import { Status, Warnings } from "../../components/CoreFeedback";
import type { CoreResult, CoreWarning, GameEvent, Proposal, ReplayState } from "../../core/types";

export function EventLog({
  events,
  replayResult,
  proposalResult,
  loadError,
  warnings,
  latestUndoEvent,
  undoDisabled = false,
  onRequestUndo,
}: {
  events: GameEvent[];
  replayResult?: CoreResult<ReplayState>;
  proposalResult?: CoreResult<Proposal>;
  loadError?: string;
  warnings: CoreWarning[];
  latestUndoEvent?: Pick<GameEvent, "id" | "summary">;
  undoDisabled?: boolean;
  onRequestUndo?: (event: Pick<GameEvent, "id" | "summary">, trigger: HTMLButtonElement) => void;
}) {
  const errorCount =
    Number(Boolean(loadError)) +
    Number(replayResult?.ok === false) +
    Number(proposalResult?.ok === false);
  return (
    <section className="eventLogSurface" aria-label="이벤트 로그">
      {latestUndoEvent && onRequestUndo ? (
        <section className="panel latestEventUndo" aria-label="최근 이벤트">
          <div>
            <span>최근 이벤트</span>
            <strong>{latestUndoEvent.summary}</strong>
          </div>
          <button
            type="button"
            disabled={undoDisabled}
            onClick={(event) => onRequestUndo(latestUndoEvent, event.currentTarget)}
          >
            Undo
          </button>
        </section>
      ) : null}
      <details className="panel log auxiliaryPanel">
        <summary>
          <span>이벤트 로그</span>
          <small>
            {events.length}건{errorCount ? ` · 오류 ${errorCount}` : ""}
            {warnings.length ? ` · 경고 ${warnings.length}` : ""}
          </small>
        </summary>
        <div className="auxiliaryPanelContent">
          <Status replayResult={replayResult} proposalResult={proposalResult} loadError={loadError} />
          <Warnings warnings={warnings} />
          <ol className="eventList">
            {events.length === 0 ? <li>확정된 이벤트 없음</li> : null}
            {events.map((event) => (
              <li key={event.id}>{event.summary}</li>
            ))}
          </ol>
        </div>
      </details>
    </section>
  );
}
