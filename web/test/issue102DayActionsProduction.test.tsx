import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Command, GameEvent, GameFile, ReplayState, SetupPlayerInput } from "../src/core/types";
import { PlayerTokenList } from "../src/features/grimoire/playerTokenPresentation";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { proposeAndAppend, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

test("the production UI records an Artist action, autosaves it, and shows it from the Grimoire player details", async () => {
  const game = await firstDayGame();
  const storage = new MemoryGameStorageDriver(game);
  const user = userEvent.setup();

  render(<SectsAndVioletsApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  expect(await screen.findByRole("button", { name: "백치천재 행동 열기, 1번 민지" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "화가 행동 열기, 2번 현우" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "곡예사 행동 열기, 3번 서준" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "화가 행동 열기, 2번 현우" }));
  const actionPanel = screen.getByRole("dialog", { name: "화가 능력 사용" });
  await user.click(within(actionPanel).getByRole("button", { name: "화가 캐릭터 상세 열기" }));
  expect(screen.getByRole("dialog", { name: "화가 캐릭터 상세" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "캐릭터 상세 닫기" }));

  await user.type(within(actionPanel).getByRole("textbox", { name: "질문" }), "악마가 홀수 좌석에 있나요?");
  expect(within(actionPanel).getByText("보르톡스")).toBeTruthy();
  await user.click(within(actionPanel).getByRole("button", { name: "X 아니오" }));
  await user.click(within(actionPanel).getByRole("button", { name: "거짓 정보 전달" }));

  await waitFor(() => expect(screen.queryByRole("button", { name: /화가 행동/ })).toBeNull());
  await waitFor(() => {
    expect(storage.savedGames.at(-1)?.game.events.at(-1)).toMatchObject({
      type: "dayActionRecorded",
      payload: {
        actorPlayerId: "player-2",
        characterId: "artist",
        record: { kind: "artist", question: "악마가 홀수 좌석에 있나요?", answer: "no", truthful: false },
        activeReasons: [{ type: "vortox", demonPlayerId: "player-7" }],
      },
    });
  });

  await user.click(screen.getByRole("button", { name: "마도서" }));
  expect(screen.getByRole("button", { name: "백치천재 행동 열기, 1번 민지" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "곡예사 행동 열기, 3번 서준" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /2번 좌석, 현우, 화가/ }));
  const playerDetails = screen.getByRole("dialog", { name: "2번 현우 플레이어 상세" });
  expect(within(playerDetails).getByText("악마가 홀수 좌석에 있나요?")).toBeTruthy();
  expect(within(playerDetails).getByText("답변 · X · 거짓")).toBeTruthy();
});

test("a recorded Juggler result adds stacked reminder tokens instead of changing the character identity", async () => {
  const game = await firstDayGame();
  const storage = new MemoryGameStorageDriver(game);
  const user = userEvent.setup();

  render(<SectsAndVioletsApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  await user.click(await screen.findByRole("button", { name: "곡예사 행동 열기, 3번 서준" }));
  const actionPanel = screen.getByRole("dialog", { name: "곡예사 능력 사용" });
  await user.click(within(actionPanel).getByRole("button", { name: "3" }));
  await user.click(within(actionPanel).getByRole("button", { name: "첫 낮 추측 완료" }));

  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events.at(-1)).toMatchObject({
    type: "dayActionRecorded",
    payload: {
      actorPlayerId: "player-3",
      characterId: "juggler",
      record: { kind: "juggler", correctCount: 3 },
    },
  }));

  await user.click(screen.getByRole("button", { name: "마도서" }));
  await user.click(screen.getByRole("button", { name: /3번 좌석, 서준, 곡예사, 토큰 3개/ }));
  const playerDetails = screen.getByRole("dialog", { name: "3번 서준 플레이어 상세" });
  const identity = within(playerDetails).getByRole("button", { name: "곡예사 캐릭터 상세 열기" });
  expect(within(identity).getByText("곡예사")).toBeTruthy();
  expect(within(identity).queryByText("정답 • 3개")).toBeNull();
  const tokenArea = within(playerDetails).getByRole("region", { name: "부착된 토큰" });
  const resultTokens = within(tokenArea).getByLabelText("곡예사 정답 토큰 3개");
  expect(resultTokens.children).toHaveLength(3);
  expect(within(resultTokens).getByText("곡예사")).toBeTruthy();
  expect(within(resultTokens).getByText("정답 • 3개")).toBeTruthy();
  expect(within(playerDetails).queryByRole("region", { name: "낮 자유 행동 기록" })).toBeNull();
});

test("a zero-correct Juggler result uses one muted result token", () => {
  render(<PlayerTokenList tokens={[]} theme="day" jugglerResult={{ correctCount: 0 }} />);

  const resultTokens = screen.getByLabelText("곡예사 정답 토큰 0개");
  expect(resultTokens.children).toHaveLength(1);
  expect(resultTokens.firstElementChild?.classList.contains("zeroCorrect")).toBe(true);
  expect(within(resultTokens).getByText("정답 • 0개")).toBeTruthy();
});

async function firstDayGame(): Promise<GameFile> {
  const players: SetupPlayerInput[] = [
    player("player-1", 1, "민지", "savant"),
    player("player-2", 2, "현우", "artist"),
    player("player-3", 3, "서준", "juggler"),
    player("player-4", 4, "도윤", "clockmaker"),
    player("player-5", 5, "유나", "dreamer"),
    player("player-6", 6, "하린", "evilTwin"),
    player("player-7", 7, "준호", "vortox"),
  ];
  const events: GameEvent[] = [{
    id: "setup-1",
    type: "setupConfirmed",
    phase: "setup",
    payload: { players },
    summary: "초기 설정 확정: 7명",
    createdAt: "2026-07-25T00:00:00.000Z",
  }];
  const selectedIds = players.map((entry) => entry.actualCharacter);
  const game: GameFile = {
    schemaVersion: 3,
    game: {
      id: "issue-102-production-ui",
      name: "Issue 102 production UI",
      scriptId: "sectsAndViolets",
      createdAt: "2026-07-25T00:00:00.000Z",
      updatedAt: "2026-07-25T00:04:00.000Z",
      events,
    },
    ui: {
      sectsAndVioletsSession: {
        version: 1,
        activeTab: "play",
        savedAt: "2026-07-25T00:04:00.000Z",
        setup: {
          playerCount: 7,
          demon: "vortox",
          selectedIds,
          seatAssignments: Object.fromEntries(selectedIds.map((id, index) => [index + 1, id])),
          seatAlignments: Object.fromEntries(selectedIds.map((_id, index) => [index + 1, index >= 5 ? "evil" : "good"])),
          seatNames: Object.fromEntries(players.map((entry) => [entry.seat, entry.name])),
          rosterConfirmed: true,
          seatingConfirmed: true,
        },
        phaseCheckpoints: [],
      },
    },
  };
  for (let attempts = 0; attempts < 48; attempts += 1) {
    const state = await replayOrThrow(game);
    if (state.phase === "day") return game;
    if (!state.currentStep) throw new Error("expected a first-night step");
    await proposeAndAppend(game, commandFor(state.currentStep));
  }
  throw new Error("did not reach the first day");
}

function player(id: string, seat: number, name: string, character: string): SetupPlayerInput {
  return { id, seat, name, actualCharacter: character, shownCharacter: character };
}

function commandFor(step: NonNullable<ReplayState["currentStep"]>): Command {
  if (step.support === "manual") {
    return { type: "resolveManualStep", payload: { stepId: step.id, outcome: "handled" } };
  }
  if (step.character === "dreamer") {
    const check = step.informationPrompt?.targetChecks?.[0];
    if (!check) throw new Error("expected a Dreamer target check");
    return {
      type: "confirmStep",
      payload: {
        stepId: step.id,
        input: { playerIds: check.targetPlayerIds },
        deliveredResult: check.choices[0].result,
      },
    };
  }
  if (step.requiredInput.kind === "playerIds") {
    const target = step.requiredInput.allowedPlayerIds?.[0];
    if (!target) throw new Error(`expected a target for ${step.character ?? step.id}`);
    return {
      type: "confirmStep",
      payload: { stepId: step.id, input: { playerIds: [target] } },
    };
  }
  if (step.informationPrompt?.deliveryMode === "selectable") {
    const numberChoice = step.informationPrompt.numberChoices[0];
    if (numberChoice) {
      return {
        type: "confirmStep",
        payload: {
          stepId: step.id,
          input: null,
          deliveredResult: { kind: "number", value: numberChoice.value },
        },
      };
    }
    if (step.informationPrompt.numberConstraint) {
      return {
        type: "confirmStep",
        payload: {
          stepId: step.id,
          input: null,
          deliveredResult: { kind: "number", value: 100 },
        },
      };
    }
    const booleanChoice = step.informationPrompt.booleanChoices?.[0];
    if (booleanChoice) {
      return {
        type: "confirmStep",
        payload: {
          stepId: step.id,
          input: null,
          deliveredResult: { kind: "boolean", value: booleanChoice.value },
        },
      };
    }
  }
  if (step.informationPrompt?.computedResult) {
    return {
      type: "confirmStep",
      payload: { stepId: step.id, input: null, deliveredResult: step.informationPrompt.computedResult },
    };
  }
  return { type: "confirmStep", payload: { stepId: step.id, input: null } };
}
