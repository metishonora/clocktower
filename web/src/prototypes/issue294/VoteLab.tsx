import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Cast, Player } from './cast';
import { MoodBackdrop } from './MoodBackdrop';
import { Ground, horizonY, layout, type Ring } from './plazaParts';
import './voteLab.css';

export const NOMINEE = 6;
export type MeState = 'alive' | 'ghost' | 'spent';

/* ── 인물: 생존은 색 있는 사람, 유령은 투표권이 있으면 흰 유령, 쓰면 투명한 유령. 손을 들면 두 팔을 든다. */
export function VoteFigure({ p, up, ghost }: { p: Player; up: boolean; ghost?: 'available' | 'spent' }) {
  if (ghost) {
    return (
      <svg className={`vf vf-ghost ${ghost} ${up ? 'up' : ''}`} viewBox="0 0 40 64" aria-hidden="true">
        {up && <g className="vf-arms"><path d="M28 38 C32 32 34 25 33 17" /></g>}
        <path className="vf-body" d="M9 58 C8 41 11 27 20 27 C29 27 32 41 31 58 C28 55 26 60 23.5 57 C21 60 19 55 16.5 58 C14 61 12 55 9 58Z" />
        <circle className="vf-body" cx="20" cy="20" r="8.5" />
        <circle className="vf-eye" cx="17" cy="20" r="1.2" />
        <circle className="vf-eye" cx="23" cy="20" r="1.2" />
      </svg>
    );
  }
  return (
    <svg className={`vf vf-alive ${up ? 'up' : ''}`} viewBox="0 0 40 64" aria-hidden="true">
      <ellipse cx="20" cy="61" rx="12" ry="2.8" fill="rgba(40,25,15,.25)" />
      {up && <g className="vf-arms" stroke={p.tint}><path d="M27.5 37 C31 31 32.5 24 32 16" /></g>}
      {up && <circle cx="32" cy="15" r="2.6" fill="#f0d6bd" />}
      <path d="M8.5 60 C8.5 41 12 31 20 31 C28 31 31.5 41 31.5 60 Z" fill={p.tint} />
      <path d="M14.5 33.5 L20 41 L25.5 33.5" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="20" cy="22" r="8.2" fill="#f0d6bd" />
      <path d="M11.6 22.5 C11 12.5 29 12.5 28.4 22.5 C26.5 17.6 13.5 17.6 11.6 22.5Z" fill="rgba(40,28,20,.78)" />
      <circle cx="17.2" cy="23.6" r="1.05" fill="#3b2c1f" />
      <circle cx="22.8" cy="23.6" r="1.05" fill="#3b2c1f" />
    </svg>
  );
}

/* ── 공통 진행: 지명된 사람 다음 자리부터 시계방향으로 한 사람씩 확정한다. */
type Run = ReturnType<typeof useVoteRun>;
export type Prior = { seat: number; votes: number } | null;

// 지명된 사람 자리부터 시계방향으로 한 사람씩 비춘다. 빛이 머무는 동안은 바꿀 수 있고, 빛이 지나가면 확정된다.
export function useVoteRun(c: Cast, myVote: boolean, runKey: number, prior: Prior) {
  const n = c.players.length;
  const raisers = useMemo(() => new Set(n > 10 ? [7, 9, 10, 13, 1, 5] : [7, 1, 5]), [n]);
  const order = useMemo(() => {
    const i = c.players.findIndex((p) => p.seat === NOMINEE);
    return Array.from({ length: n }, (_, k) => c.players[(i + k) % n].seat);
  }, [c, n]);
  const [pos, setPos] = useState(-1);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    setPos(-1);
    setRunning(false);
    const t = window.setTimeout(() => setRunning(true), 1500);
    return () => window.clearTimeout(t);
  }, [c, runKey]);
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setPos((p) => (p >= n ? p : p + 1)), 1100);
    return () => window.clearInterval(t);
  }, [running, n]);
  const canVote = (p: Player) => !!(p.alive || p.ghostVote);
  const wants = (p: Player) => (p.me ? myVote : raisers.has(p.seat)) && canVote(p);
  const passed = (seat: number) => order.indexOf(seat) < pos;
  const lit = (seat: number) => order.indexOf(seat) === pos;
  const counted = order.filter((s) => passed(s) && wants(c.players.find((p) => p.seat === s)!));
  const me = c.players.find((p) => p.me)!;
  const locked = passed(me.seat);
  const view = (p: Player) => {
    const up = wants(p) && (passed(p.seat) || lit(p.seat) || !!p.me);
    const ghost: 'available' | 'spent' | undefined = p.alive ? undefined : p.ghostVote && !(wants(p) && passed(p.seat)) ? 'available' : 'spent';
    return { up, ghost, current: lit(p.seat), next: order[pos + 1] === p.seat, passed: passed(p.seat), voted: wants(p) && passed(p.seat) };
  };
  const majority = Math.ceil(c.alive / 2);
  // 오늘 이미 과반을 넘긴 지명이 있으면 그 표를 넘어야 처형 예정이 되고, 같으면 동점이다.
  const tie = prior && prior.votes >= majority ? prior.votes : null;
  const threshold = tie ? tie + 1 : majority;
  return { order, pos, counted, majority, tie, threshold, locked, me, view, canVote, done: pos >= n };
}

function MyVote({ run, myVote, setMyVote, meState }: { run: Run; myVote: boolean; setMyVote: (v: boolean) => void; meState: MeState }) {
  if (meState === 'spent') return <div className="vl-mine"><p className="vl-mine-note">투표권 없음</p></div>;
  if (run.locked) return <div className="vl-mine"><p className="vl-mine-note">{myVote ? '손을 들었습니다' : '손을 내렸습니다'}</p></div>;
  return (
    <div className="vl-mine">
      <button type="button" className={`vl-btn raise ${myVote ? 'on' : ''}`} aria-pressed={myVote} onClick={() => setMyVote(true)}>손 들기</button>
      <button type="button" className={`vl-btn lower ${!myVote ? 'on' : ''}`} aria-pressed={!myVote} onClick={() => setMyVote(false)}>내리기</button>
    </div>
  );
}

function Tally({ c, run, prior }: { c: Cast; run: Run; prior: Prior }) {
  const count = run.counted.length;
  const slots = Math.max(run.threshold, count);
  const state = count >= run.threshold ? 'exec' : run.tie && count === run.tie ? 'tie' : 'below';
  const priorName = prior ? c.players.find((p) => p.seat === prior.seat)!.name : '';
  return (
    <div className={`vl-tally-box ${state}`}>
      <div className="vl-tally" aria-label={`${count}표, 처형 예정 ${run.threshold}표`}>
        {Array.from({ length: slots }, (_, i) => {
          const k = i + 1;
          return (
            <i key={i} className={`${i < count ? 'on' : ''} ${k === run.tie ? 'tie' : ''} ${k === run.threshold ? 'line' : ''} ${k > run.threshold ? 'over' : ''}`}>
              {k === run.tie && <b className="vl-mark tie">동점</b>}
              {k === run.threshold && <b className="vl-mark line">처형</b>}
            </i>
          );
        })}
      </div>
      <div className="vl-tally-state">
        <strong>{count}</strong><span>/ {run.threshold}</span>
        {state === 'exec' && <em className="exec">처형 예정</em>}
        {state === 'tie' && <em className="tie">{priorName}와 동점</em>}
      </div>
    </div>
  );
}

const name = (c: Cast, seat: number) => c.players.find((p) => p.seat === seat)!.name;

/* ── 가. 해 질 녘 광장에서 투표 */
export function PlazaVote({ c, myVote, setMyVote, meState, runKey, prior }: { c: Cast; myVote: boolean; setMyVote: (v: boolean) => void; meState: MeState; runKey: number; prior: Prior }) {
  const run = useVoteRun(c, myVote, runKey, prior);
  const root = useRef<HTMLDivElement>(null);
  const square = useRef<HTMLDivElement>(null);
  const [ring, setRing] = useState<Ring>();
  const [box, setBox] = useState({ w: 390, h: 760, qx: 0, qy: 80, qw: 390, qh: 520 });
  useLayoutEffect(() => {
    const el = square.current;
    const r0 = root.current;
    if (!el || !r0) return;
    const measure = () => {
      const r = r0.getBoundingClientRect();
      const q = el.getBoundingClientRect();
      if (!q.height) return;
      const top = ((horizonY(r.width, r.height) - (q.top - r.top)) / q.height) * 100;
      const groundTop = Math.min(30, Math.max(4, top));
      const ry = (88 - groundTop - 6) / 2;
      setRing({ cy: 88 - ry, ry });
      setBox({ w: r.width, h: r.height, qx: q.left - r.left, qy: q.top - r.top, qw: q.width, qh: q.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(r0);
    return () => ro.disconnect();
  }, []);
  const spots = layout(c, { depth: 'flat', ring, center: NOMINEE });
  const seats = layout(c, { depth: 'flat', ring });
  const toPx = (s: { x: number; y: number }) => ({ x: box.qx + (s.x / 100) * box.qw, y: box.qy + (s.y / 100) * box.qh });
  const px = (seat: number) => toPx(spots.get(seat)!);
  // 빛은 자리를 비춘다. 지명된 사람은 가운데에 나와 있으므로 빈 자리를 비추고, 가운데의 본인도 함께 강조한다.
  const seatPx = (seat: number) => toPx(seat === NOMINEE ? seats.get(NOMINEE)! : spots.get(seat)!);
  const emptySeat = seats.get(NOMINEE)!;
  const curSeat = run.pos >= 0 && run.pos < run.order.length ? run.order[run.pos] : null;
  const nextSeat = run.pos + 1 < run.order.length ? run.order[run.pos + 1] : null;
  const s0 = 390 / Math.max(box.w / 390, box.h / 760);
  const scale = Math.max(box.w / 390, box.h / 760);
  const tower = { x: (box.w - 390 * scale) / 2 + 195 * scale, y: box.h - 760 * scale + 160 * scale };
  void s0;
  const cur = curSeat ? seatPx(curSeat) : null;
  const next = nextSeat ? seatPx(nextSeat) : null;
  const nomLit = curSeat === NOMINEE;
  const tallyRef = useRef<HTMLDivElement>(null);
  const [tallyPos, setTallyPos] = useState({ x: 195, y: 120 });
  useLayoutEffect(() => {
    const t = tallyRef.current?.querySelector('.vl-tally');
    const r0 = root.current;
    if (!t || !r0) return;
    const a = t.getBoundingClientRect();
    const r = r0.getBoundingClientRect();
    setTallyPos({ x: a.left - r.left + a.width / 2, y: a.top - r.top + 20 });
  }, [box, run.threshold, run.counted.length]);

  return (
    <div ref={root} className="vl vl-plaza">
      <MoodBackdrop mood="overcast" fall={0.85} />
      <header className="vl-head"><span className="vl-chip">투표</span><strong>{name(c, NOMINEE)} 처형</strong></header>
      {cur && (
        <svg className="vl-beam" width="100%" height="100%" aria-hidden="true">
          <defs><linearGradient id="vl-beam-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe3a3" stopOpacity=".05" /><stop offset="1" stopColor="#ffe3a3" stopOpacity=".38" /></linearGradient></defs>
          <polygon className="vl-beam-cone" points={`${tower.x - 4},${tower.y} ${tower.x + 4},${tower.y} ${cur.x + 26},${cur.y - 6} ${cur.x - 26},${cur.y - 6}`} fill="url(#vl-beam-g)" />
        </svg>
      )}
      <div ref={square} className="vl-square">
        <Ground depth="flat" ring={ring} well={false} />
        <div className="vl-center-spot" style={{ left: `${spots.get(NOMINEE)!.x}%`, top: `${spots.get(NOMINEE)!.y}%` }} />
        <div className={`vl-empty-seat ${nomLit ? 'lit' : ''}`} style={{ left: `${emptySeat.x}%`, top: `${emptySeat.y}%` }} aria-hidden="true" />
        {nomLit && (
          <svg className="vl-link" width="100%" height="100%" aria-hidden="true">
            <line x1={`${emptySeat.x}%`} y1={`${emptySeat.y}%`} x2={`${spots.get(NOMINEE)!.x}%`} y2={`${spots.get(NOMINEE)!.y}%`} />
          </svg>
        )}
        {cur && <div className="vl-pool" style={{ left: cur.x - box.qx, top: cur.y - box.qy }} />}
        {next && run.pos >= -1 && <div key={nextSeat} className="vl-next" style={{ left: next.x - box.qx, top: next.y - box.qy }} aria-hidden="true" />}
        {c.players.map((p) => {
          const s = spots.get(p.seat)!;
          const v = run.view(p);
          return (
            <div key={p.seat} className={`vl-person ${p.seat === NOMINEE ? 'nominee' : ''} ${v.current ? 'current' : ''} ${v.next ? 'next' : ''} ${p.me ? 'me' : ''}`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: p.seat === NOMINEE ? 500 : s.z, ['--s' as string]: s.scale }}>
              <VoteFigure p={p} up={v.up} ghost={v.ghost} />
            </div>
          );
        })}
        <div className="vl-names">
          {c.players.map((p) => {
            const s = spots.get(p.seat)!;
            const v = run.view(p);
            return <span key={p.seat} className={`${p.me ? 'me' : ''} ${p.alive ? '' : 'ghost'} ${v.ghost === 'spent' ? 'spent' : ''} ${p.seat === NOMINEE ? 'nominee' : ''} ${v.voted ? 'voted' : ''} ${v.current ? 'current' : ''} ${v.next ? 'next' : ''}`}
              style={{ left: `${s.x}%`, top: `calc(${s.y}% - ${19 * s.scale}px)` }}>{p.me ? '나' : p.name}</span>;
          })}
        </div>
      </div>
      <div ref={tallyRef} className="vl-tally-wrap"><Tally c={c} run={run} prior={prior} /></div>
      {run.counted.map((seat, i) => {
        const from = px(seat);
        const slots = Math.max(run.threshold, run.counted.length);
        const slotX = tallyPos.x + (i - (slots - 1) / 2) * 18;
        return <span key={seat} className="vl-coin" style={{ left: slotX, top: tallyPos.y, ['--dx' as string]: `${from.x - slotX}px`, ['--dy' as string]: `${from.y - 40 - tallyPos.y}px` } as CSSProperties} />;
      })}
      <MyVote run={run} myVote={myVote} setMyVote={setMyVote} meState={meState} />
    </div>
  );
}

/* ── 나. 다듬은 시계 문자판 */
export function DialVote({ c, myVote, setMyVote, meState, runKey, prior }: { c: Cast; myVote: boolean; setMyVote: (v: boolean) => void; meState: MeState; runKey: number; prior: Prior }) {
  const run = useVoteRun(c, myVote, runKey, prior);
  const n = c.players.length;
  const angle = (seat: number) => Math.PI + ((seat - c.meSeat) * 2 * Math.PI) / n;
  const cur = run.pos >= 0 && run.pos < n ? run.order[run.pos] : run.pos >= n ? run.order[n - 1] : null;
  const startA = angle(run.order[0]) - (2 * Math.PI) / n;
  const [turns, setTurns] = useState(0);
  const targetDeg = ((cur ? angle(cur) : startA) * 180) / Math.PI;
  const prev = useRef(targetDeg);
  useEffect(() => {
    // 바늘은 항상 시계방향으로만 돈다.
    if (targetDeg < prev.current - 1) setTurns((t) => t + 1);
    prev.current = targetDeg;
  }, [targetDeg]);
  const deg = targetDeg + turns * 360;
  const R = 41;
  const med = n > 10 ? 46 : 58;

  return (
    <div className="vl vl-dial">
      <header className="vl-head dark"><span className="vl-chip">투표</span><strong>{name(c, NOMINEE)} 처형</strong></header>
      <div className="vl-dial-wrap">
        <svg className="vl-face" viewBox="-120 -120 240 240" aria-hidden="true">
          <defs>
            <radialGradient id="vl-face-g" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#2a1b1e" /><stop offset="1" stopColor="#120b0d" /></radialGradient>
            <linearGradient id="vl-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f0d595" /><stop offset=".5" stopColor="#a87e3c" /><stop offset="1" stopColor="#e2c07a" /></linearGradient>
          </defs>
          <circle r="117" fill="url(#vl-brass)" />
          <circle r="112" fill="#1a1012" />
          <circle r="109" fill="url(#vl-face-g)" stroke="#a87e3c" strokeWidth=".6" />
          {Array.from({ length: 60 }, (_, i) => {
            const a = (i / 60) * Math.PI * 2;
            const r1 = i % 5 === 0 ? 100 : 104;
            return <line key={i} x1={r1 * Math.sin(a)} y1={-r1 * Math.cos(a)} x2={107 * Math.sin(a)} y2={-107 * Math.cos(a)} stroke="#c9a05c" strokeWidth={i % 5 === 0 ? 1.4 : .5} opacity=".8" />;
          })}
          <circle r="62" fill="none" stroke="#a87e3c" strokeWidth=".6" opacity=".6" />
          <circle r="58" fill="none" stroke="#a87e3c" strokeWidth=".3" opacity=".5" strokeDasharray="1 3" />
          {/* 지나간 자리를 따라 남는 금빛 호 */}
          {run.pos >= 0 && (() => {
            const a0 = startA + (2 * Math.PI) / n / 2;
            const a1 = angle(run.order[Math.min(run.pos, n - 1)]);
            const span = ((a1 - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
            const r = 62;
            const x0 = r * Math.sin(a0), y0 = -r * Math.cos(a0), x1 = r * Math.sin(a0 + span), y1 = -r * Math.cos(a0 + span);
            return <path d={`M${x0} ${y0} A${r} ${r} 0 ${span > Math.PI ? 1 : 0} 1 ${x1} ${y1}`} fill="none" stroke="#f0d595" strokeWidth="2.4" strokeLinecap="round" opacity=".8" />;
          })()}
        </svg>
        <div className="vl-hand" style={{ transform: `rotate(${deg}deg)` }} aria-hidden="true">
          <svg viewBox="-120 -120 240 240">
            <path d="M0 20 L0 -40" stroke="#d9b56a" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M0 -60 L6 -47 L0 -41 L-6 -47Z" fill="#f0d595" />
            <path d="M0 -41 C7 -37 7 -30 0 -27 C-7 -30 -7 -37 0 -41Z" fill="none" stroke="#e2c07a" strokeWidth="1.3" />
            <circle cy="20" r="6" fill="#c9a05c" />
            <circle cy="20" r="2.4" fill="#1a1012" />
            <circle r="6.5" fill="#e2c07a" />
            <circle r="2.4" fill="#1a1012" />
          </svg>
        </div>
        {c.players.map((p) => {
          const a = angle(p.seat);
          const v = run.view(p);
          return (
            <div key={p.seat} className={`vl-medal ${p.alive ? '' : 'is-ghost'} ${v.ghost ?? ''} ${p.seat === NOMINEE ? 'nominee' : ''} ${p.me ? 'me' : ''} ${v.current ? 'current' : ''} ${v.voted ? 'voted' : ''} ${v.next ? 'next' : ''}`}
              style={{ left: `${50 + R * Math.sin(a)}%`, top: `${50 - R * Math.cos(a)}%`, width: med, height: med }}>
              <span className="vl-medal-face"><VoteFigure p={p} up={v.up} ghost={v.ghost} /></span>
              <span className="vl-medal-name">{p.me ? '나' : p.name}</span>
            </div>
          );
        })}
        <div className="vl-dial-center"><Tally c={c} run={run} prior={prior} /></div>
      </div>
      <MyVote run={run} myVote={myVote} setMyVote={setMyVote} meState={meState} />
    </div>
  );
}
