import { Status, Warnings } from "../../components/CoreFeedback";
import type { CoreResult, CoreWarning, GameEvent, Proposal, ReplayState } from "../../core/types";

export function EventLog({
  events,
  replayResult,
  proposalResult,
  loadError,
  warnings,
}: {
  events: GameEvent[];
  replayResult?: CoreResult<ReplayState>;
  proposalResult?: CoreResult<Proposal>;
  loadError?: string;
  warnings: CoreWarning[];
}) {
  const errorCount =
    Number(Boolean(loadError)) +
    Number(replayResult?.ok === false) +
    Number(proposalResult?.ok === false);
  return (
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
  );
}
