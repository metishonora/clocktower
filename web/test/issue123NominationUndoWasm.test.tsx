import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Command, GameEvent, GameFile, SetupPlayerInput } from "../src/core/types";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { proposeAndAppend, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

test("undo treats a completed nomination and its vote as one action", async () => {
  const game = await gameAtFirstNomination();
  const baselineEventCount = game.game.events.length;
  const storage = new MemoryGameStorageDriver(game);
  const user = userEvent.setup();
  render(<SectsAndVioletsApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  expect(await within(app).findByRole("heading", { name: "지명 및 투표" })).toBeTruthy();

  await user.click(within(app).getByRole("button", { name: "← 지명하기" }));
  await user.click(within(app).getByRole("button", { name: /9번 좌석/ }));
  await user.click(within(app).getByRole("button", { name: /8번 좌석/ }));
  await user.click(within(app).getByRole("button", { name: "9번 → 8번 지명 확정" }));

  expect(await within(app).findByRole("heading", { name: "투표" })).toBeTruthy();
  await user.click(within(app).getByRole("button", { name: /3번 좌석/ }));
  await user.click(within(app).getByRole("button", { name: "1표로 투표 확정" }));
  await user.click(await within(app).findByRole("button", { name: "투표 완료 →" }));

  await user.click(await within(app).findByRole("button", { name: /최근 행동 되돌리기/ }));
  const undo = screen.getByRole("dialog", { name: "Undo" });
  expect(within(undo).getAllByRole("listitem")).toHaveLength(2);
  await user.click(within(undo).getByRole("button", { name: "되돌리기" }));

  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events).toHaveLength(baselineEventCount));
  const undoneGame = storage.savedGames.at(-1)!;
  const undone = await replayOrThrow(undoneGame);
  expect(undone.ruleState.automaticReminders?.map((reminder) => reminder.label)).toEqual([
    "악마 투표 안 함",
    "하수인 지목 안 함",
  ]);

  await user.click(within(app).getByRole("button", { name: "← 지명하기" }));
  await user.click(within(app).getByRole("button", { name: /6번 좌석/ }));
  await user.click(within(app).getByRole("button", { name: /1번 좌석/ }));
  await user.click(within(app).getByRole("button", { name: "6번 → 1번 지명 확정" }));
  expect(await within(app).findByRole("heading", { name: "투표" })).toBeTruthy();
  expect(screen.queryByRole("dialog", { name: "작업 실패" })).toBeNull();
});

test("repeated nominations stay in one nomination and voting phase on the progress screen", async () => {
  const game = await gameAtFirstNomination();
  const user = userEvent.setup();
  render(
    <SectsAndVioletsApp
      coreAdapter={realWasmCore()}
      storageDriver={new MemoryGameStorageDriver(game)}
    />,
  );

  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  const nominationPhaseCount = () => within(
    within(app).getByRole("list", { name: "낮 순서" }),
  ).getAllByText("지명 및 투표").length;
  expect(nominationPhaseCount()).toBe(1);

  await completeNominationAndReturn(user, app, 9, 8, [3]);
  expect(nominationPhaseCount()).toBe(1);

  await completeNominationAndReturn(user, app, 6, 1, [3]);
  expect(nominationPhaseCount()).toBe(1);
});

async function completeNominationAndReturn(
  user: ReturnType<typeof userEvent.setup>,
  app: HTMLElement,
  nominator: number,
  nominee: number,
  voters: number[],
) {
  await user.click(within(app).getByRole("button", { name: "← 지명하기" }));
  await user.click(within(app).getByRole("button", { name: new RegExp(`${nominator}번 좌석`) }));
  await user.click(within(app).getByRole("button", { name: new RegExp(`${nominee}번 좌석`) }));
  await user.click(within(app).getByRole("button", { name: `${nominator}번 → ${nominee}번 지명 확정` }));
  for (const voter of voters) {
    await user.click(within(app).getByRole("button", { name: new RegExp(`${voter}번 좌석`) }));
  }
  await user.click(within(app).getByRole("button", { name: `${voters.length}표로 투표 확정` }));
  await user.click(await within(app).findByRole("button", { name: "투표 완료 →" }));
}

async function gameAtFirstNomination(): Promise<GameFile> {
  const players: SetupPlayerInput[] = [
    "mathematician",
    "townCrier",
    "noDashii",
    "philosopher",
    "oracle",
    "cerenovus",
    "clockmaker",
    "snakeCharmer",
    "pitHag",
    "flowergirl",
  ].map((actualCharacter, index) => ({
    id: `player-${index + 1}`,
    seat: index + 1,
    name: `플레이어 ${index + 1}`,
    actualCharacter,
    shownCharacter: actualCharacter,
  }));
  const setup: GameEvent = {
    id: "setup-1",
    type: "setupConfirmed",
    phase: "setup",
    payload: { players },
    summary: "초기 설정 확정: 10명",
    createdAt: "2026-07-24T15:06:45.000Z",
  };
  const game: GameFile = {
    schemaVersion: 3,
    game: {
      id: "issue-123-regression",
      name: "Issue 123 nomination undo",
      scriptId: "sectsAndViolets",
      createdAt: "2026-07-24T15:06:45.000Z",
      updatedAt: "2026-07-24T15:06:45.000Z",
      events: [setup],
    },
  };

  for (let attempts = 0; attempts < 32; attempts += 1) {
    const state = await replayOrThrow(game);
    const step = state.currentStep;
    if (step?.id === "day:nomination:1") break;
    if (!step) throw new Error("game ended before the first nomination");
    let command: Command;
    if (step.support === "manual") {
      command = { type: "resolveManualStep", payload: { stepId: step.id, outcome: "handled" } };
    } else if (step.character === "snakeCharmer") {
      command = {
        type: "confirmStep",
        payload: { stepId: step.id, input: { playerIds: ["player-1"] } },
      };
    } else if (step.requiredInput.kind === "madnessAssignment") {
      command = {
        type: "confirmStep",
        payload: { stepId: step.id, input: { playerIds: ["player-1"], characterId: "clockmaker" } },
      };
    } else {
      command = { type: "confirmStep", payload: { stepId: step.id, input: null } };
    }
    await proposeAndAppend(game, command);
  }

  const state = await replayOrThrow(game);
  expect(state.currentStep?.id).toBe("day:nomination:1");
  const selectedIds = players.map((player) => player.actualCharacter);
  game.ui = {
    sectsAndVioletsSession: {
      version: 1,
      activeTab: "play",
      savedAt: "2026-07-24T15:08:00.000Z",
      setup: {
        playerCount: players.length,
        demon: "noDashii",
        selectedIds,
        seatAssignments: Object.fromEntries(players.map((player) => [player.seat, player.actualCharacter])),
        seatAlignments: Object.fromEntries(players.map((player) => [
          player.seat,
          ["noDashii", "cerenovus", "pitHag"].includes(player.actualCharacter) ? "evil" : "good",
        ])),
        seatNames: Object.fromEntries(players.map((player) => [player.seat, player.name])),
        rosterConfirmed: true,
        seatingConfirmed: true,
      },
      phaseCheckpoints: game.game.events.map((event, index) => ({
        id: event.id,
        kind: index === 0 ? "setup" : "phase",
        eventCount: index + 1,
        summary: event.summary,
        activeTab: index === 0 ? "seating" : "play",
      })),
    },
  };
  return game;
}
