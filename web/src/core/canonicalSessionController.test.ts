import { equal } from "node:assert/strict";
import test from "node:test";
import type { CoreAdapter } from "./coreAdapter.js";
import { CanonicalSessionController } from "./canonicalSessionController.js";
import type { GameEvent, GameFile, ReplayState } from "./types.js";

test("session controller rejects stale proposals before calling the domain adapter", async () => {
  let proposalCalls = 0;
  const controller = new CanonicalSessionController(adapter(() => { proposalCalls += 1; }));
  const result = await controller.propose(file([event("one")]), state(0), {
    type: "skipStep",
    payload: { stepId: "day:discussion" },
  });
  equal(result.ok, false);
  equal(proposalCalls, 0);
});

test("session controller rejects duplicate IDs and stale replay results at the apply boundary", async () => {
  const controller = new CanonicalSessionController(adapter());
  const duplicate = await controller.apply(file([event("one")]), state(1), event("one"));
  equal(duplicate.ok, false);

  const staleReplay = await controller.apply(file([event("one")]), state(1), event("two"));
  equal(staleReplay.ok, false);
  if (!staleReplay.ok) equal(staleReplay.error.code, "STALE_REPLAY");
});

function adapter(onPropose: () => void = () => {}): CoreAdapter {
  return {
    async propose() {
      onPropose();
      throw new Error("unexpected proposal");
    },
    async replay() {
      return { ok: true, value: state(1) };
    },
    async setupDistribution() {
      return { ok: true, value: { Townsfolk: 5, Outsider: 0, Minion: 1, Demon: 1 } };
    },
    setupDistributionSync() {
      return { ok: true, value: { Townsfolk: 5, Outsider: 0, Minion: 1, Demon: 1 } };
    },
    async suggestPhaseInput() {
      return { ok: false, error: { code: "UNUSED", messageKo: "unused" } };
    },
  };
}

function file(events: GameEvent[]): GameFile {
  return {
    schemaVersion: 3,
    game: {
      scriptId: "sectsAndViolets",
      id: "controller-test",
      name: "controller-test",
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
