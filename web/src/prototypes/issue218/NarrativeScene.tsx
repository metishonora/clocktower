import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import nightWoodcut from './assets/night-woodcut-v3.png';
import './narrativeScene.css';

function Person({ seat, children }: { seat: number; children: string }) {
  return <strong className="scenePerson"><small>{seat}번</small> {children}</strong>;
}
function NarrativeScene() {
  const [advanced, setAdvanced] = useState(false);
  const next = useRef<HTMLElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!advanced) return;
    next.current?.focus({ preventScroll: true });
    next.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [advanced]);
  function reset() {
    setAdvanced(false);
    requestAnimationFrame(() => { window.scrollTo({ top: 0, behavior: 'instant' }); first.current?.focus({ preventScroll: true }); });
  }
  return <>
    <aside className="sceneReview" aria-label="프로토타입 검토 도구">
      <div><b>#218 · 진행 본문</b><span>{advanced ? '다음 문장까지 · 선택 UI는 다음 검토' : '공개를 마친 예시 · 다음으로를 눌러 누적 확인'}</span></div>
      <button onClick={reset}>처음으로</button>
    </aside>
    <main className={`nightScene ${advanced ? 'hasRecord' : ''}`} aria-label="첫날 밤 진행">
      <div className="sceneAtmosphere" aria-hidden="true">
        <img className="sceneWoodcut" src={nightWoodcut} alt="" />
        <div className="sceneMist sceneMistFar"/><div className="sceneMist sceneMistNear"/>
        <div className="sceneEmber"/>
      </div>
      <div className="sceneReading">
        <header className="sceneHeading"><h1>첫날 밤</h1></header>
        <section className={`scenePassage ${advanced ? 'sceneRecord' : 'sceneCurrent'}`} aria-label={advanced ? '완료한 하수인 기록' : '현재 하수인 단계'}>
          <p><em className="sceneRole">하수인</em>인 <Person seat={2}>영희</Person>와<br className="sceneDesktopBreak"/> <Person seat={3}>민수</Person>가 눈을 떴습니다.</p>
          <p>두 사람은 <Person seat={1}>수빈</Person>이<br className="sceneDesktopBreak"/> <em className="sceneRole">악마</em>라는 것을 확인했습니다.</p>
          {!advanced && <button ref={first} className="sceneAdvance" onClick={() => setAdvanced(true)}>다음으로 <span aria-hidden="true">⟶</span></button>}
        </section>
        {advanced && <section ref={next} tabIndex={-1} className="scenePassage sceneCurrent sceneArriving" aria-label="현재 악마 단계">
          <p>이제 <em className="sceneRole">악마</em>인<br className="sceneDesktopBreak"/> <Person seat={1}>수빈</Person>이 눈을 뜹니다.</p>
          <p>수빈에게 알려줄<br className="sceneDesktopBreak"/> 속임수 세 가지를 고릅니다.</p>
        </section>}
      </div>
    </main>
  </>;
}
createRoot(document.getElementById('root')!).render(<NarrativeScene/>);
