import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConceptA } from './ConceptA';
import { ConceptB } from './ConceptB';
import { useGame, type ReviewEvent } from './useGame';
import './review.css';

type ConceptKey = 'a' | 'b';
const concepts: { key: ConceptKey; label: string; hint: string }[] = [
  { key: 'a', label: 'A · 대화방형', hint: '대화가 주 화면. 요청은 입력창 바로 위에 붙는다.' },
  { key: 'b', label: 'B · 광장형', hint: '좌석 원탁이 주 화면. 대화는 아래 시트로 올려 쓴다.' },
];
const events: { key: ReviewEvent; label: string }[] = [
  { key: 'vote', label: '지명 · 투표 요청' },
  { key: 'whisper', label: '귓속말 도착' },
  { key: 'burst', label: '공개 대화 3개' },
];

function useWide() {
  const query = '(min-width: 760px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

// iOS Safari는 키보드가 올라와도 레이아웃 뷰포트를 줄이지 않으므로 visualViewport 높이를 직접 쓴다.
function useViewportHeight(active: boolean) {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    if (!active || !window.visualViewport) return;
    const vv = window.visualViewport;
    const on = () => {
      setH(vv.height);
      window.scrollTo(0, 0);
    };
    on();
    vv.addEventListener('resize', on);
    vv.addEventListener('scroll', on);
    return () => {
      vv.removeEventListener('resize', on);
      vv.removeEventListener('scroll', on);
    };
  }, [active]);
  return h;
}

function App() {
  const game = useGame();
  const wide = useWide();
  const viewportH = useViewportHeight(!wide);
  const [concept, setConcept] = useState<ConceptKey>(() => (new URLSearchParams(location.search).get('c') === 'b' ? 'b' : 'a'));
  const [delayed, setDelayed] = useState(true);
  const [pending, setPending] = useState<{ event: ReviewEvent; at: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [simKeyboard, setSimKeyboard] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('c', concept);
    history.replaceState(null, '', url);
  }, [concept]);

  const { trigger } = game;
  useEffect(() => {
    if (!pending) return;
    const t = window.setInterval(() => {
      if (Date.now() >= pending.at) {
        trigger(pending.event);
        setPending(null);
      } else setTick((n) => n + 1);
    }, 250);
    return () => window.clearInterval(t);
  }, [pending, trigger]);

  const fire = (event: ReviewEvent) => {
    if (delayed) setPending({ event, at: Date.now() + 5000 });
    else game.trigger(event);
    if (!wide) setPanelOpen(false);
  };

  const product = concept === 'a' ? <ConceptA key="a" game={game} /> : <ConceptB key="b" game={game} />;
  void tick;
  const countdown = pending ? Math.max(0, Math.ceil((pending.at - Date.now()) / 1000)) : 0;

  const controls = (
    <>
      <section>
        <h2>시안</h2>
        <div className="rv-seg">
          {concepts.map((c) => (
            <button key={c.key} aria-pressed={concept === c.key} onClick={() => setConcept(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
        <p className="rv-hint">{concepts.find((c) => c.key === concept)?.hint}</p>
      </section>
      <section>
        <h2>사건 보내기</h2>
        <label className="rv-check">
          <input type="checkbox" checked={delayed} onChange={(e) => setDelayed(e.target.checked)} /> 5초 뒤 도착 (먼저 입력창에서 글을 쓰세요)
        </label>
        <div className="rv-events">
          {events.map((e) => (
            <button key={e.key} disabled={!!pending} onClick={() => fire(e.key)}>
              {e.label}
            </button>
          ))}
        </div>
        {pending && <p className="rv-pending">{events.find((e) => e.key === pending.event)?.label} · {countdown}초 뒤 도착</p>}
      </section>
      {wide && (
        <section>
          <h2>화면</h2>
          <label className="rv-check">
            <input type="checkbox" checked={simKeyboard} onChange={(e) => setSimKeyboard(e.target.checked)} /> 입력창을 누르면 키보드 자리 표시
          </label>
        </section>
      )}
      <section>
        <button className="rv-reset" onClick={() => { game.reset(); setPending(null); }}>
          처음 상태로
        </button>
      </section>
      <section className="rv-notes">
        <h2>이번에 확인할 것</h2>
        <ul>
          <li>입력 중에 투표 요청이 오면 알아차릴 수 있는가</li>
          <li>요청에 응답하고 돌아와도 쓰던 글이 남아 있는가</li>
          <li>키보드가 올라온 상태에서도 광장 상황(생사·단계)을 놓치지 않는가</li>
        </ul>
        <p>2일차 낮 · 8인 TB · 나는 3번 서연(초공감자)</p>
      </section>
    </>
  );

  if (wide) {
    return (
      <div className="rv-wide">
        <aside className="rv-panel">
          <header>
            <span className="rv-tag">검토</span>
            <h1>#294 참가자 화면 · 1차 확인</h1>
          </header>
          {controls}
        </aside>
        <main className="rv-stage">
          <PhoneFrame simKeyboard={simKeyboard}>{product}</PhoneFrame>
        </main>
      </div>
    );
  }

  return (
    <div className="rv-narrow" style={viewportH ? { height: viewportH } : undefined}>
      <div className={`rv-bar ${panelOpen ? 'open' : ''}`}>
        <button className="rv-bar-toggle" onClick={() => setPanelOpen((o) => !o)}>
          <span className="rv-tag">검토</span>
          {concepts.find((c) => c.key === concept)?.label}
          {pending && <span className="rv-bar-pending"> · {countdown}초</span>}
          <span className="rv-bar-caret">{panelOpen ? '닫기' : '열기'}</span>
        </button>
        {panelOpen && <div className="rv-bar-body">{controls}</div>}
      </div>
      <div className="rv-product">{product}</div>
    </div>
  );
}

function PhoneFrame({ simKeyboard, children }: { simKeyboard: boolean; children: ReactNode }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
    const onIn = (e: FocusEvent) => setFocused(isField(e.target));
    const onOut = (e: FocusEvent) => setFocused(isField(e.relatedTarget));
    el.addEventListener('focusin', onIn);
    el.addEventListener('focusout', onOut);
    return () => {
      el.removeEventListener('focusin', onIn);
      el.removeEventListener('focusout', onOut);
    };
  }, []);
  const kb = simKeyboard && focused;
  return (
    <div className="rv-phone">
      <div className="rv-phone-screen" ref={ref}>
        <div className="rv-phone-app">{children}</div>
        {kb && (
          <div className="rv-keyboard" onMouseDown={(e) => e.preventDefault()}>
            <span>키보드 자리</span>
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
