import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cast } from './cast';
import { Clock } from './Clock';
import { Plaza } from './Plaza';
import { PlazaExecution, PlazaNight, type NightState } from './plazaScenes';
import { PcFrame, PhoneFrame, useViewportHeight, useWide } from './reviewKit';
import './review.css';

type Concept = 'plaza' | 'clock';
type Scene = 'day' | 'night' | 'execution';
const scenes: { key: Scene; label: string }[] = [
  { key: 'day', label: '낮 토론' },
  { key: 'night', label: '밤' },
  { key: 'execution', label: '처형 발표' },
];
const nightStates: { key: NightState; label: string }[] = [
  { key: 'wait', label: '대기 (모두 같은 화면)' },
  { key: 'choose', label: '행동 요청 · 점쟁이' },
  { key: 'info', label: '정보 도착 · 초공감자' },
];
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
  const [scene, setScene] = useState<Scene>((params.get('s') as Scene) || 'day');
  const [night, setNight] = useState<NightState>('wait');
  const [run, setRun] = useState(0);
  const [pc, setPc] = useState(params.get('pc') === '1');
  const c = useMemo(() => cast(count), [count]);

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('c', concept);
    url.searchParams.set('n', String(count));
    url.searchParams.set('s', scene);
    history.replaceState(null, '', url);
  }, [concept, count, scene]);

  const showPc = wide && pc && concept === 'plaza' && scene === 'day';
  const product =
    concept === 'clock' ? (
      <Clock key={`c${count}`} c={c} playing={playing} />
    ) : scene === 'night' ? (
      <PlazaNight key={`n${count}${night}`} c={c} state={night} />
    ) : scene === 'execution' ? (
      <PlazaExecution key={`e${count}${run}`} c={c} />
    ) : (
      <Plaza key={`p${count}${showPc}`} c={c} playing={playing} wide={showPc} />
    );
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
      {concept === 'plaza' && (
        <section>
          <h2>장면</h2>
          <div className="rv-seg three">
            {scenes.map((x) => (
              <button key={x.key} aria-pressed={scene === x.key} onClick={() => setScene(x.key)}>{x.label}</button>
            ))}
          </div>
          {scene === 'night' && (
            <div className="rv-events" style={{ marginTop: 8 }}>
              {nightStates.map((x) => (
                <button key={x.key} aria-pressed={night === x.key} onClick={() => setNight(x.key)}>{x.label}</button>
              ))}
            </div>
          )}
          {scene === 'execution' && (
            <button className="rv-reset" style={{ marginTop: 8 }} onClick={() => setRun((r) => r + 1)}>연출 다시 보기</button>
          )}
          {scene === 'day' && wide && (
            <label className="rv-check" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={pc} onChange={(e) => setPc(e.target.checked)} /> PC 화면으로 보기
            </label>
          )}
        </section>
      )}
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
          <li>밤 대기 화면이 역할이나 깨는 순서를 드러내지 않는가</li>
          <li>광장에서 사람을 눌러 고르는 방식이 자연스러운가</li>
          <li>처형 발표가 중요한 순간으로 느껴지는가</li>
          <li>PC에서 광장과 기록을 함께 보는 배치가 맞는가</li>
        </ul>
        <p>TB · 나는 3번 서연. 밤 행동 요청만 실제로 눌러 볼 수 있고 나머지 버튼은 연결하지 않았다.</p>
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
          {showPc ? <PcFrame>{product}</PcFrame> : <PhoneFrame simKeyboard={false}>{product}</PhoneFrame>}
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
