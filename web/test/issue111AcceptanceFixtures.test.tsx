import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sectsAndVioletsCharacters } from "../src/sectsAndVioletsCharacters";
import { importGameFileJson } from "../src/gameStorage";
import { replayOrThrow } from "./realWasmCoreHarness";

type AcceptanceCategory =
  | "setup"
  | "first-night"
  | "day"
  | "night"
  | "information"
  | "madness"
  | "character-change"
  | "impairment"
  | "death"
  | "win"
  | "persistence";

type AcceptanceCase = {
  id: string;
  file: string;
  categories: AcceptanceCategory[];
  characterIds: string[];
  officialSources: string[];
  reproductionStepsKo: string[];
  expectedResultsKo: string[];
  checkpoint: {
    phase: "setup" | "firstNight" | "day" | "night" | "ended";
    currentStepId?: string | null;
    warningCodes?: string[];
    deadPlayerIds?: string[];
    players?: Array<{
      playerId: string;
      characterId?: string;
      alignment?: "good" | "evil";
      alive?: boolean;
    }>;
    impairments?: Array<{
      playerId: string;
      kind: "drunk" | "poisoned";
      sourceCharacterId: string;
    }>;
    pendingDeathConsequenceKinds?: string[];
    pendingGameEndCause?: string | null;
  };
};

type AcceptanceManifest = {
  schemaVersion: 2;
  script: "sectsAndViolets";
  issue: 111;
  generatedAt: string;
  officialSources: string[];
  requiredCategories: AcceptanceCategory[];
  cases: AcceptanceCase[];
};

const fixtureRoot = resolve(process.cwd(), "../fixtures/acceptance/sects-and-violets");
const checklist = readFileSync(
  resolve(process.cwd(), "../docs/acceptance/sects-and-violets.md"),
  "utf8",
);
const manifest = JSON.parse(
  readFileSync(resolve(fixtureRoot, "manifest.json"), "utf8"),
) as AcceptanceManifest;

describe("Sects & Violets issue 111 manual acceptance package", () => {
  it("indexes unique, documented cases covering every required category and character", () => {
    expect(manifest).toMatchObject({ schemaVersion: 2, script: "sectsAndViolets", issue: 111 });
    expect(new Set(manifest.cases.map(({ id }) => id)).size).toBe(manifest.cases.length);
    expect(new Set(manifest.cases.map(({ file }) => file)).size).toBe(manifest.cases.length);

    const coveredCategories = new Set(manifest.cases.flatMap(({ categories }) => categories));
    expect(manifest.requiredCategories.every((category) => coveredCategories.has(category))).toBe(true);
    expect([...coveredCategories].sort()).toEqual([...manifest.requiredCategories].sort());

    const coveredCharacters = new Set(manifest.cases.flatMap(({ characterIds }) => characterIds));
    expect(
      sectsAndVioletsCharacters
        .map(({ id }) => id)
        .filter((characterId) => !coveredCharacters.has(characterId)),
    ).toEqual([]);

    for (const acceptanceCase of manifest.cases) {
      expect(acceptanceCase.id).toMatch(/^[a-z0-9-]+$/);
      expect(acceptanceCase.file).toBe(`${acceptanceCase.id}.json`);
      expect(acceptanceCase.categories.length).toBeGreaterThan(0);
      expect(acceptanceCase.characterIds.length).toBeGreaterThan(0);
      expect(acceptanceCase.officialSources.length).toBeGreaterThan(0);
      expect(acceptanceCase.reproductionStepsKo.length).toBeGreaterThan(0);
      expect(acceptanceCase.expectedResultsKo.length).toBeGreaterThan(0);
      for (const source of acceptanceCase.officialSources) {
        expect(manifest.officialSources).toContain(source);
      }
    }
  });

  it("links every import fixture from the manual checklist", () => {
    for (const acceptanceCase of manifest.cases) {
      expect(checklist).toContain(
        `../../fixtures/acceptance/sects-and-violets/${acceptanceCase.file}`,
      );
    }
  });

  for (const acceptanceCase of manifest.cases) {
    it(`${acceptanceCase.id} imports and replays at its documented checkpoint`, async () => {
      const json = readFileSync(resolve(fixtureRoot, acceptanceCase.file), "utf8");
      const gameFile = importGameFileJson(json, "sectsAndViolets");
      const replay = await replayOrThrow(gameFile);
      const setup = gameFile.game.events.find(({ type }) => type === "setupConfirmed");
      expect(setup?.type).toBe("setupConfirmed");
      if (setup?.type === "setupConfirmed") {
        expect(setup.payload.players.map(({ actualCharacter }) => actualCharacter).sort())
          .toEqual([...acceptanceCase.characterIds].sort());
      }

      expect(replay.phase).toBe(acceptanceCase.checkpoint.phase);
      if (acceptanceCase.checkpoint.currentStepId !== undefined) {
        expect(replay.currentStep?.id ?? null).toBe(acceptanceCase.checkpoint.currentStepId);
      }
      for (const warningCode of acceptanceCase.checkpoint.warningCodes ?? []) {
        expect(replay.warnings.map(({ code }) => code)).toContain(warningCode);
      }
      if (acceptanceCase.checkpoint.deadPlayerIds !== undefined) {
        expect(replay.players.filter(({ alive }) => !alive).map(({ id }) => id).sort())
          .toEqual([...acceptanceCase.checkpoint.deadPlayerIds].sort());
      }
      for (const expectedPlayer of acceptanceCase.checkpoint.players ?? []) {
        const player = replay.players.find(({ id }) => id === expectedPlayer.playerId);
        expect(player, expectedPlayer.playerId).toBeDefined();
        if (expectedPlayer.characterId !== undefined) {
          expect(player?.actualCharacter).toBe(expectedPlayer.characterId);
        }
        if (expectedPlayer.alignment !== undefined) {
          expect(player?.alignment).toBe(expectedPlayer.alignment);
        }
        if (expectedPlayer.alive !== undefined) {
          expect(player?.alive).toBe(expectedPlayer.alive);
        }
      }
      for (const expectedImpairment of acceptanceCase.checkpoint.impairments ?? []) {
        expect(replay.ruleState.activeImpairments).toEqual(expect.arrayContaining([
          expect.objectContaining(expectedImpairment),
        ]));
      }
      if (acceptanceCase.checkpoint.pendingDeathConsequenceKinds !== undefined) {
        expect((replay.pendingDeathConsequences ?? []).map(({ kind }) => kind))
          .toEqual(acceptanceCase.checkpoint.pendingDeathConsequenceKinds);
      }
      if (acceptanceCase.checkpoint.pendingGameEndCause !== undefined) {
        expect(replay.pendingGameEnd?.cause ?? null)
          .toBe(acceptanceCase.checkpoint.pendingGameEndCause);
      }
    });
  }
});
