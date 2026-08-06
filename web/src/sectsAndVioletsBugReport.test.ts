import assert from "node:assert/strict";
import test from "node:test";
import type { GameFile } from "./core/types.js";
import { buildSectsAndVioletsBugReport } from "./sectsAndVioletsBugReport.js";

const gameFile: GameFile = {
  schemaVersion: 3,
  game: {
    scriptId: "sectsAndViolets",
    id: "game-136",
    name: "Private game name",
    createdAt: "2026-08-06T10:00:00.000Z",
    updatedAt: "2026-08-06T10:30:00.000Z",
    events: [
      {
        id: "event-setup",
        type: "setupConfirmed",
        phase: "setup",
        summary: "초기 설정 확정: Alice와 Bob",
        createdAt: "2026-08-06T10:00:00.000Z",
        payload: {
          players: [
            { id: "player-1", seat: 1, name: "Alice", actualCharacter: "philosopher" },
            { id: "player-2", seat: 2, name: "Bob", actualCharacter: "fangGu" },
          ],
        },
      },
      {
        id: "event-notes",
        type: "playerAnnotationsUpdated",
        phase: "day",
        summary: "플레이어 표시 수정: 1번 Alice",
        createdAt: "2026-08-06T10:30:00.000Z",
        payload: {
          playerId: "player-1",
          systemTokenIds: [],
          scriptTokens: [],
          notes: "Alice suspects Bob; private storyteller note",
        },
      },
    ],
  },
};

test("builds an AI-reconstructable S&V report without player names or notes", () => {
  const report = buildSectsAndVioletsBugReport({
    gameFile,
    symptom: "두 번째 밤에 잘못된 정보가 표시되었습니다.",
    environment: {
      appVersion: "0.0.0-test",
      buildCommit: "abc1234",
      pageUrl: "https://example.test/clocktower/sects-and-violets/",
      userAgent: "Test Browser",
      viewport: { width: 1024, height: 1366 },
    },
  });

  assert.equal(report.subject, "[Clocktower S&V] 버그 제보");
  assert.match(report.body, /두 번째 밤에 잘못된 정보/);
  assert.match(report.body, /schemaVersion: 3/);
  assert.match(report.body, /buildCommit: abc1234/);
  assert.match(report.body, /1번 플레이어/);
  assert.match(report.body, /2번 플레이어/);
  assert.match(report.body, /"id": "event-notes"/);
  assert.match(report.body, /"playerId": "player-1"/);
  assert.match(report.body, /"notesOmitted": true/);
  assert.equal(/Alice|Bob|private storyteller note|Private game name/.test(report.body), false);
  assert.equal(/createdAt/.test(report.body), false);
  const attachment = JSON.parse(report.attachmentJson);
  assert.equal(attachment.reportType, "clocktower.snv.bug-report");
  assert.equal(attachment.game.events[1].payload.notesOmitted, true);
  assert.equal(/Alice|Bob|private storyteller note|Private game name/.test(report.attachmentJson), false);
});

test("builds the report when the optional problem description is empty", () => {
  const report = buildSectsAndVioletsBugReport({
    gameFile,
    symptom: "",
    environment: {
      appVersion: "0.0.0-test",
      buildCommit: "abc1234",
      pageUrl: "https://example.test/clocktower/sects-and-violets/",
      userAgent: "Test Browser",
      viewport: { width: 390, height: 844 },
    },
  });

  assert.match(report.body, /\(작성하지 않음\)/);
  assert.equal(report.body.includes("기대 결과"), false);
});

test("includes the original GameFile only after explicit opt-in", () => {
  const report = buildSectsAndVioletsBugReport({
    gameFile,
    symptom: "저장 파일을 불러올 수 없습니다.",
    includeOriginalGameFile: true,
    environment: {
      appVersion: "0.0.0-test",
      buildCommit: "abc1234",
      pageUrl: "https://example.test/clocktower/sects-and-violets/",
      userAgent: "Test Browser",
      viewport: { width: 1024, height: 1366 },
    },
  });

  assert.match(report.body, /원본 GameFile JSON/);
  assert.match(report.body, /Private game name/);
  assert.match(report.body, /private storyteller note/);
  const attachment = JSON.parse(report.attachmentJson);
  assert.equal(attachment.originalGameFile.game.name, "Private game name");
});
