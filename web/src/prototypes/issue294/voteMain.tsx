import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cast, type Cast } from './cast';
import { PhoneFrame, useViewportHeight, useWide } from './reviewKit';
import { DialVote, PlazaVote, type MeState, type Prior } from './VoteLab';
import './review.css';

type Kind = 'plaza' | 'dial';
const kinds: { key: Kind; label: string }[] = [
  { key: 'plaza', label: '가 · 광장에서 투표' },
  { key: 'dial', label: '나 · 다듬은 문자판' },
];
const meStates: { key: MeState; label: string }[] = [
  { key: 'alive', label: '살아 있음' },
  { key: 'ghost', label: '유령 · 투표권 있음' },
  { key: 'spent', label: '유령 · 투표권 사용함' },
];

function build(count: 8 | 15, me: MeState): Cast {
  const base = cast(count);
  const players = base.players.map((p) => p.me ? { ...p, alive: me === 'alive', ghostVote: me !== 'spent' } : p);
  return { ...base, players, alive: players.filter((p) => p.alive).length };
}

function App() {
  const wide = useWide();
  const viewportH = useViewportHeight(!wide);
  const params = new URLSearchParams(location.search);
  const [kind, setKind] = useState<Kind>(params.get('k') === 'dial' ? 'dial' : 'plaza');
  const [count, setCount] = useState<8 | 15>(params.get('n') === '8' ? 8 : 15);
  const [me, setMe] = useState<MeState>((params.get('me') as MeState) || 'ghost');
  const [myVote, setMyVote] = useState(false);
  const [run, setRun] = useState(0);
  const [open, setOpen] = useState(false);
  const [hasPrior, setHasPrior] = useState(params.get('prior') !== '0');
  const c = useMemo(() => build(count, me), [count, me]);
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('k', kind); url.searchParams.set('n', String(count)); url.searchParams.set('me', me);
    history.replaceState(null, '', url);
  }, [kind, count, me]);
  const restart = () => { setMyVote(false); setRun((r) => r + 1); if (!wide) setOpen(false); };
  // 오늘 앞선 지명: 민지가 과반 표를 받은 상태. 지호가 같은 표면 동점, 넘으면 처형 예정이 바뀐다.
  const prior: Prior = hasPrior ? { seat: 1, votes: Math.ceil(c.alive / 2) } : null;
  const props = { c, myVote, setMyVote, meState: me, runKey: run, prior };
  const product = kind === 'plaza' ? <PlazaVote key={`p${run}${count}${me}`} {...props} /> : <DialVote key={`d${run}${count}${me}`} {...props} />;
  const controls = (
    <>
      <section><h2>안</h2><div className="rv-events">{kinds.map((k) => <button key={k.key} aria-pressed={kind === k.key} onClick={() => { setKind(k.key); restart(); }}>{k.label}</button>)}</div></section>
      <section><h2>나의 상태</h2><div className="rv-events">{meStates.map((s) => <button key={s.key} aria-pressed={me === s.key} onClick={() => { setMe(s.key); restart(); }}>{s.label}</button>)}</div></section>
      <section><h2>오늘 앞선 지명</h2><div className="rv-seg"><button aria-pressed={!hasPrior} onClick={() => { setHasPrior(false); restart(); }}>없음</button><button aria-pressed={hasPrior} onClick={() => { setHasPrior(true); restart(); }}>민지 · 과반 득표</button></div><p className="rv-hint">앞선 지명이 과반을 받았으면 그 표 수가 동점 지점, 그보다 1표 많아야 처형 예정입니다. 손 들기/내리기로 동점·처형 예정을 바꿔 볼 수 있습니다.</p></section>
      <section><h2>인원</h2><div className="rv-seg">{([15, 8] as const).map((n) => <button key={n} aria-pressed={count === n} onClick={() => { setCount(n); restart(); }}>{n}인</button>)}</div></section>
      <section><button className="rv-reset" onClick={restart}>투표 다시 보기</button></section>
      <section className="rv-notes"><h2>공통 표현</h2><ul>
        <li>유령 · 투표권 있음 = 빛나는 흰 유령</li>
        <li>유령 · 투표권 사용 = 점선 윤곽의 투명한 유령</li>
        <li>손 듦 = 인물이 한 손을 듦 (아이콘 없음)</li>
        <li>빛은 지명된 사람부터 돌고, 빛이 머무는 동안만 바꿀 수 있음</li>
        <li>표 = 금빛 구슬이 지명된 사람 아래 슬롯을 채움</li>
      </ul><p>8인: 유나·민지·하은(유령)이 손을 든다. 15인은 여기에 수아·시우·다은. 태민(유령)은 들지 않고, 건우는 이미 투표권을 썼다.</p></section>
    </>
  );
  if (wide) return (
    <div className="rv-wide">
      <aside className="rv-panel"><header><span className="rv-tag">검토</span><h1>#294 투표 화면 비교</h1></header>{controls}</aside>
      <main className="rv-stage"><PhoneFrame simKeyboard={false}>{product}</PhoneFrame></main>
    </div>
  );
  return (
    <div className="rv-narrow" style={viewportH ? { height: viewportH } : undefined}>
      <div className={`rv-bar ${open ? 'open' : ''}`}>
        <button className="rv-bar-toggle" onClick={() => setOpen((o) => !o)}><span className="rv-tag">검토</span>{kinds.find((k) => k.key === kind)!.label} · {count}인<span className="rv-bar-caret">{open ? '닫기' : '열기'}</span></button>
        {open && <div className="rv-bar-body">{controls}</div>}
      </div>
      <div className="rv-product">{product}</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
