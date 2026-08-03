import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { GameEvent, GameFile, SetupPlayerInput } from "../src/core/types";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { proposeAndAppend, realWasmCore } from "./realWasmCoreHarness";

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

function setupPlayer(seat: number, name: string, actualCharacter: string): SetupPlayerInput {
  return { seat, name, actualCharacter };
}
