import { expect, test } from "vitest";
import type { GameEvent, GameFile } from "../src/core/types";
import {
  exportLatestSectsAndVioletsCheckpoint,
  removeLatestSectsAndVioletsPhaseCheckpoint,
  type SectsAndVioletsPhaseCheckpoint,
} from "../src/sectsAndVioletsSession";

test("exports only through the latest completed S&V phase checkpoint", () => {
  const game = sessionGame([event("setup", "setupConfirmed"), event("one"), event("draft")], [
    checkpoint("setup", "setup", 1),
    checkpoint("one", "phase", 2),
  ]);

  const exported = exportLatestSectsAndVioletsCheckpoint(game, [
    checkpoint("setup", "setup", 1),
    checkpoint("one", "phase", 2),
  ]);

  expect(exported.game.events.map((candidate) => candidate.id)).toEqual(["setup", "one"]);
  expect(exported.ui).toBeUndefined();
});

test("undo removes every event in the latest completed S&V phase group", () => {
  const game = sessionGame(
    [event("setup", "setupConfirmed"), event("a-1"), nomination("nomination"), vote("vote", "nomination")],
    [],
  );

  const undone = removeLatestSectsAndVioletsPhaseCheckpoint(game);

  expect(undone?.removed.id).toBe("nomination");
  expect(undone?.gameFile.game.events.map((candidate) => candidate.id)).toEqual(["setup", "a-1"]);
  expect(undone?.gameFile.ui).toBeUndefined();
});

test("canonical undo scope is unchanged when S&V UI session metadata is absent", () => {
  const game = sessionGame(
    [event("setup", "setupConfirmed"), nomination("nomination"), vote("vote", "nomination")],
    [],
  );
  delete game.ui;

  const undone = removeLatestSectsAndVioletsPhaseCheckpoint(game);

  expect(undone?.removed.eventIds).toEqual(["nomination", "vote"]);
  expect(undone?.gameFile.game.events.map((candidate) => candidate.id)).toEqual(["setup"]);
  expect(undone?.gameFile.ui).toBeUndefined();
});

test("inferred S&V checkpoints group a rules-owned game end with its causal event", () => {
  const cause = event("cause");
  const ended: GameEvent = {
    id: "game-ended",
    type: "gameEnded",
    phase: "firstNight",
    payload: {
      winningTeam: "good",
      source: { kind: "demonAbsent", sourceEventId: cause.id },
    },
    summary: "게임 종료 · 선한 팀 승리",
    createdAt: "2026-07-22T00:00:00.000Z",
  };
  const game = sessionGame([event("setup", "setupConfirmed"), cause, event("legacy-after-win"), ended], []);
  delete game.ui;

  const undone = removeLatestSectsAndVioletsPhaseCheckpoint(game);

  expect(undone?.removed.eventIds).toEqual(["cause", "legacy-after-win", "game-ended"]);
  expect(undone?.gameFile.game.events.map((candidate) => candidate.id)).toEqual(["setup"]);
});

test("legacy source-less S&V game ends remain a single-event undo", () => {
  const ended: GameEvent = {
    id: "legacy-game-ended",
    type: "gameEnded",
    phase: "firstNight",
    payload: { winningTeam: "evil" },
    summary: "게임 종료 · 악한 팀 승리",
    createdAt: "2026-07-22T00:00:00.000Z",
  };
  const game = sessionGame([event("setup", "setupConfirmed"), event("cause"), ended], []);
  delete game.ui;

  const undone = removeLatestSectsAndVioletsPhaseCheckpoint(game);

  expect(undone?.removed.eventIds).toEqual(["legacy-game-ended"]);
  expect(undone?.gameFile.game.events.map((candidate) => candidate.id)).toEqual(["setup", "cause"]);
});

function sessionGame(events: GameEvent[], _phaseCheckpoints: SectsAndVioletsPhaseCheckpoint[]): GameFile {
  return {
    schemaVersion: 3,
    game: {
      scriptId: "sectsAndViolets",
      id: "sv-test",
      name: "Sects & Violets",
      createdAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z",
      events,
    },
  };
}

function checkpoint(id: string, kind: "setup" | "phase", eventCount: number) {
  return { id, kind, eventCount, summary: id, activeTab: kind === "setup" ? "seating" as const : "play" as const };
}

function event(id: string, type: "setupConfirmed" | "phaseStepConfirmed" = "phaseStepConfirmed"): GameEvent {
  return type === "setupConfirmed"
    ? {
        id,
        type,
        phase: "setup",
        payload: { players: [] },
        summary: id,
        createdAt: "2026-07-22T00:00:00.000Z",
      }
    : {
        id,
        type,
        phase: "firstNight",
        payload: { stepId: id, input: null },
        summary: id,
        createdAt: "2026-07-22T00:00:00.000Z",
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
      registrationJudgments: [],
      virginResolution: { kind: "notApplicable" },
    },
    summary: id,
    createdAt: "2026-07-22T00:00:00.000Z",
  };
}

function vote(id: string, nominationEventId: string): GameEvent {
  return {
    id,
    type: "nominationVoteConfirmed",
    phase: "day",
    payload: {
      stepId: "day:nomination:1",
      nominationEventId,
      voterIds: [],
      ghostVoteSpentPlayerIds: [],
    },
    summary: id,
    createdAt: "2026-07-22T00:00:00.000Z",
  };
}
