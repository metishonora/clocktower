import test from "node:test";
import assert from "node:assert/strict";
import type { GameEvent, GameFile } from "./types.js";
import { latestCanonicalUndoUnit, removeLatestCanonicalUndoUnit } from "./canonicalUndo.js";

test("groups a nomination and its linked vote into one canonical Undo unit", () => {
  const game = gameFile([
    event("setup", "setupConfirmed"),
    nomination("nomination"),
    vote("vote", "nomination"),
  ]);

  const unit = latestCanonicalUndoUnit(game);
  const removed = removeLatestCanonicalUndoUnit(game, unit?.id ?? "");

  assert.deepEqual(unit?.eventIds, ["nomination", "vote"]);
  assert.deepEqual(removed?.gameFile.game.events.map(({ id }) => id), ["setup"]);
});

test("groups a rules-owned game end with its causal event and intervening events", () => {
  const game = gameFile([
    event("setup", "setupConfirmed"),
    event("cause"),
    event("follow-up"),
    gameEnd("ended", "cause"),
  ]);

  const unit = latestCanonicalUndoUnit(game);
  const removed = removeLatestCanonicalUndoUnit(game, unit?.id ?? "");

  assert.deepEqual(unit?.eventIds, ["cause", "follow-up", "ended"]);
  assert.deepEqual(removed?.gameFile.game.events.map(({ id }) => id), ["setup"]);
});

test("keeps a source-less legacy or manual game end as one Undo unit", () => {
  const game = gameFile([
    event("setup", "setupConfirmed"),
    event("cause"),
    gameEnd("ended"),
  ]);

  const unit = latestCanonicalUndoUnit(game);
  const removed = removeLatestCanonicalUndoUnit(game, unit?.id ?? "");

  assert.deepEqual(unit?.eventIds, ["ended"]);
  assert.deepEqual(removed?.gameFile.game.events.map(({ id }) => id), ["setup", "cause"]);
});

function gameFile(events: GameEvent[]): GameFile {
  return {
    schemaVersion: 3,
    game: {
      scriptId: "troubleBrewing",
      id: "issue-140-undo",
      name: "Issue 140 Undo",
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
      events,
    },
  };
}

function event(id: string, type: GameEvent["type"] = "phaseStepConfirmed"): GameEvent {
  if (type === "setupConfirmed") {
    return {
      id,
      type,
      phase: "setup",
      payload: { players: [] },
      summary: id,
      createdAt: "2026-08-06T00:00:00.000Z",
    };
  }
  return {
    id,
    type: "phaseStepConfirmed",
    phase: "day",
    payload: { stepId: `day:${id}`, input: null },
    summary: id,
    createdAt: "2026-08-06T00:00:00.000Z",
  };
}

function nomination(id: string): GameEvent {
  return {
    id,
    type: "nominationStarted",
    phase: "day",
    payload: {
      stepId: "day:nomination:1",
      nominatorId: "player-1",
      nomineeId: "player-2",
      virginResolution: { kind: "notApplicable" },
      registrationJudgments: [],
    },
    summary: id,
    createdAt: "2026-08-06T00:00:00.000Z",
  };
}

function vote(id: string, nominationEventId: string): GameEvent {
  return {
    id,
    type: "nominationVoteConfirmed",
    phase: "day",
    payload: {
      stepId: "day:nominationVote:1",
      nominationEventId,
      voterIds: [],
      ghostVoteSpentPlayerIds: [],
    },
    summary: id,
    createdAt: "2026-08-06T00:00:00.000Z",
  };
}

function gameEnd(id: string, sourceEventId?: string): GameEvent {
  return {
    id,
    type: "gameEnded",
    phase: "day",
    payload: {
      winningTeam: "good",
      ...(sourceEventId
        ? { source: { kind: "demonAbsent" as const, sourceEventId } }
        : {}),
    },
    summary: id,
    createdAt: "2026-08-06T00:00:00.000Z",
  };
}
