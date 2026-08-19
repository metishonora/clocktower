import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { importGameFileJson } from "../src/gameStorage";
import { buildTroubleBrewingBugReport } from "../src/troubleBrewingBugReport";
import { replayOrThrow } from "./realWasmCoreHarness";

const fixturePath = resolve(
  process.cwd(),
  "../fixtures/acceptance/trouble-brewing/spy-grimoire-reveal.json",
);

test("builds an importable, replayable, privacy-safe TB fixture from Spy's canonical stream", async () => {
  const source = importGameFileJson(readFileSync(fixturePath, "utf8"), "troubleBrewing");
  const sourceSetup = source.game.events.find((event) => event.type === "setupConfirmed");
  const sourceAnnotations = source.game.events.find((event) => event.type === "playerAnnotationsUpdated");
  if (!sourceSetup || !sourceAnnotations) throw new Error("Spy fixture setup and annotations are required");
  const originalEventShape = source.game.events.map((event) => ({
    id: event.id,
    type: event.type,
    phase: event.phase,
    createdAt: event.createdAt,
  }));
  const privatePlayerNames = sourceSetup.payload.players.map(
    (player, index) => `Private Player ${index + 1}`,
  );
  const privateNames = new Set(privatePlayerNames);
  source.game.name = "Private TB fixture game";
  source.ui = {
    seatLayout: {
      preset: "circle",
      positions: Object.fromEntries(sourceSetup.payload.players.map((player) => [
        player.seat,
        { x: 50, y: 20 + player.seat * 5 },
      ])),
    },
  };
  sourceSetup.payload.players.forEach((player, index) => {
    player.name = privatePlayerNames[index];
  });
  sourceSetup.summary = `${privatePlayerNames[0]} and ${privatePlayerNames[1]} setup`;
  sourceAnnotations.summary = `${privatePlayerNames[6]} private annotations`;
  sourceAnnotations.payload.notes = "Private Storyteller Notes for Player 7";

  const report = buildTroubleBrewingBugReport({
    gameFile: source,
    symptom: `${privatePlayerNames[0]}의 정보가 ${privatePlayerNames[8]}에게 잘못 표시되었습니다.`,
    environment: {
      appVersion: "fixture-test",
      buildCommit: "tb-151-fixture",
      pageUrl: "https://example.test/clocktower/trouble-brewing/",
      userAgent: "Test Browser",
      viewport: { width: 390, height: 844 },
    },
    reproductionContext: {
      activeTab: "play",
      replayPhase: "night",
      currentStepId: "night2:spy",
      currentStepType: "character",
    },
  });

  expect(report.metadata.reportSchemaVersion).toBe(2);
  expect(report.subject).toBe("[Clocktower Trouble Brewing] 버그 제보");
  expect(report.fixture.schemaVersion).toBe(3);
  expect(report.fixture.game.scriptId).toBe("troubleBrewing");
  expect(report.fixture.game.id).toBe(source.game.id);
  expect(report.fixture.game.name).toBe("Redacted bug report");
  expect(report.fixture.ui).toBeUndefined();
  expect(report.fixture.game.events).toHaveLength(source.game.events.length);
  expect(report.fixture.game.events.map((event) => ({
    id: event.id,
    type: event.type,
    phase: event.phase,
    createdAt: event.createdAt,
  }))).toEqual(originalEventShape);
  expect(report.fixture.game.events.map(withoutPrivateText)).toEqual(
    source.game.events.map(withoutPrivateText),
  );

  const setup = report.fixture.game.events.find((event) => event.type === "setupConfirmed");
  if (!setup) throw new Error("redacted setup event is required");
  expect(setup.payload.players.map((player) => player.name)).toEqual(
    sourceSetup.payload.players.map((player) => `${player.seat}번 플레이어`),
  );
  const annotations = report.fixture.game.events.find((event) => event.type === "playerAnnotationsUpdated");
  if (!annotations) throw new Error("redacted annotations event is required");
  expect(annotations.payload.notes).toBe("");
  const minionInfo = report.fixture.game.events.find((event) => event.id === "phase-step-3");
  if (!minionInfo || minionInfo.type !== "phaseStepConfirmed" || !minionInfo.payload.information) {
    throw new Error("redacted minion information event is required");
  }
  expect(minionInfo.payload.stepId).toBe("firstNight:minionInfo");
  expect(minionInfo.payload.information.computedResult?.kind).toBe("teamInfo");
  if (minionInfo.payload.information.computedResult?.kind !== "teamInfo") throw new Error("team info is required");
  expect(minionInfo.payload.information.computedResult.minionPlayerIds)
    .toEqual(["player-8", "player-9"]);
  expect(report.fixture.game.events.map((event) => event.summary).some((summary) =>
    [...privateNames].some((name) => summary.includes(name)),
  )).toBe(false);

  expect(report.body).toContain("1번 플레이어의 정보가 9번 플레이어에게");
  expect(report.body).not.toContain("Private TB fixture game");
  expect(report.body).not.toContain("Private Storyteller Notes");
  expect(report.attachmentJson).not.toContain("RuleState");
  expect(report.attachmentJson).not.toContain("ruleState");
  expect(report.attachmentJson).not.toContain("revealPayload");
  expect(report.attachmentJson).not.toContain("automaticReminders");

  const imported = importGameFileJson(JSON.stringify(report.fixture), "troubleBrewing");
  expect(imported).toEqual(report.fixture);
  const replay = await replayOrThrow(imported);
  expect(replay.eventCount).toBe(source.game.events.length);
  expect(replay.currentStep?.id).toBe("night2:spy");
  expect(replay.ruleState.automaticReminders).toEqual(expect.arrayContaining([
    expect.objectContaining({ characterId: "fortuneTeller", tokenId: "redHerring", playerId: "player-1" }),
    expect.objectContaining({ characterId: "poisoner", tokenId: "poisoned", playerId: "player-1" }),
    expect.objectContaining({ characterId: "monk", tokenId: "safe", playerId: "player-4" }),
  ]));
});

function withoutPrivateText(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutPrivateText);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "name" && key !== "summary" && key !== "notes")
    .map(([key, nested]) => [key, withoutPrivateText(nested)]));
}
