import type { DayState, Player } from "../../core/types";
import {
  ghostVotesSpentByDraft,
  pendingExecutionCandidateMessage,
  seatPlayerLabel,
  validVotePlayersByDraft,
} from "../../voting";
import type { NominationDraft } from "./useNominationDraft";

export function NominationVoteInput({
  players,
  dayState,
  draft,
  onChange,
  busy,
}: {
  players: Player[];
  dayState?: DayState;
  draft: NominationDraft;
  onChange: (draft: NominationDraft) => void;
  busy: boolean;
}) {
  const ghostVoteSpentPlayers = ghostVotesSpentByDraft(players, draft);
  const validVotePlayers = validVotePlayersByDraft(players, draft);
  const pendingCandidateMessage = pendingExecutionCandidateMessage(players, dayState, draft);
  const candidate = dayState?.executionCandidate
    ? players.find((player) => player.id === dayState.executionCandidate?.nomineeId)
    : undefined;

  return (
    <div className="nominationVoteInput">
      <div className="nominationSelectors">
        <label>
          지명자
          <select
            value={draft.nominatorId}
            disabled={busy}
            onChange={(event) => onChange({ ...draft, nominatorId: event.target.value })}
          >
            <option value="">선택</option>
            {players.map((player) => (
              <option value={player.id} key={player.id}>
                {seatPlayerLabel(player)}
              </option>
            ))}
          </select>
        </label>
        <label>
          피지명자
          <select
            value={draft.nomineeId}
            disabled={busy}
            onChange={(event) => onChange({ ...draft, nomineeId: event.target.value })}
          >
            <option value="">선택</option>
            {players.map((player) => (
              <option value={player.id} key={player.id}>
                {seatPlayerLabel(player)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <dl className="votePreview">
        <div>
          <dt>현재 표</dt>
          <dd>{validVotePlayers.length}표</dd>
        </div>
        <div>
          <dt>소비될 유령표</dt>
          <dd>{ghostVoteSpentPlayers.length > 0 ? ghostVoteSpentPlayers.map(seatPlayerLabel).join(", ") : "없음"}</dd>
        </div>
        <div>
          <dt>현재 처형 후보</dt>
          <dd>{candidate && dayState?.executionCandidate ? `${seatPlayerLabel(candidate)} · ${dayState.executionCandidate.voteCount}표` : "없음"}</dd>
        </div>
        <div>
          <dt>확정 후</dt>
          <dd>{pendingCandidateMessage}</dd>
        </div>
      </dl>
      <p className="nominationHint">투표자는 Grimoire 좌석을 눌러 선택합니다.</p>
    </div>
  );
}
