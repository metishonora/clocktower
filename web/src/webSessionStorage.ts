import type { ScriptId } from "./core/scripts.js";
import type { GameFile } from "./core/types.js";
import {
  importGameFileJson,
  type GameStorageDriver,
} from "./gameStorage.js";

const DB_NAME = "clocktower";
const DB_VERSION = 1;
const STORE_NAME = "game";

export type WebSessionSnapshot<SetupDraft = unknown, Presentation = unknown> = {
  version: 1;
  scriptId: ScriptId;
  savedAt: string;
  canonical: GameFile;
  setupDraft: SetupDraft;
  presentation: Presentation;
};

export type WebSessionStorageDriver<SetupDraft = unknown, Presentation = unknown> = {
  loadSession(): Promise<WebSessionSnapshot<SetupDraft, Presentation> | undefined>;
  saveSession(snapshot: WebSessionSnapshot<SetupDraft, Presentation>): Promise<void>;
};

export type CompatibleWebSessionStorage<SetupDraft, Presentation> =
  | WebSessionStorageDriver<SetupDraft, Presentation>
  | GameStorageDriver;

export class IndexedDbWebSessionStorageDriver<SetupDraft = unknown, Presentation = unknown>
implements WebSessionStorageDriver<SetupDraft, Presentation> {
  constructor(
    private readonly scriptId: ScriptId,
    private readonly idb: IDBFactory = globalThis.indexedDB,
  ) {}

  async loadSession(): Promise<WebSessionSnapshot<SetupDraft, Presentation> | undefined> {
    const db = await this.openDb();
    try {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const stored = await requestToPromise<unknown>(
        transaction.objectStore(STORE_NAME).get(sessionStorageKey(this.scriptId)),
      );
      return stored === undefined
        ? undefined
        : parseWebSession(stored, this.scriptId) as WebSessionSnapshot<SetupDraft, Presentation>;
    } finally {
      db.close();
    }
  }

  async saveSession(snapshot: WebSessionSnapshot<SetupDraft, Presentation>): Promise<void> {
    if (
      snapshot.scriptId !== this.scriptId
      || snapshot.canonical.game.scriptId !== this.scriptId
    ) {
      throw scriptMismatch();
    }
    const validated = parseWebSession(snapshot, this.scriptId);
    const db = await this.openDb();
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(
        validated,
        sessionStorageKey(this.scriptId),
      );
      await transactionDone(transaction);
    } finally {
      db.close();
    }
  }

  private async openDb(): Promise<IDBDatabase> {
    const request = this.idb.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    return requestToPromise(request);
  }
}

export function loadWebSession<SetupDraft, Presentation>(
  driver: WebSessionStorageDriver<SetupDraft, Presentation>,
): Promise<WebSessionSnapshot<SetupDraft, Presentation> | undefined> {
  return driver.loadSession();
}

export async function saveWebSession<SetupDraft, Presentation>(
  snapshot: WebSessionSnapshot<SetupDraft, Presentation>,
  driver: WebSessionStorageDriver<SetupDraft, Presentation>,
): Promise<void> {
  await driver.saveSession(snapshot);
}

export async function loadCompatibleWebSession<SetupDraft, Presentation>(
  driver: CompatibleWebSessionStorage<SetupDraft, Presentation>,
  createFallback: (canonical: GameFile | undefined) => WebSessionSnapshot<SetupDraft, Presentation>,
): Promise<WebSessionSnapshot<SetupDraft, Presentation>> {
  if (isWebSessionStorageDriver<SetupDraft, Presentation>(driver)) {
    return await driver.loadSession() ?? createFallback(undefined);
  }
  return createFallback(await driver.loadLatestGame());
}

export async function saveCompatibleWebSession<SetupDraft, Presentation>(
  snapshot: WebSessionSnapshot<SetupDraft, Presentation>,
  driver: CompatibleWebSessionStorage<SetupDraft, Presentation>,
): Promise<void> {
  if (isWebSessionStorageDriver<SetupDraft, Presentation>(driver)) {
    await driver.saveSession(snapshot);
    return;
  }
  await driver.saveLatestGame(snapshot.canonical);
}

export function parseWebSession(
  value: unknown,
  expectedScriptId: ScriptId,
): WebSessionSnapshot {
  if (
    !isRecord(value)
    || value.version !== 1
    || value.scriptId !== expectedScriptId
    || typeof value.savedAt !== "string"
    || Number.isNaN(Date.parse(value.savedAt))
    || !("setupDraft" in value)
    || !("presentation" in value)
  ) {
    throw invalidSession();
  }
  const canonical = importGameFileJson(JSON.stringify(value.canonical), expectedScriptId);
  return {
    version: 1,
    scriptId: expectedScriptId,
    savedAt: value.savedAt,
    canonical,
    setupDraft: structuredClone(value.setupDraft),
    presentation: structuredClone(value.presentation),
  };
}

function sessionStorageKey(scriptId: ScriptId): string {
  return `session:${scriptId}`;
}

function scriptMismatch(): Error {
  return new Error("현재 세션과 다른 스크립트의 저장 상태입니다.");
}

function invalidSession(): Error {
  return new Error("저장된 웹 세션 형식이 올바르지 않습니다.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWebSessionStorageDriver<SetupDraft, Presentation>(
  driver: CompatibleWebSessionStorage<SetupDraft, Presentation>,
): driver is WebSessionStorageDriver<SetupDraft, Presentation> {
  return "loadSession" in driver && "saveSession" in driver;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 요청 실패"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB 저장 실패"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB 저장 취소"));
  });
}
