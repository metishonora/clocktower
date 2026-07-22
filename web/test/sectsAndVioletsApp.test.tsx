import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import type { GameFile, SetupPlayerInput } from "../src/core/types";

const core = vi.hoisted(() => ({
  replay: vi.fn(async (gameFile: GameFile) => {
    const setupEvent = gameFile.game.events[0];
    const players = setupEvent?.type === "setupConfirmed"
      ? setupEvent.payload.players.map((player: SetupPlayerInput, index: number) => ({
          id: `player-${index + 1}`,
          ...player,
          shownCharacter: player.actualCharacter,
          alignment: ["evilTwin", "fangGu"].includes(player.actualCharacter) ? "evil" as const : "good" as const,
          alive: true,
          ghostVoteUsed: false,
          deathAnnounced: false,
          systemTokenIds: [],
          scriptTokens: [],
          notes: "",
        }))
      : [];
    const steps = [
      { id: "firstNight:minionInfo", phase: "firstNight" as const, stepType: "evilInfo" as const, support: "automated" as const },
      { id: "firstNight:demonInfo", phase: "firstNight" as const, stepType: "evilInfo" as const, support: "automated" as const },
      { id: "firstNight:snakeCharmer", phase: "firstNight" as const, stepType: "character" as const, support: "manual" as const, character: "snakeCharmer", playerId: "player-3" },
      { id: "firstNight:toDay", phase: "firstNight" as const, stepType: "phaseTransition" as const, support: "automated" as const },
      { id: "day:manual", phase: "day" as const, stepType: "discussion" as const, support: "manual" as const },
      { id: "night:snakeCharmer", phase: "night" as const, stepType: "character" as const, support: "manual" as const, character: "snakeCharmer", playerId: "player-3" },
    ];
    const step = setupEvent ? steps[gameFile.game.events.length - 1] : undefined;
    const currentStep = step ? {
      ...step,
      requiredInput: { kind: "none" as const, optional: false },
      canSkip: false,
    } : null;
    return {
      ok: true as const,
      value: {
        schemaVersion: 3 as const,
        scriptId: "sectsAndViolets" as const,
        eventCount: gameFile.game.events.length,
        phase: currentStep?.phase ?? (setupEvent ? "night" as const : "setup" as const),
        players,
        currentStep,
        phaseOverview: currentStep ? [{ ...currentStep, status: "current" as const }] : [],
        ruleState: { unannouncedNightDeathPlayerIds: [] },
        warnings: [],
        gameEnd: null,
      },
    };
  }),
  propose: vi.fn(async (_gameFile, command) => {
    const setup = command.type === "createGame";
    const manual = command.type === "resolveManualStep";
    return {
      ok: true as const,
      value: {
        event: setup ? {
          id: "setup-1",
          type: "setupConfirmed" as const,
          phase: "setup" as const,
          payload: command.payload,
          summary: "초기 설정 확정: 7명",
          createdAt: "2026-07-22T00:00:00.000Z",
        } : manual ? {
          id: "manual-2",
          type: "manualPhaseStepResolved" as const,
          phase: command.payload.stepId.startsWith("day:") ? "day" as const : command.payload.stepId.startsWith("night:") ? "night" as const : "firstNight" as const,
          payload: command.payload,
          summary: `수동 단계 처리: ${command.payload.stepId}`,
          createdAt: "2026-07-22T00:01:00.000Z",
        } : {
          id: "phase-2",
          type: "phaseStepConfirmed" as const,
          phase: "firstNight" as const,
          payload: { stepId: command.payload.stepId, input: null },
          summary: `단계 확정: ${command.payload.stepId}`,
          createdAt: "2026-07-22T00:01:00.000Z",
        },
        warnings: [],
        followUpSteps: [],
        preview: null,
      },
    };
  }),
  setupDistribution: vi.fn(async () => ({
    ok: true as const,
    value: { Townsfolk: 4, Outsider: 1, Minion: 1, Demon: 1 },
  })),
  setupDistributionSync: vi.fn(() => ({
    ok: true as const,
    value: { Townsfolk: 4, Outsider: 1, Minion: 1, Demon: 1 },
  })),
  suggestPhaseInput: vi.fn(),
}));

vi.mock("../src/core/wasmClient", () => ({ wasmCoreAdapter: core }));

beforeEach(() => {
  vi.clearAllMocks();
});

test("uses the approved setup, Grimoire, and progression shell on the production S&V route", async () => {
  render(<SectsAndVioletsApp />);

  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  expect(within(app).queryByText("준비 중")).toBeNull();
  const stages = within(app).getByRole("navigation", { name: "작업 단계" });
  expect(within(stages).getByRole("button", { name: "직업" })).toBeTruthy();
  expect(within(stages).getByRole("button", { name: "마도서" })).toBeTruthy();
  expect(within(stages).getByRole("button", { name: "진행" })).toBeTruthy();
  const utilities = within(app).getByRole("navigation", { name: "게임 데이터" });
  expect(within(utilities).getByRole("button", { name: "새 게임" })).toBeTruthy();
  expect(within(utilities).getByRole("button", { name: "저장 / 불러오기" })).toBeTruthy();
  await waitFor(() => expect(core.setupDistribution).toHaveBeenCalledWith({
    scriptId: "sectsAndViolets",
    playerCount: 7,
    actualCharacters: ["fangGu"],
  }));
});

test("confirms the assigned production roster through the canonical S&V createGame command", async () => {
  const user = userEvent.setup();
  render(<SectsAndVioletsApp />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  for (const character of ["시계공", "꿈꾸는 자", "뱀 조련사", "수학자", "변종", "사악한 쌍둥이"]) {
    await user.click(within(app).getByRole("button", { name: character }));
  }
  await user.click(within(app).getByRole("button", { name: "직업 선택 확정" }));
  await user.click(within(app).getByRole("button", { name: "무작위 배치" }));
  await user.click(within(app).getByRole("button", { name: "배치 확정" }));

  expect(core.propose).toHaveBeenCalledWith(
    expect.objectContaining({ game: expect.objectContaining({ scriptId: "sectsAndViolets" }) }),
    {
      type: "createGame",
      payload: {
        players: expect.arrayContaining([
          expect.objectContaining({ seat: 1, name: "플레이어 1", actualCharacter: expect.any(String) }),
        ]),
      },
    },
  );
});

test("keeps the seating draft intact when canonical setup confirmation fails", async () => {
  const user = userEvent.setup();
  render(<SectsAndVioletsApp />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  for (const character of ["시계공", "꿈꾸는 자", "뱀 조련사", "수학자", "변종", "사악한 쌍둥이"]) {
    await user.click(within(app).getByRole("button", { name: character }));
  }
  await user.click(within(app).getByRole("button", { name: "직업 선택 확정" }));
  await user.click(within(app).getByRole("button", { name: "무작위 배치" }));
  core.propose.mockRejectedValueOnce(new Error("구성을 다시 확인하세요"));
  await user.click(within(app).getByRole("button", { name: "배치 확정" }));

  expect((await within(app).findByRole("alert")).textContent).toContain("구성을 다시 확인하세요");
  expect(within(app).getByLabelText("7자리 그리모어")).toBeTruthy();
  expect(within(app).queryAllByRole("button", { name: /미할당/ })).toHaveLength(0);
  expect(within(app).getByRole("button", { name: "배치 확정" }).hasAttribute("disabled")).toBe(false);
});

test("advances the production first-night step through the canonical phase command", async () => {
  const user = userEvent.setup();
  render(<SectsAndVioletsApp />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  for (const character of ["시계공", "꿈꾸는 자", "뱀 조련사", "수학자", "변종", "사악한 쌍둥이"]) {
    await user.click(within(app).getByRole("button", { name: character }));
  }
  await user.click(within(app).getByRole("button", { name: "직업 선택 확정" }));
  await user.click(within(app).getByRole("button", { name: "무작위 배치" }));
  await user.click(within(app).getByRole("button", { name: "배치 확정" }));
  await user.click(within(app).getByRole("button", { name: "진행" }));

  expect(await within(app).findByRole("heading", { name: "하수인 정보" })).toBeTruthy();
  await user.click(within(app).getByRole("button", { name: "다음 단계" }));
  expect(core.propose).toHaveBeenLastCalledWith(
    expect.objectContaining({ game: expect.objectContaining({ scriptId: "sectsAndViolets" }) }),
    { type: "confirmStep", payload: { stepId: "firstNight:minionInfo", input: null } },
  );
  expect(await within(app).findByRole("heading", { name: "악마 정보" })).toBeTruthy();
});

test("records manual work and follows the canonical first-night to day boundary", async () => {
  const user = userEvent.setup();
  render(<SectsAndVioletsApp />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  for (const character of ["시계공", "꿈꾸는 자", "뱀 조련사", "수학자", "변종", "사악한 쌍둥이"]) {
    await user.click(within(app).getByRole("button", { name: character }));
  }
  await user.click(within(app).getByRole("button", { name: "직업 선택 확정" }));
  await user.click(within(app).getByRole("button", { name: "무작위 배치" }));
  await user.click(within(app).getByRole("button", { name: "배치 확정" }));
  await user.click(within(app).getByRole("button", { name: "진행" }));

  await user.click(within(app).getByRole("button", { name: "다음 단계" }));
  await user.click(within(app).getByRole("button", { name: "다음 단계" }));
  expect(await within(app).findByRole("heading", { name: "뱀 조련사" })).toBeTruthy();
  await user.click(within(app).getByRole("button", { name: "마도서" }));
  expect(within(app).getByRole("button", { name: /3번 좌석.*현재 행동자/ })).toBeTruthy();
  await user.click(within(app).getByRole("button", { name: "진행" }));
  await user.click(within(app).getByRole("button", { name: "처리 완료" }));
  expect(core.propose).toHaveBeenLastCalledWith(
    expect.anything(),
    { type: "resolveManualStep", payload: { stepId: "firstNight:snakeCharmer", outcome: "handled" } },
  );

  expect(await within(app).findByRole("heading", { name: "1일차 밤 종료" })).toBeTruthy();
  await user.click(within(app).getByRole("button", { name: "낮으로" }));
  expect(await within(app).findByRole("heading", { name: "2일차 낮" })).toBeTruthy();
});

test("starts a production new game with fresh canonical history", async () => {
  const user = userEvent.setup();
  render(<SectsAndVioletsApp />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  for (const character of ["시계공", "꿈꾸는 자", "뱀 조련사", "수학자", "변종", "사악한 쌍둥이"]) {
    await user.click(within(app).getByRole("button", { name: character }));
  }
  await user.click(within(app).getByRole("button", { name: "직업 선택 확정" }));
  await user.click(within(app).getByRole("button", { name: "무작위 배치" }));
  await user.click(within(app).getByRole("button", { name: "배치 확정" }));

  await user.click(within(app).getByRole("button", { name: "새 게임" }));
  await user.click(within(screen.getByRole("dialog", { name: "새 게임 시작 확인" })).getByRole("button", { name: "새 게임 시작" }));

  await waitFor(() => expect(core.replay.mock.calls.at(-1)?.[0].game.events).toEqual([]));
  expect(within(app).getByRole("button", { name: "마도서" }).hasAttribute("disabled")).toBe(true);
});
