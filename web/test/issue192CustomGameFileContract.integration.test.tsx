import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import type { GameFile } from "../src/core/types";
import { wasmCoreAdapter } from "../src/core/wasmClient";

beforeAll(() => {
  const wasm = readFileSync(join(
    process.cwd(),
    "src/generated/clocktower_wasm/clocktower_wasm_bg.wasm",
  ));
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith("clocktower_wasm_bg.wasm")) {
      return new Response(wasm, { headers: { "Content-Type": "application/wasm" } });
    }
    throw new Error(`unexpected fetch: ${String(input)}`);
  }));
});

afterAll(() => vi.unstubAllGlobals());

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

test("generated WASM replays a schema-v4 official reference", async () => {
  const result = await wasmCoreAdapter.replay(game({
    type: "official",
    scriptId: "troubleBrewing",
  }));

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value).toMatchObject({
    schemaVersion: 4,
    scriptId: "troubleBrewing",
    eventCount: 0,
    phase: "setup",
  });
});

test("official WASM rejects a custom script reference without runtime fallback", async () => {
  const result = await wasmCoreAdapter.replay(game({ type: "custom", definition: { id: "custom-boundary", name: "Custom boundary", characterIds: [], firstNightOrder: [{ kind: "system", actionId: "dusk" }, { kind: "system", actionId: "minionInfo" }, { kind: "system", actionId: "demonInfo" }, { kind: "system", actionId: "dawn" }] } }));
  expect(result).toMatchObject({ ok: false, error: { code: "MALFORMED_GAME_FILE" } });
});
