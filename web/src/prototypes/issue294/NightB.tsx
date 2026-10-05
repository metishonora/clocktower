import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Cast, Player } from './cast';
import { asset } from './fixture';
import { MoodBackdrop, moodForSurvivors } from './MoodBackdrop';
import { EnvelopeIcon, Figure, Ground, horizonY, layout, Moon, type Ring } from './plazaParts';
import './plaza.css';
import './nightB.css';

export type NightBStep = 'dusk' | 'wait' | 'choose' | 'sent' | 'letter' | 'open' | 'kept' | 'dawn';
export const EXECUTED = 6;
const NIGHT_DEATH = 1;
const role = { name: '점쟁이', icon: asset('characters/tb/fortuneteller_g.webp') };
const ANSWER = '예';

type Pt = { x: number; y: number };
// 배경(390×760, xMidYMax slice) 좌표를 화면 좌표로 바꾼다.
function backdropPoint(w: number, h: number, x: number, y: number): Pt {
  const s = Math.max(w / 390, h / 760);
  return { x: (w - 390 * s) / 2 + x * s, y: h - 760 * s + y * s };
}
const WINDOWS: [number, number][] = [[22, 231], [76, 237], [304, 231], [258, 241]];

export function NightB({ base, step, picked, onPick, onSend, onOpen, onConfirm, onReopen }: {
  base: Cast; step: NightBStep; picked: number[];
  onPick: (seat: number) => void; onSend: () => void; onOpen: () => void; onConfirm: () => void; onReopen: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const square = useRef<HTMLDivElement>(null);
  const [ring, setRing] = useState<Ring>();
  const [box, setBox] = useState({ w: 390, h: 760, qx: 0, qy: 74, qw: 390, qh: 520 });
  const [asleep, setAsleep] = useState(step === 'dusk' ? 0 : 99);
  const [belled, setBelled] = useState(step !== 'dusk');

  // 공개 사실만 반영한다: 처형은 저물기 전에, 밤사이 죽음은 새벽에야 드러난다.
  const executedNow = step !== 'dusk' || belled;
  const nightDeathShown = step === 'dawn';
  const c: Cast = (() => {
    const players = base.players.map((p) => p.seat === EXECUTED ? { ...p, alive: !executedNow } : p.seat === NIGHT_DEATH && nightDeathShown ? { ...p, alive: false } : p);
    const alive = players.filter((p) => p.alive).length;
    return { ...base, players, alive };
  })();
  const beforeAlive = base.players.filter((p) => p.alive).length;
  const moodBefore = moodForSurvivors(beforeAlive, base.players.length);
  const moodNow = moodForSurvivors(c.alive, base.players.length);

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

  // 저무는 연출: 종이 울리면 처형이 반영되고, 사람들이 차례로 눈을 감는다.
  useEffect(() => {
    if (step !== 'dusk') { setAsleep(99); setBelled(true); return; }
    setAsleep(0);
    setBelled(false);
    const bell = window.setTimeout(() => setBelled(true), 900);
    let t: number | undefined;
    const close = window.setTimeout(() => {
      t = window.setInterval(() => setAsleep((n) => n + 1), 140);
    }, 2600);
    return () => { window.clearTimeout(bell); window.clearTimeout(close); if (t) window.clearInterval(t); };
  }, [step]);

  const spots = layout(c, { depth: 'flat', ring });
  const me = spots.get(c.meSeat)!;
  const mePx = { x: box.qx + (me.x / 100) * box.qw, y: box.qy + (me.y / 100) * box.qh };
  const tower = backdropPoint(box.w, box.h, 195, 158);
  const night = step !== 'dawn';
  const awake = step === 'choose';
  const order = [...c.players].sort((a, b) => spots.get(b.seat)!.y - spots.get(a.seat)!.y);
  const sleeping = (p: Player) => {
    if (step === 'dawn') return false;
    if (p.me && awake) return false;
    if (step === 'dusk') return order.findIndex((q) => q.seat === p.seat) < asleep;
    return true;
  };
  const name = (seat: number) => c.players.find((p) => p.seat === seat)!.name;

  return (
    <div ref={root} className={`pz nb nb-s-${step} ${awake ? 'nb-awake' : ''}`} style={{ ['--mx' as string]: `${mePx.x}px`, ['--my' as string]: `${mePx.y - 30}px` }}>
      <div className={`nb-backdrop ${belled ? 'hide' : ''}`}><MoodBackdrop mood={moodBefore} fall={0.9} /></div>
      <div className={`nb-backdrop ${belled ? '' : 'hide'}`}><MoodBackdrop mood={moodNow} fall={step === 'dawn' ? 0 : 0.9} /></div>

      {/* 밤하늘: 위에서부터 덮이고, 새벽에는 아래에서부터 걷힌다 */}
      <div className="nb-nightsky" />
      <div className="nb-stars" />
      <div className="nb-moon" style={{ left: box.w * 0.7, top: horizonY(box.w, box.h) - 70 }} />
      {step === 'dusk' && WINDOWS.map(([x, y], i) => {
        const p = backdropPoint(box.w, box.h, x, y);
        return <span key={i} className="nb-window" style={{ left: p.x, top: p.y, animationDelay: `${1.4 + i * 0.25}s` }} />;
      })}
      {step === 'dusk' && [0, 1, 2].map((i) => <span key={i} className="nb-bell" style={{ left: tower.x, top: tower.y, animationDelay: `${0.9 + i * 0.35}s` }} />)}
      {step === 'dawn' && <div className="nb-sunrise" />}

      <header className="pz-head nb-head">
        <div className="pz-time nb-time">{night ? <Moon /> : <Sun />}<span className="pz-day">{night ? '2일차 밤' : '3일차 아침'}</span></div>
        <button type="button" className="nb-horn" aria-label="공지"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 10v4h3l6 4V6L7 10H4Zm12-1.5a4 4 0 0 1 0 7M18.5 6a7.5 7.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      </header>

      <div ref={square} className="nb-square">
        <Ground depth="flat" ring={ring} well={false} />
        {c.players.map((p) => {
          const s = spots.get(p.seat)!;
          const pick = picked.indexOf(p.seat);
          const turning = step === 'dusk' && p.seat === EXECUTED;
          return (
            <div key={p.seat} className={`pz-person nb-person ${p.me ? 'me' : ''} ${p.alive ? '' : 'ghost'} ${pick >= 0 && awake ? 'picked' : ''} ${turning ? 'turning' : ''}`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: s.z, ['--s' as string]: s.scale }}>
              {turning ? (
                <span className="nb-turn">
                  <span className="was"><Figure p={{ ...p, alive: true }} /></span>
                  <span className="now"><Figure p={{ ...p, alive: false, ghostVote: true }} sleeping={sleeping(p)} /></span>
                </span>
              ) : <Figure p={p} sleeping={sleeping(p)} />}
            </div>
          );
        })}
        <div className="nb-names">
          {c.players.map((p) => {
            const s = spots.get(p.seat)!;
            const pick = picked.includes(p.seat);
            const style = { left: `${s.x}%`, top: `calc(${s.y}% - ${19 * s.scale}px)` };
            const cls = `nb-name ${p.me ? 'me' : ''} ${p.alive ? '' : 'ghost'} ${pick && awake ? 'picked' : ''}`;
            return awake ? (
              <button key={p.seat} type="button" className={cls} style={style} onClick={() => onPick(p.seat)} aria-pressed={pick}>{pick && <b className="nb-order">{picked.indexOf(p.seat) + 1}</b>}{p.me ? '나' : p.name}</button>
            ) : (
              <span key={p.seat} className={cls} style={style}>
                {p.me ? '나' : p.name}
                {p.me && (step === 'kept' || step === 'dawn') && (
                  <button type="button" className="nb-keep-btn" onClick={onReopen} aria-label="받은 정보 다시 보기"><EnvelopeIcon /></button>
                )}
              </span>
            );
          })}
        </div>
        {awake && c.players.map((p) => {
          const s = spots.get(p.seat)!;
          return <button key={p.seat} type="button" className="nb-hit" style={{ left: `${s.x}%`, top: `${s.y}%`, height: 80 * s.scale }} onClick={() => onPick(p.seat)} aria-label={`${p.name} 선택`} />;
        })}
      </div>

      {/* 어둠: 모두에게 같은 잠든 마을. 깨어나면 내 자리에서부터 걷힌다(내 기기에서만). */}
      <div className="nb-dark" />
      <div className="nb-lantern" />

      {step === 'letter' && <Crow from={tower} to={{ x: mePx.x + 26, y: mePx.y - 8 }} />}
      {(step === 'letter') && (
        <button type="button" className="nb-envelope" style={{ left: mePx.x + 26, top: mePx.y - 8 }} onClick={onOpen} aria-label="이야기꾼의 편지 열기">
          <span className="nb-letter-paper" /><span className="nb-letter-seal" />
        </button>
      )}

      {awake && (
        <section className="nb-band" aria-label="점쟁이 선택">
          <img src={role.icon} alt="" />
          <strong>두 사람</strong>
          <span className="nb-chips">
            {[0, 1].map((i) => picked[i] !== undefined
              ? <button key={i} type="button" className="nb-chip" onClick={() => onPick(picked[i])}>{name(picked[i])}</button>
              : <span key={i} className="nb-chip empty" />)}
          </span>
          <button type="button" className="nb-send" disabled={picked.length < 2} onClick={onSend}>보내기</button>
        </section>
      )}
      {step === 'sent' && <section className="nb-band done"><span className="nb-check">✓</span>{picked.map(name).join(' · ')}</section>}

      {step === 'open' && (
        <div className="nb-scroll-wrap">
          <article className="nb-scroll">
            <span className="nb-scroll-seal" />
            <p className="nb-scroll-kicker"><img src={role.icon} alt="" />{role.name}</p>
            <p className="nb-scroll-q">{picked.map(name).join(' · ')} 중 악마가 있는가</p>
            <p className="nb-scroll-a">{ANSWER}</p>
            <button type="button" className="nb-ok" onClick={onConfirm}>확인</button>
          </article>
        </div>
      )}

      {(step === 'wait' || step === 'kept' || step === 'sent' || step === 'letter') && <div className="nb-rest"><Moon /></div>}
    </div>
  );
}

function Crow({ from, to }: { from: Pt; to: Pt }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mid = { x: (from.x + to.x) / 2 + 40, y: Math.min(from.y, to.y) - 60 };
    const exit = { x: to.x + 160, y: to.y - 220 };
    el.animate([
      { transform: `translate(${from.x}px, ${from.y}px) scale(.6)`, opacity: 0 },
      { transform: `translate(${from.x}px, ${from.y}px) scale(.7)`, opacity: 1, offset: 0.08 },
      { transform: `translate(${mid.x}px, ${mid.y}px) scale(1)`, offset: 0.45 },
      { transform: `translate(${to.x}px, ${to.y - 18}px) scale(1.05)`, offset: 0.7 },
      { transform: `translate(${exit.x}px, ${exit.y}px) scale(.7)`, opacity: 0 },
    ], { duration: 2600, easing: 'ease-in-out', fill: 'forwards' });
  }, [from.x, from.y, to.x, to.y]);
  return (
    <span ref={ref} className="nb-crow" aria-hidden="true">
      <svg viewBox="0 0 40 24" width="40" height="24"><path className="wing" d="M2 12 Q12 0 20 10 Q28 0 38 12 Q28 8 20 14 Q12 8 2 12Z" fill="#120c0a" /></svg>
    </span>
  );
}

const Sun = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="4.2" fill="#e0a43a" /><g stroke="#e0a43a" strokeWidth="1.6" strokeLinecap="round"><path d="M10 1.8v2.2M10 16v2.2M1.8 10h2.2M16 10h2.2M4.2 4.2l1.5 1.5M14.3 14.3l1.5 1.5M4.2 15.8l1.5-1.5M14.3 5.7l1.5-1.5" /></g></svg>
);
