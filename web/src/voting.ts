import type { Player } from "./core/types.js";

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

export function voteStatusForPlayer(player: Player, _selected: boolean): {
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
  return {
    className: "",
    disabled: false,
    label: "생존",
  };
}
