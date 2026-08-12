import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import type { GameEvent, GameFile, SetupPlayerInput } from "../src/core/types";
import { ClocktowerApp } from "../src/main";
import { MemoryGameStorageDriver } from "./clocktowerAppHarness";
import { phaseEvent, proposeAndAppend, realWasmCore, replayOrThrow } from "./realWasmCoreHarness";
import { confirmLivePlayerSelection, selectLivePlayers } from "./livePlayTestHelpers";

const players = {
  undertaker: "player-1",
  executed: "player-2",
  victim: "player-3",
  poisoner: "player-4",
  imp: "player-5",
} as const;

describe("issue #69 Undertaker progression after an Imp kill", () => {
  test("keeps the night-death warning visible while the real WASM Undertaker Proposal and Reveal advance once", async () => {
    const game = await gameAtNight({ victimCharacter: "washerwoman", execute: true });
    const beforeAttackCount = game.game.events.length;
    const storage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "임프: 5번 Imp" });
    await confirmLivePlayerSelection(user, /Night Victim/);

    expect((await screen.findAllByText("공개하지 않은 밤 사망이 있습니다.")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("heading", { name: "장의사: 1번 Undertaker" })).toBeTruthy();
    await expectSavedEventCount(storage, beforeAttackCount + 1);
    expect(screen.queryByText("코어 응답 형식이 올바르지 않습니다.")).toBeNull();
    expect(screen.queryByText("WASM_LOAD_FAILED")).toBeNull();

    await user.click(screen.getByRole("button", { name: "정보 공개" }));
    let reveal = await screen.findByLabelText("플레이어 공개 화면");
    await expectSavedEventCount(storage, beforeAttackCount + 2);
    const undertakerEvent = storage.savedGames.at(-1)?.game.events.at(-1);
    expect(undertakerEvent?.type).toBe("phaseStepConfirmed");
    if (undertakerEvent?.type === "phaseStepConfirmed") {
      expect(undertakerEvent.payload.information?.targetPlayerIds).toEqual([players.executed]);
      expect(undertakerEvent.payload.information?.deliveredResult).toEqual({ kind: "character", characterId: "chef" });
    }

    expect(within(within(reveal).getByLabelText("확인 대상")).getByText("2번 Executed Chef")).toBeTruthy();
    expect(within(reveal).queryByText("Night Victim")).toBeNull();
    expect(within(reveal).getByText("요리사")).toBeTruthy();
    await user.click(within(reveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));

    let informationTask = await screen.findByRole("region", { name: "장의사 정보" });
    expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
    expect(within(informationTask).getByRole("button", { name: "정보 공개" })).toBeTruthy();
    await user.click(within(informationTask).getByRole("button", { name: "정보 공개" }));
    reveal = await screen.findByLabelText("플레이어 공개 화면");
    await user.click(within(reveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
    await expectSavedEventCount(storage, beforeAttackCount + 2);

    informationTask = await screen.findByRole("region", { name: "장의사 정보" });
    expect(within(informationTask).getByRole("button", { name: "다음 단계" })).toBeTruthy();
    await user.click(within(informationTask).getByRole("button", { name: "다음 단계" }));
    expect(await screen.findByRole("heading", { name: "낮 시작" })).toBeTruthy();
    await expectSavedEventCount(storage, beforeAttackCount + 2);
    expect(screen.queryByText("코어 응답 형식이 올바르지 않습니다.")).toBeNull();
  });

  test("runs a real Ravenkeeper Reveal before the eligible Undertaker", async () => {
    const game = await gameAtNight({ victimCharacter: "ravenkeeper", execute: true });
    const beforeAttackCount = game.game.events.length;
    const storage = new MemoryGameStorageDriver(game);
    const user = userEvent.setup();

    render(<ClocktowerApp coreAdapter={realWasmCore()} storageDriver={storage} />);

    await screen.findByRole("heading", { name: "임프: 5번 Imp" });
    await confirmLivePlayerSelection(user, /Night Victim/);

    expect(await screen.findByRole("heading", { name: "까마귀지기: 3번 Night Victim" })).toBeTruthy();
    await expectSavedEventCount(storage, beforeAttackCount + 1);
    expect(screen.getAllByText("공개하지 않은 밤 사망이 있습니다.").length).toBeGreaterThan(0);
    await selectLivePlayers(user, /Imp/);
    await user.click(screen.getByRole("button", { name: "정보 공개" }));

    let reveal = await screen.findByLabelText("플레이어 공개 화면");
    await expectSavedEventCount(storage, beforeAttackCount + 2);
    expect(within(within(reveal).getByLabelText("확인 대상")).getByText("5번 Imp")).toBeTruthy();
    expect(within(reveal).getByText("임프")).toBeTruthy();
    await user.click(within(reveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
    let informationTask = await screen.findByRole("region", { name: "까마귀지기 정보" });
    expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
    expect(within(informationTask).getByRole("button", { name: "다음 단계" })).toBeTruthy();
    await user.click(within(informationTask).getByRole("button", { name: "다음 단계" }));

    expect(await screen.findByRole("heading", { name: "장의사: 1번 Undertaker" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "정보 공개" }));
    await expectSavedEventCount(storage, beforeAttackCount + 3);
    reveal = await screen.findByLabelText("플레이어 공개 화면");
    expect(within(within(reveal).getByLabelText("확인 대상")).getByText("2번 Executed Chef")).toBeTruthy();
    expect(within(reveal).queryByText("Night Victim")).toBeNull();
    await user.click(within(reveal).getByRole("button", { name: "확인했으면 눈을 감으세요" }));
    informationTask = await screen.findByRole("region", { name: "장의사 정보" });
    expect(screen.queryByLabelText("확정된 Reveal 후속 조치")).toBeNull();
    expect(within(informationTask).getByRole("button", { name: "다음 단계" })).toBeTruthy();
    await user.click(within(informationTask).getByRole("button", { name: "다음 단계" }));
    expect(await screen.findByRole("heading", { name: "낮 시작" })).toBeTruthy();
    await expectSavedEventCount(storage, beforeAttackCount + 3);
    expect(screen.queryByText("코어 응답 형식이 올바르지 않습니다.")).toBeNull();
    expect(screen.queryByText("WASM_LOAD_FAILED")).toBeNull();
  });

  test("does not create an Undertaker step when the previous day had no execution death", async () => {
    const game = await gameAtNight({ victimCharacter: "washerwoman", execute: false });
    const beforeAttack = await replayOrThrow(game);
    expect(beforeAttack.currentStep?.id).toBe("night:imp");

    await proposeAndAppend(game, {
      type: "confirmStep",
      payload: { stepId: "night:imp", input: { playerIds: [players.victim] } },
    });
    const afterAttack = await replayOrThrow(game);

    expect(afterAttack.ruleState.unannouncedNightDeathPlayerIds).toEqual([players.victim]);
    expect(afterAttack.phaseOverview.some((step) => step.id === "night:undertaker")).toBe(false);
    expect(afterAttack.currentStep?.id).toBe("night:toDay");
  });
});

async function gameAtNight({ victimCharacter, execute }: { victimCharacter: "washerwoman" | "ravenkeeper"; execute: boolean }): Promise<GameFile> {
  const roster: SetupPlayerInput[] = [
    { id: players.undertaker, seat: 1, name: "Undertaker", actualCharacter: "undertaker", shownCharacter: "undertaker" },
    { id: players.executed, seat: 2, name: "Executed Chef", actualCharacter: "chef", shownCharacter: "chef" },
    { id: players.victim, seat: 3, name: "Night Victim", actualCharacter: victimCharacter, shownCharacter: victimCharacter },
    { id: players.poisoner, seat: 4, name: "Poisoner", actualCharacter: "poisoner", shownCharacter: "poisoner" },
    { id: players.imp, seat: 5, name: "Imp", actualCharacter: "imp", shownCharacter: "imp" },
  ];
  const events: GameEvent[] = [
    {
      id: "seed-setup",
      type: "setupConfirmed",
      phase: "setup",
      payload: { players: roster },
      summary: "초기 설정 확정",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    phaseEvent("phaseStepConfirmed", "firstNight:minionInfo"),
    phaseEvent("phaseStepConfirmed", "firstNight:demonInfo"),
  ];
  const game: GameFile = {
    schemaVersion: 3,
    game: {
      scriptId: "troubleBrewing",
      id: "issue-69",
      name: "Issue 69 regression",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      events,
    },
  };

  for (let eventCount = 1; eventCount <= events.length; eventCount += 1) {
    const probe = structuredClone(game);
    probe.game.events = probe.game.events.slice(0, eventCount);
    const result = await realWasmCore().replay(probe);
    if (!result.ok) {
      throw new Error(`seed failed after ${events[eventCount - 1]?.id}: ${result.error.code} ${result.error.messageKo}`);
    }
  }

  await expectStep(game, "firstNight:poisoner");
  await proposeAndAppend(game, { type: "skipStep", payload: { stepId: "firstNight:poisoner", input: null } });
  if (victimCharacter === "washerwoman") {
    await expectStep(game, "firstNight:washerwoman");
    await proposeAndAppend(game, {
      type: "confirmStep",
      payload: {
        stepId: "firstNight:washerwoman",
        input: { playerIds: [players.executed, players.victim], characterId: "chef" },
      },
    });
  }
  await expectStep(game, "firstNight:chef");
  await proposeAndAppend(game, { type: "confirmStep", payload: { stepId: "firstNight:chef", input: null } });
  await expectStep(game, "firstNight:toDay");
  await proposeAndAppend(game, { type: "confirmStep", payload: { stepId: "firstNight:toDay", input: null } });
  for (const stepId of ["day:announceDeaths", "day:whisper", "day:discussion"]) {
    await expectStep(game, stepId);
    await proposeAndAppend(game, { type: "confirmStep", payload: { stepId, input: null } });
  }

  if (execute) {
    await expectStep(game, "day:nomination:1");
    await proposeAndAppend(game, {
      type: "confirmStep",
      payload: { stepId: "day:nomination:1", input: { nominatorId: players.undertaker, nomineeId: players.executed } },
    });
    await expectStep(game, "day:nomination:1:vote");
    await proposeAndAppend(game, {
      type: "confirmStep",
      payload: { stepId: "day:nomination:1:vote", input: { voterIds: [players.undertaker, players.executed, players.victim] } },
    });
    await expectStep(game, "day:nomination:2");
    await proposeAndAppend(game, { type: "skipStep", payload: { stepId: "day:nomination:2", input: null } });
    await expectStep(game, "day:execution");
    await proposeAndAppend(game, { type: "confirmStep", payload: { stepId: "day:execution", input: { execute: true } } });
    await expectStep(game, "day:executionDeath");
    await proposeAndAppend(game, { type: "confirmStep", payload: { stepId: "day:executionDeath", input: { died: true } } });
  } else {
    await expectStep(game, "day:nomination:1");
    await proposeAndAppend(game, { type: "skipStep", payload: { stepId: "day:nomination:1", input: null } });
    await expectStep(game, "day:execution");
    await proposeAndAppend(game, { type: "confirmStep", payload: { stepId: "day:execution", input: { execute: false } } });
  }
  await expectStep(game, "day:toNight");
  await proposeAndAppend(game, { type: "confirmStep", payload: { stepId: "day:toNight", input: null } });
  await expectStep(game, "night:poisoner");
  await proposeAndAppend(game, { type: "skipStep", payload: { stepId: "night:poisoner", input: null } });
  await expectStep(game, "night:imp");
  return game;
}

async function expectStep(game: GameFile, stepId: string) {
  const replay = await replayOrThrow(game);
  expect(replay.currentStep?.id).toBe(stepId);
}

async function expectSavedEventCount(storage: MemoryGameStorageDriver, count: number) {
  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events).toHaveLength(count));
}
