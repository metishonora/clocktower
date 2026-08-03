import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { InformationResult } from "../src/core/types";
import { importGameFileJson } from "../src/gameStorage";
import { replayOrThrow } from "./realWasmCoreHarness";

type AcceptanceCase = {
  id: string;
  characterId: "mathematician";
  file: string;
  officialSource: string;
  officialExample: string;
  phaseBoundary: string;
  truthfulAuditCount: number;
  deliveredResult: InformationResult;
};

const fixtureRoot = resolve(process.cwd(), "../fixtures/acceptance/sects-and-violets");
const manifest = JSON.parse(
  readFileSync(resolve(fixtureRoot, "issue-108-manifest.json"), "utf8"),
) as {
  schemaVersion: 1;
  script: "sectsAndViolets";
  issue: 108;
  officialSources: string[];
  cases: AcceptanceCase[];
};

describe("Sects & Violets issue 108 acceptance fixtures", () => {
  it("indexes the two owned official Mathematician examples", () => {
    expect(manifest).toMatchObject({ schemaVersion: 1, script: "sectsAndViolets", issue: 108 });
    expect(manifest.officialSources).toContain("https://wiki.bloodontheclocktower.com/Mathematician");
    expect(manifest.cases.map(({ officialExample }) => officialExample)).toEqual([
      "mathematician-example-2",
      "mathematician-example-3",
    ]);
    expect(manifest.cases.map(({ truthfulAuditCount }) => truthfulAuditCount)).toEqual([1, 6]);
  });

  for (const acceptanceCase of manifest.cases) {
    it(`${acceptanceCase.id} replays and preserves the truthful audit projection`, async () => {
      const game = importGameFileJson(
        readFileSync(resolve(fixtureRoot, acceptanceCase.file), "utf8"),
        "sectsAndViolets",
      );
      const finalEvent = game.game.events.at(-1);
      expect(finalEvent).toMatchObject({
        type: "phaseStepConfirmed",
        payload: {
          stepId: acceptanceCase.phaseBoundary,
          information: {
            actor: { characterId: acceptanceCase.characterId },
            deliveredResult: acceptanceCase.deliveredResult,
          },
        },
      });

      const beforeMathematician = {
        ...game,
        game: { ...game.game, events: game.game.events.slice(0, -1) },
      };
      const beforeState = await replayOrThrow(beforeMathematician);
      expect(beforeState.currentStep?.id).toBe(acceptanceCase.phaseBoundary);
      const records = beforeState.currentStep?.informationPrompt?.mathematicianAudit?.records ?? [];
      expect(records).toHaveLength(acceptanceCase.truthfulAuditCount);
      const abnormalReminders = (beforeState.ruleState.automaticReminders ?? []).filter(
        ({ characterId, tokenId }) => characterId === "mathematician" && tokenId === "abnormal",
      );
      expect(abnormalReminders.map(({ playerId }) => playerId)).toEqual(
        records.map(({ subjectPlayerId }) => subjectPlayerId),
      );
      expect(abnormalReminders.every(({ label }) => label === "비정상")).toBe(true);

      const afterState = await replayOrThrow(game);
      expect((afterState.ruleState.automaticReminders ?? []).some(
        ({ characterId, tokenId }) => characterId === "mathematician" && tokenId === "abnormal",
      )).toBe(false);
    });
  }
});
