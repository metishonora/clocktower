import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { BAD_MOON_RISING } from "../src/core/scripts";
import type { GameFile } from "../src/core/types";
import { wasmCoreAdapter } from "../src/core/wasmClient";
import { exportGameFileJson, importGameFileJson } from "../src/gameStorage";

function fixtureText(): string {
  return readFileSync(resolve(
    process.cwd(),
    "../fixtures/acceptance/shared/issue-177-ordered-death.json",
  ), "utf8");
}

beforeAll(() => {
  const wasm = readFileSync(resolve(
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

test("round-trips an ordered multi-target action through TypeScript import/export and real WASM replay", async () => {
  const imported = importGameFileJson(fixtureText(), BAD_MOON_RISING);
  const exported = exportGameFileJson(imported, new Date("2026-08-24T01:00:00.000Z"));
  const roundTripped = importGameFileJson(exported, BAD_MOON_RISING);
  const ordered = roundTripped.game.events.find(({ type }) => (type as string) === "orderedDeathResolved");

  expect(ordered).toEqual(imported.game.events[1]);

  const replayed = await wasmCoreAdapter.replay(roundTripped);
  expect(replayed.ok).toBe(true);
  if (!replayed.ok) return;
  expect(replayed.value.players.find(({ id }) => id === "player-1")?.alive).toBe(true);
  expect(replayed.value.players.find(({ id }) => id === "player-2")?.alive).toBe(false);
  expect(replayed.value.ruleState.unannouncedNightDeathPlayerIds).toEqual(["player-2"]);
});

test("rejects reordered target resolutions through the real WASM boundary", async () => {
  const tampered = JSON.parse(fixtureText()) as {
    game: { events: Array<{ type: string; payload: { resolutions?: unknown[] } }> };
  };
  const event = tampered.game.events.find(({ type }) => type === "orderedDeathResolved");
  event?.payload.resolutions?.reverse();

  const replayed = await wasmCoreAdapter.replay(tampered as unknown as GameFile);

  expect(replayed.ok).toBe(false);
  if (!replayed.ok) expect(replayed.error.code).toBe("INVALID_DEATH_RESOLUTION");
});

