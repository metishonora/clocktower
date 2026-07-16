import { useEffect, useRef } from "react";
import type { GameEvent } from "../../core/types";

export function LiveUndoDialog({
  event,
  onCancel,
  onConfirm,
}: {
  event: Pick<GameEvent, "id" | "summary">;
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
      className="confirmedUndoDialogBackdrop"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="confirmedUndoDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-undo-title"
      >
        <h2 id="live-undo-title">최근 확정 행동을 되돌릴까요?</h2>
        <strong>되돌릴 항목: {event.summary}</strong>
        <footer>
          <button ref={cancelRef} type="button" className="secondaryButton" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="confirmedUndoButton" onClick={onConfirm}>
            되돌리기
          </button>
        </footer>
      </section>
    </div>
  );
}
