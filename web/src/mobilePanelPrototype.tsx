import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CommunityContentNotice } from "./components/CommunityContentNotice";
import "./mobilePanelPrototype.css";

type Variant = "drag" | "bookmark";
type PanelState = "compact" | "middle" | "expanded" | "controls" | "grimoire";

const heightRatios = {
  compact: 0.2,
  middle: 0.5,
  expanded: 0.85,
} as const;

const seats = [
  { seat: 1, name: "민지", character: "세탁부", x: 50, y: 7 },
  { seat: 2, name: "준호", character: "요리사", x: 79, y: 18 },
  { seat: 3, name: "서연", character: "공감능력자", x: 93, y: 48 },
  { seat: 4, name: "도윤", character: "학살자", x: 80, y: 79 },
  { seat: 5, name: "지우", character: "은둔자", x: 50, y: 93 },
  { seat: 6, name: "현우", character: "독살자", x: 20, y: 79 },
  { seat: 7, name: "하린", character: "시장", x: 7, y: 48 },
  { seat: 8, name: "유나", character: "주정뱅이", x: 21, y: 18 },
] as const;

export function MobilePanelPrototype() {
  const initialViewportHeight = currentViewportHeight();
  const [variant, setVariant] = useState<Variant>("drag");
  const [panelState, setPanelState] = useState<PanelState>("expanded");
  const [panelHeight, setPanelHeight] = useState(() => heightForState(initialViewportHeight, "expanded"));
  const viewportHeightRef = useRef(initialViewportHeight);
  const panelHeightRef = useRef(panelHeight);
  const panelStateRef = useRef(panelState);
  const dragCleanupRef = useRef<(() => void) | undefined>(undefined);

  function commitHeight(height: number) {
    panelHeightRef.current = height;
    setPanelHeight(height);
  }

  function commitState(state: PanelState, viewportHeight = viewportHeightRef.current) {
    panelStateRef.current = state;
    setPanelState(state);
    commitHeight(heightForState(viewportHeight, state));
  }

  function selectVariant(next: Variant) {
    dragCleanupRef.current?.();
    setVariant(next);
    commitState(next === "drag" ? "expanded" : "controls");
  }

  function resetVariant() {
    commitState(variant === "drag" ? "expanded" : "controls");
  }

  function toggleBookmark() {
    commitState(panelStateRef.current === "grimoire" ? "controls" : "grimoire");
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const startY = event.clientY;
    const startHeight = panelHeightRef.current;
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture?.(pointerId);
    event.preventDefault();

    function move(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      const viewportHeight = viewportHeightRef.current;
      const compact = heightForState(viewportHeight, "compact");
      const expanded = heightForState(viewportHeight, "expanded");
      commitHeight(clamp(startHeight + startY - moveEvent.clientY, compact, expanded));
    }

    function finish(finishEvent: PointerEvent) {
      if (finishEvent.pointerId !== pointerId) return;
      const viewportHeight = viewportHeightRef.current;
      const next = nearestDragState(panelHeightRef.current, viewportHeight);
      cleanup();
      commitState(next, viewportHeight);
    }

    function cleanup() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      dragCleanupRef.current = undefined;
    }

    dragCleanupRef.current?.();
    dragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  useEffect(() => {
    const visualViewport = window.visualViewport;
    function syncViewport() {
      const nextViewportHeight = currentViewportHeight();
      viewportHeightRef.current = nextViewportHeight;
      commitHeight(heightForState(nextViewportHeight, panelStateRef.current));
    }
    window.addEventListener("resize", syncViewport);
    visualViewport?.addEventListener("resize", syncViewport);
    return () => {
      dragCleanupRef.current?.();
      window.removeEventListener("resize", syncViewport);
      visualViewport?.removeEventListener("resize", syncViewport);
    };
  }, []);

  return (
    <main
      className={`mobilePanelPrototype variant-${variant}`}
      aria-label="모바일 패널 전환 프로토타입"
      data-panel-state={panelState}
      style={{ "--prototype-panel-height": `${panelHeight}px` } as CSSProperties}
    >
      <header className="mobilePanelPrototypeToolbar">
        <div>
          <span>이슈 #65 프로토타입</span>
          <strong>모바일 그리모어 열기</strong>
        </div>
        <nav aria-label="프로토타입 방식">
          <button type="button" className={variant === "drag" ? "selected" : ""} onClick={() => selectVariant("drag")}>A · 드래그</button>
          <button type="button" className={variant === "bookmark" ? "selected" : ""} onClick={() => selectVariant("bookmark")}>B · 책갈피</button>
          <button type="button" onClick={resetVariant}>초기화</button>
        </nav>
      </header>

      <div className="mobilePanelPrototypePage">
        <section className="panel mobilePanelPrototypeGrimoire">
          <div className="sectionHeader">
            <div><p className="eyebrow">그리모어</p><h1>Trouble Brewing</h1></div>
            <span className="phaseBadge">낮 1일차</span>
          </div>
          <div className="mobilePanelPrototypeMap">
            <div className="mobilePanelPrototypeTable"><span>생존 7명</span><strong>처형 기준 4표</strong></div>
            {seats.map((player) => (
              <div
                className={`mobilePanelPrototypeSeat ${player.seat === 5 ? "dead" : ""}`}
                key={player.seat}
                style={{ "--seat-x": `${player.x}%`, "--seat-y": `${player.y}%` } as CSSProperties}
              >
                <span>{player.seat}</span><strong>{player.name}</strong><small>{player.character}</small>
              </div>
            ))}
          </div>
          <section className="mobilePanelPrototypeLog">
            <strong>최근 상태</strong>
            <span>5번 지우 사망 · 유령표 있음</span>
            <span>오늘 지명 가능 · 처형 없음</span>
          </section>
        </section>
        <CommunityContentNotice />
      </div>

      <section className="panel mobilePanelPrototypeSheet">
        {variant === "drag" ? (
          <div className="mobilePanelPrototypeHandle" data-testid="drag-handle" onPointerDown={startDrag}>
            <span />
          </div>
        ) : (
          <button
            type="button"
            className="mobilePanelPrototypeBookmark"
            data-testid="bookmark-toggle"
            onClick={toggleBookmark}
          >
            <span aria-hidden="true" />
          </button>
        )}
        <div className="mobilePanelPrototypeContent">
          <div className="sectionHeader compact mobilePanelPrototypePhaseHeader">
            <div><p className="eyebrow">낮 1일차</p><h2>현재 단계</h2></div>
            <span className="phaseBadge">토론</span>
          </div>
          <section className="mobilePanelPrototypeStatus">
            <div><span>생존</span><strong>7명</strong></div>
            <div><span>처형 기준</span><strong>4표</strong></div>
            <div><span>유령표</span><strong>1장</strong></div>
          </section>
          <section className="currentStepCard mobilePanelPrototypeCurrent">
            <p className="eyebrow">공개 토론</p>
            <h3>플레이어 토론 진행</h3>
            <p>밀담을 마치고 지명을 받을 준비가 되면 다음 단계로 이동합니다.</p>
            <div className="stepActions">
              <button type="button" className="primaryButton">지명 시작</button>
              <button type="button" className="secondaryButton">밤으로 이동</button>
            </div>
          </section>
          <details className="phaseOverviewDisclosure" open>
            <summary><span>단계 개요</span><small>3 / 7 완료</small></summary>
            <ol className="mobilePanelPrototypeSteps">
              <li className="complete"><span>1</span><div><strong>새벽 정리</strong><small>완료</small></div></li>
              <li className="complete"><span>2</span><div><strong>사망 공지</strong><small>완료</small></div></li>
              <li className="complete"><span>3</span><div><strong>밀담</strong><small>완료</small></div></li>
              <li className="current"><span>4</span><div><strong>공개 토론</strong><small>현재</small></div></li>
              <li><span>5</span><div><strong>지명 및 투표</strong><small>대기</small></div></li>
              <li><span>6</span><div><strong>처형</strong><small>대기</small></div></li>
              <li><span>7</span><div><strong>밤 전환</strong><small>대기</small></div></li>
            </ol>
          </details>
        </div>
      </section>
    </main>
  );
}

function currentViewportHeight() {
  return Math.round(window.visualViewport?.height ?? window.innerHeight);
}

function heightForState(viewportHeight: number, state: PanelState) {
  const dragState = state === "controls" ? "expanded" : state === "grimoire" ? "compact" : state;
  return Math.round(viewportHeight * heightRatios[dragState]);
}

function nearestDragState(height: number, viewportHeight: number): "compact" | "middle" | "expanded" {
  const states = ["compact", "middle", "expanded"] as const;
  return states.reduce((nearest, candidate) =>
    Math.abs(heightForState(viewportHeight, candidate) - height) <
    Math.abs(heightForState(viewportHeight, nearest) - height)
      ? candidate
      : nearest,
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
