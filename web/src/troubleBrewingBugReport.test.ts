import assert from "node:assert/strict";
import test from "node:test";
import type { GameFile } from "./core/types.js";
import { buildTroubleBrewingBugReport } from "./troubleBrewingBugReport.js";

const gameFile: GameFile = {
  schemaVersion: 3,
  ui: {
    seatLayout: {
      preset: "circle",
      positions: {
        1: { x: 50, y: 20 },
        2: { x: 50, y: 40 },
      },
    },
  },
  game: {
    scriptId: "troubleBrewing",
    id: "tb-game-151",
    name: "Private Trouble Brewing game",
    createdAt: "2026-08-10T10:00:00.000Z",
    updatedAt: "2026-08-10T10:30:00.000Z",
    events: [
      {
        id: "setup-151",
        type: "setupConfirmed",
        phase: "setup",
        summary: "Alice와 Bob 설정",
        createdAt: "2026-08-10T10:00:00.000Z",
        payload: {
          players: [
            { id: "player-1", seat: 1, name: "Alice", actualCharacter: "washerwoman" },
            { id: "player-2", seat: 2, name: "Bob", actualCharacter: "imp" },
          ],
        },
      },
      {
        id: "annotation-151",
        type: "playerAnnotationsUpdated",
        phase: "firstNight",
        summary: "Alice 메모",
        createdAt: "2026-08-10T10:30:00.000Z",
        payload: {
          playerId: "player-1",
          systemTokenIds: [],
          scriptTokens: [],
          notes: "Alice private storyteller note",
        },
      },
    ],
  },
};

const reproductionContext = {
  activeTab: "roles",
  replayPhase: "firstNight",
  currentStepId: "firstNight:washerwoman",
  currentStepType: "character",
} as const;

const environment = {
  appVersion: "0.0.0-test",
  buildCommit: "tb-151-test",
  pageUrl: "https://example.test/clocktower/trouble-brewing/",
  userAgent: "Test Browser",
  viewport: { width: 390, height: 844 },
};

test("builds the Trouble Brewing report using the shared privacy contract", () => {
  const report = buildTroubleBrewingBugReport({
    gameFile,
    symptom: "Alice의 정보가 Bob에게 잘못 표시되었습니다.",
    environment,
    reproductionContext,
  });

  assert.equal(report.subject, "[Clocktower Trouble Brewing] 버그 제보");
  assert.match(report.body, /^# Clocktower Trouble Brewing 버그 제보/);
  assert.match(report.body, /reportSchemaVersion: 2/);
  assert.equal(report.metadata.reportSchemaVersion, 2);
  assert.equal(report.metadata.scriptId, "troubleBrewing");
  assert.equal(report.fixture.schemaVersion, 3);
  assert.equal(report.fixture.game.scriptId, "troubleBrewing");
  assert.equal(report.fixture.game.name, "Redacted bug report");
  assert.equal("ui" in report.fixture, false);
  assert.deepEqual(report.reproductionContext, {
    ...reproductionContext,
    eventCount: gameFile.game.events.length,
  });
  assert.deepEqual(Object.keys(report.reproductionContext), [
    "activeTab",
    "replayPhase",
    "currentStepId",
    "currentStepType",
    "eventCount",
  ]);

  const setup = report.fixture.game.events.find((event) => event.type === "setupConfirmed");
  assert.ok(setup);
  assert.deepEqual(setup.payload.players.map((player) => player.name), [
    "1번 플레이어",
    "2번 플레이어",
  ]);
  const annotations = report.fixture.game.events.find((event) => event.type === "playerAnnotationsUpdated");
  assert.ok(annotations);
  assert.equal(annotations.payload.notes, "");
  assert.equal(annotations.id, "annotation-151");
  assert.equal(annotations.payload.playerId, "player-1");
  assert.match(report.body, /1번 플레이어/);
  assert.match(report.body, /2번 플레이어/);
  assert.match(report.body, /1번 플레이어의 정보가 2번 플레이어에게/);
  assert.equal(/Alice|Bob|private storyteller note|Private Trouble Brewing game/.test(report.body), false);

  const attachment = JSON.parse(report.attachmentJson);
  assert.equal(attachment.reportType, "clocktower.trouble-brewing.bug-report");
  assert.equal(attachment.reportSchemaVersion, 2);
  assert.equal(attachment.fixture.game.events[1].payload.notes, "");
  assert.equal(/Alice|Bob|private storyteller note|Private Trouble Brewing game/.test(report.attachmentJson), false);
});

test("includes the original GameFile only after explicit opt-in", () => {
  const report = buildTroubleBrewingBugReport({
    gameFile,
    symptom: "원본 파일 확인",
    includeOriginalGameFile: true,
    environment,
    reproductionContext,
  });

  assert.match(report.body, /원본 GameFile JSON/);
  assert.match(report.body, /Private Trouble Brewing game/);
  const attachment = JSON.parse(report.attachmentJson);
  assert.deepEqual(attachment.originalGameFile, gameFile);
});
