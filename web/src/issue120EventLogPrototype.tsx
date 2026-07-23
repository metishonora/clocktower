import { useEffect, useRef, useState } from "react";
import "./sectsAndVioletsFoundationPrototype.css";
import "./issue120EventLogPrototype.css";

type ActiveTab = "roles" | "grimoire" | "play" | "storage";
type Scenario = "normal" | "setupOnly" | "busy";
type PrototypeTheme = "day" | "night";

type PrototypeEvent = {
  id: string;
  summary: string;
  checkpointId: string;
};

type PrototypeCheckpoint = {
  id: string;
  kind: "setup" | "phase";
  summary: string;
};

type NumberedPrototypeEvent = {
  event: PrototypeEvent;
  number: number;
};

const initialEvents: PrototypeEvent[] = [
  { id: "setup", checkpointId: "setup", summary: "초기 설정 확정: 7명" },
  { id: "philosopher", checkpointId: "philosopher", summary: "철학자 단계 처리 완료" },
  { id: "minion-info", checkpointId: "minion-info", summary: "하수인 정보 공개 완료" },
  { id: "demon-info", checkpointId: "demon-info", summary: "악마 정보 공개 완료" },
  { id: "snake-charmer", checkpointId: "snake-charmer", summary: "뱀 조련사: 3번 서준 → 7번 준호 · 악마 아님" },
  { id: "clockmaker", checkpointId: "clockmaker", summary: "시계공 정보: 악마와 가장 가까운 하수인 사이 2칸" },
  { id: "day-start", checkpointId: "day-start", summary: "2일차 낮 시작" },
  { id: "nomination-vote", checkpointId: "nomination-vote", summary: "2번 현우 → 4번 도윤 지명 투표 · 5표" },
  { id: "execution", checkpointId: "execution", summary: "4번 도윤 처형 확정" },
  { id: "execution-death", checkpointId: "execution", summary: "처형 결과: 4번 도윤 사망" },
];

const initialCheckpoints: PrototypeCheckpoint[] = [
  { id: "setup", kind: "setup", summary: "초기 설정 확정" },
  { id: "philosopher", kind: "phase", summary: "철학자 행동 완료" },
  { id: "minion-info", kind: "phase", summary: "하수인 정보 공개" },
  { id: "demon-info", kind: "phase", summary: "악마 정보 공개" },
  { id: "snake-charmer", kind: "phase", summary: "뱀 조련사 행동 완료" },
  { id: "clockmaker", kind: "phase", summary: "시계공 정보 공개" },
  { id: "day-start", kind: "phase", summary: "2일차 낮 시작" },
  { id: "nomination-vote", kind: "phase", summary: "2번 현우 → 4번 도윤 지명 투표" },
  { id: "execution", kind: "phase", summary: "4번 도윤 처형 · 사망" },
];

const severeError = "가져온 게임을 끝까지 재생하지 못했습니다. 현재 게임은 그대로 유지됩니다.";
const warningMessage = "보르톡스가 살아 있습니다. 정보가 거짓이어야 하는지 확인하세요.";

export function Issue120EventLogPrototype() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("storage");
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [isDay, setIsDay] = useState(true);
  const [events, setEvents] = useState(initialEvents);
  const [checkpoints, setCheckpoints] = useState(initialCheckpoints);
  const [undoCheckpoint, setUndoCheckpoint] = useState<PrototypeCheckpoint>();
  const [errorOpen, setErrorOpen] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const undoTriggerRef = useRef<HTMLButtonElement>(null);
  const errorTriggerRef = useRef<HTMLButtonElement>(null);
  const warningTriggerRef = useRef<HTMLButtonElement>(null);

  const latestUndoCheckpoint = [...checkpoints].reverse().find((checkpoint) => checkpoint.kind === "phase");
  const undoEvents: NumberedPrototypeEvent[] = undoCheckpoint
    ? events
        .map((event, index) => ({ event, number: index + 1 }))
        .filter(({ event }) => event.checkpointId === undoCheckpoint.id)
        .reverse()
    : [];
  const transitionBusy = scenario === "busy";

  function changeScenario(nextScenario: Scenario) {
    setScenario(nextScenario);
    setUndoCheckpoint(undefined);
    if (nextScenario === "setupOnly") {
      setEvents(initialEvents.slice(0, 1));
      setCheckpoints(initialCheckpoints.slice(0, 1));
      setActiveTab("roles");
      return;
    }
    setEvents(initialEvents);
    setCheckpoints(initialCheckpoints);
  }

  function closeUndo() {
    setUndoCheckpoint(undefined);
    requestAnimationFrame(() => undoTriggerRef.current?.focus());
  }

  function confirmUndo() {
    if (!undoCheckpoint || latestUndoCheckpoint?.id !== undoCheckpoint.id) {
      closeUndo();
      return;
    }
    setEvents((current) => current.filter((event) => event.checkpointId !== undoCheckpoint.id));
    setCheckpoints((current) => current.filter((checkpoint) => checkpoint.id !== undoCheckpoint.id));
    setUndoCheckpoint(undefined);
  }

  function closeError() {
    setErrorOpen(false);
    requestAnimationFrame(() => errorTriggerRef.current?.focus());
  }

  function closeWarning() {
    setWarningVisible(false);
    requestAnimationFrame(() => warningTriggerRef.current?.focus());
  }

  return (
    <main
      className={`snvFoundationPrototype issue120Prototype ${isDay ? "snvDayMode" : "snvNightMode"}`}
      aria-label="이슈 120 이벤트 로그 프로토타입"
    >
      <header className="snvPrototypeHeader" role="banner">
        <div>
          <span className="snvEyebrow">ISSUE 120 · EVENT HISTORY REVIEW</span>
          <h1>Sects &amp; Violets</h1>
          <p>저장 이력과 전역 Undo 피드백</p>
        </div>
        <div className="issue120PhaseActions" aria-label="현재 페이즈와 되돌리기">
          {latestUndoCheckpoint ? (
            <button
              ref={undoTriggerRef}
              type="button"
              className="issue120GlobalUndo"
              aria-label={`최근 행동 되돌리기: ${latestUndoCheckpoint.summary}`}
              aria-haspopup="dialog"
              disabled={transitionBusy}
              onClick={() => setUndoCheckpoint(latestUndoCheckpoint)}
            >
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <path d="M12.2 9.2 6.5 14.8l5.7 5.7" />
                <path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" />
              </svg>
              <span className="issue120IconTooltip" role="tooltip">최근 행동 되돌리기</span>
            </button>
          ) : (
            <button
              type="button"
              className="issue120GlobalUndo empty"
              data-visual-state="muted"
              aria-hidden="true"
              tabIndex={-1}
              disabled
            >
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <path d="M12.2 9.2 6.5 14.8l5.7 5.7" />
                <path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" />
              </svg>
            </button>
          )}
          <span
            className={`snvPhaseMark ${isDay ? "snvSunMark" : "snvMoonMark"}`}
            role="img"
            aria-label={isDay ? "2일차 낮" : "2일차 밤"}
          >{isDay ? "☀" : "☾"}</span>
        </div>
      </header>

      <section className="issue120ReviewBar" aria-label="프로토타입 상태 선택">
        <div>
          <span>게임 상태</span>
          <button type="button" aria-pressed={scenario === "normal"} onClick={() => changeScenario("normal")}>일반 진행</button>
          <button type="button" aria-pressed={scenario === "setupOnly"} onClick={() => changeScenario("setupOnly")}>설정만 확정</button>
          <button type="button" aria-pressed={scenario === "busy"} onClick={() => changeScenario("busy")}>전환 중</button>
        </div>
        <div>
          <span>검토 도구</span>
          <button type="button" onClick={() => setIsDay((current) => !current)}>{isDay ? "밤 화면 보기" : "낮 화면 보기"}</button>
          <button ref={errorTriggerRef} type="button" onClick={() => setErrorOpen(true)}>심각한 오류 보기</button>
          <button ref={warningTriggerRef} type="button" onClick={() => setWarningVisible(true)}>경고 보기</button>
        </div>
      </section>

      <nav className="snvUtilityTabs" aria-label="게임 데이터">
        <button type="button" className="snvNewGameTab">새 게임</button>
        <button
          type="button"
          className={`snvStorageTab ${activeTab === "storage" ? "active" : ""}`}
          aria-current={activeTab === "storage" ? "page" : undefined}
          onClick={() => setActiveTab("storage")}
        >저장 / 불러오기</button>
      </nav>
      <p className={`snvAutosaveStatus ${transitionBusy ? "" : "saved"}`} role="status">
        {transitionBusy ? "상태 재생 중…" : "자동 저장 완료 14:32:18"}
      </p>

      <nav className="snvSurfaceTabs" aria-label="작업 단계">
        <button type="button" className={activeTab === "roles" ? "active" : ""} aria-current={activeTab === "roles" ? "page" : undefined} onClick={() => setActiveTab("roles")}>직업</button>
        <button type="button" className={activeTab === "grimoire" ? "active" : ""} aria-current={activeTab === "grimoire" ? "page" : undefined} onClick={() => setActiveTab("grimoire")}>마도서</button>
        <button type="button" className={activeTab === "play" ? "active" : ""} aria-current={activeTab === "play" ? "page" : undefined} onClick={() => setActiveTab("play")}>진행</button>
      </nav>

      {activeTab === "storage" ? (
        <StoragePage events={events} />
      ) : (
        <PrototypePage activeTab={activeTab} isDay={isDay} />
      )}

      {undoCheckpoint ? (
        <UndoDialog theme={isDay ? "day" : "night"} events={undoEvents} onCancel={closeUndo} onConfirm={confirmUndo} />
      ) : null}
      {errorOpen ? <ErrorDialog theme={isDay ? "day" : "night"} onClose={closeError} /> : null}
      {warningVisible ? (
        <aside className="issue120WarningNotification" role="status" aria-live="polite" aria-label="게임 경고">
          <span aria-hidden="true">!</span>
          <div><strong>게임 경고</strong><p>{warningMessage}</p></div>
          <button type="button" aria-label="경고 닫기" onClick={closeWarning}>×</button>
        </aside>
      ) : null}
    </main>
  );
}

function StoragePage({ events }: { events: PrototypeEvent[] }) {
  const newestFirst = [...events].reverse();
  return (
    <section className="issue120StorageSurface snvTabPanel" aria-label="저장 및 불러오기">
      <div className="issue120StorageActions">
        <article><span>현재 게임</span><h2>JSON 내보내기</h2><button type="button">export JSON</button></article>
        <article><span>저장된 게임</span><h2>JSON 가져오기</h2><button type="button">import JSON</button></article>
      </div>
      <section className="issue120EventLog" aria-label="이벤트 로그">
        <div className="issue120EventLogHeader"><h2>이벤트 로그</h2><strong>{events.length}건</strong></div>
        {newestFirst.length ? (
          <ol className="issue120ScrollableEventList" aria-label="확정 이벤트 최신순" tabIndex={0}>
            {newestFirst.map((event, index) => (
              <li key={event.id}>
                <span>{String(events.length - index).padStart(2, "0")}</span>
                <p>{event.summary}</p>
              </li>
            ))}
          </ol>
        ) : <p className="issue120EmptyLog">확정된 이벤트가 없습니다.</p>}
      </section>
    </section>
  );
}

function PrototypePage({ activeTab, isDay }: { activeTab: Exclude<ActiveTab, "storage">; isDay: boolean }) {
  const content = activeTab === "roles"
    ? { eyebrow: "직업", title: "S&V 직업 선택", body: "현재 선택된 7개 직업과 인원 구성을 검토합니다." }
    : activeTab === "grimoire"
      ? { eyebrow: "마도서", title: "2일차 플레이어 상태", body: "생존 6명 · 사망 1명 · 처형 후보 도윤" }
      : { eyebrow: isDay ? "2일차 낮" : "2일차 밤", title: isDay ? "지명 및 투표" : "보르톡스 행동", body: isDay ? "현재 후보 4번 도윤 · 5표" : "대상을 선택하고 밤 행동을 확정합니다." };
  return (
    <section className="issue120PagePlaceholder snvTabPanel" aria-label={`${content.eyebrow} 화면`}>
      <span>{content.eyebrow}</span><h2>{content.title}</h2><p>{content.body}</p>
      <button type="button">{activeTab === "play" ? "현재 행동 계속" : "선택 상태 검토"}</button>
    </section>
  );
}

function UndoDialog({ theme, events, onCancel, onConfirm }: {
  theme: PrototypeTheme;
  events: NumberedPrototypeEvent[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);
  return (
    <div className="issue120DialogBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section ref={dialogRef} className="issue120Dialog issue120UndoDialog" data-theme={theme} role="dialog" aria-modal="true" aria-labelledby="issue120-undo-title">
        <h2 id="issue120-undo-title">Undo</h2>
        <p className="issue120UndoLabel">되돌릴 행동</p>
        <ol className="issue120UndoEventStack" aria-label="취소될 이벤트">
          {events.map(({ event, number }) => (
            <li key={event.id}>
              <span>{String(number).padStart(2, "0")}</span>
              <p>{event.summary}</p>
            </li>
          ))}
        </ol>
        <p className="issue120UndoNotice">위 이벤트를 취소하고 직전 상태로 돌아갑니다.</p>
        <footer><button ref={cancelRef} type="button" onClick={onCancel}>취소</button><button type="button" className="destructive" onClick={onConfirm}>되돌리기</button></footer>
      </section>
    </div>
  );
}

function ErrorDialog({ theme, onClose }: { theme: PrototypeTheme; onClose: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        event.preventDefault();
        confirmRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  return (
    <div className="issue120DialogBackdrop">
      <section className="issue120Dialog issue120ErrorDialog" data-theme={theme} role="dialog" aria-modal="true" aria-labelledby="issue120-error-title">
        <h2 id="issue120-error-title">작업 실패</h2><p>{severeError}</p>
        <footer><button ref={confirmRef} type="button" onClick={onClose}>확인</button></footer>
      </section>
    </div>
  );
}
