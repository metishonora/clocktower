import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { IndexedDbCustomScriptRepository } from "../../src/custom/storage/definitionRepository.js";
import type { CustomScriptDefinition, FirstNightOrderPlan } from "../../src/custom/core/types.js";
import { realWasmCore } from "./realCustomWasmHarness.js";
import { loadCustomDefinitionValidator } from "../../src/custom/core/wasmClient.js";

function definition(id = "repository-validation"): CustomScriptDefinition {
  return {
    id,
    name: "Repository validation",
    characterIds: ["washerwoman", "imp"],
    firstNightOrder: [
      { kind: "system", actionId: "dusk" },
      { kind: "system", actionId: "demonInfo" },
      { kind: "character", characterId: "washerwoman", actionId: "learnTownsfolk" },
      { kind: "system", actionId: "minionInfo" },
      { kind: "system", actionId: "dawn" },
    ],
  };
}

describe("Issue #198 repository uses canonical definition validation", () => {
  it("snapshots save input while preparing the validator before the transaction", async () => {
    realWasmCore();
    const idb = new IDBFactory();
    const validate = await loadCustomDefinitionValidator();
    let ready!: () => void;
    const preparation = new Promise<void>((resolve) => { ready = resolve; });
    const repository = new IndexedDbCustomScriptRepository(idb, async () => {
      await preparation;
      return validate;
    });
    const original = definition();
    const input = structuredClone(original);
    const saving = repository.save({ version: 1, definition: input });
    input.firstNightOrder.length = 0;
    ready();
    await saving;
    expect(await repository.load(original.id)).toEqual({
      status: "loaded", record: { version: 1, definition: original },
    });
  });

  it("rejects invalid orders before overwriting a valid record", async () => {
    realWasmCore();
    const repository = new IndexedDbCustomScriptRepository(new IDBFactory());
    const valid = definition();
    await repository.save({ version: 1, definition: valid });
    const invalidOrders: FirstNightOrderPlan[] = [
      [],
      valid.firstNightOrder.filter((entry) => entry.kind !== "character"),
      [valid.firstNightOrder[0]!, ...valid.firstNightOrder],
      [...valid.firstNightOrder].reverse(),
      valid.firstNightOrder.map((entry) => entry.kind === "character"
        ? { ...entry, actionId: "wrongAction" } : entry),
      valid.firstNightOrder.map((entry) => entry.kind === "character"
        ? { ...entry, characterId: "notInThePool" } : entry),
    ];
    for (const firstNightOrder of invalidOrders) {
      await expect(repository.save({
        version: 1,
        definition: { ...valid, firstNightOrder },
      })).rejects.toMatchObject({ code: "CUSTOM_DEFINITION_INVALID" });
      expect(await repository.load(valid.id)).toEqual({
        status: "loaded", record: { version: 1, definition: valid },
      });
    }

    const { firstNightOrder: _order, ...missingOrder } = valid;
    await expect(repository.save({
      version: 1, definition: missingOrder as CustomScriptDefinition,
    })).rejects.toMatchObject({ code: "CUSTOM_DEFINITION_INVALID" });
    expect(await repository.load(valid.id)).toEqual({
      status: "loaded", record: { version: 1, definition: valid },
    });
  });

  it("marks invalid stored orders unreadable and requires a valid explicit recovery", async () => {
    realWasmCore();
    const idb = new IDBFactory();
    const repository = new IndexedDbCustomScriptRepository(idb);
    const valid = definition("valid");
    const invalid = { ...definition("broken"), firstNightOrder: [] };
    await repository.save({ version: 1, definition: valid });
    await putRaw(idb, invalid.id, { version: 1, definition: invalid });

    expect(await repository.load(invalid.id)).toMatchObject({ status: "unreadable" });
    expect(await repository.list()).toEqual({
      records: [{ version: 1, definition: valid }], unreadableIds: [invalid.id],
    });
    await expect(repository.save({
      version: 1, definition: definition(invalid.id),
    })).rejects.toMatchObject({ code: "CUSTOM_DEFINITION_RECOVERY_REQUIRED" });
    await expect(repository.replaceUnreadable(invalid.id, {
      version: 1, definition: invalid,
    })).rejects.toMatchObject({ code: "CUSTOM_DEFINITION_INVALID" });
    expect(await repository.load(invalid.id)).toMatchObject({ status: "unreadable" });

    const repaired = definition(invalid.id);
    await repository.replaceUnreadable(invalid.id, { version: 1, definition: repaired });
    expect(await repository.load(invalid.id)).toEqual({
      status: "loaded", record: { version: 1, definition: repaired },
    });
  });

  it("does not treat validator initialization failure as corrupt stored data", async () => {
    realWasmCore();
    const idb = new IDBFactory();
    const repository = new IndexedDbCustomScriptRepository(idb);
    const valid = definition();
    await repository.save({ version: 1, definition: valid });
    const unavailable = new IndexedDbCustomScriptRepository(idb, async () => {
      throw new Error("validator unavailable");
    });
    await expect(unavailable.load(valid.id)).rejects.toThrow("validator unavailable");
    await expect(unavailable.save({ version: 1, definition: valid })).rejects.toThrow("validator unavailable");
    expect(await repository.load(valid.id)).toEqual({
      status: "loaded", record: { version: 1, definition: valid },
    });
  });
});

async function putRaw(idb: IDBFactory, id: string, value: unknown): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = idb.open("clocktower", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("game", "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      transaction.objectStore("game").put(value, `custom-definition:${encodeURIComponent(id)}`);
    });
  } finally {
    db.close();
  }
}
