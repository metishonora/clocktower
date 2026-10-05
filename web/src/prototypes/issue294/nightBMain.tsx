import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cast } from './cast';
import { NightB, type NightBStep } from './NightB';
import { PhoneFrame, useViewportHeight, useWide } from './reviewKit';
import { Trial } from './Trial';
import './review.css';

type Step = 'verdict' | NightBStep;
const steps: { key: Step; label: string }[] = [
  { key: 'verdict', label: '0 · 처형 결과' },
  { key: 'dusk', label: '1 · 종이 울리며 저묾' },
  { key: 'wait', label: '2 · 잠든 마을 (모두 같은 화면)' },
  { key: 'choose', label: '3 · 깨어나 선택' },
  { key: 'sent', label: '4 · 보냄' },
  { key: 'letter', label: '5 · 까마귀의 편지' },
  { key: 'open', label: '6 · 편지 열기' },
  { key: 'kept', label: '7 · 확인 후 (이름표 옆 봉투)' },
  { key: 'dawn', label: '8 · 새벽' },
];
const autoNext: Partial<Record<Step, [Step, number]>> = { verdict: ['dusk', 2600], dusk: ['wait', 6200], wait: ['choose', 2600], sent: ['letter', 2200], kept: ['dawn', 2600] };

function App() {
  const wide = useWide();
  const viewportH = useViewportHeight(!wide);
  const params = new URLSearchParams(location.search);
  const [step, setStep] = useState<Step>((params.get('s') as Step) || 'verdict');
  const [count, setCount] = useState<8 | 15>(params.get('n') === '8' ? 8 : 15);
  const [picked, setPicked] = useState<number[]>(() => (['sent', 'letter', 'open', 'kept', 'dawn'].includes(params.get('s') ?? '') ? [1, 2] : []));
  const [auto, setAuto] = useState(params.get('auto') !== '0');
  const [run, setRun] = useState(0);
  const [cut, setCut] = useState(false);
  const [open, setOpen] = useState(false);
  const base = useMemo(() => cast(count), [count]);

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('s', step);
    url.searchParams.set('n', String(count));
    history.replaceState(null, '', url);
  }, [step, count]);

  useEffect(() => {
    if (!auto) return;
    const next = autoNext[step];
    if (!next) return;
    const t = window.setTimeout(() => go(next[0], true), next[1]);
    return () => window.clearTimeout(t);
  }, [auto, step, run]);

  // 처형 결과에서 광장으로 넘어갈 때는 겹치지 않게 짧게 암전한다.
  function go(next: Step, fromAuto = false) {
    if (!fromAuto) setOpen(false);
    if (next === 'choose' || next === 'verdict' || next === 'dusk' || next === 'wait') setPicked([]);
    if (['sent', 'letter', 'open', 'kept', 'dawn'].includes(next) && picked.length < 2) setPicked([1, 2]);
    if (step === 'verdict' && next === 'dusk') {
      setCut(true);
      window.setTimeout(() => { setStep(next); setRun((r) => r + 1); }, 320);
      window.setTimeout(() => setCut(false), 420);
      return;
    }
    setStep(next);
    setRun((r) => r + 1);
  }
  const pick = (seat: number) => setPicked((all) => (all.includes(seat) ? all.filter((s) => s !== seat) : all.length < 2 ? [...all, seat] : all));

  const product = (
    <div style={{ position: 'absolute', inset: 0 }}>
      {step === 'verdict'
        ? <Trial key={`v${run}`} c={base} step="verdict" myVote={true} setMyVote={() => {}} />
        : <NightB key={`${step}${count}${run}`} base={base} step={step} picked={picked} onPick={pick}
            onSend={() => go('sent')} onOpen={() => go('open')} onConfirm={() => go('kept')} onReopen={() => go('open')} />}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3000, background: '#000', opacity: cut ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none' }} />
    </div>
  );
  const controls = (
    <>
      <section>
        <h2>장면</h2>
        <div className="rv-events">{steps.map((s) => <button key={s.key} aria-pressed={step === s.key} onClick={() => go(s.key)}>{s.label}</button>)}</div>
        <button className="rv-reset" style={{ marginTop: 8 }} onClick={() => { setAuto(true); go('verdict'); }}>처음부터 이어서 재생</button>
        <label className="rv-check" style={{ marginTop: 8 }}><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> 이야기꾼 동작 자동 재현</label>
      </section>
      <section>
        <h2>인원</h2>
        <div className="rv-seg">{([15, 8] as const).map((n) => <button key={n} aria-pressed={count === n} onClick={() => { setCount(n); go(step); }}>{n}인</button>)}</div>
      </section>
      <section className="rv-notes">
        <h2>Codex 검토 07과 다른 점</h2>
        <ul>
          <li>처형 결과와 광장이 겹치지 않음 · 짧은 암전 뒤 광장</li>
          <li>종이 울리며 지호가 유령이 되고 마을 분위기 단계가 바뀜</li>
          <li>밤에도 마을과 사람·이름이 남음 · 눈 감은 채 어둡게</li>
          <li>설명 문구 없음 · 대기 중에는 달 표시만</li>
          <li>깨어나면 눈을 뜨고 발밑 고리에 불 · 한 줄 선택 띠 · 이름표도 눌러 선택</li>
          <li>정보는 까마귀가 가져온 편지 · 확인 한 번 · 이름표 옆 봉투로 다시 보기</li>
        </ul>
        <p>깨움·선택·편지는 해당 참가자의 기기에서만 일어난다. 모두에게 보이는 요소(종, 하늘, 달)는 밤 순서와 연결하지 않는다.</p>
      </section>
    </>
  );
  if (wide) {
    return (
      <div className="rv-wide">
        <aside className="rv-panel"><header><span className="rv-tag">검토</span><h1>#294 밤 화면 · 제안 B</h1></header>{controls}</aside>
        <main className="rv-stage"><PhoneFrame simKeyboard={false}>{product}</PhoneFrame></main>
      </div>
    );
  }
  return (
    <div className="rv-narrow" style={viewportH ? { height: viewportH } : undefined}>
      <div className={`rv-bar ${open ? 'open' : ''}`}>
        <button className="rv-bar-toggle" onClick={() => setOpen((o) => !o)}>
          <span className="rv-tag">검토</span>{steps.find((s) => s.key === step)?.label} · {count}인
          <span className="rv-bar-caret">{open ? '닫기' : '열기'}</span>
        </button>
        {open && <div className="rv-bar-body">{controls}</div>}
      </div>
      <div className="rv-product">{product}</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
