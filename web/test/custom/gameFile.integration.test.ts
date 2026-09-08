import { expect, test } from "vitest";
import type { GameFile } from "../../src/custom/core/types.js";
import { realWasmCore } from "./realCustomWasmHarness.js";
const wasmCoreAdapter = realWasmCore();
function game(script: unknown): GameFile {
  return {
    schemaVersion: 4,
    game: {
      script,
      id: "issue-192-wasm",
      name: "Issue 192 WASM",
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
      events: [],
    },
  } as GameFile;
}

test("generated WASM replays a custom snapshot with its complete identity", async () => {
  const result = await wasmCoreAdapter.replay(game({
    type: "custom",
    definition: {
      id: "custom-stable-id",
      name: "Mixed roster",
      characterIds: ["washerwoman", "clockmaker", "imp"],
      firstNightOrder: [
        { kind: "system", actionId: "dusk" },
        { kind: "character", characterId: "washerwoman", actionId: "learnTownsfolk" },
        { kind: "character", characterId: "clockmaker", actionId: "learnSteps" },
        { kind: "system", actionId: "minionInfo" },
        { kind: "system", actionId: "demonInfo" },
        { kind: "system", actionId: "dawn" },
      ],
    },
  }));

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value).toMatchObject({
    schemaVersion: 4,
    script: {
      type: "custom",
      definition: {
        id: "custom-stable-id",
        name: "Mixed roster",
        characterIds: ["washerwoman", "clockmaker", "imp"],
        firstNightOrder: [
          { kind: "system", actionId: "dusk" },
          { kind: "character", characterId: "washerwoman", actionId: "learnTownsfolk" },
          { kind: "character", characterId: "clockmaker", actionId: "learnSteps" },
          { kind: "system", actionId: "minionInfo" },
          { kind: "system", actionId: "demonInfo" },
          { kind: "system", actionId: "dawn" },
        ],
      },
    },
    eventCount: 0,
    phase: "setup",
  });
  expect(result.value).not.toHaveProperty("scriptId");
});
