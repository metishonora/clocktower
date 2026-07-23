import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Command, GameEvent, GameFile, ReplayState, SetupPlayerInput } from "../src/core/types";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { proposeAndAppend, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

test("the real WASM skips the newly poisoned Snake Charmer until the next night", async () => {
  const game = snakeCharmerGame();

  const firstNight = await advanceToSnakeCharmer(game, false);
  await choosePlayer(game, firstNight, "player-6");

  const ongoingNight = await advanceToSnakeCharmer(game, true);
  expect(ongoingNight.currentStep?.id).toBe("night:snakeCharmer:player-1");
  await choosePlayer(game, ongoingNight, "player-7");

  const immediatelyAfterSwap = await replayOrThrow(game);
  expect(immediatelyAfterSwap.currentStep).not.toMatchObject({
    character: "snakeCharmer",
    playerId: "player-7",
  });
  expect(immediatelyAfterSwap.phaseOverview).not.toContainEqual(expect.objectContaining({
    id: "night:snakeCharmer:player-7",
  }));

  const nextNight = await advanceToSnakeCharmer(game, true);
  expect(nextNight.currentStep).toMatchObject({
    id: "night2:snakeCharmer:player-7",
    character: "snakeCharmer",
    playerId: "player-7",
  });
});

test("the real WASM never generates a first-night wake step for the new Snake Charmer", async () => {
  const game = snakeCharmerGame();
  const firstNight = await advanceToSnakeCharmer(game, false);

  await choosePlayer(game, firstNight, "player-7");

  const immediatelyAfterSwap = await replayOrThrow(game);
  expect(immediatelyAfterSwap.currentStep).not.toMatchObject({
    character: "snakeCharmer",
    playerId: "player-7",
  });
  expect(immediatelyAfterSwap.phaseOverview).not.toContainEqual(expect.objectContaining({
    id: "firstNight:snakeCharmer:player-7",
  }));
});

test("the production UI continues to the later role after both swap reveals", async () => {
  const game = snakeCharmerGame();
  const firstNight = await advanceToSnakeCharmer(game, false);
  await choosePlayer(game, firstNight, "player-6");
  await advanceToSnakeCharmer(game, true);
  game.ui = liveSession();
  const storage = new MemoryGameStorageDriver(game);
  const user = userEvent.setup();

  render(<SectsAndVioletsApp coreAdapter={realWasmCore()} storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  await user.click(await within(app).findByRole("button", { name: "대상 선택" }));
  await user.click(within(app).getByRole("button", { name: /7번 좌석, Vigormortis/ }));
  await user.click(within(app).getByRole("button", { name: "7번 Vigormortis 선택 확정" }));

  expect(within(app).getByRole("button", { name: /1번 좌석.*현재 행동자/ })).toBeTruthy();
  expect(within(app).queryByRole("button", { name: /6번 좌석.*현재 행동자/ })).toBeNull();

  for (const sequence of [1, 2]) {
    const prompt = await screen.findByRole("dialog", { name: `직업 변경 안내 ${sequence}/2` });
    await user.click(within(prompt).getByRole("button", { name: "공개" }));
    const reveal = await screen.findByRole("dialog", { name: `역할 변경 공개 ${sequence}/2` });
    await user.click(within(reveal).getByRole("button", { name: "확인했다면 눈을 감으세요" }));
  }

  await user.click(await within(app).findByRole("button", { name: "진행 →" }));
  expect(await within(app).findByRole("heading", { name: "마귀할멈" })).toBeTruthy();
  expect(within(app).queryByRole("group", { name: "뱀 조련사 대상 선택" })).toBeNull();
});

async function advanceToSnakeCharmer(game: GameFile, ongoingNightOnly: boolean): Promise<ReplayState> {
  for (let attempts = 0; attempts < 96; attempts += 1) {
    const state = await replayOrThrow(game);
    const step = state.currentStep;
    if (!step) throw new Error("expected a current phase step");
    if (step.character === "snakeCharmer" && (!ongoingNightOnly || state.phase === "night")) {
      return state;
    }
    await proposeAndAppend(game, commandFor(step));
  }
  throw new Error("did not reach the Snake Charmer step");
}

function commandFor(step: NonNullable<ReplayState["currentStep"]>): Command {
  if (step.requiredInput.kind === "nomination") {
    return { type: "skipStep", payload: { stepId: step.id } };
  }
  if (step.requiredInput.kind === "executionDecision") {
    return { type: "confirmStep", payload: { stepId: step.id, input: { execute: false } } };
  }
  if (step.support === "manual") {
    return { type: "resolveManualStep", payload: { stepId: step.id, outcome: "handled" } };
  }
  if (step.id.includes(":demon:")) {
    return { type: "confirmStep", payload: { stepId: step.id, input: { playerIds: ["player-2"] } } };
  }
  return { type: "confirmStep", payload: { stepId: step.id, input: null } };
}

async function choosePlayer(game: GameFile, state: ReplayState, playerId: string): Promise<void> {
  const step = state.currentStep;
  if (!step) throw new Error("expected a Snake Charmer step");
  await proposeAndAppend(game, {
    type: "confirmStep",
    payload: { stepId: step.id, input: { playerIds: [playerId] } },
  });
}

function snakeCharmerGame(): GameFile {
  const players: SetupPlayerInput[] = [
    { id: "player-1", seat: 1, name: "Snake", actualCharacter: "snakeCharmer", shownCharacter: "snakeCharmer" },
    { id: "player-2", seat: 2, name: "Clock", actualCharacter: "clockmaker", shownCharacter: "clockmaker" },
    { id: "player-3", seat: 3, name: "Dreamer", actualCharacter: "dreamer", shownCharacter: "dreamer" },
    { id: "player-4", seat: 4, name: "Seamstress", actualCharacter: "seamstress", shownCharacter: "seamstress" },
    { id: "player-5", seat: 5, name: "Mathematician", actualCharacter: "mathematician", shownCharacter: "mathematician" },
    { id: "player-6", seat: 6, name: "Pit-Hag", actualCharacter: "pitHag", shownCharacter: "pitHag" },
    { id: "player-7", seat: 7, name: "Vigormortis", actualCharacter: "vigormortis", shownCharacter: "vigormortis" },
  ];
  const setup: GameEvent = {
    id: "setup-1",
    type: "setupConfirmed",
    phase: "setup",
    payload: { players },
    summary: "초기 설정 확정",
    createdAt: "2026-07-23T00:00:00.000Z",
  };
  return {
    schemaVersion: 3,
    game: {
      id: "issue-101-real-wasm",
      name: "Snake Charmer WASM regression",
      scriptId: "sectsAndViolets",
      createdAt: "2026-07-23T00:00:00.000Z",
      updatedAt: "2026-07-23T00:00:00.000Z",
      events: [setup],
    },
  };
}

function liveSession(): NonNullable<GameFile["ui"]> {
  const characterIds = [
    "snakeCharmer",
    "clockmaker",
    "dreamer",
    "seamstress",
    "mathematician",
    "pitHag",
    "vigormortis",
  ];
  return {
    sectsAndVioletsSession: {
      version: 1,
      activeTab: "play",
      savedAt: "2026-07-23T00:00:00.000Z",
      setup: {
        playerCount: 7,
        demon: "vigormortis",
        selectedIds: characterIds,
        seatAssignments: Object.fromEntries(characterIds.map((id, index) => [index + 1, id])),
        seatAlignments: Object.fromEntries(characterIds.map((_id, index) => [index + 1, index >= 5 ? "evil" : "good"])),
        seatNames: {
          1: "Snake",
          2: "Clock",
          3: "Dreamer",
          4: "Seamstress",
          5: "Mathematician",
          6: "Pit-Hag",
          7: "Vigormortis",
        },
        rosterConfirmed: true,
        seatingConfirmed: true,
      },
      phaseCheckpoints: [],
    },
  };
}
