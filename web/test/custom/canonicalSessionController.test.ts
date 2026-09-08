import { deepEqual, equal } from "node:assert/strict";

import { test } from "vitest";

import type { CoreAdapter } from "../../src/custom/core/coreAdapter.js";

import { CanonicalSessionController, replayMatches } from "../../src/custom/core/canonicalSessionController.js";

import type { CustomScriptDefinition, GameEvent, GameFile, GameFileV4, ReplayState } from "../../src/custom/core/types.js";


test("custom session controller binds replay to the complete definition snapshot", async () => {
  const definition = customDefinition();
  let replayCalls = 0;
  const controller = new CanonicalSessionController(
    { type: "custom", definition },
    adapter(undefined, (eventCount) => {
      replayCalls += 1;
      return customState(eventCount, definition);
    }),
  );
  const gameFile = customFile([event("setup", "setupConfirmed")], definition);

  const replayed = await controller.replay(gameFile);
  equal(replayed.ok, true);
  equal(replayCalls, 1);

  const edited = customFile(gameFile.game.events, { ...definition, name: "Edited" });
  const mismatch = await controller.replay(edited);
  equal(mismatch.ok, false);
  if (!mismatch.ok) equal(mismatch.error.code, "SCRIPT_MISMATCH");
  equal(replayCalls, 1);
});


test("custom controller rejects a replay result for a different snapshot and Undo preserves the definition", async () => {
  const definition = customDefinition();
  const wrongReplayController = new CanonicalSessionController(
    { type: "custom", definition },
    adapter(undefined, (eventCount) => customState(eventCount, {
      ...definition,
      characterIds: [...definition.characterIds, "poisoner"],
    })),
  );
  const gameFile = customFile([
    event("setup", "setupConfirmed"),
    event("latest"),
  ], definition);
  const wrongReplay = await wrongReplayController.replay(gameFile);
  equal(wrongReplay.ok, false);
  if (!wrongReplay.ok) equal(wrongReplay.error.code, "SCRIPT_MISMATCH");

  const controller = new CanonicalSessionController(
    { type: "custom", definition },
    adapter(undefined, (eventCount) => customState(eventCount, definition)),
  );
  const replayed = await controller.replay(gameFile);
  if (!replayed.ok) throw new Error(replayed.error.messageKo);
  const undone = await controller.undo(gameFile, replayed.value, "latest");
  equal(undone.ok, true);
  if (undone.ok) {
    if (undone.value.gameFile.schemaVersion !== 4) throw new Error("expected schema v4 custom game");
    deepEqual(undone.value.gameFile.game.script, { type: "custom", definition });
    deepEqual(undone.value.gameFile.game.events.map(({ id }) => id), ["setup"]);
  }
});


test("custom replay binding rejects a different game ID even with the same event stream", async () => {
  const definition = customDefinition();
  const controller = new CanonicalSessionController(
    { type: "custom", definition },
    adapter(undefined, (eventCount) => customState(eventCount, definition)),
  );
  const gameFile = customFile([event("setup", "setupConfirmed")], definition);
  const replayed = await controller.replay(gameFile);
  if (!replayed.ok) throw new Error(replayed.error.messageKo);
  const otherGame = {
    ...gameFile,
    game: { ...gameFile.game, id: "other-custom-game" },
  };
  equal(replayMatches(otherGame, replayed.value), false);
  const proposed = await controller.propose(otherGame, replayed.value, {
    type: "confirmStep",
    payload: { stepId: "firstNight:minionInfo" },
  });
  equal(proposed.ok, false);
  if (!proposed.ok) equal(proposed.error.code, "STALE_REPLAY");
});


function adapter(
  onPropose: (() => void) | undefined = () => { },
  replayState: (eventCount: number) => ReplayState = count => customState(count, customDefinition()),
  proposedEvent?: GameEvent,
): CoreAdapter {
  return {
    async propose(gameFile) {
      onPropose?.();
      if (proposedEvent) {
        return { ok: true, value: { event: proposedEvent, warnings: [], followUpSteps: [], preview: {} } };
      }
      throw new Error("unexpected proposal");
    },
    async replay(gameFile) {
      return { ok: true, value: replayState(gameFile.game.events.length) };
    },
    async setupDistribution() {
      return { ok: true, value: { Townsfolk: 5, Outsider: 0, Minion: 1, Demon: 1 } };
    },
    setupDistributionSync() {
      return { ok: true, value: { Townsfolk: 5, Outsider: 0, Minion: 1, Demon: 1 } };
    },
  };
}


function event(id: string, type: "setupConfirmed" | "phaseStepConfirmed" = "phaseStepConfirmed"): GameEvent {
  return type === "setupConfirmed"
    ? {
      id,
      type,
      phase: "setup",
      payload: { players: [] },
      summary: id,
      createdAt: "2026-07-27T00:00:00.000Z",
    }
    : {
      id,
      type,
      phase: "day",
      payload: { stepId: "day:discussion", input: null },
      summary: id,
      createdAt: "2026-07-27T00:00:00.000Z",
    };
}


function customDefinition(): CustomScriptDefinition {
  return {
    id: "controller-custom",
    name: "Controller custom",
    characterIds: ["washerwoman", "clockmaker", "imp"],
    firstNightOrder: [
      { kind: "system", actionId: "dusk" },
      { kind: "character", characterId: "washerwoman", actionId: "learnTownsfolk" },
      { kind: "character", characterId: "clockmaker", actionId: "learnSteps" },
      { kind: "system", actionId: "minionInfo" },
      { kind: "system", actionId: "demonInfo" },
      { kind: "system", actionId: "dawn" },
    ],
  };
}


function customFile(events: GameEvent[], definition: CustomScriptDefinition): GameFileV4 {
  return {
    schemaVersion: 4,
    game: {
      script: { type: "custom", definition },
      id: "custom-controller-test",
      name: definition.name,
      createdAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
      events,
    },
  };
}


function customState(eventCount: number, definition: CustomScriptDefinition): ReplayState {
  return {
    schemaVersion: 4,
    script: { type: "custom", definition },
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
