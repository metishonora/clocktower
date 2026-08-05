import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { AcquiredAbilityPresentation } from "../src/features/phase-control/acquiredAbilityPresentation";
import { importGameFileJson } from "../src/gameStorage";
import { replayOrThrow } from "./realWasmCoreHarness";

test("a real schema-v3 save carries canonical identity and exact acting ability into production UI", async () => {
  const fixture = readFileSync(resolve(
    process.cwd(),
    "../fixtures/acceptance/sects-and-violets/issue-138-philosopher-clockmaker.json",
  ), "utf8");
  const state = await replayOrThrow(importGameFileJson(fixture, "sectsAndViolets"));
  const actor = state.players.find((player) => player.id === "player-1");
  const step = state.currentStep;

  expect(actor?.actualCharacter).toBe("philosopher");
  expect(step).toMatchObject({
    character: "clockmaker",
    abilityUse: {
      ownerPlayerId: "player-1",
      characterId: "clockmaker",
      abilityInstanceId: "phase-2:player-1",
    },
    abilityOrigin: {
      kind: "acquired",
      acquisitionEventId: "phase-2",
      source: {
        ownerPlayerId: "player-1",
        characterId: "philosopher",
        abilityInstanceId: "setup:player-1",
      },
    },
  });

  const html = renderToStaticMarkup(
    <AcquiredAbilityPresentation
      actor={actor!}
      abilityCharacterId={step!.abilityUse!.characterId}
      abilityOrigin={step!.abilityOrigin!}
    />,
  );
  expect(html).toContain("철학자");
  expect(html).toContain("시계공");
  expect(html).toContain("획득한 능력");
});
