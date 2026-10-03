import type { ReactNode } from 'react';
import type { Cast, Player } from './cast';
import { Figure } from './plazaParts';
import { useFeed } from './useFeed';
import './plaza.css';
import './stages.css';

export type StageKind = 'tower' | 'houses' | 'fire';
export type Time = 'day' | 'night';

type Ring = { cx: number; cy: number; rx: number; ry: number; persp: number };
type Seat = { x: number; y: number; scale: number; z: number };

// 내 자리를 맨 아래에 두고 시계방향으로 도는 좌석 배치. persp는 맨 뒤 좌석의 축소 비율.
function seats(c: Cast, r: Ring): Map<number, Seat> {
  const n = c.players.length;
  const m = new Map<number, Seat>();
  c.players.forEach((p) => {
    const a = Math.PI + ((p.seat - c.meSeat) * 2 * Math.PI) / n;
    const x = r.cx + r.rx * Math.sin(a);
    const y = r.cy - r.ry * Math.cos(a);
    const t = (y - (r.cy - r.ry)) / (2 * r.ry);
    m.set(p.seat, { x, y, scale: r.persp + (1 - r.persp) * t, z: Math.round(y * 10) });
  });
  return m;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const LEFT = 167;
const TOTAL = 300;

export function Stage({ kind, time, c, playing }: { kind: StageKind; time: Time; c: Cast; playing: boolean }) {
  const { shown, latest } = useFeed(c.feed, playing && time === 'day', 2);
  const props = { c, time, shown: time === 'day' ? shown : [], speaking: time === 'day' ? latest?.seat : undefined };
  return (
    <div className={`st st-k-${kind} st-${time} st-n${c.players.length}`}>
      {kind === 'tower' ? <TowerStage {...props} /> : kind === 'houses' ? <HouseStage {...props} /> : <FireStage {...props} />}
      <Bottom time={time} kind={kind} />
    </div>
  );
}

type StageProps = { c: Cast; time: Time; shown: { seat: number; text: string }[]; speaking?: number };

function Head({ time, children }: { time: Time; children?: ReactNode }) {
  return (
    <header className="st-head">
      <div className="st-phase">
        <span className="st-day">{time === 'day' ? '2일차 낮' : '2일차 밤'}</span>
        {children}
      </div>
      <button type="button" className="st-horn" aria-label="공지">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 10v4h3l6 4V6L7 10H4Zm12-1.5a4 4 0 0 1 0 7M18.5 6a7.5 7.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </header>
  );
}

function Bottom({ time, kind }: { time: Time; kind: StageKind }) {
  return (
    <nav className={`st-bottom ${time === 'night' || kind === 'fire' ? 'dark' : ''}`}>
      <button type="button" className="st-speak">광장에 말하기</button>
      <button type="button" className="st-whisper">
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><rect x="2.5" y="5" width="15" height="10.5" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M3 6l7 5 7-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
        귓속말
      </button>
    </nav>
  );
}

function Bubbles({ c, shown, at, lift }: { c: Cast; shown: StageProps['shown']; at: Map<number, Seat>; lift: number }) {
  return (
    <>
      {shown.map((l, i) => {
        const s = at.get(l.seat)!;
        const p = c.players.find((q) => q.seat === l.seat)!;
        const align = s.x < 30 ? 'start' : s.x > 70 ? 'end' : 'center';
        return (
          <div
            key={`${l.seat}-${l.text}`}
            className={`st-bubble ${align} ${i < shown.length - 1 ? 'old' : ''} ${p.alive ? '' : 'ghost'}`}
            style={{ left: `${s.x}%`, top: `calc(${s.y}% - ${lift * s.scale}px)`, ['--tint' as string]: p.tint }}
          >
            <b>{p.name}</b> {l.text}
          </div>
        );
      })}
    </>
  );
}

function Whisper({ a, b, className }: { a: Seat; b: Seat; className: string }) {
  const mx = (a.x + b.x) / 2;
  const my = Math.min(a.y, b.y) - 6;
  return (
    <svg className={`st-whisper-line ${className}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={`M${a.x} ${a.y - 4} Q${mx} ${my} ${b.x} ${b.y - 4}`} />
    </svg>
  );
}

function ClockFace({ time, size }: { time: Time; size: number }) {
  const frac = LEFT / TOTAL;
  const a = frac * 2 * Math.PI;
  return (
    <svg className="st-clock" width={size} height={size} viewBox="-20 -20 40 40" aria-hidden="true">
      <circle r="18" className="st-clock-rim" />
      <circle r="15.5" className="st-clock-face" />
      {time === 'day' && <path d={`M0 -13 A13 13 0 ${frac > 0.5 ? 1 : 0} 1 ${13 * Math.sin(a)} ${-13 * Math.cos(a)}`} className="st-clock-left" />}
      {Array.from({ length: 12 }, (_, i) => {
        const t = (i / 12) * 2 * Math.PI;
        return <line key={i} x1={14 * Math.sin(t)} y1={-14 * Math.cos(t)} x2={12 * Math.sin(t)} y2={-12 * Math.cos(t)} className="st-clock-tick" />;
      })}
      {time === 'day' ? (
        <line x1="0" y1="0" x2={11 * Math.sin(a)} y2={-11 * Math.cos(a)} className="st-clock-hand" />
      ) : (
        <line x1="0" y1="0" x2="0" y2="-11" className="st-clock-hand stopped" />
      )}
      <circle r="1.6" className="st-clock-hub" />
    </svg>
  );
}

function Tower({ time, height }: { time: Time; height: number }) {
  return (
    <div className="st-tower" style={{ height }}>
      <svg viewBox="0 0 60 170" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <path d="M30 0 L48 34 L12 34Z" className="st-tower-roof" />
        <rect x="12" y="34" width="36" height="20" className="st-tower-belfry" />
        <path d="M22 54 V42 a8 8 0 0 1 16 0 V54Z" className="st-tower-arch" />
        {time === 'night' && (
          <g className="st-eyes">
            <circle cx="26.5" cy="46" r="1.6" />
            <circle cx="33.5" cy="46" r="1.6" />
          </g>
        )}
        <rect x="14" y="54" width="32" height="116" className="st-tower-body" />
        <rect x="24" y="140" width="12" height="30" rx="6" className="st-tower-door" />
      </svg>
      <div className="st-tower-clock">
        <ClockFace time={time} size={46} />
        {time === 'day' && <span className="st-tower-left">{fmt(LEFT)}</span>}
      </div>
    </div>
  );
}

function Sky({ time, kind }: { time: Time; kind: StageKind }) {
  return (
    <div className="st-sky">
      {time === 'night' && <div className="st-moon" />}
      {kind !== 'fire' && (
        <svg className="st-roofline" viewBox="0 0 390 80" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 80 V50 L18 34 L36 50 V44 L58 26 L80 44 V52 L96 40 L112 52 V80Z M278 80 V48 L298 30 L318 48 V42 L340 24 L362 42 V50 L376 38 L390 50 V80Z" />
        </svg>
      )}
    </div>
  );
}

/* 가. 시계탑 아래 모임 */
function TowerStage({ c, time, shown, speaking }: StageProps) {
  const n = c.players.length;
  const at = seats(c, { cx: 50, cy: 58, rx: 41, ry: 34, persp: 0.82 });
  const base = n > 10 ? 0.86 : 1.05;
  const [w1, w2] = c.whisper.map((s) => at.get(s)!);
  return (
    <>
      <Sky time={time} kind="tower" />
      <Head time={time} />
      <div className="st-field">
        <div className="st-plaza tower" />
        <div className="st-tower-wrap" style={{ left: '50%', top: '58%' }}>
          <Tower time={time} height={n > 10 ? 210 : 230} />
        </div>
        {time === 'day' && <Whisper a={w1} b={w2} className="tower" />}
        {c.players.map((p) => {
          const s = at.get(p.seat)!;
          return (
            <Person key={p.seat} p={p} s={s} scale={s.scale * base} sleeping={time === 'night'} speaking={speaking === p.seat} whisper={time === 'day' && c.whisper.includes(p.seat)} />
          );
        })}
        <Bubbles c={c} shown={shown} at={at} lift={96 * base} />
      </div>
    </>
  );
}

function Person({ p, s, scale, sleeping, speaking, whisper }: { p: Player; s: Seat; scale: number; sleeping: boolean; speaking: boolean; whisper: boolean }) {
  return (
    <div className={`st-person ${p.alive ? '' : 'ghost'} ${p.me ? 'me' : ''} ${speaking ? 'speaking' : ''} ${whisper ? 'whisper' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: s.z + 10, ['--s' as string]: scale }}>
      <Figure p={p} sleeping={sleeping} />
      <span className="st-name">{p.me ? '나' : p.name}</span>
    </div>
  );
}

/* 나. 각자의 집 + 시계탑 */
function HouseStage({ c, time, shown, speaking }: StageProps) {
  const n = c.players.length;
  const at = seats(c, { cx: 50, cy: 55, rx: 42, ry: 37, persp: 0.8 });
  const base = n > 10 ? 0.92 : 1.12;
  const [w1, w2] = c.whisper.map((s) => at.get(s)!);
  return (
    <>
      <Sky time={time} kind="houses" />
      <Head time={time} />
      <div className="st-field">
        <div className="st-plaza houses" />
        <div className="st-tower-wrap" style={{ left: '50%', top: '55%' }}>
          <Tower time={time} height={n > 10 ? 170 : 190} />
        </div>
        {time === 'day' && <Whisper a={w1} b={w2} className="houses" />}
        {c.players.map((p) => {
          const s = at.get(p.seat)!;
          return <House key={p.seat} p={p} s={s} scale={s.scale * base} time={time} speaking={speaking === p.seat} whisper={time === 'day' && c.whisper.includes(p.seat)} />;
        })}
        <Bubbles c={c} shown={shown} at={at} lift={70 * base} />
      </div>
    </>
  );
}

function House({ p, s, scale, time, speaking, whisper }: { p: Player; s: Seat; scale: number; time: Time; speaking: boolean; whisper: boolean }) {
  const night = time === 'night';
  const lit = !night && speaking;
  return (
    <div className={`st-house ${p.alive ? '' : 'dead'} ${p.me ? 'me' : ''} ${speaking ? 'speaking' : ''} ${whisper ? 'whisper' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: s.z + 10, ['--s' as string]: scale, ['--tint' as string]: p.tint }}>
      <svg className="st-house-svg" viewBox="0 0 60 62" aria-hidden="true">
        <path d="M3 27 L30 5 L57 27Z" className="st-roof" />
        <rect x="8" y="26" width="44" height="34" className="st-wall" />
        <rect x="38" y="33" width="9" height="9" rx="1" className={`st-window ${lit ? 'lit' : ''}`} />
        <path d="M24 60 V45 a6 6 0 0 1 12 0 V60Z" className="st-door" />
        {!p.alive && (
          <g className="st-wreath">
            <circle cx="30" cy="48" r="3.4" />
            <path d="M28.5 51 L27 56 M31.5 51 L33 56" />
          </g>
        )}
        {!p.alive && <path d="M13 34 L22 42 M22 34 L13 42" className="st-board" />}
      </svg>
      {!night && p.alive && (
        <div className="st-house-person">
          <Figure p={p} />
        </div>
      )}
      {!night && !p.alive && (
        <div className="st-house-person ghost">
          <Figure p={p} />
        </div>
      )}
      {!p.alive && <span className={`st-candle ${p.ghostVote ? '' : 'out'}`} aria-label={p.ghostVote ? '유령 투표권 있음' : '유령 투표권 사용'} />}
      <span className="st-plate">{p.me ? '나' : p.name}</span>
    </div>
  );
}

/* 다. 등불 원 */
function FireStage({ c, time, shown, speaking }: StageProps) {
  const n = c.players.length;
  const at = seats(c, { cx: 50, cy: 52, rx: 40, ry: 31, persp: 0.94 });
  const base = n > 10 ? 1 : 1.18;
  const [w1, w2] = c.whisper.map((s) => at.get(s)!);
  const frac = LEFT / TOTAL;
  return (
    <>
      <div className="st-fog" />
      {time === 'night' && <div className="st-moon blood" />}
      <Head time={time}>{time === 'day' && <span className="st-left">토론 {fmt(LEFT)}</span>}</Head>
      <div className="st-field">
        <div className="st-firelight" />
        <div className="st-bonfire" style={{ left: '50%', top: '52%' }}>
          <svg viewBox="-30 -30 60 60" aria-hidden="true">
            {time === 'day' && <circle r="26" className="st-ember-track" />}
            {time === 'day' && <circle r="26" className="st-ember-left" strokeDasharray={`${frac * 163} 163`} transform="rotate(-90)" />}
            <g className="st-flame">
              <path d="M0 14 C-10 10 -9 -2 -3 -9 C-3 -3 0 -2 1 -6 C3 -12 9 -6 8 2 C11 0 11 -4 10 -6 C14 0 11 12 0 14Z" />
              <path d="M0 13 C-5 10 -4 3 0 -1 C1 3 4 4 4 8 C4 11 2 13 0 13Z" className="inner" />
            </g>
            <g className="st-logs"><rect x="-13" y="11" width="26" height="4" rx="2" transform="rotate(12)" /><rect x="-13" y="11" width="26" height="4" rx="2" transform="rotate(-12)" /></g>
          </svg>
        </div>
        {time === 'day' && <Whisper a={w1} b={w2} className="fire" />}
        {c.players.map((p) => {
          const s = at.get(p.seat)!;
          return (
            <div key={p.seat} className={`st-seat ${p.alive ? '' : 'ghost'} ${p.me ? 'me' : ''} ${speaking === p.seat ? 'speaking' : ''} ${time === 'day' && c.whisper.includes(p.seat) ? 'whisper' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: s.z + 10, ['--s' as string]: s.scale * base, ['--tint' as string]: p.tint }}>
              <span className="st-medal">
                <Figure p={p} sleeping={time === 'night'} />
              </span>
              <span className="st-name">{p.me ? '나' : p.name}</span>
            </div>
          );
        })}
        <Bubbles c={c} shown={shown} at={at} lift={58 * base} />
      </div>
    </>
  );
}
