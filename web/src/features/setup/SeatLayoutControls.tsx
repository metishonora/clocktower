import type React from "react";
import {
  findOverlappingSeats,
  resetSeatLayout,
  seatLayoutPresetLabels,
  seatLayoutPresets,
  setSeatLayoutPreset,
  type SeatPosition,
  type SetupDraft,
} from "../../setupDraft";

export function SeatLayoutControls({
  draft,
  layoutEditing,
  busy,
  onChange,
  onLayoutEditingChange,
}: {
  draft: SetupDraft;
  layoutEditing: boolean;
  busy: boolean;
  onChange: (draft: SetupDraft) => void;
  onLayoutEditingChange: (editing: boolean | ((current: boolean) => boolean)) => void;
}) {
  const overlapSeats = findOverlappingSeats(draft.seatPositions);

  return (
    <div className="seatLayoutToolbar">
      <div className="seatLayoutPresets" role="group" aria-label="좌석 배치 프리셋">
        {seatLayoutPresets.map((preset) => (
          <button
            type="button"
            className={draft.seatLayoutPreset === preset ? "selected" : ""}
            onClick={() => onChange(setSeatLayoutPreset(draft, preset))}
            disabled={busy}
            key={preset}
          >
            {seatLayoutPresetLabels[preset]}
          </button>
        ))}
      </div>
      <div className="seatLayoutActions">
        {overlapSeats.size > 0 ? (
          <span className="layoutOverlapBadge">겹침 {Array.from(overlapSeats).join(", ")}</span>
        ) : (
          <span className="layoutOkBadge">겹침 없음</span>
        )}
        <button
          type="button"
          className={`secondaryAction ${layoutEditing ? "selected" : ""}`}
          onClick={() => onLayoutEditingChange((current) => !current)}
          disabled={busy}
        >
          위치 조정
        </button>
        <button
          type="button"
          className="secondaryAction"
          onClick={() => onChange(resetSeatLayout(draft))}
          disabled={busy}
        >
          자동 배치
        </button>
      </div>
    </div>
  );
}

export function startSeatDrag({
  event,
  enabled,
  busy,
  initialPosition,
  onMove,
}: {
  event: React.PointerEvent<HTMLElement>;
  enabled: boolean;
  busy: boolean;
  initialPosition: SeatPosition;
  onMove: (position: SeatPosition) => void;
}) {
  if (!enabled || busy) return;

  const canvas = event.currentTarget.closest(".seatMap");
  if (!(canvas instanceof HTMLElement)) return;
  const canvasElement = canvas;

  event.currentTarget.setPointerCapture(event.pointerId);
  const initialRect = canvasElement.getBoundingClientRect();
  const initialCenterX = initialRect.left + (initialRect.width * initialPosition.x) / 100;
  const initialCenterY = initialRect.top + (initialRect.height * initialPosition.y) / 100;
  const grabOffsetX = event.clientX - initialCenterX;
  const grabOffsetY = event.clientY - initialCenterY;

  function moveSeat(clientX: number, clientY: number) {
    const rect = canvasElement.getBoundingClientRect();
    onMove({
      x: ((clientX - grabOffsetX - rect.left) / rect.width) * 100,
      y: ((clientY - grabOffsetY - rect.top) / rect.height) * 100,
    });
  }

  moveSeat(event.clientX, event.clientY);

  function handlePointerMove(moveEvent: PointerEvent) {
    moveSeat(moveEvent.clientX, moveEvent.clientY);
  }

  function handlePointerUp() {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
}
