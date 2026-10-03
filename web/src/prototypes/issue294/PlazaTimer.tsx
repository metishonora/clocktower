import { useEffect, useState } from 'react';
import { dayLabel } from './cast';
import { Sun } from './plazaParts';
import './timer.css';

export type TimerSnapshot = { deadline: number; duration: number; revision: number; added: boolean };
export const timerSnapshot = (seconds = 168, revision = 0): TimerSnapshot => ({
  deadline: Date.now() + seconds * 1000, duration: 180, revision, added: false,
});

// Only this readout ticks. Chat drafts, focus and the square do not rerender every second.
export function PlazaTimer({ snapshot }: { snapshot: TimerSnapshot }) {
  const secondsLeft = () => Math.max(0, Math.ceil((snapshot.deadline - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(secondsLeft);
  const [showAddition, setShowAddition] = useState(snapshot.added);
  useEffect(() => {
    if (secondsLeft() === 0) return;
    const tick = () => {
      const left = secondsLeft();
      setSeconds(left);
      if (left === 0) window.clearInterval(interval);
    };
    const interval = window.setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [snapshot.deadline]);
  useEffect(() => {
    if (!snapshot.added) return;
    const timeout = window.setTimeout(() => setShowAddition(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [snapshot.added]);

  const level = seconds === 0 ? 'ended' : seconds <= 10 ? 'urgent' : seconds <= 60 ? 'soon' : 'normal';
  const display = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const progress = Math.min(1, seconds / snapshot.duration);
  const status = seconds === 0 ? '토론 시간이 종료되었습니다.' : seconds <= 10 ? '토론 시간이 10초 이하로 남았습니다.' : seconds <= 60 ? '토론 시간이 1분 이하로 남았습니다.' : '';

  return <div className={`tr-time tr-${level}`}>
    <span className="tr-day"><Sun /><span className="pz-day">{dayLabel}</span></span>
    <span key={level} className="tr-readout" role="timer" aria-live="off" aria-label={seconds === 0 ? '토론 시간 종료' : `토론 ${Math.floor(seconds / 60)}분 ${seconds % 60}초 남음`}>
      <svg className="tr-ring" viewBox="0 0 28 28" aria-hidden="true">
        <circle className="tr-ring-track" cx="14" cy="14" r="11" />
        <circle className="tr-ring-value" cx="14" cy="14" r="11" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress * 100} />
        <path className="tr-clock-hands" d="M14 8.5V14L17.5 16" />
      </svg>
      <span className={`tr-label ${showAddition ? 'tr-added' : ''}`}>{showAddition ? '+1분' : seconds === 0 ? '종료' : '토론'}</span>
      <strong className="tr-digits">{display}</strong>
    </span>
    <span className="tr-sr-only" role="status">{showAddition ? '토론 시간이 1분 추가되었습니다.' : status}</span>
  </div>;
}
