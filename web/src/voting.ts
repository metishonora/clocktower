import type { ButlerVoteState, Player } from "./core/types.js";

export type VoteDraft = {
  nomineeId: string;
  voterIds: string[];
};

export function seatPlayerLabel(player: Player): string {
  return `${player.seat}번 ${player.name}`;
}

export function ghostVotesSpentByDraft(players: Player[], draft: VoteDraft): Player[] {
  return validVotePlayersByDraft(players, draft).filter((player) => !player.alive && !player.ghostVoteUsed);
}

export function validVotePlayersByDraft(players: Player[], draft: VoteDraft): Player[] {
  return draft.voterIds
    .map((playerId) => players.find((player) => player.id === playerId))
    .filter((player): player is Player => Boolean(player && (player.alive || !player.ghostVoteUsed)));
}

export function voteStatusForPlayer(
  player: Player,
  _selected: boolean,
  voterIds: string[] = [],
  butlerVote?: ButlerVoteState,
): {
  className: string;
  disabled: boolean;
  label: string;
} {
  if (!player.alive && player.ghostVoteUsed) {
    return {
      className: "voteUnavailable",
      disabled: true,
      label: "사망 · 유령표 사용됨",
    };
  }
  if (!player.alive) {
    return {
      className: "deadSeat",
      disabled: false,
      label: "사망 · 유령표 남음",
    };
  }
  if (
    butlerVote?.restrictionApplies &&
    butlerVote.butlerPlayerId === player.id
  ) {
    if (!butlerVote.masterPlayerId) {
      return {
        className: "voteUnavailable",
        disabled: true,
        label: "주인 미지정",
      };
    }
    if (!voterIds.includes(butlerVote.masterPlayerId)) {
      return {
        className: "voteUnavailable",
        disabled: true,
        label: "주인 미투표",
      };
    }
  }
  return {
    className: "",
    disabled: false,
    label: "생존",
  };
}

export function nextVoterIdsAfterToggle(
  voterIds: string[],
  playerId: string,
  butlerVote?: ButlerVoteState,
): string[] {
  if (voterIds.includes(playerId)) {
    return voterIds.filter((selectedId) =>
      selectedId !== playerId &&
      !(
        butlerVote?.restrictionApplies &&
        playerId === butlerVote.masterPlayerId &&
        selectedId === butlerVote.butlerPlayerId
      )
    );
  }
  if (
    butlerVote?.restrictionApplies &&
    playerId === butlerVote.butlerPlayerId &&
    (!butlerVote.masterPlayerId || !voterIds.includes(butlerVote.masterPlayerId))
  ) {
    return voterIds;
  }
  return [...voterIds, playerId];
}
