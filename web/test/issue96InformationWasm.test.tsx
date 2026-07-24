import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { GameEvent, GameFile, SetupPlayerInput } from "../src/core/types";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { proposeAndAppend, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

test("real WASM confirms Clockmaker information and advances when Reveal closes", async () => {
  const game = clockmakerGame();
  for (let index = 0; index < 2; index += 1) {
    const state = await replayOrThrow(game);
    await proposeAndAppend(game, {
      type: "confirmStep",
      payload: { stepId: state.currentStep!.id, input: null },
    });
  }
  game.ui = liveSession();
  const user = userEvent.setup();
  render(
    <SectsAndVioletsApp
      coreAdapter={realWasmCore()}
      storageDriver={new MemoryGameStorageDriver(game)}
    />,
  );

  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  const task = await within(app).findByRole("article", { name: "시계공 정보" });
  expect(within(task).getByText("진실").nextElementSibling?.textContent).toContain("1칸");
  const revealButton = within(task).getByRole("button", { name: "정보 공개" });
  expect(revealButton.classList.contains("prominent")).toBe(true);

  await user.click(revealButton);
  let reveal = await screen.findByRole("dialog", { name: "시계공 정보 공개" });
  expect(within(reveal).getByText("악마와 하수인의 거리")).toBeTruthy();
  expect(within(reveal).getByText("1칸")).toBeTruthy();
  await user.click(within(reveal).getByRole("button", { name: "정보 공개 닫기" }));

  expect(await within(app).findByRole("heading", { name: "꿈꾸는 자" })).toBeTruthy();
  expect(within(app).queryByRole("button", { name: "다음" })).toBeNull();
});

function clockmakerGame(): GameFile {
  const characterIds = [
    "clockmaker", "flowergirl", "townCrier", "oracle", "dreamer", "pitHag", "fangGu",
  ];
  const names = ["Clock", "Flower", "Crier", "Oracle", "Dreamer", "Pit-Hag", "Fang Gu"];
  const players: SetupPlayerInput[] = characterIds.map((actualCharacter, index) => ({
    id: `player-${index + 1}`,
    seat: index + 1,
    name: names[index],
    actualCharacter,
    shownCharacter: actualCharacter,
  }));
  const setup: GameEvent = {
    id: "setup-1",
    type: "setupConfirmed",
    phase: "setup",
    payload: { players },
    summary: "초기 설정 확정",
    createdAt: "2026-07-24T00:00:00.000Z",
  };
  return {
    schemaVersion: 3,
    game: {
      id: "issue-96-real-wasm",
      name: "Issue 96 WASM regression",
      scriptId: "sectsAndViolets",
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
      events: [setup],
    },
  };
}

function liveSession(): NonNullable<GameFile["ui"]> {
  const ids = ["clockmaker", "flowergirl", "townCrier", "oracle", "dreamer", "pitHag", "fangGu"];
  return {
    sectsAndVioletsSession: {
      version: 1,
      activeTab: "play",
      savedAt: "2026-07-24T00:00:00.000Z",
      setup: {
        playerCount: 7,
        demon: "fangGu",
        selectedIds: ids,
        seatAssignments: Object.fromEntries(ids.map((id, index) => [index + 1, id])),
        seatAlignments: Object.fromEntries(ids.map((_id, index) => [index + 1, index >= 5 ? "evil" : "good"])),
        seatNames: Object.fromEntries(["Clock", "Flower", "Crier", "Oracle", "Dreamer", "Pit-Hag", "Fang Gu"].map((name, index) => [index + 1, name])),
        rosterConfirmed: true,
        seatingConfirmed: true,
      },
      phaseCheckpoints: [],
    },
  };
}
