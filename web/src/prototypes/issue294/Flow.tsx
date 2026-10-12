import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Cast, Player } from './cast';
import { MoodBackdrop } from './MoodBackdrop';
import { Ground, horizonY, layout, type Ring } from './plazaParts';
import { Portrait } from './Trial';
import { VoteFigure } from './VoteLab';
import './flow.css';

// 광장과 재판정을 한 세계로 잇는 전환 시안. ① 광장 → 지명, ④ 재판정 → 광장 투표, ⑥ 광장 위 처형.
export const NOMINATOR = 2; // 광장을 가로지르도록 지호와 떨어진 자리
export const NOMINEE = 6;

export type Phase =
  | 'plaza' | 'point' | 'hit' | 'zoom' | 'cutin'
  | 'testimony' | 'pullback' | 'bell' | 'sweep' | 'result'
  | 'confirm' | 'rise' | 'stamp' | 'ash' | 'end';
export const phases: Phase[] = ['plaza', 'point', 'hit', 'zoom', 'cutin', 'testimony', 'pullback', 'bell', 'sweep', 'result', 'confirm', 'rise', 'stamp', 'ash', 'end'];
const durations: Partial<Record<Phase, number>> = {
  plaza: 1300, point: 1300, hit: 320, zoom: 900, cutin: 1700,
  testimony: 2400, pullback: 1500, bell: 1300, result: 1900,
  confirm: 1000, rise: 1000, stamp: 1300, ash: 1900,
};
const STEP = 480;

type Pt = { x: number; y: number };
const backdropPoint = (w: number, h: number, x: number, y: number): Pt => {
  const s = Math.max(w / 390, h / 760);
  return { x: (w - 390 * s) / 2 + x * s, y: h - 760 * s + y * s };
};

export function Flow({ c, start, runKey, onPhase }: { c: Cast; start: Phase; runKey: number; onPhase?: (p: Phase) => void }) {
  const [phase, setPhase] = useState<Phase>(start);
  const [sweep, setSweep] = useState(-1);
  const [crit, setCrit] = useState(false);
  useEffect(() => { setPhase(start); setSweep(-1); }, [start, runKey]);
  useEffect(() => { onPhase?.(phase); }, [phase, onPhase]);

  const n = c.players.length;
  const raisers = useMemo(() => new Set(n > 10 ? [7, 9, 10, 13, 1, 5] : [7, 1, 5]), [n]);
  const order = useMemo(() => {
    const i = c.players.findIndex((p) => p.seat === NOMINEE);
    return Array.from({ length: n }, (_, k) => c.players[(i + k) % n].seat);
  }, [c, n]);
  const threshold = Math.ceil(c.alive / 2);

  // 장면 진행
  useEffect(() => {
    if (phase === 'sweep') {
      setSweep(0);
      const t = window.setInterval(() => setSweep((s) => s + 1), STEP);
      return () => window.clearInterval(t);
    }
    const d = durations[phase];
    if (!d) return;
    const t = window.setTimeout(() => setPhase(phases[phases.indexOf(phase) + 1]), d);
    return () => window.clearTimeout(t);
  }, [phase, runKey]);
  useEffect(() => {
    if (phase === 'sweep' && sweep >= n) setPhase('result');
  }, [phase, sweep, n]);

  const at = (p: Phase) => phases.indexOf(phase) >= phases.indexOf(p);
  const between = (a: Phase, b: Phase) => { const next = phases[phases.indexOf(b) + 1]; return at(a) && (!next || !at(next)); };
  const swept = (seat: number) => (phase === 'sweep' ? order.indexOf(seat) < sweep : at('result'));
  const raised = (p: Player) => raisers.has(p.seat) && (p.alive || p.ghostVote);
  const counted = order.filter((s) => swept(s) && raised(c.players.find((p) => p.seat === s)!)).length;

  // 처형 선을 넘는 순간 짧게 멈추고 붉게 맥동한다.
  const prevCount = useRef(0);
  useEffect(() => {
    if (counted >= threshold && prevCount.current < threshold && phase === 'sweep') {
      setCrit(true);
      const t = window.setTimeout(() => setCrit(false), 520);
      prevCount.current = counted;
      return () => window.clearTimeout(t);
    }
    prevCount.current = counted;
  }, [counted, threshold, phase]);

  // 좌표
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
      const g = Math.min(30, Math.max(4, top));
      const ry = (88 - g - 6) / 2;
      setRing({ cy: 88 - ry, ry });
      setBox({ w: r.width, h: r.height, qx: q.left - r.left, qy: q.top - r.top, qw: q.width, qh: q.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(r0);
    return () => ro.disconnect();
  }, []);

  const onStage = between('pullback', 'sweep');
  const executed = at('ash');
  const cast2: Cast = executed ? { ...c, players: c.players.map((p) => (p.seat === NOMINEE ? { ...p, alive: false, ghostVote: true } : p)) } : c;
  const spots = layout(cast2, { depth: 'flat', ring, center: onStage ? NOMINEE : undefined });
  const seats = layout(cast2, { depth: 'flat', ring });
  const toPx = (s: { x: number; y: number }): Pt => ({ x: box.qx + (s.x / 100) * box.qw, y: box.qy + (s.y / 100) * box.qh });
  const px = (seat: number) => toPx(spots.get(seat)!);
  const head = (seat: number) => { const p = px(seat); const s = spots.get(seat)!; return { x: p.x, y: p.y - 46 * s.scale }; };
  const tower = backdropPoint(box.w, box.h, 195, 158);
  const litSeat = phase === 'sweep' && sweep >= 0 && sweep < n ? order[sweep] : null;
  const litPx = litSeat ? toPx((litSeat === NOMINEE ? seats : spots).get(litSeat)!) : null;
  const pair = new Set([NOMINATOR, NOMINEE]);
  const desat = between('hit', 'zoom');
  const focusNominee = between('confirm', 'ash');

  // 컷인 초상화: 광장의 인물 자리에서 띠 위치로 날아간다.
  const bandPos = (who: 'a' | 'b') => (who === 'a' ? { x: box.w * 0.32, y: box.h * 0.3, w: box.w * 0.52 } : { x: box.w * 0.68, y: box.h * 0.72, w: box.w * 0.52 });
  const figPos = (seat: number) => { const h = head(seat); return { x: h.x, y: h.y, w: 36 }; };
  const portraitStyle = (seat: number, who: 'a' | 'b'): CSSProperties => {
    const p = at('zoom') ? bandPos(who) : figPos(seat);
    return { left: p.x, top: p.y, width: p.w, opacity: at('zoom') ? 1 : phase === 'hit' ? 0.9 : 0 };
  };
  const yuna = c.players.find((p) => p.seat === NOMINATOR)!;
  const jiho = c.players.find((p) => p.seat === NOMINEE)!;

  // 처형 초상화: 지호 머리 위에서 떠올라 화면 가운데로.
  const execStyle = (): CSSProperties => {
    const h = head(NOMINEE);
    if (!at('rise')) return { left: h.x, top: h.y, width: 30, opacity: 0 };
    return { left: box.w / 2, top: box.h * 0.42, width: box.w * 0.56, opacity: 1 };
  };

  const plazaClass = ['fl-plaza', phase === 'pullback' ? 'pulling' : '', between('testimony', 'testimony') ? 'hidden' : ''].join(' ');
  const jihoPx = px(NOMINEE);

  return (
    <div ref={root} className={`fl fl-p-${phase} ${crit ? 'crit' : ''}`} style={{ ['--ox' as string]: `${jihoPx.x}px`, ['--oy' as string]: `${jihoPx.y}px` }}>
      {/* 광장: 언제나 뒤에 살아 있다 */}
      <div className={plazaClass}>
        <MoodBackdrop mood="overcast" fall={at('pullback') ? 0.85 : 0.55} />
        <div ref={square} className="fl-square">
          <Ground depth="flat" ring={ring} well={false} />
          {between('bell', 'sweep') && <div className="fl-empty" style={{ left: `${seats.get(NOMINEE)!.x}%`, top: `${seats.get(NOMINEE)!.y}%` }} />}
          {litPx && <div className="fl-pool" style={{ left: litPx.x - box.qx, top: litPx.y - box.qy }} />}
          {cast2.players.map((p) => {
            const s = spots.get(p.seat)!;
            const up = (phase === 'point' || phase === 'hit') && p.seat === NOMINATOR ? true : at('sweep') && !at('confirm') && raised(p) && swept(p.seat);
            const ghost = p.alive ? undefined : p.ghostVote && !(raised(p) && swept(p.seat) && at('sweep')) ? 'available' : 'spent';
            const dim = (desat && !pair.has(p.seat)) || (focusNominee && p.seat !== NOMINEE);
            return (
              <div key={p.seat} className={`fl-person ${dim ? 'dim' : ''} ${p.seat === NOMINEE ? 'nominee' : ''} ${litSeat === p.seat || (litSeat === NOMINEE && p.seat === NOMINEE) ? 'lit' : ''} ${p.seat === NOMINEE && phase === 'ash' ? 'turning' : ''}`}
                style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: s.z + 10, ['--s' as string]: s.scale }}>
                <VoteFigure p={p} up={!!up} ghost={ghost as 'available' | 'spent' | undefined} />
              </div>
            );
          })}
          <div className="fl-names">
            {cast2.players.map((p) => {
              const s = spots.get(p.seat)!;
              const dim = (desat && !pair.has(p.seat)) || (focusNominee && p.seat !== NOMINEE);
              return <span key={p.seat} className={`${p.me ? 'me' : ''} ${p.alive ? '' : 'ghost'} ${p.seat === NOMINEE && at('point') ? 'nominee' : ''} ${dim ? 'dim' : ''}`}
                style={{ left: `${s.x}%`, top: `calc(${s.y}% - ${19 * s.scale}px)` }}>{p.me ? '나' : p.name}</span>;
            })}
          </div>
        </div>
      </div>

      {/* ① 지명: 손가락 끝에서 붉은 선이 꽂힌다 */}
      {between('point', 'hit') && (() => {
        const a = head(NOMINATOR);
        const b = head(NOMINEE);
        return (
          <svg className="fl-accuse" width="100%" height="100%" aria-hidden="true">
            <line x1={a.x + 12} y1={a.y - 14} x2={b.x} y2={b.y + 10} pathLength={100} />
            <circle cx={b.x} cy={b.y + 10} r="16" />
          </svg>
        );
      })()}
      {phase === 'hit' && <div className="fl-flash" />}

      {/* 컷인 */}
      {between('hit', 'cutin') && (
        <div className="fl-cutin">
          <div className="fl-band a" />
          <div className="fl-band b" />
          <div className="fl-portrait" style={portraitStyle(NOMINATOR, 'a')}><Portrait p={yuna} /></div>
          <div className="fl-portrait" style={portraitStyle(NOMINEE, 'b')}><Portrait p={jiho} /></div>
          <span className="fl-band-name a">{yuna.name}</span>
          <span className="fl-band-name b">{jiho.name}</span>
          <div className="fl-slash"><strong>지명</strong></div>
        </div>
      )}

      {/* 증언대(요약) → 카메라가 빠지며 광장으로 */}
      {between('testimony', 'pullback') && (
        <div className="fl-trial">
          <div className="fl-trial-spot" />
          <div className="fl-trial-portrait"><Portrait p={jiho} talking={phase === 'testimony'} /></div>
          <section className="fl-trial-dialog">
            <span>{jiho.name}</span>
            <p>나는 유나를 지켰을 뿐이야. 나를 처형하면 수도승만 잃어.</p>
          </section>
        </div>
      )}

      {/* ④ 종과 빛줄기, 떨어지는 표 슬롯 */}
      {between('bell', 'bell') && [0, 1, 2].map((i) => <span key={i} className="fl-bell" style={{ left: tower.x, top: tower.y, animationDelay: `${i * 0.28}s` }} />)}
      {litPx && (
        <svg className="fl-beam" width="100%" height="100%" aria-hidden="true">
          <defs><linearGradient id="fl-beam-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe3a3" stopOpacity=".05" /><stop offset="1" stopColor="#ffe3a3" stopOpacity=".4" /></linearGradient></defs>
          <polygon points={`${tower.x - 4},${tower.y} ${tower.x + 4},${tower.y} ${litPx.x + 26},${litPx.y - 6} ${litPx.x - 26},${litPx.y - 6}`} fill="url(#fl-beam-g)" />
        </svg>
      )}
      {between('bell', 'result') && (
        <div className={`fl-tally ${at('result') ? 'center' : ''} ${counted >= threshold ? 'exec' : ''}`} style={at('result') ? { top: box.qy + ((ring?.cy ?? 58) / 100) * box.qh } : undefined}>
          <div className="fl-slots">
            {Array.from({ length: Math.max(threshold, counted) }, (_, i) => (
              <i key={i} className={`${i < counted ? 'on' : ''} ${i + 1 === threshold ? 'line' : ''}`} style={{ animationDelay: `${0.5 + i * 0.07}s` }} />
            ))}
          </div>
          <div className="fl-count"><strong>{counted}</strong><span>/ {threshold}</span>{counted >= threshold && <em>처형 예정</em>}</div>
        </div>
      )}

      {/* ⑥ 광장 위 처형 */}
      {between('confirm', 'ash') && <div className="fl-converge" />}
      {between('confirm', 'ash') && (
        <div className={`fl-exec ${phase === 'ash' ? 'ashing' : ''}`} style={execStyle()}>
          <Portrait p={jiho} />
          {at('stamp') && <span className="fl-stamp">처형</span>}
        </div>
      )}
      {phase === 'ash' && <Ash x={box.w / 2} y={box.h * 0.42} w={box.w * 0.56} />}
      {between('stamp', 'end') && <p className="fl-verdict">{jiho.name}가 처형되었습니다</p>}

      <header className="fl-head">
        {at('bell') && !at('confirm') ? <><span className="fl-chip">투표</span><strong>{jiho.name} 처형</strong></> : <strong>2일차 낮</strong>}
      </header>
    </div>
  );
}

function Ash({ x, y, w }: { x: number; y: number; w: number }) {
  const bits = useMemo(() => Array.from({ length: 34 }, (_, i) => {
    const a = (i * 137.5 * Math.PI) / 180;
    const r = (i % 7) / 7;
    return { sx: Math.cos(a) * r * w * 0.42, sy: Math.sin(a) * r * w * 0.55, dx: 40 + (i % 5) * 26, dy: -120 - (i % 6) * 34, s: 3 + (i % 4) * 2, d: (i % 9) * 0.05 };
  }), [w]);
  return (
    <div className="fl-ash" style={{ left: x, top: y }} aria-hidden="true">
      {bits.map((b, i) => <i key={i} style={{ left: b.sx, top: b.sy, width: b.s, height: b.s, animationDelay: `${0.25 + b.d}s`, ['--dx' as string]: `${b.dx}px`, ['--dy' as string]: `${b.dy}px` } as CSSProperties} />)}
    </div>
  );
}
