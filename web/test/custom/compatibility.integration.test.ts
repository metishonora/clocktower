import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { IDBFactory } from "fake-indexeddb";
import { expect, test } from "vitest";
import { CustomCanonicalSession } from "../../src/custom/session.js";
import { IndexedDbCustomScriptRepository, type StoredCustomScriptDefinition } from "../../src/custom/storage/definitionRepository.js";
import { IndexedDbCustomWebSessionStorageDriver, type CustomWebSessionSnapshot } from "../../src/custom/storage/sessionStorage.js";
import { parseGameFileJson } from "../../src/custom/storage/gameFile.js";
import type { Command, Proposal, ReplayState } from "../../src/custom/core/types.js";
import { realWasmCore } from "./realCustomWasmHarness.js";

const baseline = (name: string) => JSON.parse(readFileSync(resolve(process.cwd(), "../fixtures/acceptance/custom-first-night/compatibility", name), "utf8"));

test("independent Production WASM and IndexedDB restore the frozen pre-separation records", async () => {
  const core = realWasmCore();
  const trace = baseline("production-trace.json").trace as Array<{ game: unknown; replay: ReplayState; proposal?: Proposal; command?: Command }>;
  for (let index = 0; index < trace.length; index += 1) {
    const prefix = trace[index]!;
    const game = parseGameFileJson(JSON.stringify(prefix.game));
    expect(await core.replay(game)).toEqual({ ok: true, value: prefix.replay });
    if (index > 0) {
      const prior = parseGameFileJson(JSON.stringify(trace[index - 1]!.game));
      expect(await core.propose(prior, prefix.command!)).toEqual({ ok: true, value: prefix.proposal });
    }
  }
  const idb = new IDBFactory();
  const record = baseline("definition-record.json") as StoredCustomScriptDefinition;
  const repository = new IndexedDbCustomScriptRepository(idb);
  await repository.save(record);
  expect(await repository.load(record.definition.id)).toEqual({ status: "loaded", record });
  const snapshot = baseline("session-record.json") as CustomWebSessionSnapshot;
  const storage = new IndexedDbCustomWebSessionStorageDriver(snapshot.customScriptId, idb);
  await storage.saveSession(snapshot);
  expect(await storage.loadSession()).toEqual({ status: "loaded", snapshot });
  const loaded = await CustomCanonicalSession.load({ core, storage });
  expect(loaded.status).toBe("loaded");
  if (loaded.status !== "loaded") throw new Error("Baseline session did not load");
  expect(loaded.session.snapshot).toEqual(snapshot);
  expect(loaded.session.canResumeWith(record.definition)).toBe(true);
  expect(loaded.session.canResumeWith({ ...record.definition, name: "Changed" })).toBe(false);
});
