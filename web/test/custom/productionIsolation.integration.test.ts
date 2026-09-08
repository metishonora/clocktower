import { describe, expect, it } from "vitest";
import { createCustomGameFile } from "../../src/custom/storage/sessionStorage.js";
import { parseGameEvent } from "../../src/custom/core/validation.js";
import type { CustomScriptDefinition, GameEvent, GameFileV4 } from "../../src/custom/core/types.js";
import { realWasmCore } from "./realCustomWasmHarness.js";

describe("Issue #206 production custom-runtime isolation", () => {
  it("keeps an active unimplemented Character action unsupported in ordinary generated WASM", async () => {
    const definition = productionDefinition();
    const empty = createCustomGameFile(
      definition,
      "issue-206-production-unsupported",
      new Date("2026-09-07T00:00:00.000Z"),
    );
    const setup = await realWasmCore().propose(empty, {
      type: "createGame",
      payload: { players: productionPlayers() },
    });
    expect(setup.ok).toBe(true);
    if (!setup.ok) return;
    const setupGame: GameFileV4 = {
      ...empty,
      game: { ...empty.game, events: [setup.value.event] },
    };
    const replayed = await realWasmCore().replay(setupGame);
    expectCoreError(replayed, "FIRST_NIGHT_ACTION_HANDLER_UNAVAILABLE");
  });

  it("rejects fixture result discriminators at the production Rust and TypeScript boundaries", async () => {
    const definition = productionDefinition();
    const empty = createCustomGameFile(
      definition,
      "issue-206-production-result-boundary",
      new Date("2026-09-07T00:00:00.000Z"),
    );
    const fixtureEvent = {
      id: "fixture-result-1",
      type: "customActionConfirmed",
      phase: "firstNight",
      payload: {
        stepId: "firstNight:philosopher:chooseAbility:owner2:p1:instance8:setup:p1",
        actionRef: { kind: "character", characterId: "philosopher", actionId: "chooseAbility" },
        abilityUse: {
          ownerPlayerId: "p1",
          characterId: "philosopher",
          abilityInstanceId: "setup:p1",
        },
        input: null,
        result: { kind: "fixtureAbilityGranted", targetCharacterId: "washerwoman" },
      },
      summary: "fixture result",
      createdAt: "2026-09-07T00:00:00.000Z",
    } as unknown as GameEvent;
    expect(() => parseGameEvent(fixtureEvent)).toThrow();
    const malformed = {
      ...empty,
      game: { ...empty.game, events: [fixtureEvent] },
    };
    expectCoreError(await realWasmCore().replay(malformed), "MALFORMED_EVENT");
  });
});

function productionDefinition(): CustomScriptDefinition {
  return {
    id: "issue-206-production-definition",
    name: "Issue 206 production definition",
    characterIds: [
      "philosopher",
      "ravenkeeper",
      "mayor",
      "undertaker",
      "monk",
      "soldier",
      "saint",
      "scarletWoman",
      "imp",
    ],
    firstNightOrder: [
      { kind: "system", actionId: "dusk" },
      { kind: "system", actionId: "demonInfo" },
      { kind: "character", characterId: "philosopher", actionId: "chooseAbility" },
      { kind: "system", actionId: "minionInfo" },
      { kind: "system", actionId: "dawn" },
    ],
  };
}

function productionPlayers() {
  return [
    { id: "p1", seat: 1, name: "philosopher", actualCharacter: "philosopher" },
    { id: "p2", seat: 2, name: "ravenkeeper", actualCharacter: "ravenkeeper" },
    { id: "p3", seat: 3, name: "mayor", actualCharacter: "mayor" },
    { id: "p4", seat: 4, name: "undertaker", actualCharacter: "undertaker" },
    { id: "p5", seat: 5, name: "monk", actualCharacter: "monk" },
    { id: "p6", seat: 6, name: "saint", actualCharacter: "saint" },
    { id: "p7", seat: 7, name: "scarletWoman", actualCharacter: "scarletWoman" },
    { id: "p8", seat: 8, name: "imp", actualCharacter: "imp" },
  ];
}

function expectCoreError<T>(
  result: { ok: true; value: T } | { ok: false; error: { code: string; messageKo: string } },
  code: string,
): asserts result is { ok: false; error: { code: string; messageKo: string } } {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe(code);
}
