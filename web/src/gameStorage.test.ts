import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import {
  exportGameFileJson,
  importGameFileJson,
  loadLatestGame,
  saveLatestGame,
  type GameStorageDriver,
} from "./gameStorage.js";
import type { GameFile } from "./core/types.js";

const gameFile: GameFile = {
  schemaVersion: 2,
  game: {
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

test("export writes schemaVersion and exportedAt into GameFile JSON", () => {
  const json = exportGameFileJson(gameFile, new Date("2026-07-10T00:00:00.000Z"));
  const parsed = JSON.parse(json);

  equal(parsed.schemaVersion, 2);
  equal(parsed.exportedAt, "2026-07-10T00:00:00.000Z");
  deepEqual(parsed.game.events, gameFile.game.events);
});

test("import validates basic GameFile shape and schemaVersion", () => {
  deepEqual(importGameFileJson(JSON.stringify(gameFile)), gameFile);
  try {
    importGameFileJson(JSON.stringify({ ...gameFile, schemaVersion: 1 }));
    throw new Error("expected schema validation to fail");
  } catch (error) {
    equal(error instanceof Error ? error.message : "", "지원하지 않는 게임 파일 버전입니다.");
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

  const imported = importGameFileJson(exportGameFileJson(gameWithLayout));

  deepEqual((imported as unknown as { ui?: unknown }).ui, { seatLayout: layout });
});

test("import rejects malformed seat-layout UI metadata without weakening legacy files", () => {
  deepEqual(importGameFileJson(JSON.stringify(gameFile)), gameFile);
  const invalidLayouts = [
    { preset: "spiral", positions: { 1: { x: 41, y: 31 } } },
    { preset: "circle", positions: { 1: { x: 200, y: 31 } } },
  ];

  for (const seatLayout of invalidLayouts) {
    try {
      importGameFileJson(JSON.stringify({ ...gameFile, ui: { seatLayout } }));
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
