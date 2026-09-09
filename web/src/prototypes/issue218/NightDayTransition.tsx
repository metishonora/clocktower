import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import nightWoodcut from './assets/night-woodcut-v3.png';
import './narrativeScene.css';
import './nightDayTransition.css';

type Phase = 'night' | 'out' | 'turn' | 'in' | 'day';
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
function NightDayTransition() {
  const [phase, setPhase] = useState<Phase>('night');
  const [preview, setPreview] = useState('play');
  const [slow, setSlow] = useState(false);
  const [size, setSize] = useState({ w: 1280, h: 720 });
  const stage = useRef<HTMLElement>(null);
  const destination = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const busy = phase !== 'night' && phase !== 'day';
  const multiplier = slow ? 2 : 1;
  useEffect(() => {
    const element = stage.current!;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (preview !== 'play') return;
    const next: Partial<Record<Phase, [Phase, number]>> = { out: ['turn', 800], turn: ['in', 1100], in: ['day', 800] };
    const transition = next[phase];
    if (transition) timer.current = window.setTimeout(() => setPhase(transition[0]), transition[1] * multiplier);
    return () => window.clearTimeout(timer.current);
  }, [phase, preview, multiplier]);
  useEffect(() => { if (phase === 'day') destination.current?.focus({ preventScroll: true }); }, [phase]);
  function start() {
    if (busy) return;
    setPreview('play');
    setPhase(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'day' : 'out');
  }
  function reset() { window.clearTimeout(timer.current); setPreview('play'); setPhase('night'); }
  function inspect(value: string) {
    window.clearTimeout(timer.current); setPreview(value); setPhase(value === 'play' ? 'night' : value === 'open' ? 'out' : 'turn');
  }
  const bookWidth = Math.min(1120, size.w * .88);
  const bookHeight = Math.max(size.h * bookWidth / (2 * size.w), Math.min(630, size.h * .62, size.w * .7));
  const style = { '--book-w': `${bookWidth}px`, '--book-h': `${bookHeight}px`, '--scene-w': `${size.w}px`, '--scene-h': `${size.h}px`, '--page-scene-h': `${bookHeight * 2 * size.w / bookWidth}px`, '--zoom-x': size.w / (bookWidth / 2), '--zoom-y': size.h / bookHeight, '--shrink-x': bookWidth / 2 / size.w, '--shrink-y': bookHeight / size.h, '--camera-time': `${800 * multiplier}ms`, '--turn-time': `${1100 * multiplier}ms` } as CSSProperties;
  return <div className="transitionPrototype">
    <aside className="sceneReview transitionReview" aria-label="프로토타입 검토 도구">
      <div><b>#218 · 밤 → 낮</b><span>밤 종료 예시 · 중간 행동 생략</span></div>
      <div className="transitionTools"><label><input type="checkbox" checked={slow} disabled={busy} onChange={e => setSlow(e.target.checked)}/> 느리게</label><select aria-label="전환 검토 상태" value={preview} onChange={e => inspect(e.target.value)}><option value="play">전체 재생</option><option value="open">펼친 책</option><option value="half">넘김 중간</option></select><button onClick={reset}>처음으로</button></div>
    </aside>
    <main ref={stage} className={`transitionStage phase-${phase} preview-${preview}`} style={style} aria-label="밤에서 낮으로 전환 시안" aria-busy={busy && preview === 'play'}>
      <div className="bookCamera" aria-hidden={phase !== 'night' && phase !== 'day'}>
        <div className="bookBinding" aria-hidden="true"><i/><i/><i/><i/></div>
        <div className="bookLeaf bookLeft" aria-hidden="true"><div className="oldPage"><span>첫날 밤</span><div className="oldPageRule"/><p>영희와 민수는<br/>악마가 누구인지<br/>확인했습니다.</p><img src={nightWoodcut} alt=""/></div></div>
        <div className="bookLeaf bookRight" aria-hidden={phase !== 'day'} inert={phase !== 'day'}><div ref={destination} tabIndex={-1} aria-label="첫날 낮 진행" className="pageContents"><Scene day/></div></div>
        <div className="turningLeaf" aria-hidden={phase !== 'night'} inert={phase !== 'night'}>
          <div className="leafFace leafFront"><div className="pageContents"><Scene onStart={start}/></div></div>
          <div className="leafFace leafBack" aria-hidden="true"><div className="oldPage"><span>첫날 밤</span><div className="oldPageRule"/><p>사망자 없음.</p><img src={nightWoodcut} alt=""/></div></div>
        </div>
        <div className="bookGutter" aria-hidden="true"/>
      </div>
    </main>
  </div>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<NightDayTransition/>);
import.meta.hot?.dispose(() => root.unmount());
