import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { importGameFileJson } from "../src/gameStorage";
import { replayOrThrow } from "./realWasmCoreHarness";

type AcceptanceCase = {
  id: string;
  characterId: "clockmaker" | "flowergirl" | "townCrier" | "oracle";
  file: string;
  officialSource: string;
  officialExample: string;
  phaseBoundary: string;
  summaryFragment: string;
  deliveredValue: number | boolean;
  reminderLabel?: string;
  undoCurrentStepId?: string;
};

type AcceptanceManifest = {
  schemaVersion: 1;
  script: "sectsAndViolets";
  issue: 96;
  officialSources: string[];
  cases: AcceptanceCase[];
};

const fixtureRoot = resolve(process.cwd(), "../fixtures/acceptance/sects-and-violets");
const manifest = JSON.parse(
  readFileSync(resolve(fixtureRoot, "manifest.json"), "utf8"),
) as AcceptanceManifest;

describe("Sects & Violets issue 96 acceptance fixtures", () => {
  it("indexes one canonical fixture for each automated information character", () => {
    expect(manifest).toMatchObject({ schemaVersion: 1, script: "sectsAndViolets", issue: 96 });
    expect(manifest.cases.map(({ characterId }) => characterId).sort()).toEqual([
      "clockmaker",
      "flowergirl",
      "oracle",
      "townCrier",
    ]);
    expect(new Set(manifest.cases.map(({ id }) => id)).size).toBe(4);
    for (const acceptanceCase of manifest.cases) {
      expect(acceptanceCase.file).toBe(`${acceptanceCase.id}.json`);
      expect(manifest.officialSources).toContain(acceptanceCase.officialSource);
      expect(acceptanceCase.officialExample).toMatch(/-example-\d+$/);
    }
  });

  for (const acceptanceCase of manifest.cases) {
    it(`${acceptanceCase.id} replays its persisted delivered information`, async () => {
      const json = readFileSync(resolve(fixtureRoot, acceptanceCase.file), "utf8");
      const gameFile = importGameFileJson(json, "sectsAndViolets");
      const replay = await replayOrThrow(gameFile);
      const confirmed = gameFile.game.events.at(-1);

      expect(confirmed).toMatchObject({
        type: "phaseStepConfirmed",
        payload: {
          stepId: acceptanceCase.phaseBoundary,
          information: {
            actor: { characterId: acceptanceCase.characterId },
            deliveredResult: { value: acceptanceCase.deliveredValue },
          },
        },
      });
      expect(confirmed?.summary).toContain(acceptanceCase.summaryFragment);
      if (acceptanceCase.reminderLabel) {
        expect((replay.ruleState.automaticReminders ?? []).map(({ label }) => label))
          .toContain(acceptanceCase.reminderLabel);
      }
      if (acceptanceCase.undoCurrentStepId) {
        const undone = structuredClone(gameFile);
        undone.game.events.pop();
        expect((await replayOrThrow(undone)).currentStep?.id)
          .toBe(acceptanceCase.undoCurrentStepId);
      }
    });
  }
});
