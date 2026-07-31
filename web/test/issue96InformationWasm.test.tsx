import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { GameEvent, GameFile, SetupPlayerInput } from "../src/core/types";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { importGameFileJson } from "../src/gameStorage";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { proposeAndAppend, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

test("real WASM repeats Clockmaker information until explicit next-step progression", async () => {
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

  const confirmedTask = await within(app).findByRole("article", { name: "시계공 정보" });
  await user.click(within(confirmedTask).getByRole("button", { name: "정보 공개" }));
  reveal = await screen.findByRole("dialog", { name: "시계공 정보 공개" });
  expect(within(reveal).getByText("1칸")).toBeTruthy();
  await user.click(within(reveal).getByRole("button", { name: "정보 공개 닫기" }));

  await user.click(within(confirmedTask).getByRole("button", { name: "다음 단계" }));
  expect(await within(app).findByRole("heading", { name: "꿈꾸는 자" })).toBeTruthy();
  expect(within(app).queryByRole("button", { name: "다음" })).toBeNull();
});

test("real WASM accepts an obviously false Vortox number and restores the prompt after undo", async () => {
  const game = clockmakerGame();
  const setup = game.game.events[0];
  if (setup?.type !== "setupConfirmed") throw new Error("expected setup");
  setup.payload.players[6] = {
    ...setup.payload.players[6]!,
    actualCharacter: "vortox",
    shownCharacter: "vortox",
  };
  for (let index = 0; index < 2; index += 1) {
    const state = await replayOrThrow(game);
    await proposeAndAppend(game, {
      type: "confirmStep",
      payload: { stepId: state.currentStep!.id, input: null },
    });
  }

  const prompt = (await replayOrThrow(game)).currentStep?.informationPrompt;
  expect(prompt?.numberConstraint).toEqual({
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    excludedValues: [1],
  });
  const proposal = await proposeAndAppend(game, {
    type: "confirmStep",
    payload: {
      stepId: "firstNight:clockmaker",
      input: null,
      deliveredResult: { kind: "number", value: 100 },
    },
  });
  expect(proposal.event.type).toBe("phaseStepConfirmed");
  if (proposal.event.type !== "phaseStepConfirmed") throw new Error("expected phase event");
  expect(proposal.event.payload.information?.deliveredResult).toEqual({ kind: "number", value: 100 });
  expect(proposal.revealPayload).toEqual({
    kind: "numericInformation",
    characterId: "clockmaker",
    value: 100,
  });

  game.game.events.pop();
  const undone = await replayOrThrow(game);
  expect(undone.currentStep?.id).toBe("firstNight:clockmaker");
  expect(undone.currentStep?.informationPrompt?.numberConstraint?.excludedValues).toEqual([1]);
});

test("real WASM keeps Dreamer targets available for repeated information reveals", async () => {
  const fixturePath = resolve(process.cwd(), "../fixtures/acceptance/sects-and-violets/issue-98-dreamer.json");
  const game = importGameFileJson(readFileSync(fixturePath, "utf8"), "sectsAndViolets");
  game.game.events.pop();
  game.ui = targetedInformationLiveSession();
  const user = userEvent.setup();
  render(
    <SectsAndVioletsApp
      coreAdapter={realWasmCore()}
      storageDriver={new MemoryGameStorageDriver(game)}
    />,
  );

  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  await user.click(await within(app).findByRole("button", { name: "대상 선택" }));
  await user.click(await within(app).findByRole("button", { name: /2번 좌석.*Seamstress/ }));
  await user.click(within(app).getByRole("button", { name: "선택 확정" }));

  let task = await within(app).findByRole("article", { name: "꿈꾸는 자 정보" });
  expect(within(task).getByRole("group", { name: "대상과 진실" }).textContent).toContain("2번 Seamstress");
  await user.click(within(task).getByRole("button", { name: "정보 공개" }));
  let reveal = await screen.findByRole("dialog", { name: "꿈꾸는 자 정보 공개" });
  await user.click(within(reveal).getByRole("button", { name: "정보 공개 닫기" }));

  task = await within(app).findByRole("article", { name: "꿈꾸는 자 정보" });
  expect(within(task).getByRole("group", { name: "대상과 진실" }).textContent).toContain("2번 Seamstress");
  expect(within(within(app).getByRole("list", { name: "첫날 밤 순서" })).getAllByText("현재")).toHaveLength(1);
  await user.click(within(task).getByRole("button", { name: "정보 공개" }));
  reveal = await screen.findByRole("dialog", { name: "꿈꾸는 자 정보 공개" });
  await user.click(within(reveal).getByRole("button", { name: "정보 공개 닫기" }));

  await user.click(within(task).getByRole("button", { name: "다음 단계" }));
  expect(await within(app).findByRole("heading", { name: "재봉사" })).toBeTruthy();
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

function targetedInformationLiveSession(): NonNullable<GameFile["ui"]> {
  const ids = ["dreamer", "seamstress", "sage", "clockmaker", "oracle", "evilTwin", "fangGu"];
  const names = ["Dreamer", "Seamstress", "Sage", "Clockmaker", "Oracle", "Evil Twin", "Fang Gu"];
  return {
    sectsAndVioletsSession: {
      version: 1,
      activeTab: "play",
      savedAt: "2026-07-25T00:00:00.000Z",
      setup: {
        playerCount: 7,
        demon: "fangGu",
        selectedIds: ids,
        seatAssignments: Object.fromEntries(ids.map((id, index) => [index + 1, id])),
        seatAlignments: Object.fromEntries(ids.map((_id, index) => [index + 1, index >= 5 ? "evil" : "good"])),
        seatNames: Object.fromEntries(names.map((name, index) => [index + 1, name])),
        rosterConfirmed: true,
        seatingConfirmed: true,
      },
      phaseCheckpoints: [],
    },
  };
}
