import type { CustomScriptDefinition } from "./core/types.js";
import { parseCustomScriptDefinition } from "./gameStorage.js";

const DB_NAME = "clocktower";
const DB_VERSION = 1;
const STORE_NAME = "game";
const DEFINITION_KEY_PREFIX = "custom-definition:";

export type CustomScriptDefinitionMetadata = {
  author?: string;
  source?: string;
};

export type StoredCustomScriptDefinition = {
  version: 1;
  definition: CustomScriptDefinition;
  metadata?: CustomScriptDefinitionMetadata;
};

export type CustomScriptDefinitionLoadResult =
  | { status: "missing" }
  | { status: "loaded"; record: StoredCustomScriptDefinition }
  | { status: "unreadable"; id: string; error: CustomScriptRepositoryError };

export type CustomScriptDefinitionListResult = {
  records: StoredCustomScriptDefinition[];
  unreadableIds: string[];
};

export type CustomScriptRepositoryErrorCode =
  | "CUSTOM_DEFINITION_INVALID"
  | "CUSTOM_DEFINITION_ID_MISMATCH"
  | "CUSTOM_DEFINITION_RECOVERY_REQUIRED"
  | "CUSTOM_DEFINITION_NOT_UNREADABLE";

export class CustomScriptRepositoryError extends Error {
  constructor(
    readonly code: CustomScriptRepositoryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CustomScriptRepositoryError";
  }
}

export class IndexedDbCustomScriptRepository {
  constructor(private readonly idb: IDBFactory = globalThis.indexedDB) {}

  async load(id: string): Promise<CustomScriptDefinitionLoadResult> {
    validateStableId(id);
    const db = await this.openDb();
    try {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const stored = await requestToPromise<unknown>(
        transaction.objectStore(STORE_NAME).get(definitionStorageKey(id)),
      );
      if (stored === undefined) return { status: "missing" };
      try {
        return { status: "loaded", record: parseStoredDefinition(stored, id) };
      } catch (error) {
        return { status: "unreadable", id, error: unreadableError(error) };
      }
    } finally {
      db.close();
    }
  }

  async list(): Promise<CustomScriptDefinitionListResult> {
    const db = await this.openDb();
    try {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const entries = await definitionEntries(transaction.objectStore(STORE_NAME));
      const records: StoredCustomScriptDefinition[] = [];
      const unreadableIds: string[] = [];
      for (const { id, value } of entries) {
        try {
          records.push(parseStoredDefinition(value, id));
        } catch {
          unreadableIds.push(id);
        }
      }
      records.sort((left, right) => left.definition.id.localeCompare(right.definition.id));
      unreadableIds.sort((left, right) => left.localeCompare(right));
      return { records, unreadableIds };
    } finally {
      db.close();
    }
  }

  async save(record: StoredCustomScriptDefinition): Promise<void> {
    const validated = parseStoredDefinition(record);
    const id = validated.definition.id;
    const db = await this.openDb();
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const key = definitionStorageKey(id);
      const existing = await requestToPromise<unknown>(store.get(key));
      if (existing !== undefined) {
        try {
          parseStoredDefinition(existing, id);
        } catch (error) {
          transaction.abort();
          throw new CustomScriptRepositoryError(
            "CUSTOM_DEFINITION_RECOVERY_REQUIRED",
            "저장된 커스텀 시나리오를 명시적으로 복구해야 합니다.",
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

  async replaceUnreadable(id: string, record: StoredCustomScriptDefinition): Promise<void> {
    validateStableId(id);
    const validated = parseStoredDefinition(record);
    if (validated.definition.id !== id) {
      throw new CustomScriptRepositoryError(
        "CUSTOM_DEFINITION_ID_MISMATCH",
        "복구 대상과 커스텀 시나리오 ID가 일치하지 않습니다.",
      );
    }
    const db = await this.openDb();
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const key = definitionStorageKey(id);
      const existing = await requestToPromise<unknown>(store.get(key));
      let unreadable = existing !== undefined;
      if (existing !== undefined) {
        try {
          parseStoredDefinition(existing, id);
          unreadable = false;
        } catch {
          unreadable = true;
        }
      }
      if (!unreadable) {
        transaction.abort();
        throw new CustomScriptRepositoryError(
          "CUSTOM_DEFINITION_NOT_UNREADABLE",
          "복구할 손상된 커스텀 시나리오가 없습니다.",
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

function parseStoredDefinition(
  value: unknown,
  expectedId?: string,
): StoredCustomScriptDefinition {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ["version", "definition", "metadata"])
    || value.version !== 1
  ) {
    throw invalidDefinition();
  }
  let definition: CustomScriptDefinition;
  try {
    definition = parseCustomScriptDefinition(value.definition);
  } catch (error) {
    throw invalidDefinition(error);
  }
  if (expectedId !== undefined && definition.id !== expectedId) {
    throw new CustomScriptRepositoryError(
      "CUSTOM_DEFINITION_ID_MISMATCH",
      "저장 key와 커스텀 시나리오 ID가 일치하지 않습니다.",
    );
  }
  const metadata = parseMetadata(value.metadata);
  return {
    version: 1,
    definition,
    ...(metadata ? { metadata } : {}),
  };
}

function parseMetadata(value: unknown): CustomScriptDefinitionMetadata | undefined {
  if (value === undefined) return undefined;
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ["author", "source"])
    || (value.author !== undefined && typeof value.author !== "string")
    || (value.source !== undefined && typeof value.source !== "string")
  ) {
    throw invalidDefinition();
  }
  return {
    ...(value.author === undefined ? {} : { author: value.author }),
    ...(value.source === undefined ? {} : { source: value.source }),
  };
}

function validateStableId(id: string): void {
  if (typeof id !== "string" || id.trim().length === 0) throw invalidDefinition();
}

function invalidDefinition(cause?: unknown): CustomScriptRepositoryError {
  return new CustomScriptRepositoryError(
    "CUSTOM_DEFINITION_INVALID",
    "커스텀 시나리오 저장 정의가 올바르지 않습니다.",
    cause === undefined ? undefined : { cause },
  );
}

function unreadableError(cause: unknown): CustomScriptRepositoryError {
  return cause instanceof CustomScriptRepositoryError
    ? cause
    : invalidDefinition(cause);
}

function definitionStorageKey(id: string): string {
  return `${DEFINITION_KEY_PREFIX}${encodeURIComponent(id)}`;
}

function definitionIdFromStorageKey(key: IDBValidKey): string | undefined {
  if (typeof key !== "string" || !key.startsWith(DEFINITION_KEY_PREFIX)) return undefined;
  const encoded = key.slice(DEFINITION_KEY_PREFIX.length);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function definitionEntries(
  store: IDBObjectStore,
): Promise<Array<{ id: string; value: unknown }>> {
  return new Promise((resolve, reject) => {
    const entries: Array<{ id: string; value: unknown }> = [];
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(entries);
        return;
      }
      const id = definitionIdFromStorageKey(cursor.key);
      if (id !== undefined) entries.push({ id, value: cursor.value });
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 조회 실패"));
  });
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
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
