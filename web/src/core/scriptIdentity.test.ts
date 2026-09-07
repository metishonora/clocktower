import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import type { CustomScriptDefinition, GameFile, ReplayState, ScriptReference } from "./types.js";
import {
  customGameCanResumeWithDefinition,
  replayStateScriptReference,
  sameScriptReference,
} from "./scriptIdentity.js";

const definition: CustomScriptDefinition = {
  id: "custom-identity",
  name: "Mixed identity",
  characterIds: ["washerwoman", "clockmaker", "imp"],
  firstNightOrder: [
    { kind: "system", actionId: "dusk" },
    { kind: "system", actionId: "minionInfo" },
    { kind: "system", actionId: "demonInfo" },
    { kind: "system", actionId: "dawn" },
  ],
};

test("complete custom ScriptReference identity is exact and ordered", () => {
  const reference = customReference(definition);
  equal(sameScriptReference(reference, structuredClone(reference)), true);
  equal(sameScriptReference(reference, customReference({ ...definition, id: "other-id" })), false);
  equal(sameScriptReference(reference, customReference({ ...definition, name: "Renamed" })), false);
  equal(sameScriptReference(reference, customReference({
    ...definition,
    characterIds: ["clockmaker", "washerwoman", "imp"],
  })), false);
  equal(sameScriptReference(reference, customReference({
    ...definition,
    firstNightOrder: [...definition.firstNightOrder].reverse(),
  })), false);
  equal(sameScriptReference(reference, { type: "official", scriptId: "troubleBrewing" }), false);
});

test("replay identity normalizes official and preserves the complete custom snapshot", () => {
  deepEqual(replayStateScriptReference(replayState("troubleBrewing")), {
    type: "official",
    scriptId: "troubleBrewing",
  });
  deepEqual(replayStateScriptReference(customReplayState(definition)), customReference(definition));
});

test("custom resume requires the current runtime definition to equal the immutable game snapshot", () => {
  const gameFile = customGameFile(definition);
  equal(customGameCanResumeWithDefinition(gameFile, structuredClone(definition)), true);
  equal(customGameCanResumeWithDefinition(gameFile, { ...definition, name: "Edited" }), false);
  equal(customGameCanResumeWithDefinition(gameFile, {
    ...definition,
    characterIds: [...definition.characterIds, "poisoner"],
  }), false);
  equal(customGameCanResumeWithDefinition(gameFile, {
    ...definition,
    firstNightOrder: undefined,
  } as unknown as CustomScriptDefinition), false);
  equal(customGameCanResumeWithDefinition(gameFile, structuredClone(definition)), true);

  const official: GameFile = {
    schemaVersion: 4,
    game: {
      script: { type: "official", scriptId: "troubleBrewing" },
      id: "official-game",
      name: "Official",
      createdAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
      events: [],
    },
  };
  equal(customGameCanResumeWithDefinition(official, definition), false);
});

function customReference(value: CustomScriptDefinition): ScriptReference {
  return { type: "custom", definition: value };
}

function customGameFile(value: CustomScriptDefinition): GameFile {
  return {
    schemaVersion: 4,
    game: {
      script: customReference(value),
      id: "custom-game",
      name: value.name,
      createdAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
      events: [],
    },
  };
}

function replayState(scriptId: "troubleBrewing"): ReplayState {
  return {
    schemaVersion: 4,
    scriptId,
    eventCount: 0,
    phase: "setup",
    players: [],
    currentStep: null,
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
  };
}

function customReplayState(value: CustomScriptDefinition): ReplayState {
  return {
    schemaVersion: 4,
    script: { type: "custom", definition: value },
    eventCount: 0,
    phase: "setup",
    players: [],
    currentStep: null,
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
  };
}
