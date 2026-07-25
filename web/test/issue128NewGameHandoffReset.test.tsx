import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { GameFile } from "../src/core/types";
import { importGameFileJson } from "../src/gameStorage";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

test("starting a new game clears an unfinished Seamstress selection before confirming the next seating", async () => {
  const previousGame = seamstressGameAtTargetSelection();
  expect((await replayOrThrow(previousGame)).currentStep?.character).toBe("seamstress");
  const user = userEvent.setup();
  render(
    <SectsAndVioletsApp
      coreAdapter={realWasmCore()}
      storageDriver={new MemoryGameStorageDriver(previousGame)}
    />,
  );

  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  await user.click(await within(app).findByRole("button", { name: "대상 선택" }));
  expect(within(app).getByRole("heading", { name: "두 명 선택" })).toBeTruthy();

  await user.click(within(app).getByRole("button", { name: "새 게임" }));
  const confirmation = screen.getByRole("dialog", { name: "새 게임 시작 확인" });
  await user.click(within(confirmation).getByRole("button", { name: "새 게임 시작" }));

  for (const characterName of ["시계공", "꿈꾸는 자", "수학자", "철학자", "얼뜨기", "마녀"]) {
    await user.click(within(app).getByRole("button", { name: characterName }));
  }
  await user.click(within(app).getByRole("button", { name: "직업 선택 확정" }));
  await user.click(within(app).getByRole("button", { name: "무작위 배치" }));
  await user.click(within(app).getByRole("button", { name: "배치 확정" }));

  const progressTab = await within(app).findByRole("button", { name: "진행" });
  expect(progressTab.hasAttribute("disabled")).toBe(false);
  expect(within(app).queryByRole("heading", { name: "두 명 선택" })).toBeNull();
  expect(within(app).getByRole("button", { name: "진행 →" })).toBeTruthy();
});

function seamstressGameAtTargetSelection(): GameFile {
  const fixturePath = resolve(process.cwd(), "../fixtures/acceptance/sects-and-violets/issue-98-seamstress.json");
  const game = importGameFileJson(readFileSync(fixturePath, "utf8"), "sectsAndViolets");
  game.game.events.pop();
  const players = game.game.events[0].type === "setupConfirmed"
    ? game.game.events[0].payload.players
    : [];
  const ids = players.map((player) => player.actualCharacter);
  game.ui = {
    sectsAndVioletsSession: {
      version: 1,
      activeTab: "play",
      savedAt: "2026-07-25T00:00:00.000Z",
      setup: {
        playerCount: players.length,
        demon: "fangGu",
        selectedIds: ids,
        seatAssignments: Object.fromEntries(players.map((player) => [player.seat, player.actualCharacter])),
        seatAlignments: Object.fromEntries(players.map((player) => [player.seat, ["evilTwin", "fangGu"].includes(player.actualCharacter) ? "evil" : "good"])),
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
