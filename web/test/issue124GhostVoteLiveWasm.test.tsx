import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Command, GameEvent, GameFile, ReplayState, SetupPlayerInput } from "../src/core/types";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { proposeAndAppend, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

test("a real-WASM second-day nomination accepts the killed Snake Charmer's ghost vote", async () => {
  const game = await gameAtSecondDayNomination();
  const beforeVote = await replayOrThrow(game);
  expect(beforeVote.players.find((player) => player.id === "player-3")).toMatchObject({
    actualCharacter: "snakeCharmer",
    alive: false,
    ghostVoteUsed: false,
  });

  const storage = new MemoryGameStorageDriver(game);
  const user = userEvent.setup();
  render(<SectsAndVioletsApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  expect(await within(app).findByRole("heading", { name: "지명 및 투표" })).toBeTruthy();

  await user.click(within(app).getByRole("button", { name: "← 지명하기" }));
  await user.click(within(app).getByRole("button", { name: /5번 좌석/ }));
  await user.click(within(app).getByRole("button", { name: /9번 좌석/ }));
  await user.click(within(app).getByRole("button", { name: "5번 → 9번 지명 확정" }));

  expect(await within(app).findByRole("heading", { name: "투표" })).toBeTruthy();
  const deadSnakeCharmer = within(app).getByRole("button", {
    name: /3번 좌석.*뱀 조련사.*사망, 투표 가능/,
  });
  expect(deadSnakeCharmer.hasAttribute("disabled")).toBe(false);
  expect(deadSnakeCharmer.classList.contains("snvDeadSeat")).toBe(true);
  expect(deadSnakeCharmer.querySelector(".snvFuneralIcon")).not.toBeNull();
  expect(deadSnakeCharmer.querySelector("img")).not.toBeNull();

  await user.click(deadSnakeCharmer);
  expect(within(app).getByText("1표")).toBeTruthy();
  expect(deadSnakeCharmer.getAttribute("aria-pressed")).toBe("true");
  expect(deadSnakeCharmer.classList.contains("snvSeatStateSelected")).toBe(true);

  await user.click(within(app).getByRole("button", { name: "1표로 투표 확정" }));
  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events.at(-1)?.type).toBe("nominationVoteConfirmed"));
  const afterVote = await replayOrThrow(storage.savedGames.at(-1)!);
  expect(afterVote.players.find((player) => player.id === "player-3")?.ghostVoteUsed).toBe(true);
});

test("the same mounted game keeps the swapped and killed Snake Charmer eligible for a later ghost vote", async () => {
  const game = await gameAtStep("firstNight:philosopher");
  const storage = new MemoryGameStorageDriver(game);
  const user = userEvent.setup();
  render(<SectsAndVioletsApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  await user.click(await within(app).findByRole("button", { name: "처리 완료" }));
  await user.click(await within(app).findByRole("button", { name: "다음 단계" }));
  await user.click(await within(app).findByRole("button", { name: "다음 단계" }));
  await user.click(await within(app).findByRole("button", { name: "대상 선택" }));
  await user.click(within(app).getByRole("button", { name: /1번 좌석/ }));
  await user.click(within(app).getByRole("button", { name: "1번 플레이어 1 선택 확정" }));
  await user.click(await within(app).findByRole("button", { name: "다음 →" }));
  await user.click(await within(app).findByRole("button", { name: "처리 완료" }));
  await revealCurrentInformation(user, app);
  await user.click(await within(app).findByRole("button", { name: "처리 완료" }));
  await user.click(await within(app).findByRole("button", { name: "낮으로" }));
  await user.click(await within(app).findByRole("button", { name: "발표 완료" }));
  await user.click(await within(app).findByRole("button", { name: "밀담 종료" }));
  await user.click(await within(app).findByRole("button", { name: "지명 시작" }));

  await completeNomination(user, app, 9, 1, [1, 2, 3]);
  await user.click(within(app).getByRole("button", { name: "지명 종료" }));
  await user.click(await within(app).findByRole("button", { name: "확정" }));
  await user.click(await within(app).findByRole("button", { name: "다음 →" }));

  await user.click(await within(app).findByRole("button", { name: "처리 완료" }));
  await user.click(await within(app).findByRole("button", { name: "대상 선택" }));
  await user.click(within(app).getByRole("button", { name: /3번 좌석/ }));
  await user.click(within(app).getByRole("button", { name: "3번 플레이어 3 선택 확정" }));
  await acknowledgeSnakeCharmerSwap(user);
  await user.click(await within(app).findByRole("button", { name: "진행 →" }));

  await user.click(await within(app).findByRole("button", { name: "처리 완료" }));
  await user.click(await within(app).findByRole("button", { name: "처리 완료" }));
  await user.click(await within(app).findByRole("button", { name: "← 공격" }));
  await user.click(within(app).getByRole("button", { name: /3번 좌석/ }));
  await user.click(within(app).getByRole("button", { name: "3번 플레이어 3 공격 확정" }));
  await user.click(await within(app).findByRole("button", { name: "다음 →" }));

  for (let informationIndex = 0; informationIndex < 3; informationIndex += 1) {
    await user.click(await within(app).findByRole("button", { name: "정보 공개" }));
    const reveal = await screen.findByRole("dialog", { name: /정보 공개$/ });
    await user.click(within(reveal).getByRole("button", { name: "정보 공개 닫기" }));
    await user.click(await within(app).findByRole("button", { name: "다음" }));
  }
  await user.click(await within(app).findByRole("button", { name: "처리 완료" }));
  await user.click(await within(app).findByRole("button", { name: "다음 →" }));
  await user.click(await within(app).findByRole("button", { name: "발표 완료" }));
  await user.click(await within(app).findByRole("button", { name: "밀담 종료" }));
  await user.click(await within(app).findByRole("button", { name: "지명 시작" }));

  await user.click(await within(app).findByRole("button", { name: "← 지명하기" }));
  await user.click(within(app).getByRole("button", { name: /5번 좌석/ }));
  await user.click(within(app).getByRole("button", { name: /9번 좌석/ }));
  await user.click(within(app).getByRole("button", { name: "5번 → 9번 지명 확정" }));

  const deadSnakeCharmer = await within(app).findByRole("button", {
    name: /3번 좌석.*뱀 조련사.*사망, 투표 가능/,
  });
  expect(deadSnakeCharmer.hasAttribute("disabled")).toBe(false);
  await user.click(deadSnakeCharmer);
  expect(within(app).getByText("1표")).toBeTruthy();
  expect(deadSnakeCharmer.getAttribute("aria-pressed")).toBe("true");
  await user.click(within(app).getByRole("button", { name: "1표로 투표 확정" }));
  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events.at(-1)?.type).toBe("nominationVoteConfirmed"));
  const afterVote = await replayOrThrow(storage.savedGames.at(-1)!);
  expect(afterVote.players.find((player) => player.id === "player-3")?.ghostVoteUsed).toBe(true);
}, 15_000);

async function gameAtSecondDayNomination(): Promise<GameFile> {
  return gameAtStep("day2:nomination:1");
}

async function gameAtStep(targetStepId: string): Promise<GameFile> {
  const players = setupPlayers();
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
      id: "issue-124-live-regression",
      name: "Issue 124 live ghost vote",
      scriptId: "sectsAndViolets",
      createdAt: setup.createdAt,
      updatedAt: setup.createdAt,
      events: [setup],
    },
  };

  for (let attempts = 0; attempts < 64; attempts += 1) {
    const state = await replayOrThrow(game);
    const step = state.currentStep;
    if (step?.id === targetStepId) break;
    if (!step) throw new Error(`game ended before ${targetStepId}`);
    await proposeAndAppend(game, commandFor(step));
  }

  expect((await replayOrThrow(game)).currentStep?.id).toBe(targetStepId);
  game.ui = liveSession(players, game.game.events);
  return game;
}

async function completeNomination(
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

async function acknowledgeSnakeCharmerSwap(user: ReturnType<typeof userEvent.setup>) {
  for (const sequence of [1, 2]) {
    const prompt = await screen.findByRole("dialog", { name: `직업 변경 안내 ${sequence}/2` });
    await user.click(within(prompt).getByRole("button", { name: "공개" }));
    const reveal = await screen.findByRole("dialog", { name: `역할 변경 공개 ${sequence}/2` });
    await user.click(within(reveal).getByRole("button", { name: "확인했다면 눈을 감으세요" }));
  }
}

async function revealCurrentInformation(user: ReturnType<typeof userEvent.setup>, app: HTMLElement) {
  await user.click(await within(app).findByRole("button", { name: "정보 공개" }));
  const reveal = await screen.findByRole("dialog", { name: /정보 공개$/ });
  await user.click(within(reveal).getByRole("button", { name: "정보 공개 닫기" }));
  await user.click(await within(app).findByRole("button", { name: "다음" }));
}

function commandFor(step: NonNullable<ReplayState["currentStep"]>): Command {
  if (step.id === "day:nomination:1") {
    return {
      type: "confirmStep",
      payload: { stepId: step.id, input: { nominatorId: "player-9", nomineeId: "player-1" } },
    };
  }
  if (step.id === "day:nomination:1:vote") {
    return {
      type: "confirmStep",
      payload: { stepId: step.id, input: { voterIds: ["player-1", "player-2", "player-3"] } },
    };
  }
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
    const targetId = step.id.startsWith("firstNight") ? "player-1" : "player-3";
    return { type: "confirmStep", payload: { stepId: step.id, input: { playerIds: [targetId] } } };
  }
  if (step.id.includes(":demon:")) {
    return { type: "confirmStep", payload: { stepId: step.id, input: { playerIds: ["player-3"] } } };
  }
  return { type: "confirmStep", payload: { stepId: step.id, input: null } };
}

function setupPlayers(): SetupPlayerInput[] {
  return [
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
}

function liveSession(players: SetupPlayerInput[], events: GameEvent[]): NonNullable<GameFile["ui"]> {
  return {
    sectsAndVioletsSession: {
      version: 1,
      activeTab: "play",
      savedAt: "2026-07-24T15:21:44.000Z",
      setup: {
        playerCount: players.length,
        demon: "noDashii",
        selectedIds: players.map((player) => player.actualCharacter),
        seatAssignments: Object.fromEntries(players.map((player) => [player.seat, player.actualCharacter])),
        seatAlignments: Object.fromEntries(players.map((player) => [
          player.seat,
          ["noDashii", "cerenovus", "pitHag"].includes(player.actualCharacter) ? "evil" : "good",
        ])),
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
