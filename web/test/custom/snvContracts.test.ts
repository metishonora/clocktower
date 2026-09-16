import { expect, test } from "vitest";
import { parseGameEvent } from "../../src/custom/core/validation.js";
const source = { ownerPlayerId: "p1", characterId: "philosopher", abilityInstanceId: "setup:p1" };
function event() { return { id: "e2", type: "customActionConfirmed", phase: "firstNight", summary: "test", createdAt: "t", payload: { stepId: "simulation", actionRef: { kind: "character", characterId: "dreamer", actionId: "learnCharacters" }, simulationSource: { selectionEventId: "e1", sourceAbilityUse: source }, input: null, result: { kind: "simulation", information: null, spent: false } } }; }
test("simulated source preserves real Philosopher provenance and rejects real effects", () => {
  expect(parseGameEvent(event())).toEqual(event());
  expect(() => parseGameEvent({ ...event(), payload: { ...event().payload, abilityUse: { ...source, characterId: "dreamer" } } })).toThrow();
  expect(() => parseGameEvent({ ...event(), payload: { ...event().payload, result: { kind: "snakeCharmer", targetPlayerId: "p2", outcome: "swapped" } } })).toThrow();
  expect(() => parseGameEvent({ ...event(), payload: { ...event().payload, simulationSource: { selectionEventId: "e1", sourceAbilityUse: { ...source, characterId: "dreamer" } } } })).toThrow();
});
test("simulation information uses a finite complete delivery contract", () => {
  const information = { actor: { playerId: "p1", characterId: "dreamer" }, targetPlayerIds: ["p2"], computedResult: { kind: "characterPair", characterIds: ["dreamer", "witch"] }, deliveredResult: { kind: "characterPair", characterIds: ["dreamer", "witch"] }, deliveryContext: { type: "discretionary", reasons: [{ type: "drunk" }] } };
  const valid = { ...event(), payload: { ...event().payload, result: { kind: "simulation", information, spent: false } } };
  expect(parseGameEvent(valid)).toEqual(valid);
  expect(() => parseGameEvent({ ...valid, payload: { ...valid.payload, result: { ...valid.payload.result, information: { ...information, deliveryContext: { type: "discretionary", reasons: [{ type: "invented" }] } } } } })).toThrow();
});
