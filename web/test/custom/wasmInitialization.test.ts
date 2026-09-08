import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, test, vi } from "vitest";
import trace from "../../../fixtures/acceptance/custom-first-night/compatibility/production-trace.json" with { type: "json" };
import { parseGameFileJson } from "../../src/custom/storage/gameFile.js";
import { IndexedDbCustomScriptRepository } from "../../src/custom/storage/definitionRepository.js";

const state = vi.hoisted(() => ({ fail: true, calls: 0, replay: "" }));
vi.mock("../../src/generated/clocktower_custom_wasm/clocktower_custom_wasm.js", () => ({
  default: async () => { state.calls += 1; if (state.fail) throw new Error("custom wasm unavailable"); },
  replay: () => state.replay,
  propose: () => { throw new Error("unexpected proposal"); },
  setup_distribution: () => { throw new Error("unexpected setup query"); },
  custom_script_catalog: () => "[]",
  custom_first_night_plan: () => { throw new Error("unexpected definition query"); },
}));
beforeEach(() => { vi.resetModules(); state.fail = true; state.calls = 0; state.replay = JSON.stringify({ ok: true, value: trace.trace[0]!.replay }); });

test("failed custom initialization clears its own pending request and permits a later retry", async () => {
  const client = await import("../../src/custom/core/wasmClient.js");
  const game = parseGameFileJson(JSON.stringify(trace.trace[0]!.game));
  const requests = [client.replay(game), client.replay(game)];
  await expect(Promise.all(requests)).rejects.toThrow("custom wasm unavailable");
  expect(state.calls).toBe(1);
  expect(client.setupDistributionSync({ customDefinition: game.game.script.definition, playerCount: 7, actualCharacters: [] })).toBeUndefined();
  state.fail = false;
  expect(await client.replay(game)).toEqual({ ok: true, value: trace.trace[0]!.replay });
  expect(state.calls).toBe(2);
});

test("definition initialization failure does not open IndexedDB or classify a record as corrupt", async () => {
  const idb = new IDBFactory();
  const open = vi.spyOn(idb, "open");
  const repository = new IndexedDbCustomScriptRepository(idb);
  await expect(repository.load("existing-definition")).rejects.toThrow("custom wasm unavailable");
  expect(open).not.toHaveBeenCalled();
  expect(state.calls).toBe(1);
});
