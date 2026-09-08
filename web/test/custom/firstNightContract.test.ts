import { deepEqual, equal, throws } from "node:assert/strict";
import { test } from "vitest";

import { exportGameFileJson, parseGameFileJson } from "../../src/custom/storage/gameFile.js";
import {
  parseCustomFirstNightPlanResult,
  parseFirstNightOrderPlan,
  parseGameEvent,
} from "../../src/custom/core/validation.js";

const plan = [
  { kind: "system" as const, actionId: "dusk" as const },
  { kind: "character" as const, characterId: "philosopher", actionId: "chooseAbility" },
  { kind: "system" as const, actionId: "demonInfo" as const },
  { kind: "system" as const, actionId: "minionInfo" as const },
  { kind: "character" as const, characterId: "poisoner", actionId: "choosePoisonTarget" },
  { kind: "system" as const, actionId: "dawn" as const },
];

test("parses the exact ordered action-ref and plan-result contracts", () => {
  deepEqual(parseFirstNightOrderPlan(plan), plan);
  deepEqual(
    parseCustomFirstNightPlanResult({ source: "definition", plan }),
    { source: "definition", plan },
  );

  for (const invalid of [
    [{ kind: "system", actionId: "midnight" }],
    [{ kind: "system", actionId: "dusk", characterId: "poisoner" }],
    [{ kind: "character", characterId: "poisoner", actionId: "" }],
    [{ kind: "character", characterId: "poisoner", actionId: "choose", handler: "tb.rs" }],
  ]) {
    throws(() => parseFirstNightOrderPlan(invalid));
  }
  throws(() => parseCustomFirstNightPlanResult({ source: "setup", plan }));
  throws(() => parseCustomFirstNightPlanResult({ source: "default", plan, owner: "snv" }));
});

test("definition-owned first-night order round-trips with a roster-only setup event", () => {
  const setupEvent = parseGameEvent({
    id: "setup-1",
    type: "setupConfirmed",
    phase: "setup",
    payload: { players: [] },
    summary: "setup",
    createdAt: "2026-09-04T00:00:00.000Z",
  });
  const game = {
    schemaVersion: 4 as const,
    game: {
      script: {
        type: "custom" as const,
        definition: {
          id: "mixed-first-night",
          name: "Mixed first night",
          characterIds: ["philosopher", "poisoner", "imp"],
          firstNightOrder: plan,
        },
      },
      id: "game-195",
      name: "Game 195",
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
      events: [setupEvent],
    },
  };

  const parsed = parseGameFileJson(JSON.stringify(game));
  deepEqual(parsed.game.script, game.game.script);
  deepEqual(parsed.game.events, [setupEvent]);
  const exported = exportGameFileJson(parsed);
  deepEqual(parseGameFileJson(exported), parsed);
  equal(exported.includes("ruleOwner"), false);
  equal(exported.includes("handlerPath"), false);
  equal(exported.includes("scriptOwner"), false);
});

test("parses the canonical custom action envelope and preserves its typed result", () => {
  const event = {
    id: "custom-action-1",
    type: "customActionConfirmed" as const,
    phase: "firstNight" as const,
    payload: {
      stepId: "firstNight:fixture:player-1:setup-1",
      actionRef: {
        kind: "character" as const,
        characterId: "washerwoman",
        actionId: "learnTownsfolk",
      },
      abilityUse: {
        ownerPlayerId: "player-1",
        characterId: "washerwoman",
        abilityInstanceId: "setup-1:player-1",
      },
      input: null,
      result: { kind: "noEffect" as const },
    },
    summary: "custom action",
    createdAt: "2026-09-07T00:00:00.000Z",
  };

  deepEqual(parseGameEvent(event), event);
});

test("rejects custom envelope tampering without tightening legacy event payloads", () => {
  const event = {
    id: "custom-action-1",
    type: "customActionConfirmed" as const,
    phase: "firstNight" as const,
    payload: {
      stepId: "firstNight:fixture:player-1:setup-1",
      actionRef: {
        kind: "character" as const,
        characterId: "washerwoman",
        actionId: "learnTownsfolk",
      },
      abilityUse: {
        ownerPlayerId: "player-1",
        characterId: "washerwoman",
        abilityInstanceId: "setup-1:player-1",
      },
      input: null,
      result: { kind: "noEffect" as const },
    },
    summary: "custom action",
    createdAt: "2026-09-07T00:00:00.000Z",
  };

  throws(() => parseGameEvent({ ...event, unexpected: true }));
  throws(() => parseGameEvent({
    ...event,
    payload: { ...event.payload, unexpected: true },
  }));
  throws(() => parseGameEvent({
    ...event,
    payload: { ...event.payload, input: { patch: { alive: false } } },
  }));
  throws(() => parseGameEvent({
    ...event,
    payload: { ...event.payload, result: { kind: "fixture", value: { alive: false } } },
  }));
  throws(() => parseGameEvent({
    ...event,
    payload: {
      ...event.payload,
      abilityUse: { ...event.payload.abilityUse, characterId: "chef" },
    },
  }));
});
