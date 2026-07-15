import type { GameFile } from "./core/types.js";
import { parseGameEvent } from "./core/validation.js";

const DB_NAME = "clocktower";
const DB_VERSION = 1;
const STORE_NAME = "game";
const LATEST_GAME_KEY = "latest";

export type GameStorageDriver = {
  loadLatestGame(): Promise<GameFile | undefined>;
  saveLatestGame(gameFile: GameFile): Promise<void>;
};

export class IndexedDbGameStorageDriver implements GameStorageDriver {
  constructor(private readonly idb: IDBFactory = globalThis.indexedDB) {}

  async loadLatestGame(): Promise<GameFile | undefined> {
    const db = await this.openDb();
    try {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const value = await requestToPromise<unknown>(transaction.objectStore(STORE_NAME).get(LATEST_GAME_KEY));
      return value === undefined ? undefined : validateGameFile(value);
    } finally {
      db.close();
    }
  }

  async saveLatestGame(gameFile: GameFile): Promise<void> {
    const db = await this.openDb();
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(gameFile, LATEST_GAME_KEY);
      await transactionDone(transaction);
    } finally {
      db.close();
    }
  }

  private async openDb(): Promise<IDBDatabase> {
    const request = this.idb.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    return requestToPromise(request);
  }
}

export async function loadLatestGame(driver: GameStorageDriver = new IndexedDbGameStorageDriver()) {
  return driver.loadLatestGame();
}

export async function saveLatestGame(
  gameFile: GameFile,
  driver: GameStorageDriver = new IndexedDbGameStorageDriver(),
) {
  await driver.saveLatestGame(gameFile);
}

export function exportGameFileJson(gameFile: GameFile, exportedAt = new Date()): string {
  return JSON.stringify(
    {
      ...gameFile,
      exportedAt: exportedAt.toISOString(),
    },
    null,
    2,
  );
}

export function importGameFileJson(json: string): GameFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("게임 파일 형식이 올바르지 않습니다.");
  }

  return validateGameFile(parsed);
}

function validateGameFile(value: unknown): GameFile {
  if (!isRecord(value)) {
    throw new Error("게임 파일 형식이 올바르지 않습니다.");
  }
  if (value.schemaVersion !== 2) {
    throw new Error("지원하지 않는 게임 파일 버전입니다.");
  }
  if (!isRecord(value.game)) {
    throw new Error("게임 파일 형식이 올바르지 않습니다.");
  }
  if (
    typeof value.game.id !== "string" ||
    typeof value.game.name !== "string" ||
    typeof value.game.createdAt !== "string" ||
    typeof value.game.updatedAt !== "string" ||
    !Array.isArray(value.game.events)
  ) {
    throw new Error("게임 파일 형식이 올바르지 않습니다.");
  }

  return {
    schemaVersion: 2,
    game: {
      id: value.game.id,
      name: value.game.name,
      createdAt: value.game.createdAt,
      updatedAt: value.game.updatedAt,
      events: value.game.events.map(parseGameEvent),
    },
  };
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
