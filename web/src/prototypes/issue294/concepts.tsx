import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cast } from './cast';
import { Clock } from './Clock';
import { Plaza } from './Plaza';
import { PhoneFrame, useViewportHeight, useWide } from './reviewKit';
import './review.css';

type Concept = 'plaza' | 'clock';
const concepts: { key: Concept; label: string; hint: string }[] = [
  { key: 'plaza', label: '② 광장', hint: '광장에 둘러선 사람들. 발언은 말풍선, 귓속말은 두 사람이 비켜서는 것으로 보인다.' },
  { key: 'clock', label: '③ 시계탑', hint: '좌석이 문자판의 시각 자리. 바늘·쐐기가 남은 토론 시간, 현 사이 봉투가 귓속말.' },
];

function App() {
  const wide = useWide();
  const viewportH = useViewportHeight(!wide);
  const params = new URLSearchParams(location.search);
  const [concept, setConcept] = useState<Concept>(params.get('c') === 'clock' ? 'clock' : 'plaza');
  const [count, setCount] = useState<8 | 15>(params.get('n') === '15' ? 15 : 8);
  const [playing, setPlaying] = useState(params.get('play') !== '0');
  const [panelOpen, setPanelOpen] = useState(false);
  const c = useMemo(() => cast(count), [count]);

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('c', concept);
    url.searchParams.set('n', String(count));
    history.replaceState(null, '', url);
  }, [concept, count]);

  const product = concept === 'plaza' ? <Plaza key={`p${count}`} c={c} playing={playing} /> : <Clock key={`c${count}`} c={c} playing={playing} />;
  const current = concepts.find((x) => x.key === concept)!;

  const controls = (
    <>
      <section>
        <h2>시안</h2>
        <div className="rv-seg">
          {concepts.map((x) => (
            <button key={x.key} aria-pressed={concept === x.key} onClick={() => setConcept(x.key)}>{x.label}</button>
          ))}
        </div>
        <p className="rv-hint">{current.hint}</p>
      </section>
      <section>
        <h2>인원</h2>
        <div className="rv-seg">
          {([8, 15] as const).map((n) => (
            <button key={n} aria-pressed={count === n} onClick={() => setCount(n)}>{n}인</button>
          ))}
        </div>
      </section>
      <section>
        <label className="rv-check">
          <input type="checkbox" checked={playing} onChange={(e) => setPlaying(e.target.checked)} /> 대화 흐름 재생
        </label>
      </section>
      <section className="rv-notes">
        <h2>이번에 확인할 것</h2>
        <ul>
          <li>휴대폰 세로 화면에서 이 은유가 성립하는가</li>
          <li>15인에서도 사람·좌석·이름을 알아볼 수 있는가</li>
          <li>대화를 대화방 없이도 따라갈 수 있는가</li>
          <li>분위기가 방향으로 끌리는가</li>
        </ul>
        <p>2일차 낮 토론 · TB · 나는 3번 서연(초공감자). 버튼은 연결하지 않았다.</p>
      </section>
    </>
  );

  if (wide) {
    return (
      <div className="rv-wide">
        <aside className="rv-panel">
          <header>
            <span className="rv-tag">검토</span>
            <h1>#294 컨셉 · 먼저 확인할 것</h1>
          </header>
          {controls}
        </aside>
        <main className="rv-stage">
          <PhoneFrame simKeyboard={false}>{product}</PhoneFrame>
        </main>
      </div>
    );
  }
  return (
    <div className="rv-narrow" style={viewportH ? { height: viewportH } : undefined}>
      <div className={`rv-bar ${panelOpen ? 'open' : ''}`}>
        <button className="rv-bar-toggle" onClick={() => setPanelOpen((o) => !o)}>
          <span className="rv-tag">검토</span>
          {current.label} · {count}인
          <span className="rv-bar-caret">{panelOpen ? '닫기' : '열기'}</span>
        </button>
        {panelOpen && <div className="rv-bar-body">{controls}</div>}
      </div>
      <div className="rv-product">{product}</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
