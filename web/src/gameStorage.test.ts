import { deepEqual, equal, throws } from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import {
  exportGameFileJson,
  importGameFileJson,
  IndexedDbGameStorageDriver,
  loadLatestGame,
  saveLatestGame,
  type GameStorageDriver,
} from "./gameStorage.js";
import type { GameFile } from "./core/types.js";
import { SECTS_AND_VIOLETS, TROUBLE_BREWING } from "./core/scripts.js";

const gameFile: GameFile = {
  schemaVersion: 3,
  game: {
    scriptId: "troubleBrewing",
    id: "game-1",
    name: "Trouble Brewing",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    events: [
      {
        id: "smoke-event",
        type: "smokeConfirmed",
        phase: "setup",
        payload: { source: "smoke" },
        summary: "스모크 명령 확인",
        createdAt: "1970-01-01T00:00:00.000Z",
      },
    ],
  },
};

test("saving the latest GameFile stores one replaceable value", async () => {
  const driver = new MemoryGameStorageDriver();
  await saveLatestGame(gameFile, driver);
  await saveLatestGame({ ...gameFile, game: { ...gameFile.game, events: [] } }, driver);

  deepEqual(await loadLatestGame(driver), {
    ...gameFile,
    game: { ...gameFile.game, events: [] },
  });
  equal(driver.writeCount, 2);
});

test("IndexedDB preserves independent latest games for both scripts", async () => {
  const idb = new IDBFactory();
  const troubleBrewing = new IndexedDbGameStorageDriver("troubleBrewing", idb);
  const sectsAndViolets = new IndexedDbGameStorageDriver("sectsAndViolets", idb);
  const svGame: GameFile = {
    ...gameFile,
    game: {
      ...gameFile.game,
      scriptId: "sectsAndViolets",
      id: "game-sv",
      name: "Sects & Violets",
      events: [],
    },
  };

  await troubleBrewing.saveLatestGame(gameFile);
  await sectsAndViolets.saveLatestGame(svGame);

  deepEqual(await troubleBrewing.loadLatestGame(), gameFile);
  deepEqual(await sectsAndViolets.loadLatestGame(), svGame);
});

test("only Trouble Brewing reads and normalizes the legacy latest key", async () => {
  const idb = new IDBFactory();
  const legacy = structuredClone(gameFile) as unknown as Record<string, unknown>;
  legacy.schemaVersion = 2;
  delete (legacy.game as Record<string, unknown>).scriptId;
  await putRawGame(idb, "latest", legacy);

  const troubleBrewing = new IndexedDbGameStorageDriver("troubleBrewing", idb);
  const sectsAndViolets = new IndexedDbGameStorageDriver("sectsAndViolets", idb);

  deepEqual(await troubleBrewing.loadLatestGame(), gameFile);
  equal(await sectsAndViolets.loadLatestGame(), undefined);
});

test("export writes canonical schema, script identity, and exportedAt", () => {
  const json = exportGameFileJson(gameFile, new Date("2026-07-10T00:00:00.000Z"));
  const parsed = JSON.parse(json);

  equal(parsed.schemaVersion, 3);
  equal(parsed.game.scriptId, "troubleBrewing");
  equal(parsed.exportedAt, "2026-07-10T00:00:00.000Z");
  deepEqual(parsed.game.events, gameFile.game.events);
});

test("import validates canonical GameFile shape and expected script", () => {
  deepEqual(importGameFileJson(JSON.stringify(gameFile), TROUBLE_BREWING), gameFile);
  try {
    importGameFileJson(JSON.stringify({ ...gameFile, schemaVersion: 1 }), TROUBLE_BREWING);
    throw new Error("expected schema validation to fail");
  } catch (error) {
    equal(error instanceof Error ? error.message : "", "지원하지 않는 게임 파일 버전입니다.");
  }
});

test("S&V session metadata survives storage JSON validation without crossing script identity", () => {
  const sectsAndViolets: GameFile = {
    schemaVersion: 3,
    ui: {
      sectsAndVioletsSession: {
        version: 1,
        activeTab: "roles",
        savedAt: "2026-07-22T00:00:00.000Z",
        setup: {
          playerCount: 9,
          demon: "noDashii",
          selectedIds: ["noDashii", "clockmaker"],
          seatAssignments: {},
          seatAlignments: {},
          seatNames: {},
          rosterConfirmed: false,
          seatingConfirmed: false,
        },
        phaseCheckpoints: [],
        madnessJudgments: {
          "mutant:player-1:setup-1": "violation",
          "cerenovus:assignment-1": "clear",
        },
      },
    },
    game: {
      scriptId: SECTS_AND_VIOLETS,
      id: "sv-session",
      name: "Sects & Violets",
      createdAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z",
      events: [],
    },
  };

  deepEqual(importGameFileJson(JSON.stringify(sectsAndViolets), SECTS_AND_VIOLETS), sectsAndViolets);
  try {
    importGameFileJson(JSON.stringify(sectsAndViolets), TROUBLE_BREWING);
    throw new Error("expected script mismatch");
  } catch (error) {
    equal(error instanceof Error ? error.message : "", "현재 페이지와 다른 스크립트의 게임 파일입니다.");
  }
});

test("S&V session validation rejects unknown madness judgment values", () => {
  const malformed = {
    schemaVersion: 3,
    ui: {
      sectsAndVioletsSession: {
        version: 1,
        activeTab: "roles",
        savedAt: "2026-07-22T00:00:00.000Z",
        setup: {
          playerCount: 7,
          demon: "fangGu",
          selectedIds: ["fangGu"],
          seatAssignments: {},
          seatAlignments: {},
          seatNames: {},
          rosterConfirmed: false,
          seatingConfirmed: false,
        },
        phaseCheckpoints: [],
        madnessJudgments: { "mutant:player-1:setup-1": "pending" },
      },
    },
    game: {
      scriptId: SECTS_AND_VIOLETS,
      id: "sv-session",
      name: "Sects & Violets",
      createdAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z",
      events: [],
    },
  };

  throws(
    () => importGameFileJson(JSON.stringify(malformed), SECTS_AND_VIOLETS),
    /Sects & Violets 저장 상태가 올바르지 않습니다\./,
  );
});

test("S&V session validation rejects checkpoint counts beyond canonical history", () => {
  const malformed = {
    schemaVersion: 3,
    ui: {
      sectsAndVioletsSession: {
        version: 1,
        activeTab: "play",
        savedAt: "2026-07-22T00:00:00.000Z",
        setup: {
          playerCount: 7,
          demon: "fangGu",
          selectedIds: ["fangGu"],
          seatAssignments: {},
          seatAlignments: {},
          seatNames: {},
          rosterConfirmed: true,
          seatingConfirmed: true,
        },
        phaseCheckpoints: [{ id: "missing", kind: "phase", eventCount: 2, summary: "missing", activeTab: "play" }],
      },
    },
    game: {
      scriptId: SECTS_AND_VIOLETS,
      id: "sv-session",
      name: "Sects & Violets",
      createdAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z",
      events: [],
    },
  };

  try {
    importGameFileJson(JSON.stringify(malformed), SECTS_AND_VIOLETS);
    throw new Error("expected invalid session");
  } catch (error) {
    equal(error instanceof Error ? error.message : "", "Sects & Violets 저장 상태가 올바르지 않습니다.");
  }
});

test("import normalizes a script-less schema-v2 file to canonical Trouble Brewing v3", () => {
  const legacy = structuredClone(gameFile) as unknown as Record<string, unknown>;
  legacy.schemaVersion = 2;
  delete (legacy.game as Record<string, unknown>).scriptId;

  deepEqual(importGameFileJson(JSON.stringify(legacy), TROUBLE_BREWING), gameFile);
});

test("import rejects a valid game belonging to a different script", () => {
  const sectsAndViolets = {
    ...gameFile,
    game: { ...gameFile.game, scriptId: "sectsAndViolets" },
  };
  try {
    importGameFileJson(JSON.stringify(sectsAndViolets), TROUBLE_BREWING);
    throw new Error("expected script mismatch to fail");
  } catch (error) {
    equal(error instanceof Error ? error.message : "", "현재 페이지와 다른 스크립트의 게임 파일입니다.");
  }
});

test("confirmed seat-layout UI metadata survives JSON export and import", () => {
  const layout = {
    preset: "longTable",
    positions: {
      1: { x: 41, y: 31 },
      2: { x: 72, y: 24 },
      3: { x: 76, y: 68 },
      4: { x: 34, y: 77 },
      5: { x: 17, y: 48 },
    },
  };
  const gameWithLayout = {
    ...gameFile,
    game: {
      ...gameFile.game,
      events: [
        {
          id: "setup-event",
          type: "setupConfirmed",
          phase: "setup",
          payload: {
            players: Object.keys(layout.positions).map((seat) => ({
              id: `player-${seat}`,
              seat: Number(seat),
              name: `Player ${seat}`,
              actualCharacter: "washerwoman",
            })),
          },
          summary: "초기 설정 확정",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
    ui: { seatLayout: layout },
  } as GameFile;

  const imported = importGameFileJson(exportGameFileJson(gameWithLayout), TROUBLE_BREWING);

  deepEqual((imported as unknown as { ui?: unknown }).ui, { seatLayout: layout });
});

test("import rejects malformed seat-layout UI metadata without weakening legacy files", () => {
  deepEqual(importGameFileJson(JSON.stringify(gameFile), TROUBLE_BREWING), gameFile);
  const invalidLayouts = [
    { preset: "spiral", positions: { 1: { x: 41, y: 31 } } },
    { preset: "circle", positions: { 1: { x: 200, y: 31 } } },
  ];

  for (const seatLayout of invalidLayouts) {
    try {
      importGameFileJson(JSON.stringify({ ...gameFile, ui: { seatLayout } }), TROUBLE_BREWING);
      throw new Error("expected seat-layout validation to fail");
    } catch (error) {
      equal(error instanceof Error ? error.message : "", "좌석 배치 정보가 올바르지 않습니다.");
    }
  }
});

test("audit information survives save, export, and import without a replay-state copy", async () => {
  const auditedGame: GameFile = structuredClone(gameFile);
  auditedGame.game.events.push({
    id: "event-chef",
    type: "phaseStepConfirmed",
    phase: "firstNight",
    payload: {
      stepId: "firstNight:chef",
      input: null,
      information: {
        actor: { playerId: "player-2", characterId: "chef" },
        targetPlayerIds: [],
        computedResult: { kind: "number", value: 0 },
        deliveredResult: { kind: "number", value: 1 },
        deliveryContext: {
          type: "discretionary",
          reasons: [
            {
              type: "poisoned",
              poisonerPlayerId: "player-4",
              poisonEventId: "event-poisoner",
            },
            {
              type: "registrationJudgment",
              judgments: [{ playerId: "player-5", registeredAs: "evil" }],
            },
          ],
        },
      },
    },
    summary: "요리사가 1쌍을 확인했습니다. (실제 0쌍 · 중독)",
    createdAt: "2026-07-15T00:00:00.000Z",
  });
  const driver = new MemoryGameStorageDriver();

  await saveLatestGame(auditedGame, driver);
  deepEqual(await loadLatestGame(driver), auditedGame);

  const imported = importGameFileJson(
    exportGameFileJson(auditedGame, new Date("2026-07-15T00:01:00.000Z")),
    TROUBLE_BREWING,
  );
  deepEqual(imported, auditedGame);
  equal("informationAudit" in (imported as unknown as Record<string, unknown>), false);
});

class MemoryGameStorageDriver implements GameStorageDriver {
  value: GameFile | undefined;
  writeCount = 0;

  async loadLatestGame(): Promise<GameFile | undefined> {
    return this.value;
  }

  async saveLatestGame(gameFile: GameFile): Promise<void> {
    this.writeCount += 1;
    this.value = structuredClone(gameFile);
  }
}

async function putRawGame(idb: IDBFactory, key: string, value: unknown): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = idb.open("clocktower", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("game");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("game", "readwrite");
    transaction.objectStore("game").put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
