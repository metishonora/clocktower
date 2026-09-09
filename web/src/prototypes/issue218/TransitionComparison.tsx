import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import nightWoodcut from './assets/night-woodcut-v3.png';
import './narrativeScene.css';
import './transitionComparison.css';

function Scene({ day = false, miniature = false, onStart }: { day?: boolean; miniature?: boolean; onStart?: () => void }) {
  return <div className={`nightScene transitionScene ${day ? 'transitionDay' : ''}`}>
    <div className="sceneAtmosphere" aria-hidden="true"><img className="sceneWoodcut" src={nightWoodcut} alt=""/><div className="sceneMist sceneMistFar"/><div className="sceneMist sceneMistNear"/><div className="sceneEmber"/></div>
    <div className="sceneReading">
      <header className="sceneHeading"><h1>{day ? '첫날 낮' : '첫날 밤'}</h1></header>
      {day ? <section className="scenePassage"><p>사망자는 없습니다.</p><p>공개 토론을 시작합니다.</p></section> : <>
        <section className="scenePassage sceneRecord"><p><em className="sceneRole">하수인</em>인 <strong className="scenePerson"><small>2번</small> 영희</strong>와 <strong className="scenePerson"><small>3번</small> 민수</strong>는<br className="sceneDesktopBreak"/> <strong className="scenePerson"><small>1번</small> 수빈</strong>이 <em className="sceneRole">악마</em>임을 확인했습니다.</p></section>
        <section className="scenePassage"><p>사망자 없음.</p>{!miniature && <button className="sceneAdvance" onClick={onStart}>확인하고 낮 시작 <span aria-hidden="true">⟶</span></button>}</section>
      </>}
    </div>
  </div>;
}

function TransitionComparison() {
  const [mode, setMode] = useState<'page' | 'ink'>('page');
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
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
  }, [running, duration]);
  useEffect(() => { if (progress === 1) destination.current?.focus({ preventScroll: true }); }, [progress]);
  function reset() { cancelAnimationFrame(frame.current); setRunning(false); setProgress(0); }
  function play() {
    reset();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setProgress(1);
    else setRunning(true);
  }
  function selectMode(value: 'page' | 'ink') { reset(); setMode(value); }
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
      <div className="comparisonControls"><label><input type="checkbox" checked={slow} disabled={running} onChange={e => setSlow(e.target.checked)}/> 느리게</label><label className="comparisonScrub">전환 위치<input aria-label="전환 위치" type="range" min="0" max="100" value={Math.round(progress * 100)} onChange={e => { cancelAnimationFrame(frame.current); setRunning(false); setProgress(Number(e.target.value) / 100); }}/></label><button onClick={play} disabled={running}>재생</button><button onClick={reset}>처음으로</button></div>
    </aside>
    <main className={`comparisonStage effect-${mode}`} aria-label="밤에서 낮으로 전환 비교" aria-busy={running}>
      <div ref={destination} tabIndex={-1} aria-label="첫날 낮 진행" aria-hidden={progress !== 1} inert={progress !== 1} className="comparisonLayer"><Scene day/></div>
      {nightVisible && <div className="comparisonLayer comparisonNight" aria-hidden={progress !== 0} inert={progress !== 0} style={{ clipPath: mode === 'page' ? currentClip : undefined }}><Scene onStart={play}/></div>}
      {mode === 'page' && progress > 0 && progress < 1 && <div aria-hidden="true" className="pageFold" style={{clipPath:foldClip, '--edge': `${edge}%`, '--fold': `${fold}%`, '--bend': bend} as CSSProperties}><div className="foldLight"/></div>}
      {mode === 'ink' && progress > 0 && progress < 1 && <div className="inkVeil" aria-hidden="true" style={{'--spread':inkSpread,opacity:inkOpacity} as CSSProperties}>
        <svg className="inkFilters" width="0" height="0"><defs><filter id="comparison-ink-bleed" x="-25%" y="-25%" width="150%" height="150%"><feTurbulence type="fractalNoise" baseFrequency=".021" numOctaves="3" seed="12" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="58" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>
        <div className="inkPool inkPoolOne"/><div className="inkPool inkPoolTwo"/><div className="inkPool inkPoolThree"/><div className="inkPool inkPoolFour"/>
      </div>}
    </main>
  </div>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<TransitionComparison/>);
import.meta.hot?.dispose(() => root.unmount());
