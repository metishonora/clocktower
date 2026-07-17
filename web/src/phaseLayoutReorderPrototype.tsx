import { useState } from "react";
import "./phaseLayoutReorderPrototype.css";

type PrototypeVariant = "vertical" | "compact";
type PrototypeView = "desktop" | "mobile";

type OverviewStep = {
  id: string;
  label: string;
  status: "complete" | "current" | "upcoming";
};

const overviewSteps: OverviewStep[] = [
  { id: "poisoner", label: "독살자: 6번 현우", status: "complete" },
  { id: "chef", label: "요리사: 2번 준호", status: "complete" },
  { id: "empath", label: "공감능력자: 3번 서연", status: "current" },
  { id: "fortune-teller", label: "점쟁이: 4번 도윤", status: "upcoming" },
  { id: "monk", label: "수도승: 8번 유나", status: "upcoming" },
  { id: "imp", label: "임프: 7번 태오", status: "upcoming" },
];

const seats = [
  ["1", "민지", "세탁부"],
  ["2", "준호", "요리사"],
  ["3", "서연", "공감능력자"],
  ["4", "도윤", "점쟁이"],
  ["5", "하린", "은둔자"],
  ["6", "현우", "독살자"],
  ["7", "태오", "임프"],
  ["8", "유나", "수도승"],
];

export function PhaseLayoutReorderPrototype() {
  const params = new URLSearchParams(window.location.search);
  const [variant, setVariant] = useState<PrototypeVariant>(
    params.get("variant") === "compact" ? "compact" : "vertical",
  );
  const [view, setView] = useState<PrototypeView>(params.get("view") === "mobile" ? "mobile" : "desktop");
  const [overviewOpen, setOverviewOpen] = useState(false);

  function selectVariant(nextVariant: PrototypeVariant) {
    setVariant(nextVariant);
    updateUrl({ variant: nextVariant, view });
  }

  function selectView(nextView: PrototypeView) {
    setView(nextView);
    setOverviewOpen(false);
    updateUrl({ variant, view: nextView });
  }

  return (
    <main className={`phaseReorderPrototype view-${view}`}>
      <header className="phaseReorderPrototypeHeader">
        <div>
          <p>이슈 #28 개발 전용 프로토타입</p>
          <h1>단계 순서를 먼저, 현재 행동을 다음에</h1>
        </div>
        <div className="phaseReorderPrototypeControls">
          <nav aria-label="데스크톱 개요 비교">
            <button
              type="button"
              className={variant === "vertical" ? "selected" : ""}
              onClick={() => selectVariant("vertical")}
            >
              Variant A · 세로 목록
            </button>
            <button
              type="button"
              className={variant === "compact" ? "selected" : ""}
              onClick={() => selectVariant("compact")}
            >
              Variant B · 압축 진행표시
            </button>
          </nav>
          <nav aria-label="화면 크기 미리보기">
            <button type="button" className={view === "desktop" ? "selected" : ""} onClick={() => selectView("desktop")}>iPad</button>
            <button type="button" className={view === "mobile" ? "selected" : ""} onClick={() => selectView("mobile")}>모바일</button>
          </nav>
        </div>
      </header>

      <section className="phaseReorderPreviewFrame" aria-label={`${view === "desktop" ? "iPad" : "모바일"} 미리보기`}>
        <div className="phaseReorderAppShell">
          <PrototypeGrimoire />
          <aside className="phaseReorderRail">
            <section className="phaseReorderPanel" aria-label="단계 제어 패널">
              <header className="phaseReorderPhaseHeader">
                <div><p>첫 번째 밤</p><h2>공감능력자: 3번 서연</h2></div>
                <span>숫자</span>
              </header>

              {view === "mobile" ? (
                <details
                  className="phaseReorderDisclosure"
                  aria-label="첫 번째 밤 순서 접기"
                  open={overviewOpen}
                  onToggle={(event) => setOverviewOpen(event.currentTarget.open)}
                >
                  <summary>
                    <span>첫 번째 밤 순서</span>
                    <small>2 / 6 완료</small>
                  </summary>
                  <PhaseOverview variant={variant} />
                </details>
              ) : (
                <PhaseOverview variant={variant} />
              )}

              <CurrentAction />
            </section>
            <section className="phaseReorderAuxiliary"><span>설정 및 불러오기</span><small>8명</small></section>
            <section className="phaseReorderAuxiliary"><span>이벤트 로그</span><small>3건</small></section>
          </aside>
        </div>
      </section>

      <output data-testid="phase-layout-reorder-prototype-state" className="phaseReorderPrototypeState">
        {JSON.stringify({ variant, view, overviewOpen })}
      </output>
    </main>
  );
}

function PhaseOverview({ variant }: { variant: PrototypeVariant }) {
  return (
    <section className={`phaseReorderOverview ${variant}`} aria-label="첫 번째 밤 순서">
      <header><h3>첫 번째 밤 순서</h3><span>2 / 6 완료</span></header>
      <ol>
        {overviewSteps.map((step, index) => (
          <li className={step.status} key={step.id}>
            <i>{step.status === "complete" ? "✓" : index + 1}</i>
            <span>{step.label}</span>
            <strong>{statusLabel(step.status)}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CurrentAction() {
  return (
    <section className="phaseReorderCurrentAction" aria-label="현재 단계">
      <article className="phaseReorderActor">
        <span>공</span>
        <div>
          <small>행동자</small>
          <h3>공감능력자</h3>
          <strong>3번 서연</strong>
          <p>살아있는 이웃 중 악한 플레이어 수를 알아냅니다.</p>
        </div>
      </article>
      <section className="phaseReorderPrompt">
        <small>지금 할 일</small>
        <strong>서연에게 전달할 악한 이웃 수를 선택하세요.</strong>
      </section>
      <div className="phaseReorderChoices" role="group" aria-label="전달 숫자">
        {["0", "1", "2"].map((value) => <button type="button" className={value === "1" ? "selected" : ""} key={value}>{value}</button>)}
      </div>
      <div className="phaseReorderActions">
        <button type="button" className="secondary">건너뛰기</button>
        <button type="button" className="primary">확정</button>
      </div>
    </section>
  );
}

function PrototypeGrimoire() {
  return (
    <section className="phaseReorderGrimoire" aria-label="프로토타입 그리모어">
      <header><div><p>그리모어</p><h2>Trouble Brewing</h2></div><span>설정 확정</span></header>
      <div className="phaseReorderTable">
        <strong>첫 번째 밤</strong>
        {seats.map(([seat, name, character], index) => (
          <article className={seat === "3" ? "active" : ""} style={{ "--seat-index": index } as React.CSSProperties} key={seat}>
            <span>{seat}</span><strong>{name}</strong><small>{character}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function statusLabel(status: OverviewStep["status"]) {
  if (status === "complete") return "완료";
  if (status === "current") return "현재";
  return "예정";
}

function updateUrl({ variant, view }: { variant: PrototypeVariant; view: PrototypeView }) {
  const url = new URL(window.location.href);
  url.searchParams.set("prototype", "phase-layout-reorder");
  url.searchParams.set("variant", variant);
  url.searchParams.set("view", view);
  window.history.replaceState(null, "", url);
}
