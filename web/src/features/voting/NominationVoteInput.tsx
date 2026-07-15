import type { Player } from "../../core/types";
import {
  ghostVotesSpentByDraft,
  seatPlayerLabel,
  validVotePlayersByDraft,
} from "../../voting";
import type { NominationDraft } from "./useNominationDraft";

export function NominationVoteInput({
  players,
  draft,
  onChange,
  busy,
}: {
  players: Player[];
  draft: NominationDraft;
  onChange: (draft: NominationDraft) => void;
  busy: boolean;
}) {
  const ghostVoteSpentPlayers = ghostVotesSpentByDraft(players, draft);
  const validVotePlayers = validVotePlayersByDraft(players, draft);

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
      </dl>
      <p className="nominationHint">투표자는 Grimoire 좌석을 눌러 선택합니다.</p>
    </div>
  );
}
