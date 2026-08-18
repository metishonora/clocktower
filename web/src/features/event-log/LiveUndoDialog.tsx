import { useEffect, useRef } from "react";
import type { GameEvent } from "../../core/types";

export function LiveUndoDialog({
  events,
  onCancel,
  onConfirm,
}: {
  events: Pick<GameEvent, "id" | "summary">[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function handleKeyDown(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") {
        keyEvent.preventDefault();
        onCancel();
        return;
      }
      if (keyEvent.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (keyEvent.shiftKey && document.activeElement === first) {
        keyEvent.preventDefault();
        last.focus();
      } else if (!keyEvent.shiftKey && document.activeElement === last) {
        keyEvent.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="snvDetailsBackdrop snvHistoryDialogBackdrop tbLiveUndoDialogBackdrop"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="snvHistoryDialog snvUndoHistoryDialog tbLiveUndoDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-undo-title"
      >
        <h2 id="live-undo-title">Undo</h2>
        <p className="snvUndoLabel">되돌릴 행동</p>
        <ol className="snvUndoEventStack" aria-label="취소될 이벤트">
          {events.map((event, index) => (
            <li key={event.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{event.summary}</p>
            </li>
          ))}
        </ol>
        <p className="snvUndoNotice">위 이벤트를 취소하고 직전 상태로 돌아갑니다.</p>
        <footer>
          <button ref={cancelRef} type="button" onClick={onCancel}>취소</button>
          <button type="button" className="snvDestructiveAction" onClick={onConfirm}>되돌리기</button>
        </footer>
      </section>
    </div>
  );
}
