import { equal, throws } from "node:assert/strict";
import test from "node:test";
import type { GameEvent, GameFile, ReplayState } from "./types.js";
import { appendCanonicalEvent, replayCaughtUp } from "./canonicalStream.js";

test("canonical mutation is allowed only when replay covers the current event stream", () => {
  const gameFile = file([event("one")]);
  equal(replayCaughtUp(gameFile, state(1)), true);
  equal(replayCaughtUp(gameFile, state(0)), false);
  equal(replayCaughtUp(gameFile, undefined), false);
});

test("canonical append rejects a duplicate event identity before replay", () => {
  const gameFile = file([event("one")]);
  throws(() => appendCanonicalEvent(gameFile, event("one")), /중복/);
  equal(appendCanonicalEvent(gameFile, event("two")).game.events.length, 2);
});

function file(events: GameEvent[]): GameFile {
  return {
    schemaVersion: 3,
    game: {
      scriptId: "sectsAndViolets",
      id: "stream-test",
      name: "stream-test",
      createdAt: "2026-07-27T00:00:00.000Z",
      updatedAt: "2026-07-27T00:00:00.000Z",
      events,
    },
  };
}

function event(id: string): GameEvent {
  return {
    id,
    type: "phaseStepConfirmed",
    phase: "day",
    payload: { stepId: "day:discussion", input: null },
    summary: id,
    createdAt: "2026-07-27T00:00:00.000Z",
  };
}

function state(eventCount: number): ReplayState {
  return {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount,
    phase: "day",
    players: [],
    currentStep: null,
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
    gameEnd: null,
  };
}
