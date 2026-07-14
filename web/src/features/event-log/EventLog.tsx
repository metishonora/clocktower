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
  return (
    <aside className="panel log">
      <p className="eyebrow">이벤트 로그</p>
      <Status replayResult={replayResult} proposalResult={proposalResult} loadError={loadError} />
      <Warnings warnings={warnings} />
      <ol className="eventList">
        {events.length === 0 ? <li>확정된 이벤트 없음</li> : null}
        {events.map((event) => (
          <li key={event.id}>{event.summary}</li>
        ))}
      </ol>
    </aside>
  );
}
