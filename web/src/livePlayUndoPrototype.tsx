import { useEffect, useRef, useState } from "react";
import "./livePlayUndoPrototype.css";

type PrototypeVariant = "A" | "B";
type PrototypeScenario = "normal" | "reveal" | "setupOnly" | "busy";

type PrototypeEvent = {
  id: string;
  summary: string;
};

const setupEvent: PrototypeEvent = { id: "setup", summary: "게임 설정 확정" };
const poisonerEvent: PrototypeEvent = { id: "poisoner", summary: "독살자가 2번 준호를 선택함" };
const chefEvent: PrototypeEvent = { id: "chef", summary: "요리사 정보 확정 · 1쌍 공개" };

const liveEvents = [setupEvent, poisonerEvent, chefEvent];

export function LivePlayUndoPrototype() {
  const [variant, setVariant] = useState<PrototypeVariant>(() =>
    new URLSearchParams(window.location.search).get("variant") === "B" ? "B" : "A",
  );
  const [scenario, setScenario] = useState<PrototypeScenario>("normal");
  const [events, setEvents] = useState<PrototypeEvent[]>(liveEvents);
  const [dialogEvent, setDialogEvent] = useState<PrototypeEvent>();
  const [replayedStep, setReplayedStep] = useState("empath");
  const undoTriggerRef = useRef<HTMLButtonElement>(null);

  const latestEvent = events.at(-1);
  const removableEvent = latestEvent?.id === "setup" ? undefined : latestEvent;
  const busy = scenario === "busy";

  function selectVariant(nextVariant: PrototypeVariant) {
    setVariant(nextVariant);
    const url = new URL(window.location.href);
    url.searchParams.set("prototype", "live-play-undo");
    url.searchParams.set("variant", nextVariant);
    window.history.replaceState(null, "", url);
  }

  function selectScenario(nextScenario: PrototypeScenario) {
    setScenario(nextScenario);
    setEvents(nextScenario === "setupOnly" ? [setupEvent] : liveEvents);
    setReplayedStep("empath");
    setDialogEvent(undefined);
  }

  function openUndo() {
    if (removableEvent && !busy) setDialogEvent(removableEvent);
  }

  function closeUndo() {
    setDialogEvent(undefined);
    requestAnimationFrame(() => undoTriggerRef.current?.focus());
  }

  function confirmUndo() {
    if (!dialogEvent || events.at(-1)?.id !== dialogEvent.id) {
      closeUndo();
      return;
    }
    setEvents((currentEvents) => currentEvents.slice(0, -1));
    setReplayedStep("chef");
    setDialogEvent(undefined);
  }

  return (
    <main className="liveUndoPrototype">
      <header className="liveUndoPrototypeHeader">
        <div>
          <p>이슈 #43 개발 전용 프로토타입</p>
          <h1>최근 확정 행동 되돌리기</h1>
        </div>
        <nav aria-label="배치 비교">
          <button className={variant === "A" ? "selected" : ""} type="button" onClick={() => selectVariant("A")}>Variant A · 현재 행동</button>
          <button className={variant === "B" ? "selected" : ""} type="button" onClick={() => selectVariant("B")}>Variant B · 최근 이벤트</button>
        </nav>
      </header>

      <nav className="liveUndoScenarioSwitcher" aria-label="상태 시나리오">
        <button className={scenario === "normal" ? "selected" : ""} type="button" onClick={() => selectScenario("normal")}>일반 진행</button>
        <button className={scenario === "reveal" ? "selected" : ""} type="button" onClick={() => selectScenario("reveal")}>Reveal 후속</button>
        <button className={scenario === "setupOnly" ? "selected" : ""} type="button" onClick={() => selectScenario("setupOnly")}>설정만 확정</button>
        <button className={scenario === "busy" ? "selected" : ""} type="button" onClick={() => selectScenario("busy")}>전환 중</button>
      </nav>

      <div className="liveUndoWorkspace">
        <section className="liveUndoGrimoire" aria-label="프로토타입 그리모어">
          <div className="liveUndoTable">
            <span>첫 번째 밤</span>
            <strong>{replayedStep === "chef" ? "2 / 6 완료" : "3 / 6 완료"}</strong>
            <small>{busy ? "다음 상태 재생 중" : "상태 재생 완료"}</small>
          </div>
          {[
            ["1", "민지", "세탁부"], ["2", "준호", "요리사"], ["3", "서연", "공감능력자"],
            ["4", "도윤", "점쟁이"], ["5", "하린", "은둔자"], ["6", "현우", "임프"],
          ].map(([seat, name, character]) => (
            <div className={`liveUndoSeat seat${seat}`} key={seat}>
              <span>{seat}</span><strong>{name}</strong><small>{character}</small>
            </div>
          ))}
        </section>

        <aside className="liveUndoRail">
          <section className="liveUndoPanel">
            {scenario === "reveal" && events.length === 3 ? (
              <section aria-label="확정된 Reveal 후속 조치" className="liveUndoRevealFollowup">
                <p>첫 번째 밤 · 후속 조치</p>
                <h2>확정된 정보 공개</h2>
                <strong>준호 · 요리사</strong>
                <button type="button">Reveal</button>
                <button type="button">다음 단계로 계속</button>
              </section>
            ) : (
              <section aria-label="현재 단계 입력" className="liveUndoCurrentStep">
                <p>첫 번째 밤 · 현재 행동</p>
                <h2>{replayedStep === "chef" ? "요리사 정보 입력" : "공감능력자 정보 입력"}</h2>
                <button type="button">확정</button>
              </section>
            )}

            {variant === "A" && removableEvent ? (
              <UndoSurface
                label="현재 행동"
                event={removableEvent}
                disabled={busy}
                triggerRef={undoTriggerRef}
                onUndo={openUndo}
              />
            ) : null}
          </section>

          <section className="liveUndoPanel liveUndoSetup">
            <p>설정</p>
            <strong>초기 Grimoire 준비됨</strong>
            {events.length === 1 ? <button type="button">설정 다시 수정</button> : null}
            <button type="button">새 설정</button>
          </section>

          <section className="liveUndoPanel liveUndoEventLog">
            <div>
              <p>이벤트 로그</p>
              <span>{events.length}건</span>
            </div>
            <ol>
              {events.map((event) => (
                <li key={event.id}>
                  {variant === "B" && event.id === removableEvent?.id ? (
                    <UndoSurface
                      label="최근 이벤트"
                      event={event}
                      disabled={busy}
                      triggerRef={undoTriggerRef}
                      onUndo={openUndo}
                    />
                  ) : event.summary}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <output data-testid="live-play-undo-prototype-state" className="liveUndoPrototypeState">
        {JSON.stringify({ variant, scenario, eventCount: events.length, replayedStep, dialogOpen: Boolean(dialogEvent) })}
      </output>

      {dialogEvent ? <UndoDialog event={dialogEvent} onCancel={closeUndo} onConfirm={confirmUndo} /> : null}
    </main>
  );
}

function UndoSurface({
  label,
  event,
  disabled,
  triggerRef,
  onUndo,
}: {
  label: "현재 행동" | "최근 이벤트";
  event: PrototypeEvent;
  disabled: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onUndo: () => void;
}) {
  return (
    <section className={`liveUndoAction liveUndoAction${label === "현재 행동" ? "A" : "B"}`} aria-label={label}>
      <span>{label}</span>
      <strong>{event.summary}</strong>
      <button ref={triggerRef} type="button" disabled={disabled} onClick={onUndo}>Undo</button>
    </section>
  );
}

function UndoDialog({ event, onCancel, onConfirm }: { event: PrototypeEvent; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    function onKeyDown(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="liveUndoDialogBackdrop" onMouseDown={(eventTarget) => {
      if (eventTarget.target === eventTarget.currentTarget) onCancel();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="live-undo-dialog-title" className="liveUndoDialog">
        <p>확정 행동 삭제</p>
        <h2 id="live-undo-dialog-title">최근 확정 행동을 되돌릴까요?</h2>
        <strong>되돌릴 항목: {event.summary}</strong>
        <div>
          <button type="button" autoFocus onClick={onCancel}>취소</button>
          <button type="button" className="destructive" onClick={onConfirm}>되돌리기</button>
        </div>
      </section>
    </div>
  );
}
