import type { CustomScriptDefinition, GameFileV4 } from "../core/types.js";
import { parseCustomScriptDefinition, parseGameFileJson } from "./gameFile.js";

const DB_NAME = "clocktower";
const DB_VERSION = 1;
const STORE_NAME = "game";
const CUSTOM_SESSION_KEY_PREFIX = "session:custom:";

export type CustomWebSessionSnapshot<SetupDraft = unknown, Presentation = unknown> = {
  version: 1;
  customScriptId: string;
  savedAt: string;
  canonical: GameFileV4;
  setupDraft: SetupDraft;
  presentation: Presentation;
};

export type CustomWebSessionLoadResult<SetupDraft = unknown, Presentation = unknown> =
  | { status: "missing" }
  | { status: "loaded"; snapshot: CustomWebSessionSnapshot<SetupDraft, Presentation> }
  | { status: "unreadable"; error: Error };

export type CustomWebSessionStorageDriver<SetupDraft = unknown, Presentation = unknown> = {
  loadSession(): Promise<CustomWebSessionLoadResult<SetupDraft, Presentation>>;
  saveSession(snapshot: CustomWebSessionSnapshot<SetupDraft, Presentation>): Promise<void>;
  replaceUnreadableSession(
    snapshot: CustomWebSessionSnapshot<SetupDraft, Presentation>,
  ): Promise<void>;
};

export type CustomWebSessionErrorCode =
  | "CUSTOM_SESSION_INVALID"
  | "CUSTOM_SESSION_ID_MISMATCH"
  | "CUSTOM_SESSION_RECOVERY_REQUIRED"
  | "CUSTOM_SESSION_NOT_UNREADABLE";

export class CustomWebSessionError extends Error {
  constructor(
    readonly code: CustomWebSessionErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CustomWebSessionError";
  }
}

export class IndexedDbCustomWebSessionStorageDriver<SetupDraft = unknown, Presentation = unknown>
  implements CustomWebSessionStorageDriver<SetupDraft, Presentation> {
  constructor(
    private readonly customScriptId: string,
    private readonly idb: IDBFactory = globalThis.indexedDB,
  ) {
    validateStableId(customScriptId);
  }

  async loadSession(): Promise<CustomWebSessionLoadResult<SetupDraft, Presentation>> {
    const db = await this.openDb();
    try {
      const stored = await requestToPromise<unknown>(
        db.transaction(STORE_NAME, "readonly")
          .objectStore(STORE_NAME)
          .get(customSessionStorageKey(this.customScriptId)),
      );
      if (stored === undefined) return { status: "missing" };
      try {
        return {
          status: "loaded",
          snapshot: parseCustomWebSession<SetupDraft, Presentation>(stored, this.customScriptId),
        };
      } catch (error) {
        return { status: "unreadable", error: asError(error) };
      }
    } finally {
      db.close();
    }
  }

  async saveSession(
    snapshot: CustomWebSessionSnapshot<SetupDraft, Presentation>,
  ): Promise<void> {
    const validated = parseCustomWebSession<SetupDraft, Presentation>(snapshot, this.customScriptId);
    const db = await this.openDb();
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const key = customSessionStorageKey(this.customScriptId);
      const existing = await requestToPromise<unknown>(store.get(key));
      if (existing !== undefined) {
        try {
          parseCustomWebSession(existing, this.customScriptId);
        } catch (error) {
          transaction.abort();
          throw new CustomWebSessionError(
            "CUSTOM_SESSION_RECOVERY_REQUIRED",
            "저장된 커스텀 게임을 명시적으로 복구해야 합니다.",
            { cause: error },
          );
        }
      }
      store.put(validated, key);
      await transactionDone(transaction);
    } finally {
      db.close();
    }
  }

  async replaceUnreadableSession(
    snapshot: CustomWebSessionSnapshot<SetupDraft, Presentation>,
  ): Promise<void> {
    const validated = parseCustomWebSession<SetupDraft, Presentation>(snapshot, this.customScriptId);
    const db = await this.openDb();
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const key = customSessionStorageKey(this.customScriptId);
      const existing = await requestToPromise<unknown>(store.get(key));
      let unreadable = existing !== undefined;
      if (existing !== undefined) {
        try {
          parseCustomWebSession(existing, this.customScriptId);
          unreadable = false;
        } catch {
          unreadable = true;
        }
      }
      if (!unreadable) {
        transaction.abort();
        throw new CustomWebSessionError(
          "CUSTOM_SESSION_NOT_UNREADABLE",
          "복구할 손상된 커스텀 게임이 없습니다.",
        );
      }
      store.put(validated, key);
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

export function createCustomGameFile(
  definition: CustomScriptDefinition,
  gameId: string = crypto.randomUUID(),
  now = new Date(),
): GameFileV4 {
  const snapshot = structuredClone(parseCustomScriptDefinition(definition));
  const timestamp = now.toISOString();
  return {
    schemaVersion: 4,
    game: {
      script: { type: "custom", definition: snapshot },
      id: gameId,
      name: snapshot.name,
      createdAt: timestamp,
      updatedAt: timestamp,
      events: [],
    },
  };
}

export function createCustomWebSessionSnapshot<SetupDraft, Presentation>(
  canonical: GameFileV4,
  setupDraft: SetupDraft,
  presentation: Presentation,
  savedAt = new Date().toISOString(),
): CustomWebSessionSnapshot<SetupDraft, Presentation> {
  if (canonical.game.script.type !== "custom") throw invalidSession();
  return parseCustomWebSession({
    version: 1,
    customScriptId: canonical.game.script.definition.id,
    savedAt,
    canonical,
    setupDraft,
    presentation,
  });
}

export class CoalescingCustomSessionAutosaveQueue<Snapshot> {
  private inFlight = false;
  private pending: PendingSave<Snapshot> | undefined;

  constructor(private readonly save: (snapshot: Snapshot) => Promise<void>) { }

  enqueue(snapshot: Snapshot): Promise<boolean> {
    return new Promise((resolve) => {
      this.pending?.resolve(false);
      this.pending = { snapshot: structuredClone(snapshot), resolve };
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.inFlight || !this.pending) return;
    const candidate = this.pending;
    this.pending = undefined;
    this.inFlight = true;
    let saved = false;
    try {
      await this.save(candidate.snapshot);
      saved = true;
    } catch {
      const pendingAfterFailure = this.pending as PendingSave<Snapshot> | undefined;
      pendingAfterFailure?.resolve(false);
      this.pending = undefined;
    } finally {
      this.inFlight = false;
      candidate.resolve(saved);
    }
    if (saved && this.pending) void this.drain();
  }
}

type PendingSave<Snapshot> = {
  snapshot: Snapshot;
  resolve: (saved: boolean) => void;
};

function parseCustomWebSession<SetupDraft, Presentation>(
  value: unknown,
  expectedId?: string,
): CustomWebSessionSnapshot<SetupDraft, Presentation> {
  if (
    !isRecord(value)
    || !hasExactKeys(value, [
      "version",
      "customScriptId",
      "savedAt",
      "canonical",
      "setupDraft",
      "presentation",
    ])
    || value.version !== 1
    || typeof value.customScriptId !== "string"
    || value.customScriptId.trim().length === 0
    || typeof value.savedAt !== "string"
    || Number.isNaN(Date.parse(value.savedAt))
  ) {
    throw invalidSession();
  }
  if (expectedId !== undefined && value.customScriptId !== expectedId) {
    throw idMismatch();
  }
  let canonical: GameFileV4;
  try {
    canonical = parseGameFileJson(JSON.stringify(value.canonical));
  } catch (error) {
    throw invalidSession(error);
  }
  if (canonical.game.script.type !== "custom") throw invalidSession();
  if (canonical.game.script.definition.id !== value.customScriptId) throw idMismatch();
  return {
    version: 1,
    customScriptId: value.customScriptId,
    savedAt: value.savedAt,
    canonical,
    setupDraft: structuredClone(value.setupDraft) as SetupDraft,
    presentation: structuredClone(value.presentation) as Presentation,
  };
}

function validateStableId(id: string): void {
  if (typeof id !== "string" || id.trim().length === 0) throw invalidSession();
}

function customSessionStorageKey(id: string): string {
  return `${CUSTOM_SESSION_KEY_PREFIX}${encodeURIComponent(id)}`;
}

function invalidSession(cause?: unknown): CustomWebSessionError {
  return new CustomWebSessionError(
    "CUSTOM_SESSION_INVALID",
    "커스텀 웹 세션 형식이 올바르지 않습니다.",
    cause === undefined ? undefined : { cause },
  );
}

function idMismatch(): CustomWebSessionError {
  return new CustomWebSessionError(
    "CUSTOM_SESSION_ID_MISMATCH",
    "커스텀 시나리오 ID와 저장 세션이 일치하지 않습니다.",
  );
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : invalidSession(error);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
