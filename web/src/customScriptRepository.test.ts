import { createTestCustomScriptRepository } from "./customScriptRepositoryTestSupport.js";
import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory, IDBObjectStore as FakeIDBObjectStore } from "fake-indexeddb";
import type { StoredCustomScriptDefinition } from "./customScriptRepository.js";
import { IndexedDbGameStorageDriver } from "./gameStorage.js";
import { IndexedDbWebSessionStorageDriver } from "./webSessionStorage.js";
import type { FirstNightOrderPlan } from "./core/types.js";

const FIRST_NIGHT_ORDER: FirstNightOrderPlan = [
  { kind: "system" as const, actionId: "dusk" as const },
  { kind: "character" as const, characterId: "washerwoman", actionId: "learnTownsfolk" },
  { kind: "character" as const, characterId: "clockmaker", actionId: "learnSteps" },
  { kind: "system" as const, actionId: "minionInfo" as const },
  { kind: "system" as const, actionId: "demonInfo" as const },
  { kind: "system" as const, actionId: "dawn" as const },
];

const DEFAULT_CHARACTER_IDS = ["washerwoman", "clockmaker", "imp"];

test("definition repository round-trips ordered runtime data and separate source metadata", async () => {
  const repository = createTestCustomScriptRepository(new IDBFactory());
  const record = definitionRecord("mixed/a:1", {
    metadata: { author: "Storyteller", source: "officialCustomScriptJson" },
    firstNightOrder: FIRST_NIGHT_ORDER,
  });

  await repository.save(record);

  assert.deepEqual(await repository.load(record.definition.id), {
    status: "loaded",
    record,
  });
  assert.deepEqual(await repository.list(), { records: [record], unreadableIds: [] });
});

test("saving the same stable ID atomically replaces the complete envelope without touching another ID", async () => {
  const idb = new IDBFactory();
  const repository = createTestCustomScriptRepository(idb);
  const original = definitionRecord("custom-one", {
    metadata: { author: "Original", source: "manual" },
    firstNightOrder: FIRST_NIGHT_ORDER,
  });
  const other = definitionRecord("custom-two");
  const replacement = definitionRecord("custom-one", {
    name: "Replacement",
    characterIds: ["imp", "clockmaker"],
  });

  await repository.save(original);
  await repository.save(other);
  await repository.save(replacement);

  assert.deepEqual(await repository.load("custom-one"), {
    status: "loaded",
    record: replacement,
  });
  assert.deepEqual(await repository.load("custom-two"), {
    status: "loaded",
    record: other,
  });
  assert.deepEqual((await repository.list()).records, [replacement, other]);
  const storedReplacement = await repository.load("custom-one");
  assert.equal(storedReplacement.status, "loaded");
  if (storedReplacement.status === "loaded") {
    assert.equal("metadata" in storedReplacement.record, false);
    assert.equal("firstNightOrder" in storedReplacement.record.definition, true);
    assert.deepEqual(
      storedReplacement.record.definition.firstNightOrder,
      replacement.definition.firstNightOrder,
    );
  }
});

test("loading an absent stable ID is distinct from an unreadable record", async () => {
  const repository = createTestCustomScriptRepository(new IDBFactory());
  assert.deepEqual(await repository.load("not-stored"), { status: "missing" });
});

test("stored definitions require an explicit first-night order and reject removed fields", async () => {
  const idb = new IDBFactory();
  const repository = createTestCustomScriptRepository(idb);
  await putRaw(idb, definitionKey("missing-order"), {
    version: 1,
    definition: {
      id: "missing-order",
      name: "Missing order",
      characterIds: ["imp"],
    },
  });
  await putRaw(idb, definitionKey("removed-field"), {
    version: 1,
    definition: {
      id: "removed-field",
      name: "Removed field",
      characterIds: ["imp"],
      firstNightOrder: FIRST_NIGHT_ORDER,
      firstNightOrderPlan: FIRST_NIGHT_ORDER,
    },
  });

  assert.equal((await repository.load("missing-order")).status, "unreadable");
  assert.equal((await repository.load("removed-field")).status, "unreadable");
  assert.deepEqual((await repository.list()).unreadableIds, ["missing-order", "removed-field"]);
});

test("one unreadable definition does not hide valid definitions and cannot be overwritten by normal save", async () => {
  const idb = new IDBFactory();
  const repository = createTestCustomScriptRepository(idb);
  const valid = definitionRecord("valid-definition");
  await repository.save(valid);
  await putRaw(idb, definitionKey("broken-definition"), { version: 99, damaged: true });

  const broken = await repository.load("broken-definition");
  assert.equal(broken.status, "unreadable");
  assert.deepEqual(await repository.list(), {
    records: [valid],
    unreadableIds: ["broken-definition"],
  });

  await expectErrorCode(
    repository.save(definitionRecord("broken-definition")),
    "CUSTOM_DEFINITION_RECOVERY_REQUIRED",
  );
  assert.deepEqual(await readRaw(idb, definitionKey("broken-definition")), {
    version: 99,
    damaged: true,
  });
});

test("explicit unreadable-definition recovery replaces only the requested damaged record", async () => {
  const idb = new IDBFactory();
  const repository = createTestCustomScriptRepository(idb);
  const other = definitionRecord("other-definition");
  const recovered = definitionRecord("broken-definition", { name: "Recovered" });
  await repository.save(other);
  await putRaw(idb, definitionKey("broken-definition"), { broken: true });

  await repository.replaceUnreadable("broken-definition", recovered);

  assert.deepEqual(await repository.load("broken-definition"), {
    status: "loaded",
    record: recovered,
  });
  assert.deepEqual(await repository.load("other-definition"), {
    status: "loaded",
    record: other,
  });
  await expectErrorCode(
    repository.replaceUnreadable("other-definition", other),
    "CUSTOM_DEFINITION_NOT_UNREADABLE",
  );

  await putRaw(idb, definitionKey("mismatch-target"), { still: "broken" });
  const beforeBroken = await readRaw(idb, definitionKey("mismatch-target"));
  const beforeOther = await readRaw(idb, definitionKey("other-definition"));
  await expectErrorCode(
    repository.replaceUnreadable("mismatch-target", other),
    "CUSTOM_DEFINITION_ID_MISMATCH",
  );
  assert.deepEqual(await readRaw(idb, definitionKey("mismatch-target")), beforeBroken);
  assert.deepEqual(await readRaw(idb, definitionKey("other-definition")), beforeOther);
});

test("the repository accepts an empty roster and rejects registry-invalid definitions", async () => {
  const repository = createTestCustomScriptRepository(new IDBFactory());
  const empty = definitionRecord("empty-definition", { characterIds: [] });

  await repository.save(empty);
  assert.deepEqual(await repository.load("empty-definition"), {
    status: "loaded",
    record: empty,
  });

  await expectErrorCode(
    repository.save(definitionRecord("invalid-definition", { characterIds: ["grandmother"] })),
    "CUSTOM_DEFINITION_INVALID",
  );
  assert.deepEqual(await repository.load("invalid-definition"), { status: "missing" });
});

test("invalid records and storage-open failures preserve the previously durable record", async () => {
  const idb = new IDBFactory();
  const repository = createTestCustomScriptRepository(idb);
  const original = definitionRecord("durable-definition");
  await repository.save(original);

  await expectErrorCode(
    repository.save({
      ...original,
      definition: { ...original.definition, name: " " },
    }),
    "CUSTOM_DEFINITION_INVALID",
  );

  const failingFactory = Object.create(idb) as IDBFactory;
  failingFactory.open = (() => {
    throw new Error("simulated storage failure");
  }) as IDBFactory["open"];
  const failingRepository = createTestCustomScriptRepository(failingFactory);
  await expectRejection(
    failingRepository.save(definitionRecord("durable-definition", { name: "Lost" })),
  );

  assert.deepEqual(await repository.load("durable-definition"), {
    status: "loaded",
    record: original,
  });
});

test("an aborted replacement transaction preserves the previous complete record", async () => {
  const idb = new IDBFactory();
  const repository = createTestCustomScriptRepository(idb);
  const original = definitionRecord("atomic-definition", {
    metadata: { author: "Durable" },
    firstNightOrder: FIRST_NIGHT_ORDER,
  });
  const replacement = definitionRecord("atomic-definition", { name: "Replacement" });
  await repository.save(original);

  const originalPut = FakeIDBObjectStore.prototype.put;
  let abortNextReplacement = true;
  FakeIDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
    const request = originalPut.apply(this, args);
    if (abortNextReplacement && args[1] === definitionKey("atomic-definition")) {
      abortNextReplacement = false;
      queueMicrotask(() => this.transaction.abort());
    }
    return request;
  };
  try {
    await expectRejection(repository.save(replacement));
  } finally {
    FakeIDBObjectStore.prototype.put = originalPut;
  }

  assert.deepEqual(await repository.load("atomic-definition"), {
    status: "loaded",
    record: original,
  });
});

test("definition writes and recovery preserve official game and web-session records in the shared database", async () => {
  const idb = new IDBFactory();
  const officialGame = officialGameFile();
  const officialSession = {
    version: 1 as const,
    scriptId: "troubleBrewing" as const,
    savedAt: "2026-09-05T00:00:00.000Z",
    canonical: officialGame,
    setupDraft: { playerCount: 7 },
    presentation: { activeTab: "roles" },
  };
  const gameDriver = new IndexedDbGameStorageDriver("troubleBrewing", idb);
  const sessionDriver = new IndexedDbWebSessionStorageDriver("troubleBrewing", idb);
  const repository = createTestCustomScriptRepository(idb);
  await gameDriver.saveLatestGame(officialGame);
  await sessionDriver.saveSession(officialSession);

  await repository.save(definitionRecord("shared-db-definition"));
  await putRaw(idb, definitionKey("broken-shared-db-definition"), { broken: true });
  await repository.replaceUnreadable(
    "broken-shared-db-definition",
    definitionRecord("broken-shared-db-definition"),
  );

  assert.deepEqual(await repository.list(), {
    records: [
      definitionRecord("broken-shared-db-definition"),
      definitionRecord("shared-db-definition"),
    ],
    unreadableIds: [],
  });
  assert.deepEqual(await gameDriver.loadLatestGame(), officialGame);
  assert.deepEqual(await sessionDriver.loadSession(), officialSession);
});

function definitionRecord(
  id: string,
  overrides: {
    name?: string;
    characterIds?: string[];
    firstNightOrder?: typeof FIRST_NIGHT_ORDER;
    metadata?: StoredCustomScriptDefinition["metadata"];
  } = {},
): StoredCustomScriptDefinition {
  return {
    version: 1,
    definition: {
      id,
      name: overrides.name ?? `Definition ${id}`,
      characterIds: overrides.characterIds ?? DEFAULT_CHARACTER_IDS,
      firstNightOrder: overrides.firstNightOrder ?? firstNightOrderFor(
        overrides.characterIds ?? DEFAULT_CHARACTER_IDS,
      ),
    },
    ...(overrides.metadata ? { metadata: overrides.metadata } : {}),
  };
}

function firstNightOrderFor(characterIds: string[]): FirstNightOrderPlan {
  const characterActions = [
    { characterId: "washerwoman", actionId: "learnTownsfolk" },
    { characterId: "clockmaker", actionId: "learnSteps" },
  ] as const;
  return [
    { kind: "system", actionId: "dusk" },
    ...characterActions
      .filter(({ characterId }) => characterIds.includes(characterId))
      .map(({ characterId, actionId }) => ({ kind: "character" as const, characterId, actionId })),
    { kind: "system", actionId: "minionInfo" },
    { kind: "system", actionId: "demonInfo" },
    { kind: "system", actionId: "dawn" },
  ];
}

function definitionKey(id: string): string {
  return `custom-definition:${encodeURIComponent(id)}`;
}

async function putRaw(idb: IDBFactory, key: string, value: unknown): Promise<void> {
  const db = await openDb(idb);
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("game", "readwrite");
    transaction.objectStore("game").put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function readRaw(idb: IDBFactory, key: string): Promise<unknown> {
  const db = await openDb(idb);
  const value = await new Promise<unknown>((resolve, reject) => {
    const transaction = db.transaction("game", "readonly");
    const request = transaction.objectStore("game").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

function officialGameFile() {
  const now = "2026-09-05T00:00:00.000Z";
  return {
    schemaVersion: 4 as const,
    game: {
      script: { type: "official" as const, scriptId: "troubleBrewing" as const },
      id: "official-game",
      name: "Trouble Brewing",
      createdAt: now,
      updatedAt: now,
      events: [],
    },
  };
}

function openDb(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = idb.open("clocktower", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("game");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function expectErrorCode(promise: Promise<unknown>, expectedCode: string): Promise<void> {
  const caught = await caughtRejection(promise);
  assert.equal(
    typeof caught === "object" && caught !== null && "code" in caught
      ? (caught as { code: unknown }).code
      : undefined,
    expectedCode,
  );
}

async function expectRejection(promise: Promise<unknown>): Promise<void> {
  assert.ok((await caughtRejection(promise)) !== undefined);
}

async function caughtRejection(promise: Promise<unknown>): Promise<unknown> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  return caught;
}
