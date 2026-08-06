import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import type { GameFile } from "./core/types.js";
import {
  IndexedDbWebSessionStorageDriver,
  loadWebSession,
  saveWebSession,
  type WebSessionSnapshot,
} from "./webSessionStorage.js";

test("web session storage atomically preserves canonical, draft and presentation per script", async () => {
  const idb = new IDBFactory();
  const tb = new IndexedDbWebSessionStorageDriver("troubleBrewing", idb);
  const snv = new IndexedDbWebSessionStorageDriver("sectsAndViolets", idb);
  const tbSession = snapshot("troubleBrewing", { playerCount: 7 }, { activeTab: "roles" });
  const snvSession = snapshot("sectsAndViolets", { playerCount: 9 }, { activeTab: "seating" });

  await Promise.all([saveWebSession(tbSession, tb), saveWebSession(snvSession, snv)]);

  assert.deepEqual(await loadWebSession(tb), tbSession);
  assert.deepEqual(await loadWebSession(snv), snvSession);
});

test("web session storage replaces one complete snapshot and rejects script mismatch", async () => {
  const driver = new IndexedDbWebSessionStorageDriver("troubleBrewing", new IDBFactory());
  const first = snapshot("troubleBrewing", { playerCount: 7 }, { activeTab: "roles" });
  const second = snapshot("troubleBrewing", { playerCount: 10 }, { activeTab: "seating" });
  await saveWebSession(first, driver);
  await saveWebSession(second, driver);
  assert.deepEqual(await loadWebSession(driver), second);

  const wrong = snapshot("sectsAndViolets", {}, {});
  let mismatch: unknown;
  try {
    await saveWebSession(wrong, driver);
  } catch (error) {
    mismatch = error;
  }
  assert.match(String(mismatch), /다른 스크립트/);
  assert.deepEqual(await loadWebSession(driver), second);
});

function snapshot(
  scriptId: GameFile["game"]["scriptId"],
  setupDraft: unknown,
  presentation: unknown,
): WebSessionSnapshot {
  const now = "2026-08-06T00:00:00.000Z";
  return {
    version: 1,
    scriptId,
    savedAt: now,
    canonical: {
      schemaVersion: 3,
      game: {
        scriptId,
        id: `${scriptId}-game`,
        name: scriptId,
        createdAt: now,
        updatedAt: now,
        events: [],
      },
    },
    setupDraft,
    presentation,
  };
}
