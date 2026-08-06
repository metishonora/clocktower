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

test("redacts colliding player names without changing event schema identifiers or references", () => {
  const collisionNames = ["clockmaker", "sweetheart", "pitHag", "noDashii"];
  const collisionGameFile: GameFile = {
    schemaVersion: 3,
    game: {
      scriptId: "sectsAndViolets",
      id: "collision-game",
      name: "Private collision game",
      createdAt: "2026-08-06T11:00:00.000Z",
      updatedAt: "2026-08-06T11:30:00.000Z",
      events: [
        {
          id: "setup-collisions",
          type: "setupConfirmed",
          phase: "setup",
          summary: "clockmaker, sweetheart, pitHag, noDashii 설정",
          createdAt: "2026-08-06T11:00:00.000Z",
          payload: { players: [
            { id: "player-1", seat: 1, name: "clockmaker", actualCharacter: "clockmaker", shownCharacter: "clockmaker" },
            { id: "player-2", seat: 2, name: "sweetheart", actualCharacter: "sweetheart", shownCharacter: "sweetheart" },
            { id: "player-6", seat: 6, name: "pitHag", actualCharacter: "pitHag", shownCharacter: "pitHag" },
            { id: "player-7", seat: 7, name: "noDashii", actualCharacter: "noDashii", shownCharacter: "noDashii" },
          ] },
        },
        {
          id: "clockmaker",
          type: "phaseStepConfirmed",
          phase: "firstNight",
          summary: "clockmaker 단계 확인",
          createdAt: "2026-08-06T11:05:00.000Z",
          payload: {
            stepId: "firstNight:clockmaker",
            input: null,
            information: {
              actor: { playerId: "player-1", characterId: "clockmaker" },
              targetPlayerIds: ["player-2"],
              computedResult: { kind: "number", value: 1 },
              deliveredResult: { kind: "number", value: 1 },
              deliveryContext: {
                type: "discretionary",
                reasons: [{
                  type: "poisoned",
                  poisonerPlayerId: "player-7",
                  poisonEventId: "noDashii",
                }],
              },
            },
          },
        },
        {
          id: "pitHag",
          type: "pitHagTransformationResolved",
          phase: "night",
          summary: "pitHag가 noDashii 변신 시도",
          createdAt: "2026-08-06T11:10:00.000Z",
          payload: {
            stepId: "night:pitHag",
            actorPlayerId: "player-6",
            targetPlayerId: "player-7",
            characterId: "noDashii",
            outcome: { kind: "noChange", reason: "actorImpaired" },
          },
        },
        {
          id: "pitHag-deaths",
          type: "pitHagArbitraryDeathsConfirmed",
          phase: "night",
          summary: "pitHag 임의 사망 확인",
          createdAt: "2026-08-06T11:15:00.000Z",
          payload: {
            stepId: "night:pitHagArbitraryDeaths",
            sourceTransformationEventId: "pitHag",
            deaths: [{
              playerId: "player-2",
              cause: {
                kind: "demonAttack",
                actorPlayerId: "player-7",
                actorCharacterId: "noDashii",
                targetPlayerId: "player-2",
              },
            }],
          },
        },
        {
          id: "sweetheart",
          type: "sweetheartConsequenceResolved",
          phase: "night",
          summary: "sweetheart 후속 효과 확인",
          createdAt: "2026-08-06T11:20:00.000Z",
          payload: {
            stepId: "night:sweetheart",
            trigger: {
              sourceEventId: "pitHag-deaths",
              deathSequence: 0,
              playerId: "player-2",
              sourceAbilityInstanceId: "ability:sweetheart",
            },
            targetPlayerId: "player-1",
            outcome: {
              kind: "drunkApplied",
              impairment: {
                kind: "drunk",
                playerId: "player-1",
                sourceEventId: "sweetheart",
                sourceCharacterId: "sweetheart",
                expires: "never",
              },
            },
          },
        },
        {
          id: "noDashii",
          type: "nightActionResolved",
          phase: "night",
          summary: "noDashii 공격 처리",
          createdAt: "2026-08-06T11:25:00.000Z",
          payload: {
            stepId: "night:noDashii",
            actorPlayerId: "player-7",
            actorCharacterId: "noDashii",
            resolution: {
              kind: "demonAttack",
              targetPlayerId: "player-1",
              outcome: { kind: "noEffect", reason: "actorImpaired" },
            },
          },
        },
        {
          id: "annotations-collisions",
          type: "playerAnnotationsUpdated",
          phase: "day",
          summary: "clockmaker가 sweetheart, pitHag, noDashii 메모 수정",
          createdAt: "2026-08-06T11:30:00.000Z",
          payload: {
            playerId: "player-1",
            systemTokenIds: [],
            scriptTokens: [],
            notes: "clockmaker suspects sweetheart, pitHag, and noDashii",
          },
        },
      ],
    },
  };
  const report = buildSectsAndVioletsBugReport({
    gameFile: collisionGameFile,
    symptom: "clockmaker 이후 sweetheart, pitHag, noDashii 흐름이 이상합니다.",
    environment: {
      appVersion: "collision-test",
      buildCommit: "collision-commit",
      pageUrl: "https://example.test/clocktower/sects-and-violets/",
      userAgent: "Test Browser",
      viewport: { width: 390, height: 844 },
    },
  });
  const setup = reportJsonSection(report.body, "게임 구성");
  const events = reportJsonSection(report.body, "확정 이벤트");

  assert.deepEqual(
    setup.players.map((player: { actualCharacter: string }) => player.actualCharacter),
    collisionNames,
  );
  assert.deepEqual(
    setup.players.map((player: { shownCharacter: string }) => player.shownCharacter),
    collisionNames,
  );
  assert.deepEqual(
    setup.players.map((player: { name: string }) => player.name),
    ["1번 플레이어", "2번 플레이어", "6번 플레이어", "7번 플레이어"],
  );
  assert.equal(events[1].id, "clockmaker");
  assert.equal(events[1].type, "phaseStepConfirmed");
  assert.equal(events[1].phase, "firstNight");
  assert.equal(events[1].payload.stepId, "firstNight:clockmaker");
  assert.equal(events[1].payload.information.actor.characterId, "clockmaker");
  assert.deepEqual(events[1].payload.information.targetPlayerIds, ["player-2"]);
  assert.equal(events[1].payload.information.deliveryContext.type, "discretionary");
  assert.equal(events[1].payload.information.deliveryContext.reasons[0].type, "poisoned");
  assert.equal(events[1].payload.information.deliveryContext.reasons[0].poisonEventId, "noDashii");
  assert.equal(events[2].id, "pitHag");
  assert.equal(events[2].type, "pitHagTransformationResolved");
  assert.equal(events[2].payload.characterId, "noDashii");
  assert.equal(events[2].payload.outcome.kind, "noChange");
  assert.equal(events[3].payload.sourceTransformationEventId, "pitHag");
  assert.equal(events[3].payload.deaths[0].cause.actorCharacterId, "noDashii");
  assert.equal(events[4].type, "sweetheartConsequenceResolved");
  assert.equal(events[4].payload.trigger.sourceEventId, "pitHag-deaths");
  assert.equal(events[4].payload.outcome.impairment.sourceEventId, "sweetheart");
  assert.equal(events[4].payload.outcome.impairment.sourceCharacterId, "sweetheart");
  assert.equal(events[5].id, "noDashii");
  assert.equal(events[5].payload.actorCharacterId, "noDashii");
  assert.equal(events[5].payload.resolution.kind, "demonAttack");
  assert.equal(events[6].payload.notes, undefined);
  assert.equal(events[6].payload.notesOmitted, true);
  for (const event of events) {
    assert.equal(event.createdAt, undefined);
    for (const name of collisionNames) assert.equal(event.summary.includes(name), false);
  }
  assert.deepEqual(
    events[0].payload.players.map((player: { name: string }) => player.name),
    ["1번 플레이어", "2번 플레이어", "6번 플레이어", "7번 플레이어"],
  );
  const attachment = JSON.parse(report.attachmentJson);
  assert.match(attachment.userReport.symptom, /1번 플레이어/);
  assert.equal(attachment.userReport.symptom.includes("clockmaker 이후"), false);
  assert.equal(report.attachmentJson.includes("clockmaker suspects sweetheart"), false);
});

function reportJsonSection(body: string, section: "게임 구성" | "확정 이벤트") {
  const marker = `[${section}]\n\`\`\`json\n`;
  const start = body.indexOf(marker);
  assert.notEqual(start, -1, `${section} JSON section should exist`);
  const contentStart = start + marker.length;
  const end = body.indexOf("\n```", contentStart);
  assert.notEqual(end, -1, `${section} JSON section should end`);
  return JSON.parse(body.slice(contentStart, end));
}
