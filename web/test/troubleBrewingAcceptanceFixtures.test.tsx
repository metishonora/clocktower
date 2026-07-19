import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { importGameFileJson } from "../src/gameStorage";
import { replayOrThrow } from "./realWasmCoreHarness";

type AcceptanceManifest = {
  schemaVersion: 1;
  script: "troubleBrewing";
  officialSources: string[];
  cases: AcceptanceCase[];
};

type AcceptanceCase = {
  id: string;
  file: string;
  category: string;
  characterIds: string[];
  officialSource: string;
  actionKo: string;
  expectedKo: string;
  checkpoint: {
    phase: "setup" | "firstNight" | "day" | "night";
    currentStepId?: string;
    warningCodes?: string[];
    activePoisonTargetId?: string | null;
    activeProtectionTargetId?: string | null;
    deadPlayerIds?: string[];
    ghostVoteUsedPlayerIds?: string[];
    slayerAbilityPresent?: boolean;
    virginSpent?: boolean;
    absentStepIds?: string[];
  };
  knownDeviation?: {
    officialExpectationKo: string;
    observedAppBehaviorKo: string;
  };
};

const fixtureRoot = resolve(process.cwd(), "../fixtures/acceptance/trouble-brewing");
const checklist = readFileSync(
  resolve(process.cwd(), "../docs/acceptance/trouble-brewing.md"),
  "utf8",
);
const manifest = JSON.parse(
  readFileSync(resolve(fixtureRoot, "manifest.json"), "utf8"),
) as AcceptanceManifest;

const allCharacterIds = [
  "washerwoman",
  "librarian",
  "investigator",
  "chef",
  "empath",
  "fortuneTeller",
  "undertaker",
  "monk",
  "ravenkeeper",
  "virgin",
  "slayer",
  "soldier",
  "mayor",
  "butler",
  "drunk",
  "recluse",
  "saint",
  "poisoner",
  "spy",
  "scarletWoman",
  "baron",
  "imp",
];

describe("Trouble Brewing acceptance fixtures", () => {
  it("indexes unique, documented cases covering all 22 characters", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.script).toBe("troubleBrewing");
    expect(manifest.officialSources.length).toBeGreaterThan(0);
    expect(new Set(manifest.cases.map(({ id }) => id)).size).toBe(manifest.cases.length);
    expect(new Set(manifest.cases.map(({ file }) => file)).size).toBe(manifest.cases.length);

    const covered = new Set(manifest.cases.flatMap(({ characterIds }) => characterIds));
    expect([...allCharacterIds].filter((characterId) => !covered.has(characterId))).toEqual([]);

    for (const acceptanceCase of manifest.cases) {
      expect(acceptanceCase.id).toMatch(/^[a-z0-9-]+$/);
      expect(acceptanceCase.file).toBe(`${acceptanceCase.id}.json`);
      expect(manifest.officialSources).toContain(acceptanceCase.officialSource);
      expect(acceptanceCase.actionKo.trim()).not.toBe("");
      expect(acceptanceCase.expectedKo.trim()).not.toBe("");
    }
  });

  it("links every indexed fixture from the manual checklist", () => {
    for (const acceptanceCase of manifest.cases) {
      expect(checklist).toContain(`../../fixtures/acceptance/trouble-brewing/${acceptanceCase.file}`);
    }
  });

  for (const acceptanceCase of manifest.cases) {
    it(`${acceptanceCase.id} imports and replays at its documented checkpoint`, async () => {
      const json = readFileSync(resolve(fixtureRoot, acceptanceCase.file), "utf8");
      const gameFile = importGameFileJson(json);
      const replay = await replayOrThrow(gameFile);

      expect(replay.phase).toBe(acceptanceCase.checkpoint.phase);
      if (acceptanceCase.checkpoint.currentStepId !== undefined) {
        expect(replay.currentStep?.id).toBe(acceptanceCase.checkpoint.currentStepId);
      }
      for (const warningCode of acceptanceCase.checkpoint.warningCodes ?? []) {
        expect(replay.warnings.map(({ code }) => code)).toContain(warningCode);
      }
      if (acceptanceCase.checkpoint.activePoisonTargetId !== undefined) {
        expect(replay.ruleState.activePoison?.playerId ?? null)
          .toBe(acceptanceCase.checkpoint.activePoisonTargetId);
      }
      if (acceptanceCase.checkpoint.activeProtectionTargetId !== undefined) {
        expect(replay.ruleState.activeProtection?.playerId ?? null)
          .toBe(acceptanceCase.checkpoint.activeProtectionTargetId);
      }
      if (acceptanceCase.checkpoint.deadPlayerIds !== undefined) {
        expect(replay.players.filter(({ alive }) => !alive).map(({ id }) => id).sort())
          .toEqual([...acceptanceCase.checkpoint.deadPlayerIds].sort());
      }
      if (acceptanceCase.checkpoint.ghostVoteUsedPlayerIds !== undefined) {
        expect(replay.players.filter(({ ghostVoteUsed }) => ghostVoteUsed).map(({ id }) => id).sort())
          .toEqual([...acceptanceCase.checkpoint.ghostVoteUsedPlayerIds].sort());
      }
      if (acceptanceCase.checkpoint.slayerAbilityPresent !== undefined) {
        expect(replay.ruleState.slayerAbility !== undefined)
          .toBe(acceptanceCase.checkpoint.slayerAbilityPresent);
      }
      if (acceptanceCase.checkpoint.virginSpent !== undefined) {
        expect(replay.ruleState.virginAbility?.spent)
          .toBe(acceptanceCase.checkpoint.virginSpent);
      }
      for (const absentStepId of acceptanceCase.checkpoint.absentStepIds ?? []) {
        expect(replay.phaseOverview.map(({ id }) => id)).not.toContain(absentStepId);
      }
    });
  }
});
