import { useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cast } from './cast';
import { Flow, type Phase } from './Flow';
import { PhoneFrame, useViewportHeight, useWide } from './reviewKit';
import './review.css';

const jumps: { start: Phase; label: string; hint: string }[] = [
  { start: 'plaza', label: '처음부터 이어서', hint: '광장 → 지명 → 증언대 → 투표 → 처형' },
  { start: 'plaza', label: '① 광장 → 지명', hint: '준호가 가리키면 붉은 선이 광장을 가로질러 지호에게 꽂히고, 멈춤·섬광 뒤 두 사람이 제자리에서 커져 컷인이 된다.' },
  { start: 'testimony', label: '④ 증언대 → 광장 투표', hint: '카메라가 빠지며 재판정이 지호 자리로 줄어들고 광장이 드러난다. 지호가 가운데로 나오고 종과 함께 빛줄기·슬롯이 내려온다. 처형 선을 넘는 표에서 짧게 멈추며 붉게 맥동.' },
  { start: 'confirm', label: '⑥ 광장 위 처형', hint: '빛이 지호에게 모이고 머리 위로 초상화가 떠올라 커진다. 도장이 찍히고 초상화가 재로 흩어지며 지호가 유령이 된다.' },
];

function App() {
  const wide = useWide();
  const viewportH = useViewportHeight(!wide);
  const params = new URLSearchParams(location.search);
  const [count, setCount] = useState<8 | 15>(params.get('n') === '8' ? 8 : 15);
  const [pick, setPick] = useState(0);
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>('plaza');
  const [open, setOpen] = useState(false);
  const c = useMemo(() => cast(count), [count]);
  const onPhase = useCallback((p: Phase) => setPhase(p), []);
  const play = (i: number) => { setPick(i); setRun((r) => r + 1); if (!wide) setOpen(false); };
  const product = <Flow key={`${count}`} c={c} start={jumps[pick].start} runKey={run} onPhase={onPhase} />;
  const controls = (
    <>
      <section><h2>재생</h2><div className="rv-events">{jumps.map((j, i) => <button key={j.label} aria-pressed={pick === i} onClick={() => play(i)}>{j.label}</button>)}</div>
        <p className="rv-hint">{jumps[pick].hint}</p></section>
      <section><h2>인원</h2><div className="rv-seg">{([15, 8] as const).map((n) => <button key={n} aria-pressed={count === n} onClick={() => { setCount(n); setRun((r) => r + 1); }}>{n}인</button>)}</div></section>
      <section className="rv-notes"><h2>지금 장면</h2><p className="rv-pending">{phase}</p>
        <p>검토 10(Codex)의 장면은 그대로 두고, 전환만 따로 만든 시안이다. 지명 이유·변론과 투표는 요약해 빠르게 진행한다.</p>
        <a className="sp-original-link" href="./issue-294-tribunal.html">검토 10과 비교 ↗</a></section>
    </>
  );
  if (wide) return (
    <div className="rv-wide">
      <aside className="rv-panel"><header><span className="rv-tag">검토</span><h1>#294 장면 전환 시안</h1></header>{controls}</aside>
      <main className="rv-stage"><PhoneFrame simKeyboard={false}>{product}</PhoneFrame></main>
    </div>
  );
  return (
    <div className="rv-narrow" style={viewportH ? { height: viewportH } : undefined}>
      <div className={`rv-bar ${open ? 'open' : ''}`}>
        <button className="rv-bar-toggle" onClick={() => setOpen((o) => !o)}><span className="rv-tag">검토</span>{jumps[pick].label} · {count}인<span className="rv-bar-caret">{open ? '닫기' : '열기'}</span></button>
        {open && <div className="rv-bar-body">{controls}</div>}
      </div>
      <div className="rv-product">{product}</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
