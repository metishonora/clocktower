import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import nightWoodcut from './assets/night-woodcut-v3.png';
import './narrativeScene.css';
import './transitionComparison.css';

function Scene({ day = false, nextNight = false, miniature = false, onStart }: { day?: boolean; nextNight?: boolean; miniature?: boolean; onStart?: () => void }) {
  return <div className={`nightScene transitionScene ${day ? 'transitionDay' : ''}`}>
    <div className="sceneAtmosphere" aria-hidden="true"><img className="sceneWoodcut" src={nightWoodcut} alt=""/><div className="sceneMist sceneMistFar"/><div className="sceneMist sceneMistNear"/><div className="sceneEmber"/></div>
    <div className="sceneReading">
      <header className="sceneHeading"><h1>{day ? '첫날 낮' : nextNight ? '둘째 밤' : '첫날 밤'}</h1></header>
      {nextNight ? <section className="scenePassage"><p>모두 눈을 감습니다.</p></section> : day ? <section className="scenePassage"><p>사망자는 없습니다.</p><p>공개 토론을 시작합니다.</p></section> : <>
        <section className="scenePassage sceneRecord"><p><em className="sceneRole">하수인</em>인 <strong className="scenePerson"><small>2번</small> 영희</strong>와 <strong className="scenePerson"><small>3번</small> 민수</strong>는<br className="sceneDesktopBreak"/> <strong className="scenePerson"><small>1번</small> 수빈</strong>이 <em className="sceneRole">악마</em>임을 확인했습니다.</p></section>
        <section className="scenePassage"><p>사망자 없음.</p>{!miniature && <button className="sceneAdvance" onClick={onStart}>확인하고 낮 시작 <span aria-hidden="true">⟶</span></button>}</section>
      </>}
    </div>
  </div>;
}

function TransitionComparison() {
  const [mode, setMode] = useState<'page' | 'ink'>('ink');
  const [toDay, setToDay] = useState(true);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [playbackId, setPlaybackId] = useState(0);
  const [slow, setSlow] = useState(false);
  const frame = useRef<number>(0);
  const destination = useRef<HTMLDivElement>(null);
  const duration = slow ? 3200 : 1600;
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    function tick(time: number) {
      const fraction = Math.min(1, (time - start) / duration);
      setProgress(fraction);
      if (fraction < 1) frame.current = requestAnimationFrame(tick);
      else setRunning(false);
    }
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [running, duration, playbackId]);
  useEffect(() => { if (progress === 1) destination.current?.focus({ preventScroll: true }); }, [progress]);
  function reset() { cancelAnimationFrame(frame.current); setRunning(false); setProgress(0); }
  function play() {
    reset();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setProgress(1);
    else { setPlaybackId(id => id + 1); setRunning(true); }
  }
  function selectMode(value: 'page' | 'ink') { setMode(value); play(); }
  const eased = progress * progress * (3 - 2 * progress);
  const bend = Math.sin(Math.PI * eased);
  const edge = 100 - 122 * eased;
  const slope = 13 * bend;
  const fold = 20 * bend;
  const currentClip = `polygon(0 0, ${edge + slope}% 0, ${edge - slope}% 100%, 0 100%)`;
  const foldClip = `polygon(${edge + slope}% 0, ${edge + slope + fold}% 0, ${edge - slope + fold}% 100%, ${edge - slope}% 100%)`;
  const inkSpread = Math.min(1, progress / .48);
  const inkOpacity = progress <= .58 ? 1 : Math.max(0, 1 - (progress - .58) / .42);
  const nightVisible = mode === 'page' ? progress < 1 : progress < .52;
  return <div className="comparisonPrototype">
    <aside className="sceneReview comparisonReview" aria-label="프로토타입 검토 도구">
      <div className="comparisonModes" role="group" aria-label="전환 방식">
        <b>#218</b><button aria-pressed={mode === 'page'} onClick={() => selectMode('page')}>A · 책장 넘김</button><button aria-pressed={mode === 'ink'} onClick={() => selectMode('ink')}>B · 잉크 번짐</button>
      </div>
      <div className="comparisonControls"><select aria-label="전환 방향" value={toDay ? "day" : "night"} onChange={e => { reset(); setToDay(e.target.value === "day"); }}><option value="day">밤 → 낮 · 흰 잉크</option><option value="night">낮 → 밤 · 검은 잉크</option></select><label><input type="checkbox" checked={slow} disabled={running} onChange={e => setSlow(e.target.checked)}/> 느리게</label><label className="comparisonScrub">전환 위치<input aria-label="전환 위치" type="range" min="0" max="100" value={Math.round(progress * 100)} onChange={e => { cancelAnimationFrame(frame.current); setRunning(false); setProgress(Number(e.target.value) / 100); }}/></label><button onClick={play} disabled={running}>재생</button><button onClick={reset}>처음으로</button></div>
    </aside>
    <main className={`comparisonStage effect-${mode} ${toDay ? "inkToDay" : "inkToNight"}`} aria-label="밤낮 전환 비교" aria-busy={running}>
      <div ref={destination} tabIndex={-1} aria-label={toDay ? "첫날 낮 진행" : "둘째 밤 진행"} aria-hidden={progress !== 1} inert={progress !== 1} className="comparisonLayer"><Scene day={toDay} nextNight={!toDay}/></div>
      {nightVisible && <div className="comparisonLayer comparisonNight" aria-hidden={progress !== 0} inert={progress !== 0} style={{ clipPath: mode === 'page' ? currentClip : undefined }}><Scene day={!toDay} onStart={play}/></div>}
      {mode === 'page' && progress > 0 && progress < 1 && <div aria-hidden="true" className="pageFold" style={{clipPath:foldClip, '--edge': `${edge}%`, '--fold': `${fold}%`, '--bend': bend} as CSSProperties}><div className="foldLight"/></div>}
      {mode === 'ink' && progress > 0 && progress < 1 && <div className="inkVeil" aria-hidden="true" style={{'--spread':inkSpread,opacity:inkOpacity} as CSSProperties}>
        {[1, .88, .78, 1].map((factor, index) => <div key={index} className={`inkPool inkPool${index + 1}`} style={{ transform: `translate(-50%,-50%) scale(${inkSpread * inkSpread * factor})` }}/>) }
      </div>}
    </main>
  </div>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<TransitionComparison/>);
import.meta.hot?.dispose(() => root.unmount());
