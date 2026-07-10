import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import type { ReplayState } from "./core/types.js";
import { syncSetupDraftFromReplayState } from "./gameStoreSync.js";
import { createSetupDraft, seatLayoutPositions, setSeatLayoutPreset, updateSeatPosition } from "./setupDraft.js";

test("store syncs confirmed replay Players into seating draft after load or import", () => {
  let draft = createSetupDraft(5);
  draft = setSeatLayoutPreset(draft, "longTable");
  draft = updateSeatPosition(draft, 2, { x: 44, y: 55 });

  const synced = syncSetupDraftFromReplayState(draft, replayStateWithPlayers(3));

  equal(synced.players.length, 3);
  equal(synced.players[0].name, "Ada");
  equal(synced.players[1].shownCharacter, "chef");
  equal(synced.seatLayoutPreset, "longTable");
  deepEqual(synced.seatPositions, seatLayoutPositions(3, "longTable"));
});

test("store leaves the seating draft unchanged before setup is confirmed", () => {
  const draft = createSetupDraft(5);

  equal(syncSetupDraftFromReplayState(draft, { ...replayStateWithPlayers(0), players: [] }), draft);
  equal(syncSetupDraftFromReplayState(draft, undefined), draft);
});

function replayStateWithPlayers(playerCount: number): ReplayState {
  const basePlayers = [
    {
      id: "player-1",
      seat: 1,
      name: "Ada",
      actualCharacter: "washerwoman",
      shownCharacter: "washerwoman",
      alignment: "good" as const,
      alive: true,
      ghostVoteUsed: false,
      deathAnnounced: false,
      notes: "",
    },
    {
      id: "player-2",
      seat: 2,
      name: "Bert",
      actualCharacter: "drunk",
      shownCharacter: "chef",
      alignment: "good" as const,
      alive: true,
      ghostVoteUsed: false,
      deathAnnounced: false,
      notes: "",
    },
    {
      id: "player-3",
      seat: 3,
      name: "Cy",
      actualCharacter: "imp",
      shownCharacter: "imp",
      alignment: "evil" as const,
      alive: true,
      ghostVoteUsed: false,
      deathAnnounced: false,
      notes: "",
    },
  ];

  return {
    schemaVersion: 1,
    eventCount: playerCount > 0 ? 1 : 0,
    phase: playerCount > 0 ? "setup" : "empty",
    players: basePlayers.slice(0, playerCount),
    warnings: [],
  };
}
