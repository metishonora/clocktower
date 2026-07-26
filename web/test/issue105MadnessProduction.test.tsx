import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Command, GameEvent, GameFile, ReplayState, SetupPlayerInput } from "../src/core/types";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { proposeAndAppend, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";

test("an initial Mutant assignment does not pin outsider-madness before a violation", async () => {
  const storage = new MemoryGameStorageDriver(baseMadnessGame());
  const user = userEvent.setup();

  render(<SectsAndVioletsApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  await user.click(await screen.findByRole("button", { name: "마도서" }));
  await user.click(await screen.findByRole("button", { name: /1번 좌석, 민지, 변종/ }));
  expect(screen.queryByRole("listitem", { name: "외지인 집착 · 출처 변종" })).toBeNull();
});

test("opening a reminder panel closes the previously open day or madness panel", async () => {
  const storage = new MemoryGameStorageDriver(await firstDayMadnessGame());
  const user = userEvent.setup();

  render(<SectsAndVioletsApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  await user.click(await screen.findByRole("button", { name: /백치천재 행동 열기/ }));
  expect(screen.getByRole("dialog", { name: "백치천재 능력 사용" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: /변종 집착 확인 열기/ }));
  expect(screen.queryByRole("dialog", { name: "백치천재 능력 사용" })).toBeNull();
  expect(screen.getByRole("region", { name: /집착 확인/ })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: /백치천재 행동 열기/ }));
  expect(screen.queryByRole("region", { name: /집착 확인/ })).toBeNull();
  expect(screen.getByRole("dialog", { name: "백치천재 능력 사용" })).toBeTruthy();
});

test("the production UI keeps changeable Mutant and Cerenovus judgments outside event history", async () => {
  const game = await firstDayMadnessGame();
  const storage = new MemoryGameStorageDriver(game);
  const user = userEvent.setup();
  const initialEventCount = game.game.events.length;

  const view = render(<SectsAndVioletsApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  await user.click(await screen.findByRole("button", { name: /변종 집착 확인 열기/ }));
  await user.click(screen.getByRole("button", { name: "위반 없음" }));
  const mutantClear = await screen.findByRole<HTMLButtonElement>("button", { name: "위반 없음" });
  await waitFor(() => expect(mutantClear.disabled).toBe(true));
  await waitFor(() => expect(storage.savedGames.at(-1)?.ui?.sectsAndVioletsSession?.madnessJudgments)
    .toMatchObject({ "mutant:player-1:setup-1": "clear" }));
  expect(storage.savedGames.at(-1)?.game.events.length).toBe(initialEventCount);

  await user.click(screen.getByRole("button", { name: "외지인임을 집착함" }));
  await waitFor(() => expect(storage.savedGames.at(-1)?.ui?.sectsAndVioletsSession?.madnessJudgments)
    .toMatchObject({ "mutant:player-1:setup-1": "violation" }));
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "외지인임을 집착함" }).disabled).toBe(true);
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "위반 없음" }).disabled).toBe(false);
  expect(storage.savedGames.at(-1)?.game.events.length).toBe(initialEventCount);

  await user.click(screen.getByRole("button", { name: /변종 집착 확인 닫기/ }));
  await user.click(screen.getByRole("button", { name: /세레노버스 집착 확인 열기/ }));
  await user.click(screen.getByRole("button", { name: "충분히 집착함" }));
  const cerenovusClear = await screen.findByRole<HTMLButtonElement>("button", { name: "충분히 집착함" });
  await waitFor(() => expect(cerenovusClear.disabled).toBe(true));
  await waitFor(() => expect(Object.values(
    storage.savedGames.at(-1)?.ui?.sectsAndVioletsSession?.madnessJudgments ?? {},
  )).toContain("clear"));
  expect(storage.savedGames.at(-1)?.game.events.length).toBe(initialEventCount);

  const saved = storage.savedGames.at(-1);
  expect(saved).toBeTruthy();
  view.unmount();
  render(<SectsAndVioletsApp coreAdapter={realWasmCore()} storageDriver={new MemoryGameStorageDriver(saved)} />);

  await user.click(await screen.findByRole("button", { name: /변종 집착 확인 열기/ }));
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "외지인임을 집착함" }).disabled).toBe(true);
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "위반 없음" }).disabled).toBe(false);
});

test("the production UI records and settles a Mutant violation with separate execution and death confirmations", async () => {
  const game = await firstDayMadnessGame();
  const storage = new MemoryGameStorageDriver(game);
  const user = userEvent.setup();
  const initialEventCount = game.game.events.length;

  render(<SectsAndVioletsApp coreAdapter={realWasmCore()} storageDriver={storage} />);

  await user.click(await screen.findByRole("button", { name: /변종 집착 확인 열기, \[1번 민지\]/ }));
  expect(screen.getByRole("heading", { name: "변종" })).toBeTruthy();
  expect(screen.getByText("[1번 민지]이 외지인임을 주장하며 집착하였나요?")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "외지인임을 집착함" }));

  await waitFor(() => expect(storage.savedGames.at(-1)?.ui?.sectsAndVioletsSession?.madnessJudgments)
    .toMatchObject({ "mutant:player-1:setup-1": "violation" }));
  expect(storage.savedGames.at(-1)?.game.events.length).toBe(initialEventCount);
  await user.click(screen.getByRole("button", { name: "마도서" }));
  await user.click(screen.getByRole("button", { name: /1번 좌석, 민지, 변종/ }));
  expect(screen.getByRole("listitem", { name: "외지인 집착 · 출처 변종" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "플레이어 상세 닫기" }));
  await user.click(screen.getByRole("button", { name: /^진행$/ }));
  await user.click(screen.getByRole("button", { name: "[1번 민지] 처형" }));
  const dialog = screen.getByRole("alertdialog", { name: "[1번 민지] 처형 확인" });
  await user.click(within(dialog).getByRole("button", { name: "처형 확정" }));

  expect(await screen.findByRole("group", { name: "집착 위반 처형 사망 확인" })).toBeTruthy();
  expect(screen.getByText("1번 민지")).toBeTruthy();
  expect(storage.savedGames.at(-1)?.game.events.at(-1)?.type).toBe("madnessExecutionConfirmed");
  expect(storage.savedGames.at(-1)?.game.events.length).toBe(initialEventCount + 1);

  await user.click(screen.getByRole("button", { name: "사망 확인" }));
  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events.at(-1)).toMatchObject({
    type: "deathConfirmed",
    payload: { playerId: "player-1" },
  }));
  expect(await screen.findByRole("heading", { name: /2일차 밤/ })).toBeTruthy();
});

test("the production first-night UI assigns a clearly selected Cerenovus target and good character", async () => {
  const game = await cerenovusNightGame();
  const storage = new MemoryGameStorageDriver(game);
  const user = userEvent.setup();

  render(<SectsAndVioletsApp coreAdapter={realWasmCore()} storageDriver={storage} />);
  await user.click(await screen.findByRole("button", { name: "집착 지정" }));
  await user.click(screen.getByRole("button", { name: /2번 좌석, 현우, 화가/ }));
  await user.selectOptions(screen.getByRole("combobox", { name: "집착할 캐릭터" }), "clockmaker");
  await user.click(screen.getByRole("button", { name: "2번 현우 집착 지정" }));

  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events.at(-1)).toMatchObject({
    type: "madnessAssigned",
    payload: { sourcePlayerId: "player-6", targetPlayerId: "player-2", requiredCharacterId: "clockmaker" },
  }));

  const prompt = await screen.findByRole("dialog", { name: "집착 안내" });
  expect(within(prompt).getByText("2번 현우")).toBeTruthy();
  await user.click(within(prompt).getByRole("button", { name: "공개" }));

  const reveal = screen.getByRole("dialog", { name: "세레노버스 집착 공개" });
  expect(within(reveal).getByText("세레노버스가 당신을 선택했습니다.")).toBeTruthy();
  expect(within(reveal).getByRole("heading", { name: "내일 시계공이라고 집착해야 합니다." })).toBeTruthy();
  expect(within(reveal).getByRole("img", { name: "시계공" })).toBeTruthy();
  expect(within(reveal).queryByRole("heading", { name: "시계공" })).toBeNull();
  await user.click(within(reveal).getByRole("button", { name: "확인했다면 눈을 감으세요" }));
  expect(screen.queryByRole("dialog", { name: "세레노버스 집착 공개" })).toBeNull();
});

async function firstDayMadnessGame(): Promise<GameFile> {
  const game = baseMadnessGame();
  for (let attempts = 0; attempts < 48; attempts += 1) {
    const state = await replayOrThrow(game);
    if (state.phase === "day") return game;
    if (!state.currentStep) throw new Error("expected a first-night step");
    await appendStep(game, state);
  }
  throw new Error("did not reach the first day");
}

async function cerenovusNightGame(): Promise<GameFile> {
  const game = baseMadnessGame();
  for (let attempts = 0; attempts < 48; attempts += 1) {
    const state = await replayOrThrow(game);
    if (state.currentStep?.requiredInput.kind === "madnessAssignment") return game;
    if (!state.currentStep) throw new Error("expected a first-night step");
    await appendStep(game, state);
  }
  throw new Error("did not reach Cerenovus");
}

async function appendStep(game: GameFile, state: ReplayState) {
  if (!state.currentStep) throw new Error("expected a current step");
  const command = commandFor(state.currentStep);
  try {
    await proposeAndAppend(game, command);
  } catch (error) {
    throw new Error(`${state.currentStep.id} ${JSON.stringify(command)}: ${String(error)}`);
  }
}

function baseMadnessGame(): GameFile {
  const players: SetupPlayerInput[] = [
    player("player-1", 1, "민지", "mutant"),
    player("player-2", 2, "현우", "artist"),
    player("player-3", 3, "서준", "dreamer"),
    player("player-4", 4, "도윤", "seamstress"),
    player("player-5", 5, "유나", "savant"),
    player("player-6", 6, "하린", "cerenovus"),
    player("player-7", 7, "준호", "vortox"),
  ];
  const events: GameEvent[] = [{
    id: "setup-1",
    type: "setupConfirmed",
    phase: "setup",
    payload: { players },
    summary: "초기 설정 확정: 7명",
    createdAt: "2026-07-26T00:00:00.000Z",
  }];
  const selectedIds = players.map((entry) => entry.actualCharacter);
  return {
    schemaVersion: 3,
    game: {
      id: "issue-105-production-ui",
      name: "Issue 105 production UI",
      scriptId: "sectsAndViolets",
      createdAt: "2026-07-26T00:00:00.000Z",
      updatedAt: "2026-07-26T00:04:00.000Z",
      events,
    },
    ui: {
      sectsAndVioletsSession: {
        version: 1,
        activeTab: "play",
        savedAt: "2026-07-26T00:04:00.000Z",
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
}

function commandFor(step: NonNullable<ReplayState["currentStep"]>): Command {
  if (step.support === "manual") {
    return { type: "resolveManualStep", payload: { stepId: step.id, outcome: "handled" } };
  }
  if (step.requiredInput.kind === "madnessAssignment") {
    return { type: "confirmStep", payload: { stepId: step.id, input: { playerIds: ["player-2"], characterId: "artist" } } };
  }
  if (step.informationPrompt?.targetChecks?.length) {
    const check = step.informationPrompt?.targetChecks?.[0];
    if (!check) throw new Error("expected a target check");
    return { type: "confirmStep", payload: { stepId: step.id, input: { playerIds: check.targetPlayerIds }, deliveredResult: check.choices[0].result } };
  }
  if (step.informationPrompt?.computedResult) {
    return { type: "confirmStep", payload: { stepId: step.id, input: null, deliveredResult: step.informationPrompt.computedResult } };
  }
  return { type: "confirmStep", payload: { stepId: step.id, input: null } };
}

function player(id: string, seat: number, name: string, character: string): SetupPlayerInput {
  return { id, seat, name, actualCharacter: character, shownCharacter: character };
}
