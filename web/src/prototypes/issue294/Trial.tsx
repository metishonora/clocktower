import { useEffect, useMemo, useState } from 'react';
import type { Cast, Player } from './cast';
import './trial.css';

export type TrialStep = 'cutin' | 'accuse' | 'defend' | 'vote' | 'verdict';

export const NOMINATOR = 7;
export const NOMINEE = 6;
const lines: Record<'accuse' | 'defend', string> = {
  accuse: '지호가 수도승이라면서 어젯밤 태민이 죽었어. 날 지켰다는 말도 확인할 방법이 없잖아.',
  defend: '나는 유나를 지켰을 뿐이야. 태민을 고르지 않은 게 죄는 아니잖아. 나를 처형하면 수도승만 잃어.',
};
const reactions = [
  { seat: 1, text: '수도승이면 아까운데' },
  { seat: 5, text: '변론 끝까지 듣자' },
  { seat: 2, text: '유나 말도 일리 있어' },
];

const name = (c: Cast, seat: number) => c.players.find((p) => p.seat === seat)!.name;
const josa = (w: string, a: string, b: string) => ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? a : b);

export function Trial({ c, step, myVote, setMyVote }: { c: Cast; step: TrialStep; myVote: boolean; setMyVote: (v: boolean) => void }) {
  return (
    <div className={`tr tr-${step}`}>
      {step === 'cutin' && <CutIn c={c} />}
      {(step === 'accuse' || step === 'defend') && <Testimony c={c} step={step} />}
      {step === 'vote' && <Vote c={c} myVote={myVote} setMyVote={setMyVote} />}
      {step === 'verdict' && <Verdict c={c} myVote={myVote} />}
    </div>
  );
}

/* 지명 컷인 */
function CutIn({ c }: { c: Cast }) {
  const a = c.players.find((p) => p.seat === NOMINATOR)!;
  const b = c.players.find((p) => p.seat === NOMINEE)!;
  return (
    <div className="tr-cutin">
      <div className="tr-band top"><div className="tr-band-portrait"><Portrait p={a} /></div><span className="tr-band-name">{a.name}</span></div>
      <div className="tr-slash"><strong>지명</strong></div>
      <div className="tr-band bottom"><span className="tr-band-name">{b.name}</span><div className="tr-band-portrait"><Portrait p={b} /></div></div>
      <p className="tr-cutin-line">{a.name}{josa(a.name, '이', '가')} {b.name}{josa(b.name, '을', '를')} 지명했습니다</p>
    </div>
  );
}

/* 증언대: 지명 이유와 변론 */
function Testimony({ c, step }: { c: Cast; step: 'accuse' | 'defend' }) {
  const speaker = c.players.find((p) => p.seat === (step === 'accuse' ? NOMINATOR : NOMINEE))!;
  const text = lines[step];
  const typed = useTypewriter(text, `${step}${c.players.length}`);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    const t = window.setInterval(() => setShown((n) => Math.min(reactions.length, n + 1)), 2200);
    return () => window.clearInterval(t);
  }, [step]);
  const n = c.players.length;
  const idx = c.players.findIndex((p) => p.seat === speaker.seat);
  const strip = [...c.players, ...c.players, ...c.players];
  const W = 76;

  return (
    <div className="tr-room">
      <div className="tr-stands" style={{ transform: `translateX(calc(50% - ${(n + idx) * W + W / 2}px))` }}>
        {strip.map((p, i) => (
          <div key={i} className={`tr-stand ${p.alive ? '' : 'ghost'} ${p.seat === speaker.seat ? 'self' : ''}`} style={{ width: W }}>
            <span className="tr-stand-head" style={{ background: p.tint }} />
            <span className="tr-stand-box" />
            <span className="tr-stand-name">{p.me ? '나' : p.name}</span>
          </div>
        ))}
      </div>
      <div className="tr-spot" />
      <header className="tr-head">
        <span className={`tr-chip ${step}`}>{step === 'accuse' ? '지명 이유' : '변론'}</span>
        <span className="tr-timer">0:{step === 'accuse' ? '41' : '52'}</span>
        <RingMap c={c} speaker={speaker.seat} />
      </header>
      <div className="tr-speaker" key={speaker.seat}>
        <Portrait p={speaker} talking={typed.length < text.length} />
      </div>
      <ul className="tr-reactions">
        {reactions.slice(0, shown).map((r) => (
          <li key={r.seat} className={c.players.find((p) => p.seat === r.seat)!.alive ? '' : 'ghost'}>
            <b>{name(c, r.seat)}</b> {r.text}
          </li>
        ))}
      </ul>
      <section className="tr-dialog">
        <span className="tr-plate">{speaker.name}</span>
        <div className="tr-dialog-box">
          <p>{typed}<span className="tr-caret" /></p>
        </div>
      </section>
      <nav className="tr-bottom">
        <button type="button" className="tr-speak">광장에 말하기</button>
        <button type="button" className="tr-whisper">귓속말</button>
      </nav>
    </div>
  );
}

function useTypewriter(text: string, key: string) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const t = window.setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), 45);
    return () => window.clearInterval(t);
  }, [key, text]);
  return text.slice(0, n);
}

function RingMap({ c, speaker }: { c: Cast; speaker: number }) {
  const n = c.players.length;
  return (
    <svg className="tr-ring" viewBox="-30 -30 60 60" aria-label="좌석">
      <circle r="24" className="tr-ring-track" />
      {c.players.map((p) => {
        const a = Math.PI + ((p.seat - c.meSeat) * 2 * Math.PI) / n;
        const x = 24 * Math.sin(a);
        const y = -24 * Math.cos(a);
        const cls = p.seat === speaker ? 'speaker' : p.seat === NOMINEE ? 'nominee' : p.me ? 'me' : p.alive ? '' : 'ghost';
        return <circle key={p.seat} cx={x} cy={y} r={p.seat === speaker ? 4.2 : 2.8} className={`tr-ring-dot ${cls}`} />;
      })}
    </svg>
  );
}

/* 투표: 지명된 사람 다음 자리부터 시곗바늘이 돌며 손을 센다 */
function Vote({ c, myVote, setMyVote }: { c: Cast; myVote: boolean; setMyVote: (v: boolean) => void }) {
  const n = c.players.length;
  const base = useMemo(() => new Set(n > 10 ? [7, 9, 10, 13, 1, 5] : [7, 1, 5]), [n]);
  const order = useMemo(() => {
    const i = c.players.findIndex((p) => p.seat === NOMINEE);
    return Array.from({ length: n }, (_, k) => c.players[(i + 1 + k) % n].seat);
  }, [c, n]);
  const [pos, setPos] = useState(-1);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    setPos(-1);
    setRunning(false);
    const t = window.setTimeout(() => setRunning(true), 1600);
    return () => window.clearTimeout(t);
  }, [c]);
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setPos((p) => (p >= n - 1 ? p : p + 1)), 900);
    return () => window.clearInterval(t);
  }, [running, n]);
  const raised = (seat: number) => (seat === c.meSeat ? myVote : base.has(seat));
  const counted = order.slice(0, pos + 1).filter(raised).length;
  const current = order[Math.max(0, pos)];
  const meAt = order.indexOf(c.meSeat);
  const locked = pos >= meAt;
  const needed = c.needed;
  const angleOf = (seat: number) => Math.PI + ((seat - c.meSeat) * 2 * Math.PI) / n;
  const handAngle = pos < 0 ? angleOf(order[0]) - (2 * Math.PI) / n : angleOf(current);

  return (
    <div className="tr-vote">
      <header className="tr-head">
        <span className="tr-chip vote">투표</span>
        <span className="tr-vote-title">{name(c, NOMINEE)} 처형</span>
      </header>
      <div className="tr-vote-floor">
        <svg className="tr-vote-svg" viewBox="-110 -110 220 220">
          <circle r="96" className="tr-floor" />
          <circle r="62" className="tr-floor-inner" />
          <line x1="0" y1="0" x2={80 * Math.sin(handAngle)} y2={-80 * Math.cos(handAngle)} className="tr-hand" style={{ transition: pos < 0 ? 'none' : undefined }} />
          <circle r="5" className="tr-hub" />
        </svg>
        {c.players.map((p) => {
          const a = angleOf(p.seat);
          const x = 50 + 42 * Math.sin(a);
          const y = 50 - 42 * Math.cos(a);
          const k = order.indexOf(p.seat);
          const passed = k <= pos;
          const up = raised(p.seat) && (passed || p.seat === c.meSeat);
          return (
            <div key={p.seat} className={`tr-token ${p.alive ? '' : 'ghost'} ${p.me ? 'me' : ''} ${p.seat === NOMINEE ? 'nominee' : ''} ${passed ? 'passed' : ''} ${up ? 'up' : ''} ${k === pos ? 'now' : ''}`} style={{ left: `${x}%`, top: `${y}%` }}>
              {up && <HandIcon />}
              <span className="tr-token-head" style={{ background: p.tint }} />
              <span className="tr-token-name">{p.me ? '나' : p.name}</span>
            </div>
          );
        })}
        <div className="tr-count">
          <strong>{counted}</strong>
          <span>/ {needed}표 필요</span>
        </div>
      </div>
      <section className="tr-myvote">
        {locked ? (
          <p className="tr-locked">{myVote ? '손을 들었습니다' : '손을 들지 않았습니다'}</p>
        ) : (
          <>
            <button type="button" className={`tr-vote-btn ${myVote ? 'on' : ''}`} onClick={() => setMyVote(true)}>손 들기</button>
            <button type="button" className={`tr-vote-btn ${!myVote ? 'on' : ''}`} onClick={() => setMyVote(false)}>내리기</button>
          </>
        )}
      </section>
    </div>
  );
}

/* 처형 결정 */
function Verdict({ c, myVote }: { c: Cast; myVote: boolean }) {
  const p = c.players.find((q) => q.seat === NOMINEE)!;
  const votes = (c.players.length > 10 ? 6 : 3) + (myVote ? 1 : 0);
  const executed = votes >= c.needed;
  return (
    <div className="tr-verdict">
      <div className={`tr-verdict-portrait ${executed ? 'dead' : ''}`}>
        <Portrait p={p} />
        {executed && <span className="tr-crack" />}
      </div>
      <div className={`tr-stamp ${executed ? '' : 'spared'}`}>{executed ? '처형' : '생존'}</div>
      <p className="tr-verdict-line">
        {executed ? `${p.name}${josa(p.name, '이', '가')} 처형되었습니다` : `${p.name}${josa(p.name, '은', '는')} 살아남았습니다`}
      </p>
      <p className="tr-verdict-sub">{votes}표 · 처형에 {c.needed}표 필요</p>
    </div>
  );
}

/* 큰 초상화 */
const hairs = ['#2b1d14', '#5a3a22', '#1c1c24', '#7a4a2a', '#3a2a1e'];
export function Portrait({ p, talking = false }: { p: Player; talking?: boolean }) {
  const hair = hairs[p.seat % hairs.length];
  const style = p.seat % 3;
  return (
    <svg className={`tr-portrait ${talking ? 'talking' : ''} ${p.alive ? '' : 'ghost'}`} viewBox="0 0 200 230" aria-label={p.name}>
      <path d="M18 230 C22 178 58 160 100 160 C142 160 178 178 182 230Z" fill={p.tint} />
      <path d="M100 160 L78 168 L100 205 L122 168Z" fill="rgba(255,255,255,.18)" />
      <path d={style === 2 ? 'M46 100 C40 30 160 30 154 100 L156 150 C150 140 146 130 142 120 L58 120 C54 130 50 140 44 150Z' : 'M48 104 C42 36 158 36 152 104 C150 120 146 128 140 132 L60 132 C54 128 50 120 48 104Z'} fill={hair} />
      <rect x="86" y="132" width="28" height="34" rx="10" fill="#e8c8a8" />
      <ellipse cx="100" cy="98" rx="46" ry="54" fill="#f0d6bd" />
      {style === 1 ? (
        <path d="M50 102 C40 18 162 22 152 96 C148 74 138 62 124 58 C112 78 84 84 62 72 C56 82 52 92 50 102Z" fill={hair} />
      ) : (
        <path d="M50 96 C46 20 154 20 150 96 C142 72 124 62 100 64 C76 62 58 72 50 96Z" fill={hair} />
      )}
      <path d="M72 88 q10 -6 20 0 M108 88 q10 -6 20 0" stroke="#3b2c1f" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="82" cy="102" rx="6" ry="7" fill="#fff" />
      <ellipse cx="118" cy="102" rx="6" ry="7" fill="#fff" />
      <circle cx="83" cy="103" r="3.6" fill="#2b1d14" />
      <circle cx="119" cy="103" r="3.6" fill="#2b1d14" />
      <path d="M96 116 q4 6 8 0" stroke="#c49a7a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse className="tr-mouth" cx="100" cy="132" rx="9" ry="3" fill="#8a3b34" />
    </svg>
  );
}

const HandIcon = () => (
  <svg className="tr-hand-icon" viewBox="0 0 20 24" aria-label="손 듦">
    <path d="M6 22 C3.5 19 2.5 15 3 12.5 L5 12 L6 15 L6 5.5 A1.4 1.4 0 0 1 8.8 5.5 L8.8 11 L8.8 3.6 A1.4 1.4 0 0 1 11.6 3.6 L11.6 11 L11.6 4.8 A1.4 1.4 0 0 1 14.4 4.8 L14.4 12 L14.4 7.5 A1.3 1.3 0 0 1 17 7.5 L17 15 C17 19 15 22 13 22Z" fill="#f2e6d0" stroke="#1a0d0d" strokeWidth="1.1" strokeLinejoin="round" />
  </svg>
);
