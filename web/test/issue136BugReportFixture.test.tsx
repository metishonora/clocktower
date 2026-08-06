import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import type { GameFile } from "../src/core/types";
import { importGameFileJson } from "../src/gameStorage";
import { buildSectsAndVioletsBugReport } from "../src/sectsAndVioletsBugReport";
import { replayOrThrow } from "./realWasmCoreHarness";

const privatePlayerNames = [
  "clockmaker",
  "sweetheart",
  "pitHag",
  "noDashii",
  "day",
  "phaseStepConfirmed",
  "Private seventh player",
];
const privateNotes = "private storyteller note: clockmaker trusts noDashii";

test("builds an importable, replayable, privacy-safe schema-v3 S&V fixture", async () => {
  const source = collisionGameFile();
  const report = buildSectsAndVioletsBugReport({
    gameFile: source,
    symptom: "clockmaker 이후 phaseStepConfirmed 처리에서 Private seventh player 문제가 생겼습니다.",
    environment: {
      appVersion: "fixture-test",
      buildCommit: "abc1234",
      pageUrl: "https://example.test/clocktower/sects-and-violets/",
      userAgent: "Test Browser",
      viewport: { width: 390, height: 844 },
    },
    reproductionContext: {
      activeTab: "play",
      replayPhase: "firstNight",
      currentStepId: "firstNight:dreamer",
      currentStepType: "character",
    },
  });

  const fixtureFromBody = reportJsonSection(report.body, "재현 Fixture") as GameFile;
  expect(report.metadata.reportSchemaVersion).toBe(2);
  expect(fixtureFromBody).toEqual(report.fixture);
  expect(fixtureFromBody).toEqual(JSON.parse(JSON.stringify(report.fixture)));
  expect(report.body).not.toContain("[게임 구성]");
  expect(report.body).not.toContain("[확정 이벤트]");

  expect(fixtureFromBody.schemaVersion).toBe(3);
  expect(fixtureFromBody.game).toMatchObject({
    scriptId: "sectsAndViolets",
    id: source.game.id,
    name: "Redacted bug report",
    createdAt: source.game.createdAt,
    updatedAt: source.game.updatedAt,
  });
  expect(fixtureFromBody.ui).toBeUndefined();
  expect(fixtureFromBody.game.events).toHaveLength(source.game.events.length);
  expect(fixtureFromBody.game.events.map(withoutPrivateText)).toEqual(
    source.game.events.map(withoutPrivateText),
  );
  expect(fixtureFromBody.game.events.map((event) => event.createdAt)).toEqual(
    source.game.events.map((event) => event.createdAt),
  );

  const setup = fixtureFromBody.game.events.find((event) => event.type === "setupConfirmed");
  expect(setup?.payload.players.map((player) => player.name)).toEqual([
    "1번 플레이어",
    "2번 플레이어",
    "3번 플레이어",
    "4번 플레이어",
    "5번 플레이어",
    "6번 플레이어",
    "7번 플레이어",
  ]);
  const annotations = fixtureFromBody.game.events.find(
    (event) => event.type === "playerAnnotationsUpdated",
  );
  expect(annotations?.payload.notes).toBe("");
  expect(JSON.stringify(fixtureFromBody)).not.toContain("notesOmitted");
  expect(JSON.stringify(fixtureFromBody)).not.toContain(privateNotes);
  expect(report.body).not.toContain("Private seventh player");
  expect(report.attachmentJson).not.toContain("Private seventh player");
  expect(report.body).toContain("Storyteller 메모 제거됨");

  for (const event of fixtureFromBody.game.events) {
    for (const name of privatePlayerNames) expect(event.summary).not.toContain(name);
  }
  expect(report.body).toContain('"type": "phaseStepConfirmed"');
  expect(report.body).toContain('"phase": "day"');
  expect(report.body).toContain('"id": "phaseStepConfirmed"');
  expect(report.body).toContain('"characterId": "clockmaker"');

  expect(report.reproductionContext).toEqual({
    activeTab: "play",
    replayPhase: "firstNight",
    currentStepId: "firstNight:dreamer",
    currentStepType: "character",
    eventCount: source.game.events.length,
  });
  expect(reportJsonSection(report.body, "재현 컨텍스트")).toEqual(report.reproductionContext);

  const imported = importGameFileJson(JSON.stringify(fixtureFromBody), "sectsAndViolets");
  expect(imported).toEqual(fixtureFromBody);
  await expect(replayOrThrow(imported)).resolves.toMatchObject({
    eventCount: source.game.events.length,
    phase: "firstNight",
  });

  const reportWithoutDescription = buildSectsAndVioletsBugReport({
    gameFile: source,
    symptom: "",
    environment: {
      appVersion: "fixture-test",
      buildCommit: "abc1234",
      pageUrl: "https://example.test/clocktower/sects-and-violets/",
      userAgent: "Test Browser",
      viewport: { width: 390, height: 844 },
    },
    reproductionContext: {
      activeTab: "play",
      replayPhase: "firstNight",
      currentStepId: "firstNight:dreamer",
      currentStepType: "character",
    },
  });
  expect(reportWithoutDescription.body).toContain("(작성하지 않음)");
  expect(reportWithoutDescription.fixture).toEqual(report.fixture);
  await expect(replayOrThrow(importGameFileJson(
    JSON.stringify(reportWithoutDescription.fixture),
    "sectsAndViolets",
  ))).resolves.toMatchObject({ eventCount: source.game.events.length });
});

function collisionGameFile(): GameFile {
  const source = importGameFileJson(readFileSync(resolve(
    process.cwd(),
    "../fixtures/acceptance/sects-and-violets/clockmaker-fixed-distance.json",
  ), "utf8"), "sectsAndViolets");
  const setup = source.game.events.find((event) => event.type === "setupConfirmed");
  if (!setup) throw new Error("setup fixture is required");
  setup.payload.players.forEach((player, index) => {
    player.name = privatePlayerNames[index];
  });
  source.game.name = "Private fixture game";
  source.game.updatedAt = "2026-08-06T12:00:00.000Z";
  source.game.events[3].summary = privatePlayerNames.join(" / ");
  source.game.events.push({
    id: "phaseStepConfirmed",
    type: "playerAnnotationsUpdated",
    phase: "day",
    summary: privatePlayerNames.join(" / "),
    createdAt: "2026-08-06T12:00:00.000Z",
    payload: {
      playerId: "player-1",
      systemTokenIds: [],
      scriptTokens: [],
      notes: privateNotes,
    },
  });
  source.ui = {
    sectsAndVioletsSession: {
      version: 1,
      activeTab: "play",
      savedAt: "2026-08-06T12:00:00.000Z",
      setup: {
        playerCount: 7,
        demon: "fangGu",
        selectedIds: setup.payload.players.map((player) => player.actualCharacter),
        seatAssignments: Object.fromEntries(
          setup.payload.players.map((player) => [player.seat, player.actualCharacter]),
        ),
        seatAlignments: {},
        seatNames: Object.fromEntries(
          setup.payload.players.map((player) => [player.seat, player.name]),
        ),
        rosterConfirmed: true,
        seatingConfirmed: true,
      },
      phaseCheckpoints: [],
    },
  };
  return source;
}

function withoutPrivateText(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutPrivateText);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "name" && key !== "summary" && key !== "notes")
    .map(([key, nested]) => [key, withoutPrivateText(nested)]));
}

function reportJsonSection(body: string, section: "재현 Fixture" | "재현 컨텍스트") {
  const marker = `[${section}]\n\`\`\`json\n`;
  const start = body.indexOf(marker);
  expect(start, `${section} JSON section should exist`).not.toBe(-1);
  const contentStart = start + marker.length;
  const end = body.indexOf("\n```", contentStart);
  expect(end, `${section} JSON section should end`).not.toBe(-1);
  return JSON.parse(body.slice(contentStart, end));
}
