import type {
  CustomScriptDefinition,
  GameEvent,
  GameFile,
  GameFileV4,
  ScriptReference,
  SeatLayoutState,
} from "./core/types.js";
import { parseFirstNightOrderPlan, parseGameEvent } from "./core/validation.js";
import {
  isScriptId,
  officialGameFileScriptId,
  scriptStorageKey,
  TROUBLE_BREWING,
  type ScriptId,
} from "./core/scripts.js";
import { resolveCustomScriptDefinition } from "./customScriptRegistry.js";

const DB_NAME = "clocktower";
const DB_VERSION = 1;
const STORE_NAME = "game";
const LATEST_GAME_KEY = "latest";

export type GameStorageDriver = {
  loadLatestGame(): Promise<GameFile | undefined>;
  saveLatestGame(gameFile: GameFile): Promise<void>;
};

export class IndexedDbGameStorageDriver implements GameStorageDriver {
  constructor(
    private readonly scriptId: ScriptId,
    private readonly idb: IDBFactory = globalThis.indexedDB,
  ) {}

  async loadLatestGame(): Promise<GameFile | undefined> {
    const db = await this.openDb();
    try {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      let value = await requestToPromise<unknown>(store.get(scriptStorageKey(this.scriptId)));
      if (value === undefined && this.scriptId === TROUBLE_BREWING) {
        value = await requestToPromise<unknown>(store.get(LATEST_GAME_KEY));
      }
      if (value === undefined) return undefined;
      const canonical = validateGameFile(value);
      if (officialGameFileScriptId(canonical) !== this.scriptId) throw scriptMismatch();
      return canonical;
    } finally {
      db.close();
    }
  }

  async saveLatestGame(gameFile: GameFile): Promise<void> {
    const canonical = canonicalGameFile(gameFile);
    if (officialGameFileScriptId(canonical) !== this.scriptId) throw scriptMismatch();
    const db = await this.openDb();
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(canonical, scriptStorageKey(this.scriptId));
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

export async function loadLatestGame(driver: GameStorageDriver) {
  return driver.loadLatestGame();
}

export async function saveLatestGame(
  gameFile: GameFile,
  driver: GameStorageDriver,
) {
  await driver.saveLatestGame(canonicalGameFile(gameFile));
}

export function exportGameFileJson(gameFile: GameFile, exportedAt = new Date()): string {
  const canonical = canonicalGameFile(gameFile);
  return JSON.stringify(
    {
      ...canonical,
      exportedAt: exportedAt.toISOString(),
    },
    null,
    2,
  );
}

export function importGameFileJson(
  json: string,
  expectedScriptId: ScriptId = TROUBLE_BREWING,
): GameFileV4 {
  const gameFile = parseGameFileJson(json);
  if (officialGameFileScriptId(gameFile) !== expectedScriptId) throw scriptMismatch();
  return gameFile;
}

export function parseGameFileJson(json: string): GameFileV4 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("게임 파일 형식이 올바르지 않습니다.");
  }

  return validateGameFile(parsed);
}

function validateGameFile(value: unknown): GameFileV4 {
  if (!isRecord(value)) {
    throw new Error("게임 파일 형식이 올바르지 않습니다.");
  }
  if (value.schemaVersion !== 2 && value.schemaVersion !== 3 && value.schemaVersion !== 4) {
    throw new Error("지원하지 않는 게임 파일 버전입니다.");
  }
  if (!isRecord(value.game)) {
    throw new Error("게임 파일 형식이 올바르지 않습니다.");
  }
  const script = parseStoredScriptReference(value.schemaVersion, value.game);
  if (
    typeof value.game.id !== "string" ||
    typeof value.game.name !== "string" ||
    typeof value.game.createdAt !== "string" ||
    typeof value.game.updatedAt !== "string" ||
    !Array.isArray(value.game.events)
  ) {
    throw new Error("게임 파일 형식이 올바르지 않습니다.");
  }

  const events = value.game.events.map(parseGameEvent);
  const seatLayout = parseSeatLayout(value.ui, events);
  const ui = seatLayout ? { seatLayout } : undefined;

  return {
    schemaVersion: 4,
    ...(ui ? { ui } : {}),
    game: {
      script,
      id: value.game.id,
      name: value.game.name,
      createdAt: value.game.createdAt,
      updatedAt: value.game.updatedAt,
      events,
    },
  };
}

function parseStoredScriptReference(
  schemaVersion: unknown,
  game: Record<string, unknown>,
): ScriptReference {
  const hasLegacyScriptId = Object.hasOwn(game, "scriptId");
  const hasScriptReference = Object.hasOwn(game, "script");
  if (schemaVersion === 2) {
    if (hasLegacyScriptId || hasScriptReference) throw malformedGameFile();
    return { type: "official", scriptId: TROUBLE_BREWING };
  }
  if (schemaVersion === 3) {
    if (!hasLegacyScriptId || hasScriptReference || !isScriptId(game.scriptId)) {
      throw malformedGameFile();
    }
    return { type: "official", scriptId: game.scriptId };
  }
  if (hasLegacyScriptId || !hasScriptReference) throw malformedGameFile();
  return parseScriptReference(game.script);
}

function parseScriptReference(value: unknown): ScriptReference {
  if (!isRecord(value) || typeof value.type !== "string") throw malformedGameFile();
  if (value.type === "official") {
    if (!hasExactKeys(value, ["type", "scriptId"]) || !isScriptId(value.scriptId)) {
      throw malformedGameFile();
    }
    return { type: "official", scriptId: value.scriptId };
  }
  if (value.type === "custom") {
    if (!hasExactKeys(value, ["type", "definition"])) throw malformedGameFile();
    return { type: "custom", definition: parseCustomScriptDefinition(value.definition) };
  }
  throw malformedGameFile();
}

export function parseCustomScriptDefinition(value: unknown): CustomScriptDefinition {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ["id", "name", "characterIds", "firstNightOrder"])
    || typeof value.id !== "string"
    || value.id.trim().length === 0
    || typeof value.name !== "string"
    || value.name.trim().length === 0
    || !Array.isArray(value.characterIds)
    || !value.characterIds.every(
      (characterId) => typeof characterId === "string" && characterId.trim().length > 0,
    )
  ) {
    throw new Error("커스텀 시나리오 정의가 올바르지 않습니다.");
  }
  if (new Set(value.characterIds).size !== value.characterIds.length) {
    throw new Error("커스텀 시나리오에 중복된 캐릭터가 있습니다.");
  }
  return resolveCustomScriptDefinition({
    id: value.id,
    name: value.name,
    characterIds: [...value.characterIds],
    firstNightOrder: parseFirstNightOrderPlan(value.firstNightOrder),
  });
}

function canonicalGameFile(gameFile: GameFile): GameFileV4 {
  return gameFile.schemaVersion === 4
    ? gameFile
    : {
        ...gameFile,
        schemaVersion: 4,
        game: {
          script: { type: "official", scriptId: gameFile.game.scriptId },
          id: gameFile.game.id,
          name: gameFile.game.name,
          createdAt: gameFile.game.createdAt,
          updatedAt: gameFile.game.updatedAt,
          events: gameFile.game.events,
        },
      };
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function malformedGameFile(): Error {
  return new Error("게임 파일 형식이 올바르지 않습니다.");
}

function scriptMismatch(): Error {
  return new Error("현재 페이지와 다른 스크립트의 게임 파일입니다.");
}

function parseSeatLayout(ui: unknown, events: GameEvent[]): SeatLayoutState | undefined {
  if (ui === undefined) return undefined;
  if (!isRecord(ui)) throw invalidSeatLayout();
  if (ui.seatLayout === undefined) return undefined;
  if (!isRecord(ui.seatLayout)) throw invalidSeatLayout();

  const { preset, positions } = ui.seatLayout;
  if (
    preset !== "circle" &&
    preset !== "oval" &&
    preset !== "longTable" &&
    preset !== "horseshoe"
  ) {
    throw invalidSeatLayout();
  }
  if (!isRecord(positions)) throw invalidSeatLayout();

  const setupEvent = events.find((event) => event.type === "setupConfirmed");
  if (!setupEvent) throw invalidSeatLayout();
  const expectedSeats = new Set(setupEvent.payload.players.map((player) => player.seat));
  const parsedPositions: SeatLayoutState["positions"] = {};

  for (const [seatKey, position] of Object.entries(positions)) {
    const seat = Number(seatKey);
    if (
      !Number.isInteger(seat) ||
      seat < 1 ||
      seat > 15 ||
      !expectedSeats.has(seat) ||
      !isRecord(position) ||
      typeof position.x !== "number" ||
      !Number.isFinite(position.x) ||
      position.x < 8 ||
      position.x > 92 ||
      typeof position.y !== "number" ||
      !Number.isFinite(position.y) ||
      position.y < 12 ||
      position.y > 88
    ) {
      throw invalidSeatLayout();
    }
    parsedPositions[seat] = { x: position.x, y: position.y };
  }

  if (
    Object.keys(parsedPositions).length !== expectedSeats.size ||
    [...expectedSeats].some((seat) => parsedPositions[seat] === undefined)
  ) {
    throw invalidSeatLayout();
  }

  return { preset, positions: parsedPositions };
}

function invalidSeatLayout(): Error {
  return new Error("좌석 배치 정보가 올바르지 않습니다.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
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
