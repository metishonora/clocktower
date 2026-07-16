import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import type { Player } from "./core/types.js";
import {
  ghostVotesSpentByDraft,
  validVotePlayersByDraft,
  voteStatusForPlayer,
} from "./voting.js";

test("vote draft counts living voters and unspent ghost voters only", () => {
  const players = votingPlayers();
  const draft = {
    nomineeId: "player-4",
    voterIds: ["player-1", "player-2", "player-3", "missing-player"],
  };

  deepEqual(
    validVotePlayersByDraft(players, draft).map((player) => player.id),
    ["player-1", "player-2"],
  );
  deepEqual(
    ghostVotesSpentByDraft(players, draft).map((player) => player.id),
    ["player-2"],
  );
});

test("vote status labels dead and spent ghost voters clearly", () => {
  const players = votingPlayers();

  for (const selected of [false, true]) {
    deepEqual(players.slice(0, 3).map((player) => voteStatusForPlayer(player, selected).label), [
      "생존",
      "사망 · 유령표 남음",
      "사망 · 유령표 사용됨",
    ]);
  }
  equal(voteStatusForPlayer(players[1], false).disabled, false);
  deepEqual(voteStatusForPlayer(players[2], false), {
    className: "voteUnavailable",
    disabled: true,
    label: "사망 · 유령표 사용됨",
  });
});

function votingPlayers(): Player[] {
  return [
    votingPlayer("player-1", 1, true, false),
    votingPlayer("player-2", 2, false, false),
    votingPlayer("player-3", 3, false, true),
    votingPlayer("player-4", 4, true, false),
    votingPlayer("player-5", 5, true, false),
  ];
}

function votingPlayer(id: string, seat: number, alive: boolean, ghostVoteUsed: boolean): Player {
  return {
    id,
    seat,
    name: `Player ${seat}`,
    actualCharacter: "chef",
    shownCharacter: "chef",
    alignment: "good",
    alive,
    ghostVoteUsed,
    deathAnnounced: false,
    notes: "",
  };
}
