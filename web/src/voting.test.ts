import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import type { Player } from "./core/types.js";
import {
  ghostVotesSpentByDraft,
  nextVoterIdsAfterToggle,
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

test("healthy living Butler is unavailable until the master is selected", () => {
  const players = votingPlayers();
  const butler = {
    ...players[3],
    actualCharacter: "butler",
    shownCharacter: "butler",
  };
  const rule = {
    butlerPlayerId: butler.id,
    masterPlayerId: players[0].id,
    restrictionApplies: true,
  };

  deepEqual(voteStatusForPlayer(butler, false, [], rule), {
    className: "voteUnavailable",
    disabled: true,
    label: "주인 미투표",
  });
  deepEqual(voteStatusForPlayer(butler, false, [players[0].id], rule), {
    className: "",
    disabled: false,
    label: "생존",
  });
  equal(
    voteStatusForPlayer(butler, false, [], {
      butlerPlayerId: butler.id,
      restrictionApplies: true,
    }).label,
    "주인 미지정",
  );
  equal(voteStatusForPlayer(butler, false, [], { ...rule, restrictionApplies: false }).disabled, false);
});

test("removing the Butler master removes the selected Butler atomically", () => {
  const rule = {
    butlerPlayerId: "player-2",
    masterPlayerId: "player-1",
    restrictionApplies: true,
  };

  deepEqual(nextVoterIdsAfterToggle(["player-1", "player-2", "player-4"], "player-1", rule), [
    "player-4",
  ]);
  deepEqual(nextVoterIdsAfterToggle([], "player-1", rule), ["player-1"]);
  deepEqual(nextVoterIdsAfterToggle(["player-1"], "player-2", rule), ["player-1", "player-2"]);
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
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}
