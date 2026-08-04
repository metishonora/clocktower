import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { GameEvent, GameFile, SetupPlayerInput } from "../src/core/types";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { proposeAndAppend, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

test("shows an out-of-play ability as the Philosopher's grimoire character", async () => {
  const game = philosopherGame();
  await proposeAndAppend(game, {
    type: "confirmStep",
    payload: {
      stepId: "firstNight:philosopher",
      input: { characterIds: ["dreamer"] },
    },
  });
  const user = userEvent.setup();

  render(
    <SectsAndVioletsApp
      coreAdapter={realWasmCore()}
      storageDriver={new MemoryGameStorageDriver(game)}
    />,
  );

  await user.click(await screen.findByRole("button", { name: "마도서" }));
  const grimoire = await screen.findByLabelText("밤 마도서");
  const philosopherSeat = within(grimoire).getByRole("button", {
    name: /1번 좌석, 민지, 꿈꾸는 자, 토큰 1개, 생존/,
  });
  expect(philosopherSeat.querySelector('img[src*="dreamer_g.webp"]')).toBeTruthy();

  await user.click(philosopherSeat);
  const details = await screen.findByRole("dialog", { name: "1번 민지 플레이어 상세" });
  expect(within(details).getByRole("button", { name: "꿈꾸는 자 캐릭터 상세 열기" })).toBeTruthy();
  expect(within(details).getByLabelText("철학자임 · 출처 철학자")).toBeTruthy();
});

test("keeps Philosopher identity while presenting an out-of-play Snake Charmer grant after evil information", async () => {
  const game = philosopherSnakeCharmerGame();
  await proposeAndAppend(game, {
    type: "confirmStep",
    payload: {
      stepId: "firstNight:philosopher",
      input: { characterIds: ["snakeCharmer"] },
    },
  });

  for (const stepId of ["firstNight:minionInfo", "firstNight:demonInfo"]) {
    const state = await replayOrThrow(game);
    expect(state.currentStep?.id).toBe(stepId);
    await proposeAndAppend(game, {
      type: "confirmStep",
      payload: { stepId, input: null },
    });
  }

  const afterEvilInformation = await replayOrThrow(game);
  expect(afterEvilInformation.currentStep).toMatchObject({
    character: "snakeCharmer",
    playerId: "player-1",
    abilityUse: { ownerPlayerId: "player-1", characterId: "snakeCharmer" },
  });
  expect(afterEvilInformation.phaseOverview).toContainEqual(expect.objectContaining({
    character: "snakeCharmer",
    playerId: "player-1",
  }));

  game.ui = liveSessionForCharacters([
    "philosopher",
    "clockmaker",
    "oracle",
    "artist",
    "barber",
    "cerenovus",
    "vortox",
  ]);
  render(
    <SectsAndVioletsApp
      coreAdapter={realWasmCore()}
      storageDriver={new MemoryGameStorageDriver(game)}
    />,
  );

  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  expect(await within(app).findByRole("heading", { name: "철학자" })).toBeTruthy();
  expect(within(app).getByText(/민지/)).toBeTruthy();
  expect(within(app).getByRole("button", { name: "철학자 캐릭터 상세 열기" })).toBeTruthy();
  const acquiredAbility = within(app).getByRole("button", { name: "뱀 조련사 캐릭터 상세 열기" });
  expect(within(acquiredAbility).getByText("획득한 능력")).toBeTruthy();
  expect(within(acquiredAbility).getByText(/매일 밤, 생존한 플레이어 1명을 선택합니다/)).toBeTruthy();
  expect(within(app).queryByRole("heading", { name: "뱀 조련사" })).toBeNull();

  const overview = within(app).getByRole("list", { name: "첫날 밤 순서" });
  expect(within(overview).getByText("철학자 · 뱀 조련사")).toBeTruthy();
});

function philosopherGame(): GameFile {
  const players: SetupPlayerInput[] = [
    setupPlayer(1, "민지", "philosopher"),
    setupPlayer(2, "현우", "clockmaker"),
    setupPlayer(3, "서윤", "oracle"),
    setupPlayer(4, "지훈", "snakeCharmer"),
    setupPlayer(5, "유나", "artist"),
    setupPlayer(6, "도윤", "barber"),
    setupPlayer(7, "하린", "cerenovus"),
    setupPlayer(8, "주원", "vortox"),
  ];
  const setup: GameEvent = {
    id: "setup-1",
    type: "setupConfirmed",
    phase: "setup",
    payload: { players },
    summary: "초기 설정",
    createdAt: "2026-08-04T00:00:00.000Z",
  };
  return {
    schemaVersion: 3,
    game: {
      scriptId: "sectsAndViolets",
      id: "issue-107-production",
      name: "Issue 107 Philosopher",
      createdAt: "2026-08-04T00:00:00.000Z",
      updatedAt: "2026-08-04T00:00:00.000Z",
      events: [setup],
    },
  };
}

function philosopherSnakeCharmerGame(): GameFile {
  const players: SetupPlayerInput[] = [
    setupPlayer(1, "민지", "philosopher"),
    setupPlayer(2, "현우", "clockmaker"),
    setupPlayer(3, "서윤", "oracle"),
    setupPlayer(4, "유나", "artist"),
    setupPlayer(5, "도윤", "barber"),
    setupPlayer(6, "하린", "cerenovus"),
    setupPlayer(7, "주원", "vortox"),
  ];
  return {
    schemaVersion: 3,
    game: {
      scriptId: "sectsAndViolets",
      id: "issue-107-snake-charmer-production",
      name: "Issue 107 Philosopher Snake Charmer",
      createdAt: "2026-08-04T00:00:00.000Z",
      updatedAt: "2026-08-04T00:00:00.000Z",
      events: [{
        id: "setup-1",
        type: "setupConfirmed",
        phase: "setup",
        payload: { players },
        summary: "초기 설정",
        createdAt: "2026-08-04T00:00:00.000Z",
      }],
    },
  };
}

function setupPlayer(seat: number, name: string, actualCharacter: string): SetupPlayerInput {
  return { seat, name, actualCharacter };
}

function liveSessionForCharacters(characterIds: string[]): NonNullable<GameFile["ui"]> {
  return {
    sectsAndVioletsSession: {
      version: 1,
      activeTab: "play",
      savedAt: "2026-08-04T00:00:00.000Z",
      setup: {
        playerCount: characterIds.length,
        demon: "vortox",
        selectedIds: characterIds,
        seatAssignments: Object.fromEntries(characterIds.map((id, index) => [index + 1, id])),
        seatAlignments: Object.fromEntries(characterIds.map((_id, index) => [index + 1, index >= characterIds.length - 2 ? "evil" : "good"])),
        seatNames: Object.fromEntries(characterIds.map((id, index) => [index + 1, ["민지", "현우", "서윤", "유나", "도윤", "하린", "주원"][index] ?? id])),
        rosterConfirmed: true,
        seatingConfirmed: true,
      },
      phaseCheckpoints: [],
    },
  };
}
