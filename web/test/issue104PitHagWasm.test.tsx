import { expect, test } from "vitest";
import type { Command, GameEvent, GameFile, ReplayState, SetupPlayerInput } from "../src/core/types";
import { proposeAndAppend, replayOrThrow } from "./realWasmCoreHarness";

test("the real WASM carries Pit-Hag transformation through both Demon intents and arbitrary deaths", async () => {
  const game = pitHagGame();
  const pitHag = await advanceUntil(game, (state) => state.currentStep?.requiredInput.kind === "characterTransformation");
  expect(pitHag.currentStep).toMatchObject({
    id: "night:pitHag:player-1",
    support: "automated",
    requiredInput: {
      kind: "characterTransformation",
      allowedPlayerIds: ["player-1", "player-2", "player-3", "player-4", "player-5", "player-6", "player-7"],
    },
  });
  await proposeAndAppend(game, {
    type: "confirmStep",
    payload: {
      stepId: pitHag.currentStep!.id,
      input: { playerIds: ["player-7"], characterIds: ["noDashii"] },
    },
  });
  const transformed = await replayOrThrow(game);
  expect(transformed.players[6]).toMatchObject({ actualCharacter: "noDashii", alignment: "good" });
  expect(transformed.pendingIdentityReveals).toEqual([expect.objectContaining({
    payload: { kind: "characterChange", playerId: "player-7", characterId: "noDashii", alignment: "good" },
  })]);

  for (const [actorId, targetId] of [["player-2", "player-3"], ["player-7", "player-4"]]) {
    const demon = await replayOrThrow(game);
    expect(demon.currentStep?.id).toBe(`night:demon:${actorId}`);
    const proposal = await proposeAndAppend(game, {
      type: "confirmStep",
      payload: { stepId: demon.currentStep!.id, input: { playerIds: [targetId] } },
    });
    expect(proposal.event).toMatchObject({
      type: "nightActionResolved",
      payload: { resolution: { kind: "demonAttack", outcome: { kind: "noEffect", reason: "pitHagCreatedDemon" } } },
    });
  }

  const followUp = await advanceUntil(game, (state) => state.currentStep?.stepType === "pitHagArbitraryDeaths");
  expect(followUp.currentStep).toMatchObject({
    id: "night:pitHagArbitraryDeaths",
    stepType: "pitHagArbitraryDeaths",
    requiredInput: { kind: "playerIds", minSelections: 0, zeroAllowed: true },
  });
  await proposeAndAppend(game, {
    type: "confirmStep",
    payload: { stepId: followUp.currentStep!.id, input: { playerIds: ["player-3", "player-4"] } },
  });
  const afterDeaths = await replayOrThrow(game);
  expect(afterDeaths.ruleState.unannouncedNightDeathPlayerIds).toEqual(["player-3", "player-4"]);
  expect(afterDeaths.players[2].alive).toBe(false);
  expect(afterDeaths.players[3].alive).toBe(false);
});

async function advanceUntil(
  game: GameFile,
  predicate: (state: ReplayState) => boolean,
): Promise<ReplayState> {
  for (let attempts = 0; attempts < 64; attempts += 1) {
    const state = await replayOrThrow(game);
    if (predicate(state)) return state;
    if (!state.currentStep) throw new Error("expected current step");
    await proposeAndAppend(game, commandFor(state.currentStep));
  }
  throw new Error("target step not reached");
}

function commandFor(step: NonNullable<ReplayState["currentStep"]>): Command {
  if (step.requiredInput.kind === "nomination") return { type: "skipStep", payload: { stepId: step.id } };
  if (step.requiredInput.kind === "executionDecision") {
    return { type: "confirmStep", payload: { stepId: step.id, input: { execute: false } } };
  }
  if (step.support === "manual") return { type: "resolveManualStep", payload: { stepId: step.id, outcome: "handled" } };
  return { type: "confirmStep", payload: { stepId: step.id, input: null } };
}

function pitHagGame(): GameFile {
  const players: SetupPlayerInput[] = [
    { id: "player-1", seat: 1, name: "Pit-Hag", actualCharacter: "pitHag", shownCharacter: "pitHag" },
    { id: "player-2", seat: 2, name: "Fang Gu", actualCharacter: "fangGu", shownCharacter: "fangGu" },
    { id: "player-3", seat: 3, name: "Barber", actualCharacter: "barber", shownCharacter: "barber" },
    { id: "player-4", seat: 4, name: "Sweetheart", actualCharacter: "sweetheart", shownCharacter: "sweetheart" },
    { id: "player-5", seat: 5, name: "Sage", actualCharacter: "sage", shownCharacter: "sage" },
    { id: "player-6", seat: 6, name: "Klutz", actualCharacter: "klutz", shownCharacter: "klutz" },
    { id: "player-7", seat: 7, name: "Mutant", actualCharacter: "mutant", shownCharacter: "mutant" },
  ];
  const setup: GameEvent = {
    id: "setup-1", type: "setupConfirmed", phase: "setup", payload: { players },
    summary: "초기 설정", createdAt: "2026-07-26T00:00:00.000Z",
  };
  return {
    schemaVersion: 3,
    game: {
      id: "issue-104-wasm", name: "Pit-Hag WASM", scriptId: "sectsAndViolets",
      createdAt: "2026-07-26T00:00:00.000Z", updatedAt: "2026-07-26T00:00:00.000Z",
      events: [setup],
    },
  };
}
