import { useEffect, useState } from 'react';
import { dayLabel, discussion, role, type Cast } from './cast';
import { useFeed } from './useFeed';
import './clock.css';

const C = 200;
const polar = (r: number, a: number) => ({ x: C + r * Math.sin(a), y: C - r * Math.cos(a) });

function arc(r: number, frac: number) {
  if (frac <= 0) return '';
  const f = Math.min(frac, 0.9999);
  const end = polar(r, f * 2 * Math.PI);
  return `M${C} ${C - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

function useCountdown(start: number, running: boolean) {
  const [left, setLeft] = useState(start);
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setLeft((l) => (l <= 1 ? start : l - 1)), 1000);
    return () => window.clearInterval(t);
  }, [running, start]);
  return left;
}

export function Clock({ c, playing, wide = false }: { c: Cast; playing: boolean; wide?: boolean }) {
  const n = c.players.length;
  const medR = n > 10 ? 16 : 23;
  const seatR = n > 10 ? 150 : 146;
  const angle = (seat: number) => ((seat - 1) * 2 * Math.PI) / n;
  const { shown, latest } = useFeed(c.feed, playing, wide ? 4 : 3);
  const left = useCountdown(discussion.left, playing);
  const frac = left / discussion.total;
  const hand = polar(100, frac * 2 * Math.PI);
  const [wa, wb] = c.whisper.map((s) => polar(seatR - medR - 4, angle(s)));
  const chord = `M${wa.x} ${wa.y} Q${C} ${C} ${wb.x} ${wb.y}`;

  return (
    <div className={`ck ${wide ? 'ck-wide' : ''}`}>
      <header className="ck-head">
        <div className="ck-title">
          <span className="ck-day">{dayLabel}</span>
          <span className="ck-phase">토론</span>
        </div>
        <button className="ck-role" type="button">
          <img src={role.icon} alt="" />
          {role.name}
        </button>
      </header>

      <div className="ck-body">
        <div className="ck-dial-wrap">
          <svg className="ck-dial" viewBox="0 0 400 400" role="img" aria-label="시계탑 광장">
            <defs>
              <radialGradient id="ck-face" cx="50%" cy="42%" r="60%">
                <stop offset="0" stopColor="#fbf5e6" />
                <stop offset="1" stopColor="#e9dcc0" />
              </radialGradient>
              <linearGradient id="ck-brass" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#e6c77f" />
                <stop offset=".5" stopColor="#a8823d" />
                <stop offset="1" stopColor="#d9b56a" />
              </linearGradient>
              <path id="ck-env" d="M-7 -5h14v10h-14z M-7 -5l7 5.5 7-5.5" />
            </defs>

            <circle cx={C} cy={C} r="194" fill="url(#ck-brass)" />
            <circle cx={C} cy={C} r="184" fill="#2a2216" opacity=".35" />
            <circle cx={C} cy={C} r="181" fill="url(#ck-face)" />
            {Array.from({ length: 60 }, (_, i) => {
              const a = (i / 60) * 2 * Math.PI;
              const p1 = polar(181, a);
              const p2 = polar(i % 5 === 0 ? 172 : 176, a);
              return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className={i % 5 === 0 ? 'ck-tick major' : 'ck-tick'} />;
            })}
            <circle cx={C} cy={C} r="112" className="ck-inner" />

            <circle cx={C} cy={C} r="112" className="ck-track" />
            <path d={arc(112, frac)} className="ck-remaining" />
            <path d={chord} className="ck-chord" />
            <g className="ck-envelope">
              <use href="#ck-env" />
              <animateMotion dur="2.6s" repeatCount="indefinite" path={chord} />
            </g>

            {c.players.map((p) => {
              const a = angle(p.seat);
              const pos = polar(seatR, a);
              const label = polar(seatR - medR - (n > 10 ? 13 : 17), a);
              const pip = polar(seatR + medR + 7, a);
              const speaking = latest?.seat === p.seat;
              return (
                <g key={p.seat} className={`ck-seat ${p.alive ? '' : 'dead'} ${p.me ? 'me' : ''} ${speaking ? 'speaking' : ''}`}>
                  {speaking && <circle cx={pos.x} cy={pos.y} r={medR + 4} className="ck-pulse" />}
                  {p.me && <circle cx={pos.x} cy={pos.y} r={medR + 5} className="ck-me-ring" />}
                  <circle cx={pos.x} cy={pos.y} r={medR} className="ck-medal" />
                  <circle cx={pos.x} cy={pos.y} r={medR - 3.5} className="ck-medal-in" />
                  <text x={pos.x} y={pos.y} className="ck-initial" style={{ fontSize: medR * 0.82 }}>
                    {p.name[0]}
                  </text>
                  {!p.alive && <path d={`M${pos.x - medR} ${pos.y} A${medR} ${medR} 0 0 1 ${pos.x + medR} ${pos.y}Z`} className="ck-shroud" />}
                  <text x={label.x} y={label.y} className="ck-name" style={{ fontSize: n > 10 ? 10.5 : 12.5 }}>
                    {p.me ? '나' : p.name}
                  </text>
                  {!p.alive && <circle cx={pip.x} cy={pip.y} r="4" className={p.ghostVote ? 'ck-pip' : 'ck-pip used'} />}
                </g>
              );
            })}

            <line x1={C} y1={C} x2={hand.x} y2={hand.y} className="ck-hand" />
            <circle cx={C} cy={C} r="8" fill="url(#ck-brass)" />
            <circle cx={C} cy={C} r="3" fill="#2a2216" />
            <rect x={C - 58} y={C + 24} width="116" height="50" rx="10" className="ck-plate" />
            <text x={C} y={C + 46} className="ck-left">
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
            </text>
            <text x={C} y={C + 62} className="ck-left-sub">
              생존 {c.alive} · 처형 {c.needed}표
            </text>
          </svg>
        </div>

        <ol className="ck-plaques">
          {shown.map((l, i) => {
            const p = c.players.find((q) => q.seat === l.seat)!;
            return (
              <li key={`${l.seat}-${l.text}`} className={`${i < shown.length - 1 ? 'old' : ''} ${p.alive ? '' : 'ghost'}`}>
                <span className="ck-plaque-seat">{p.name}</span>
                <span className="ck-plaque-text">{l.text}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <nav className="ck-actions">
        <button type="button" className="ck-act">기록</button>
        <button type="button" className="ck-speak">말하기</button>
        <button type="button" className="ck-act">귓속말</button>
      </nav>
    </div>
  );
}
