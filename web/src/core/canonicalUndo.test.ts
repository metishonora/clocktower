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

test("groups a Slayer ability use with its linked death confirmation", () => {
  const game = gameFile([
    event("setup", "setupConfirmed"),
    slayerAbility("slayer-shot", "day:discussion", "player-5", true),
    slayerDeath("slayer-death", "day:discussion:slayerDeath", "player-5"),
  ]);

  const unit = latestCanonicalUndoUnit(game);
  const removed = removeLatestCanonicalUndoUnit(game, unit?.id ?? "");

  assert.equal(unit?.id, "slayer-shot");
  assert.deepEqual(unit?.eventIds, ["slayer-shot", "slayer-death"]);
  assert.deepEqual(removed?.gameFile.game.events.map(({ id }) => id), ["setup"]);
});

test("groups a voted execution with its automatic death confirmation", () => {
  const game = gameFile([
    event("setup", "setupConfirmed"),
    execution("execution", "day2:execution", "player-5"),
    executionDeath("execution-death", "day2:executionDeath", "player-5"),
  ]);

  const unit = latestCanonicalUndoUnit(game);
  const removed = removeLatestCanonicalUndoUnit(game, unit?.id ?? "");

  assert.equal(unit?.id, "execution");
  assert.deepEqual(unit?.eventIds, ["execution", "execution-death"]);
  assert.deepEqual(removed?.gameFile.game.events.map(({ id }) => id), ["setup"]);
});

test("keeps a no-effect Slayer ability use as one complete Undo unit", () => {
  const game = gameFile([
    event("setup", "setupConfirmed"),
    slayerAbility("slayer-miss", "day:discussion", "player-2", false),
  ]);

  const unit = latestCanonicalUndoUnit(game);
  const removed = removeLatestCanonicalUndoUnit(game, unit?.id ?? "");

  assert.deepEqual(unit?.eventIds, ["slayer-miss"]);
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

function slayerAbility(
  id: string,
  discussionStepId: string,
  targetPlayerId: string,
  died: boolean,
): GameEvent {
  return {
    id,
    type: "slayerAbilityUsed",
    phase: "day",
    payload: {
      discussionStepId,
      actorPlayerId: "player-1",
      targetPlayerId,
      impairmentContext: { kind: "healthy" },
      registrationContext: { kind: "canonical", registeredAsDemon: died },
      outcome: died
        ? { kind: "deathPending", playerId: targetPlayerId }
        : { kind: "noEffect", reason: "targetNotDemon" },
    },
    summary: died ? "처단자 적중" : "처단자 빗나감",
    createdAt: "2026-08-06T00:00:00.000Z",
  };
}

function slayerDeath(id: string, stepId: string, playerId: string): GameEvent {
  return {
    id,
    type: "deathConfirmed",
    phase: "day",
    payload: { stepId, playerId },
    summary: "처단자 사망 확정",
    createdAt: "2026-08-06T00:00:01.000Z",
  };
}

function execution(id: string, stepId: string, playerId: string): GameEvent {
  return {
    id,
    type: "executionConfirmed",
    phase: "day",
    payload: { stepId, input: { execute: true, playerId } },
    summary: "처형 확정",
    createdAt: "2026-08-06T00:00:00.000Z",
  };
}

function executionDeath(id: string, stepId: string, playerId: string): GameEvent {
  return {
    id,
    type: "deathConfirmed",
    phase: "day",
    payload: { stepId, playerId },
    summary: "처형 사망 확정",
    createdAt: "2026-08-06T00:00:01.000Z",
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
