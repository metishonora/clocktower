import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Command, GameEvent, GameFile, ReplayState, SetupPlayerInput } from "../src/core/types";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { proposeAndAppend, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

test("the production S&V workflow executes an already-dead nominee without asking for another death", async () => {
  const game = await gameAtDeadNomineeExecution();
  const storage = new MemoryGameStorageDriver(game);
  const user = userEvent.setup();
  render(<SectsAndVioletsApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  const execution = await within(app).findByRole("group", { name: "처형 결정" });
  expect(within(execution).getByText("플레이어 3")).toBeTruthy();
  await user.click(within(execution).getByRole("button", { name: "확정" }));

  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events.at(-1)?.type).toBe("executionConfirmed"));
  const replayed = await replayOrThrow(storage.savedGames.at(-1)!);
  expect(replayed.players.find((player) => player.id === "player-3")?.alive).toBe(false);
  expect(replayed.dayState?.confirmedExecution?.playerId).toBe("player-3");
  expect(replayed.currentStep?.id).toBe("day2:toNight");
  expect(screen.queryByRole("dialog", { name: "작업 실패" })).toBeNull();
});

async function gameAtDeadNomineeExecution(): Promise<GameFile> {
  const players = setupPlayers();
  const setup: GameEvent = {
    id: "setup-1",
    type: "setupConfirmed",
    phase: "setup",
    payload: { players },
    summary: "초기 설정 확정: 7명",
    createdAt: "2026-07-25T00:00:00.000Z",
  };
  const game: GameFile = {
    schemaVersion: 3,
    game: {
      id: "issue-125-dead-nominee",
      name: "Issue 125 dead nominee execution",
      scriptId: "sectsAndViolets",
      createdAt: setup.createdAt,
      updatedAt: setup.createdAt,
      events: [setup],
    },
  };

  for (let attempts = 0; attempts < 48; attempts += 1) {
    const state = await replayOrThrow(game);
    const step = state.currentStep;
    if (step?.id === "day2:nomination:1") break;
    if (!step) throw new Error("game ended before the second-day nomination");
    await proposeAndAppend(game, commandFor(step));
  }

  await proposeAndAppend(game, {
    type: "confirmStep",
    payload: {
      stepId: "day2:nomination:1",
      input: { nominatorId: "player-1", nomineeId: "player-3" },
    },
  });
  await proposeAndAppend(game, {
    type: "confirmStep",
    payload: {
      stepId: "day2:nomination:1:vote",
      input: { voterIds: ["player-1", "player-2", "player-4"] },
    },
  });
  await proposeAndAppend(game, {
    type: "skipStep",
    payload: { stepId: "day2:nomination:2" },
  });

  expect((await replayOrThrow(game)).currentStep?.id).toBe("day2:execution");
  game.ui = liveSession(players, game.game.events);
  return game;
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
  if (step.character === "snakeCharmer") {
    return {
      type: "confirmStep",
      payload: { stepId: step.id, input: { playerIds: ["player-2"] } },
    };
  }
  if (step.id.includes(":demon:")) {
    return {
      type: "confirmStep",
      payload: { stepId: step.id, input: { playerIds: ["player-3"] } },
    };
  }
  return { type: "confirmStep", payload: { stepId: step.id, input: null } };
}

function setupPlayers(): SetupPlayerInput[] {
  return [
    "snakeCharmer",
    "clockmaker",
    "dreamer",
    "seamstress",
    "mathematician",
    "pitHag",
    "vigormortis",
  ].map((actualCharacter, index) => ({
    id: `player-${index + 1}`,
    seat: index + 1,
    name: `플레이어 ${index + 1}`,
    actualCharacter,
    shownCharacter: actualCharacter,
  }));
}

function liveSession(players: SetupPlayerInput[], events: GameEvent[]): NonNullable<GameFile["ui"]> {
  return {
    sectsAndVioletsSession: {
      version: 1,
      activeTab: "play",
      savedAt: "2026-07-25T00:02:00.000Z",
      setup: {
        playerCount: players.length,
        demon: "vigormortis",
        selectedIds: players.map((player) => player.actualCharacter),
        seatAssignments: Object.fromEntries(players.map((player) => [player.seat, player.actualCharacter])),
        seatAlignments: Object.fromEntries(players.map((player, index) => [player.seat, index >= 5 ? "evil" : "good"])),
        seatNames: Object.fromEntries(players.map((player) => [player.seat, player.name])),
        rosterConfirmed: true,
        seatingConfirmed: true,
      },
      phaseCheckpoints: events.map((event, index) => ({
        id: event.id,
        kind: index === 0 ? "setup" : "phase",
        eventCount: index + 1,
        summary: event.summary,
        activeTab: index === 0 ? "seating" : "play",
      })),
    },
  };
}
