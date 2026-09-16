
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { CanonicalSessionController } from "../src/core/canonicalSessionController.js";
import type { GameFile, GameFileV4, SetupPlayerInput } from "../src/core/types.js";
import { importGameFileJson, parseGameFileJson } from "../src/gameStorage.js";
import { realWasmCore } from "./realWasmCoreHarness.js";


it("keeps generated WASM Trouble Brewing create, replay, serialization, and undo behavior", async () => {
  const core = realWasmCore();
  const controller = new CanonicalSessionController("troubleBrewing", core);
  const created = await controller.execute(
    officialGame("troubleBrewing", "issue-198-official-tb"),
    undefined,
    { type: "createGame", payload: { players: PLAYERS } },
  );
  expect(created.ok).toBe(true);
  if (!created.ok) return;

  await expectOfficialRoundTrip(
    controller,
    created.value.gameFile,
    "firstNight:minionInfo",
  );
});


it("keeps generated WASM Sects & Violets create, replay, serialization, and undo behavior", async () => {
  const fixture = importGameFileJson(
    readFileSync(
      resolve(
        process.cwd(),
        "../fixtures/acceptance/sects-and-violets/setup-fang-gu-plus-outsider.json",
      ),
      "utf8",
    ),
    "sectsAndViolets",
  );
  const setupEvent = fixture.game.events[0];
  expect(setupEvent?.type).toBe("setupConfirmed");
  if (!setupEvent || setupEvent.type !== "setupConfirmed") return;

  const core = realWasmCore();
  const controller = new CanonicalSessionController("sectsAndViolets", core);
  const created = await controller.execute(
    officialGame("sectsAndViolets", "issue-198-official-snv"),
    undefined,
    { type: "createGame", payload: { players: setupEvent.payload.players } },
  );
  expect(created.ok).toBe(true);
  if (!created.ok) return;

  await expectOfficialRoundTrip(
    controller,
    created.value.gameFile,
    "firstNight:minionInfo",
  );
});


const PLAYERS: SetupPlayerInput[] = [
  { id: "p1", seat: 1, name: "Undertaker", actualCharacter: "undertaker", shownCharacter: "undertaker" },
  { id: "p2", seat: 2, name: "Monk", actualCharacter: "monk", shownCharacter: "monk" },
  { id: "p3", seat: 3, name: "Ravenkeeper", actualCharacter: "ravenkeeper", shownCharacter: "ravenkeeper" },
  { id: "p4", seat: 4, name: "Virgin", actualCharacter: "virgin", shownCharacter: "virgin" },
  { id: "p5", seat: 5, name: "Slayer", actualCharacter: "slayer", shownCharacter: "slayer" },
  { id: "p6", seat: 6, name: "Scarlet Woman", actualCharacter: "scarletWoman", shownCharacter: "scarletWoman" },
  { id: "p7", seat: 7, name: "Imp", actualCharacter: "imp", shownCharacter: "imp" },
];


function officialGame(
  scriptId: "troubleBrewing" | "sectsAndViolets",
  id: string,
): GameFileV4 {
  return {
    schemaVersion: 4,
    game: {
      script: { type: "official", scriptId },
      id,
      name: `Issue 198 ${scriptId}`,
      createdAt: "2026-09-07T00:00:00.000Z",
      updatedAt: "2026-09-07T00:00:00.000Z",
      events: [],
    },
  };
}


async function expectOfficialRoundTrip(
  controller: CanonicalSessionController,
  setupGame: GameFile,
  firstStepId: string,
): Promise<void> {
  const setupEvent = setupGame.game.events[0];
  expect(setupEvent?.type).toBe("setupConfirmed");
  if (!setupEvent || setupEvent.type !== "setupConfirmed") return;
  expect(Object.keys(setupEvent.payload)).toEqual(["players"]);
  expect(setupEvent.payload).not.toHaveProperty("firstNightOrderPlan");

  const replayed = await controller.replay(setupGame);
  expect(replayed.ok).toBe(true);
  if (!replayed.ok) return;
  expect(replayed.value.eventCount).toBe(1);
  expect(replayed.value.phase).toBe("firstNight");
  expect(replayed.value.currentStep?.id).toBe(firstStepId);
  const phaseOverview = replayed.value.phaseOverview.map(({ id }) => id);
  expect(phaseOverview).toContain(firstStepId);

  const serialized = parseGameFileJson(JSON.stringify(setupGame));
  const reloaded = await controller.replay(serialized);
  expect(reloaded.ok).toBe(true);
  if (!reloaded.ok) return;
  expect(reloaded.value).toMatchObject({
    eventCount: replayed.value.eventCount,
    phase: replayed.value.phase,
    currentStep: replayed.value.currentStep,
    players: replayed.value.players,
  });
  expect(reloaded.value.phaseOverview.map(({ id }) => id)).toEqual(phaseOverview);

  const confirmed = await controller.execute(serialized, reloaded.value, {
    type: "confirmStep",
    payload: { stepId: firstStepId, input: null },
  });
  expect(confirmed.ok).toBe(true);
  if (!confirmed.ok) return;
  expect(confirmed.value.proposal.event.payload).not.toHaveProperty("firstNightOrderPlan");
  expect(confirmed.value.gameFile.game.events).toHaveLength(2);
  expect(confirmed.value.replayState.eventCount).toBe(2);

  const undone = await controller.undo(
    confirmed.value.gameFile,
    confirmed.value.replayState,
    confirmed.value.proposal.event.id,
  );
  expect(undone.ok).toBe(true);
  if (!undone.ok) return;
  expect(undone.value.removed.id).toBe(confirmed.value.proposal.event.id);
  expect(undone.value.gameFile.game.events).toEqual(serialized.game.events);
  expect(undone.value.replayState.eventCount).toBe(reloaded.value.eventCount);
  expect(undone.value.replayState.phase).toBe(reloaded.value.phase);
  expect(undone.value.replayState.currentStep).toEqual(reloaded.value.currentStep);
  expect(undone.value.replayState.players).toEqual(reloaded.value.players);
  expect(undone.value.replayState.phaseOverview.map(({ id }) => id)).toEqual(phaseOverview);
}
