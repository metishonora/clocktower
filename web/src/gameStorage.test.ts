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
