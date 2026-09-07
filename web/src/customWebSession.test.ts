import { createTestCustomScriptRepository } from "./customScriptRepositoryTestSupport.js";
import { deepEqual, equal, ok, throws } from "node:assert/strict";
import test from "node:test";
import { IDBFactory, IDBObjectStore as FakeIDBObjectStore } from "fake-indexeddb";
import {
  CoalescingCustomSessionAutosaveQueue,
  createCustomGameFile,
  createCustomWebSessionSnapshot,
  IndexedDbCustomWebSessionStorageDriver,
  type CustomWebSessionSnapshot,
} from "./customWebSession.js";
import { IndexedDbWebSessionStorageDriver } from "./webSessionStorage.js";
import type { CustomScriptDefinition, GameEvent, GameFile } from "./core/types.js";

const PLAN = [
  { kind: "system" as const, actionId: "dusk" as const },
  { kind: "character" as const, characterId: "philosopher", actionId: "chooseAbility" },
  { kind: "system" as const, actionId: "minionInfo" as const },
  { kind: "system" as const, actionId: "demonInfo" as const },
  { kind: "system" as const, actionId: "dawn" as const },
];

test("custom web sessions isolate stable IDs and preserve canonical first-night provenance", async () => {
  const idb = new IDBFactory();
  const alpha = customSession("alpha");
  const beta = customSession("beta");
  const alphaDriver = new IndexedDbCustomWebSessionStorageDriver("alpha", idb);
  const betaDriver = new IndexedDbCustomWebSessionStorageDriver("beta", idb);

  await alphaDriver.saveSession(alpha);
  await betaDriver.saveSession(beta);

  deepEqual(await alphaDriver.loadSession(), { status: "loaded", snapshot: alpha });
  deepEqual(await betaDriver.loadSession(), { status: "loaded", snapshot: beta });
  const rawAlpha = await readRaw(idb, sessionKey("alpha")) as Record<string, unknown>;
  equal("firstNightOrderPlan" in rawAlpha, false);
  deepEqual((rawAlpha.canonical as GameFile).game.events, alpha.canonical.game.events);
  const serialized = JSON.stringify(rawAlpha);
  equal(serialized.match(/firstNightOrderPlan/g)?.length ?? 0, 0);
  equal(serialized.match(/actionRef/g)?.length, 1);
  equal(serialized.match(/abilityUse/g)?.length, 1);
});

test("replacing a repository definition leaves the one active game on its immutable snapshot", async () => {
  const idb = new IDBFactory();
  const repository = createTestCustomScriptRepository(idb);
  const original = definition("stable-game");
  const edited = { ...original, name: "Edited definition", characterIds: [...original.characterIds, "poisoner"] };
  const session = customSession("stable-game", original);
  const driver = new IndexedDbCustomWebSessionStorageDriver("stable-game", idb);
  await repository.save({ version: 1, definition: original });
  await driver.saveSession(session);

  await repository.save({ version: 1, definition: edited });

  deepEqual(await driver.loadSession(), { status: "loaded", snapshot: session });
  const loadedDefinition = await repository.load("stable-game");
  equal(loadedDefinition.status, "loaded");
  if (loadedDefinition.status === "loaded") deepEqual(loadedDefinition.record.definition, edited);
});

test("saving a new game explicitly replaces the single custom session for that stable ID", async () => {
  const idb = new IDBFactory();
  const driver = new IndexedDbCustomWebSessionStorageDriver("single-game", idb);
  const first = customSession("single-game");
  const second = {
    ...customSession("single-game"),
    canonical: {
      ...customSession("single-game").canonical,
      game: { ...customSession("single-game").canonical.game, id: "replacement-game" },
    },
  };

  await driver.saveSession(first);
  await driver.saveSession(second);

  deepEqual(await driver.loadSession(), { status: "loaded", snapshot: second });
});

test("custom session storage rejects wrong identities without affecting official sessions", async () => {
  const idb = new IDBFactory();
  const officialDriver = new IndexedDbWebSessionStorageDriver("troubleBrewing", idb);
  const official = officialSession();
  await officialDriver.saveSession(official);
  const customDriver = new IndexedDbCustomWebSessionStorageDriver("expected-custom", idb);

  await expectErrorCode(
    customDriver.saveSession(customSession("different-custom")),
    "CUSTOM_SESSION_ID_MISMATCH",
  );
  await expectErrorCode(
    customDriver.saveSession({
      ...customSession("expected-custom"),
      canonical: official.canonical,
    } as unknown as CustomWebSessionSnapshot),
    "CUSTOM_SESSION_INVALID",
  );

  deepEqual(await officialDriver.loadSession(), official);
  deepEqual(await customDriver.loadSession(), { status: "missing" });
});

test("unreadable custom sessions block normal autosave until explicit replacement recovery", async () => {
  const idb = new IDBFactory();
  const driver = new IndexedDbCustomWebSessionStorageDriver("broken-session", idb);
  const raw = { version: 99, canonical: "damaged" };
  await putRaw(idb, sessionKey("broken-session"), raw);

  const loaded = await driver.loadSession();
  equal(loaded.status, "unreadable");
  await expectErrorCode(
    driver.saveSession(customSession("broken-session")),
    "CUSTOM_SESSION_RECOVERY_REQUIRED",
  );
  deepEqual(await readRaw(idb, sessionKey("broken-session")), raw);

  const recovered = customSession("broken-session");
  await driver.replaceUnreadableSession(recovered);
  deepEqual(await driver.loadSession(), { status: "loaded", snapshot: recovered });
  await expectErrorCode(
    driver.replaceUnreadableSession(recovered),
    "CUSTOM_SESSION_NOT_UNREADABLE",
  );
});

test("an aborted custom-session replacement preserves the previous durable snapshot", async () => {
  const idb = new IDBFactory();
  const driver = new IndexedDbCustomWebSessionStorageDriver("atomic-session", idb);
  const original = customSession("atomic-session");
  const replacement = { ...original, savedAt: "2026-09-05T01:00:00.000Z" };
  await driver.saveSession(original);

  const originalPut = FakeIDBObjectStore.prototype.put;
  let abortNextReplacement = true;
  FakeIDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
    const request = originalPut.apply(this, args);
    if (abortNextReplacement && args[1] === sessionKey("atomic-session")) {
      abortNextReplacement = false;
      queueMicrotask(() => this.transaction.abort());
    }
    return request;
  };
  try {
    let rejected = false;
    try {
      await driver.saveSession(replacement);
    } catch {
      rejected = true;
    }
    equal(rejected, true);
  } finally {
    FakeIDBObjectStore.prototype.put = originalPut;
  }

  deepEqual(await driver.loadSession(), { status: "loaded", snapshot: original });
});

test("autosave failure keeps the caller snapshot and retries only after another meaningful enqueue", async () => {
  const first = customSession("retry-session");
  const second = { ...first, savedAt: "2026-09-05T00:01:00.000Z" };
  const inMemory = second;
  let attempts = 0;
  const queue = new CoalescingCustomSessionAutosaveQueue(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("write failed");
  });

  equal(await queue.enqueue(first), false);
  await new Promise((resolve) => setTimeout(resolve, 20));
  equal(attempts, 1);
  deepEqual(inMemory, second);

  equal(await queue.enqueue(second), true);
  equal(attempts, 2);
});

test("custom game creation snapshots its source definition instead of retaining a mutable reference", () => {
  const source = definition("snapshot-source");
  const expectedPlan = structuredClone(source.firstNightOrder);
  const gameFile = createCustomGameFile(
    source,
    "snapshot-game",
    new Date("2026-09-05T00:00:00.000Z"),
  );
  source.name = "Mutated after creation";
  source.characterIds.push("poisoner");
  const sourceFirstAction = source.firstNightOrder[0];
  if (sourceFirstAction.kind === "system") sourceFirstAction.actionId = "dawn";

  equal(gameFile.game.script.type, "custom");
  if (gameFile.game.script.type === "custom") {
    equal(gameFile.game.script.definition.name, "Definition snapshot-source");
    deepEqual(gameFile.game.script.definition.characterIds, ["philosopher", "imp"]);
    deepEqual(gameFile.game.script.definition.firstNightOrder, expectedPlan);
  }
});

test("custom game creation rejects a definition without an explicit first-night order", () => {
  const source = definition("missing-order");
  const missingOrder = { ...source, firstNightOrder: undefined } as unknown as CustomScriptDefinition;
  throws(() => createCustomGameFile(missingOrder, "missing-order-game"));
});

test("autosave coalesces pending changes and a durability waiter resolves only after storage completes", async () => {
  const first = customSession("queue-session");
  const skipped = { ...first, savedAt: "2026-09-05T00:01:00.000Z" };
  const latest = { ...first, savedAt: "2026-09-05T00:02:00.000Z" };
  const saved: CustomWebSessionSnapshot[] = [];
  let releaseFirst: (() => void) | undefined;
  let firstStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { firstStarted = resolve; });
  const queue = new CoalescingCustomSessionAutosaveQueue(async (snapshot: CustomWebSessionSnapshot) => {
    saved.push(snapshot);
    if (saved.length === 1) {
      firstStarted?.();
      await new Promise<void>((resolve) => { releaseFirst = resolve; });
    }
  });

  let firstDurable = false;
  const firstResult = queue.enqueue(first).then((result: boolean) => {
    firstDurable = result;
    return result;
  });
  await started;
  equal(firstDurable, false);
  const skippedResult = queue.enqueue(skipped);
  const latestResult = queue.enqueue(latest);
  equal(await skippedResult, false);
  releaseFirst?.();

  equal(await firstResult, true);
  equal(await latestResult, true);
  deepEqual(saved, [first, latest]);
});

function definition(id: string): CustomScriptDefinition {
  return {
    id,
    name: `Definition ${id}`,
    characterIds: ["philosopher", "imp"],
    firstNightOrder: structuredClone(PLAN),
  };
}

function customSession(
  id: string,
  customDefinition: CustomScriptDefinition = definition(id),
): CustomWebSessionSnapshot<{ roster: string[] }, { activeTab: string }> {
  const canonical = createCustomGameFile(
    customDefinition,
    `game-${id}`,
    new Date("2026-09-05T00:00:00.000Z"),
  );
  canonical.game.events = customEvents();
  return createCustomWebSessionSnapshot(
    canonical,
    { roster: [...customDefinition.characterIds] },
    { activeTab: "setup" },
    "2026-09-05T00:00:00.000Z",
  );
}

function customEvents(): GameEvent[] {
  return [
    {
      id: "setup-1",
      type: "setupConfirmed",
      phase: "setup",
      payload: { players: [] },
      summary: "setup",
      createdAt: "2026-09-05T00:00:00.000Z",
    },
    {
      id: "action-1",
      type: "phaseStepConfirmed",
      phase: "firstNight",
      payload: {
        stepId: "firstNight:philosopher:player-1",
        actionRef: { kind: "character", characterId: "philosopher", actionId: "chooseAbility" },
        abilityUse: {
          ownerPlayerId: "player-1",
          characterId: "philosopher",
          abilityInstanceId: "ability-1",
        },
        input: null,
      },
      summary: "action",
      createdAt: "2026-09-05T00:00:01.000Z",
    },
  ];
}

function officialSession() {
  const now = "2026-09-05T00:00:00.000Z";
  return {
    version: 1 as const,
    scriptId: "troubleBrewing" as const,
    savedAt: now,
    canonical: {
      schemaVersion: 4 as const,
      game: {
        script: { type: "official" as const, scriptId: "troubleBrewing" as const },
        id: "official-game",
        name: "Trouble Brewing",
        createdAt: now,
        updatedAt: now,
        events: [],
      },
    },
    setupDraft: {},
    presentation: {},
  };
}

function sessionKey(id: string): string {
  return `session:custom:${encodeURIComponent(id)}`;
}

async function expectErrorCode(promise: Promise<unknown>, expectedCode: string): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  ok(caught !== undefined);
  equal(
    typeof caught === "object" && caught !== null && "code" in caught
      ? (caught as { code: unknown }).code
      : undefined,
    expectedCode,
  );
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
    const request = db.transaction("game", "readonly").objectStore("game").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

function openDb(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = idb.open("clocktower", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("game");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
