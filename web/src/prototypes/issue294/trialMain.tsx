import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cast } from './cast';
import { Plaza } from './Plaza';
import { PhoneFrame, useViewportHeight, useWide } from './reviewKit';
import { Trial, type TrialStep } from './Trial';
import './review.css';

type Step = 'plaza' | TrialStep;
const steps: { key: Step; label: string; ms: number }[] = [
  { key: 'plaza', label: '광장 (자유 토론)', ms: 3500 },
  { key: 'cutin', label: '1 · 지명 컷인', ms: 2600 },
  { key: 'accuse', label: '2 · 지명 이유', ms: 7000 },
  { key: 'defend', label: '3 · 변론', ms: 7500 },
  { key: 'vote', label: '4 · 투표', ms: 10500 },
  { key: 'verdict', label: '5 · 처형', ms: 5000 },
];

function App() {
  const wide = useWide();
  const viewportH = useViewportHeight(!wide);
  const params = new URLSearchParams(location.search);
  const [step, setStep] = useState<Step>((params.get('s') as Step) || 'plaza');
  const [count, setCount] = useState<8 | 15>(params.get('n') === '15' ? 15 : 8);
  const [auto, setAuto] = useState(false);
  const [myVote, setMyVote] = useState(true);
  const [open, setOpen] = useState(false);
  const [run, setRun] = useState(0);
  const c = useMemo(() => cast(count), [count]);

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('s', step);
    url.searchParams.set('n', String(count));
    history.replaceState(null, '', url);
  }, [step, count]);
  useEffect(() => {
    if (!auto) return;
    const i = steps.findIndex((s) => s.key === step);
    if (i >= steps.length - 1) { setAuto(false); return; }
    const ms = step === 'vote' ? 1600 + 900 * count + 1800 : steps[i].ms;
    const t = window.setTimeout(() => setStep(steps[i + 1].key), ms);
    return () => window.clearTimeout(t);
  }, [auto, step, count]);

  const go = (s: Step) => { setStep(s); setRun((r) => r + 1); if (!wide) setOpen(false); };
  const product = step === 'plaza'
    ? <Plaza key={`p${count}`} c={c} playing />
    : <Trial key={`${step}${count}${run}`} c={c} step={step} myVote={myVote} setMyVote={setMyVote} />;

  const controls = (
    <>
      <section>
        <h2>장면</h2>
        <div className="rv-events">
          {steps.map((s) => <button key={s.key} aria-pressed={step === s.key} onClick={() => go(s.key)}>{s.label}</button>)}
        </div>
        <button className="rv-reset" style={{ marginTop: 8 }} onClick={() => { setMyVote(true); setStep('plaza'); setRun((r) => r + 1); setAuto(true); if (!wide) setOpen(false); }}>처음부터 이어서 재생</button>
      </section>
      <section>
        <h2>인원</h2>
        <div className="rv-seg">
          {([8, 15] as const).map((n) => <button key={n} aria-pressed={count === n} onClick={() => setCount(n)}>{n}인</button>)}
        </div>
      </section>
      <section className="rv-notes">
        <h2>이번에 확인할 것</h2>
        <ul>
          <li>지명부터 화면이 바뀌는 것이 중요한 순간으로 느껴지는가</li>
          <li>발언자 한 명을 크게 비추는 증언대가 읽기 쉬운가</li>
          <li>시곗바늘이 시계방향으로 돌며 손을 세는 투표가 이해되는가</li>
          <li>재판 중 다른 사람의 반응(왼쪽 작은 말)을 이 정도로 두면 되는가</li>
        </ul>
        <p>8인: 유나가 지호를 지명. 투표는 지호 다음 자리부터 돌고, 내 차례 전까지 손 들기/내리기를 바꿀 수 있다.</p>
      </section>
    </>
  );

  if (wide) {
    return (
      <div className="rv-wide">
        <aside className="rv-panel">
          <header><span className="rv-tag">검토</span><h1>#294 지명부터 재판정</h1></header>
          {controls}
        </aside>
        <main className="rv-stage"><PhoneFrame simKeyboard={false}>{product}</PhoneFrame></main>
      </div>
    );
  }
  return (
    <div className="rv-narrow" style={viewportH ? { height: viewportH } : undefined}>
      <div className={`rv-bar ${open ? 'open' : ''}`}>
        <button className="rv-bar-toggle" onClick={() => setOpen((o) => !o)}>
          <span className="rv-tag">검토</span>
          {steps.find((s) => s.key === step)!.label} · {count}인
          <span className="rv-bar-caret">{open ? '닫기' : '열기'}</span>
        </button>
        {open && <div className="rv-bar-body">{controls}</div>}
      </div>
      <div className="rv-product">{product}</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
