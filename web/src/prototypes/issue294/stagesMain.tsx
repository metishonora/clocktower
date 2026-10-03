import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cast } from './cast';
import { PhoneFrame, useViewportHeight, useWide } from './reviewKit';
import { Stage, type StageKind, type Time } from './Stages';
import './review.css';

const kinds: { key: StageKind; label: string; hint: string }[] = [
  { key: 'tower', label: '가 · 시계탑', hint: '광장 한가운데 시계탑. 문자판이 남은 시간이고, 밤에는 종루에 붉은 눈이 뜬다.' },
  { key: 'houses', label: '나 · 각자의 집', hint: '집 한 채가 좌석 하나. 문패가 이름이고, 밤에는 모두 집에 들어가 창이 꺼진다. 유령의 투표권은 문 앞 촛불.' },
  { key: 'fire', label: '다 · 등불 원', hint: '어둠 속 화톳불 둘레의 균등한 원. 불빛 고리가 남은 시간이고, 밤에는 불이 사그라든다.' },
];

function App() {
  const wide = useWide();
  const viewportH = useViewportHeight(!wide);
  const params = new URLSearchParams(location.search);
  const [kind, setKind] = useState<StageKind>((params.get('k') as StageKind) || 'houses');
  const [time, setTime] = useState<Time>(params.get('t') === 'night' ? 'night' : 'day');
  const [count, setCount] = useState<8 | 15>(params.get('n') === '8' ? 8 : 15);
  const [playing, setPlaying] = useState(params.get('play') !== '0');
  const [open, setOpen] = useState(false);
  const c = useMemo(() => cast(count), [count]);
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('k', kind);
    url.searchParams.set('t', time);
    url.searchParams.set('n', String(count));
    history.replaceState(null, '', url);
  }, [kind, time, count]);
  const current = kinds.find((k) => k.key === kind)!;
  const product = <Stage key={`${kind}${time}${count}`} kind={kind} time={time} c={c} playing={playing} />;
  const controls = (
    <>
      <section>
        <h2>무대</h2>
        <div className="rv-events">
          {kinds.map((k) => <button key={k.key} aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</button>)}
        </div>
        <p className="rv-hint">{current.hint}</p>
      </section>
      <section>
        <h2>시간</h2>
        <div className="rv-seg">
          <button aria-pressed={time === 'day'} onClick={() => setTime('day')}>낮 토론</button>
          <button aria-pressed={time === 'night'} onClick={() => setTime('night')}>밤 대기</button>
        </div>
      </section>
      <section>
        <h2>인원</h2>
        <div className="rv-seg">
          {([15, 8] as const).map((n) => <button key={n} aria-pressed={count === n} onClick={() => setCount(n)}>{n}인</button>)}
        </div>
      </section>
      <section>
        <label className="rv-check"><input type="checkbox" checked={playing} onChange={(e) => setPlaying(e.target.checked)} /> 대화 흐름 재생</label>
      </section>
      <section className="rv-notes">
        <h2>이번에 확인할 것</h2>
        <ul>
          <li>시계탑과 악마가 깃든 마을로 느껴지는가</li>
          <li>15인에서 사람·이름·생사를 읽을 수 있는가</li>
          <li>귓속말 중인 두 사람을 공개로 보여 줄 만한가 (청록 점선)</li>
          <li>밤 화면이 모두에게 같고 아무것도 드러내지 않는가</li>
        </ul>
        <p>말풍선은 세 시안 모두 한 줄 · 최근 둘로 제한했다. 하단 버튼과 확성기는 채택한 말하기 화면의 자리만 표시하고 연결하지 않았다.</p>
      </section>
    </>
  );
  if (wide) {
    return (
      <div className="rv-wide">
        <aside className="rv-panel">
          <header><span className="rv-tag">검토</span><h1>#294 광장 무대 재고안</h1></header>
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
          {current.label} · {time === 'day' ? '낮' : '밤'} · {count}인
          <span className="rv-bar-caret">{open ? '닫기' : '열기'}</span>
        </button>
        {open && <div className="rv-bar-body">{controls}</div>}
      </div>
      <div className="rv-product">{product}</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
