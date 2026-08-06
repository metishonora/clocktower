import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { InformationResult } from "../src/core/types";
import { importGameFileJson } from "../src/gameStorage";
import { replayOrThrow } from "./realWasmCoreHarness";

type AcceptanceCase = {
  id: string;
  characterId: "dreamer" | "seamstress" | "sage";
  file: string;
  phaseBoundary: string;
  deliveredResult: InformationResult;
};

const fixtureRoot = resolve(process.cwd(), "../fixtures/acceptance/sects-and-violets");
const manifest = JSON.parse(readFileSync(resolve(fixtureRoot, "issue-98-manifest.json"), "utf8")) as {
  schemaVersion: 1;
  script: "sectsAndViolets";
  issue: 98;
  cases: AcceptanceCase[];
};

describe("Sects & Violets issue 98 acceptance fixtures", () => {
  it("indexes one owned baseline for each targeted information character", () => {
    expect(manifest).toMatchObject({ schemaVersion: 1, script: "sectsAndViolets", issue: 98 });
    expect(manifest.cases.map(({ characterId }) => characterId).sort()).toEqual(["dreamer", "sage", "seamstress"]);
  });

  for (const acceptanceCase of manifest.cases) {
    it(`${acceptanceCase.id} replays its ordered delivered result`, async () => {
      const game = importGameFileJson(readFileSync(resolve(fixtureRoot, acceptanceCase.file), "utf8"), "sectsAndViolets");
      await expect(replayOrThrow(game)).resolves.toBeTruthy();
      expect(game.game.events.at(-1)).toMatchObject({
        type: "phaseStepConfirmed",
        payload: {
          stepId: acceptanceCase.phaseBoundary,
          information: {
            actor: { characterId: acceptanceCase.characterId },
            deliveredResult: acceptanceCase.deliveredResult,
          },
        },
      });
    });
  }
});
