import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { SectsAndVioletsApp } from "../src/sectsAndVioletsApp";
import type { GameFile, ReplayState, SetupPlayerInput } from "../src/core/types";
import type { GameStorageDriver } from "../src/gameStorage";

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

test("shows the canonical nomination standing and sends the Storyteller to the Grimoire", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const players = Array.from({ length: 7 }, (_, index) => ({
    id: `player-${index + 1}`,
    seat: index + 1,
    name: ["가람", "나래", "다온", "라온", "마루", "바다", "사라"][index],
    actualCharacter: ["clockmaker", "dreamer", "snakeCharmer", "mathematician", "mutant", "evilTwin", "fangGu"][index],
    shownCharacter: ["clockmaker", "dreamer", "snakeCharmer", "mathematician", "mutant", "evilTwin", "fangGu"][index],
    alignment: index >= 5 ? "evil" as const : "good" as const,
    alive: index !== 1,
    ghostVoteUsed: index === 1,
    deathAnnounced: index === 1,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  }));
  const currentStep = {
    id: "day:nomination:2",
    phase: "day" as const,
    stepType: "nomination" as const,
    requiredInput: { kind: "nomination" as const, target: "players" as const, optional: true },
    canSkip: true,
    support: "automated" as const,
  };
  const replayState = {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 8,
    phase: "day",
    players,
    currentStep,
    phaseOverview: [{ ...currentStep, status: "current" }],
    dayState: {
      nominations: [{
        stepId: "day:nomination:1",
        nominatorId: "player-1",
        nomineeId: "player-7",
        voterIds: ["player-1", "player-3", "player-4", "player-5"],
        voteCount: 4,
        ghostVoteSpentPlayerIds: [],
      }],
      eligibleNominatorIds: ["player-3", "player-4", "player-5", "player-6", "player-7"],
      eligibleNomineeIds: ["player-1", "player-2", "player-3", "player-4", "player-5", "player-6"],
      executionVoteThreshold: 3,
      highestVoteCount: 4,
      executionCandidate: { nomineeId: "player-7", voteCount: 4 },
    },
    ruleState: { unannouncedNightDeathPlayerIds: [] },
    warnings: [],
    gameEnd: null,
  } satisfies ReplayState;
  core.replay
    .mockResolvedValueOnce({ ok: true, value: replayState } as never)
    .mockResolvedValueOnce({ ok: true, value: replayState } as never)
    .mockResolvedValueOnce({ ok: true, value: replayState } as never)
    .mockResolvedValueOnce({ ok: true, value: replayState } as never);
  storage.savedGames.push(savedDayGame(players.map(({ seat, name, actualCharacter, shownCharacter }) => ({
    seat,
    name,
    actualCharacter,
    shownCharacter,
  }))));
  const initialEventCount = storage.savedGames[0].game.events.length;

  const user = userEvent.setup();
  render(<SectsAndVioletsApp storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  expect(await within(app).findByRole("heading", { name: "지명 및 투표" })).toBeTruthy();
  expect(within(app).getByText("사라")).toBeTruthy();
  expect(within(app).getByText("4표")).toBeTruthy();
  await user.click(within(app).getByRole("button", { name: "← 지명하기" }));
  expect(within(app).getByLabelText("7자리 그리모어")).toBeTruthy();
  await user.click(within(app).getByRole("button", { name: /3번 좌석/ }));
  await user.click(within(app).getByRole("button", { name: /3번 좌석.*지명자/ }));
  await user.click(within(app).getByRole("button", { name: "3번 → 3번 지명 확정" }));
  expect(core.propose).toHaveBeenLastCalledWith(
    expect.anything(),
    {
      type: "confirmStep",
      payload: {
        stepId: "day:nomination:2",
        input: { nominatorId: "player-3", nomineeId: "player-3" },
      },
    },
  );
  expect(within(app).getByRole("button", { name: "투표 취소 →" })).toBeTruthy();
  await user.click(within(app).getByRole("button", { name: "투표 취소 →" }));
  await waitFor(() => expect(core.replay.mock.calls.at(-1)?.[0].game.events).toHaveLength(initialEventCount));
  expect(within(app).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page");
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

test("autosaves a meaningful S&V setup choice and reports the completed time", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const user = userEvent.setup();

  render(<SectsAndVioletsApp storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  await user.click(within(app).getByRole("button", { name: "9명" }));

  await waitFor(() => expect(storage.savedGames).toHaveLength(1));
  expect(storage.savedGames[0]).toMatchObject({
    schemaVersion: 3,
    game: { scriptId: "sectsAndViolets", events: [] },
    ui: {
      sectsAndVioletsSession: {
        version: 1,
        activeTab: "roles",
        setup: { playerCount: 9, demon: "fangGu", selectedIds: ["fangGu"] },
      },
    },
  });
  expect(within(app).getByRole("status").textContent).toMatch(/^자동 저장 완료 \d{2}:\d{2}:\d{2}$/);
});

test("waits for stored S&V recovery before accepting a new setup choice", async () => {
  let finishLoad: ((gameFile: GameFile | undefined) => void) | undefined;
  const storage: GameStorageDriver = {
    loadLatestGame: () => new Promise((resolve) => { finishLoad = resolve; }),
    saveLatestGame: vi.fn(),
  };

  render(<SectsAndVioletsApp storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  const ninePlayers = within(app).getByRole("button", { name: "9명" });

  expect(ninePlayers.hasAttribute("disabled")).toBe(true);
  finishLoad?.(undefined);
  await waitFor(() => expect(ninePlayers.hasAttribute("disabled")).toBe(false));
});

test("restores the page captured by the last meaningful input without saving navigation alone", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const user = userEvent.setup();
  const first = render(<SectsAndVioletsApp storageDriver={storage} />);
  let app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  await user.click(within(app).getByRole("button", { name: "9명" }));
  await waitFor(() => expect(storage.savedGames).toHaveLength(1));
  await user.click(within(app).getByRole("button", { name: "저장 / 불러오기" }));
  expect(within(app).getByRole("button", { name: "저장 / 불러오기" }).getAttribute("aria-current")).toBe("page");
  await new Promise((resolve) => window.setTimeout(resolve, 20));
  expect(storage.saveAttempts).toBe(1);

  first.unmount();
  render(<SectsAndVioletsApp storageDriver={storage} />);
  app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  await waitFor(() => expect(within(app).getByRole("button", { name: "9명" }).getAttribute("aria-pressed")).toBe("true"));
  expect(within(app).getByRole("button", { name: "직업" }).getAttribute("aria-current")).toBe("page");
  expect(storage.saveAttempts).toBe(1);
});

test("does not retry a failed autosave until the next meaningful input", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  storage.failNextSave = true;
  const user = userEvent.setup();
  render(<SectsAndVioletsApp storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  await user.click(within(app).getByRole("button", { name: "9명" }));
  await waitFor(() => expect(within(app).getByRole("status").textContent).toBe("자동 저장 실패"));
  await new Promise((resolve) => window.setTimeout(resolve, 20));
  expect(storage.saveAttempts).toBe(1);
  expect(storage.savedGames).toHaveLength(0);

  await user.click(within(app).getByRole("button", { name: "8명" }));
  await waitFor(() => expect(storage.savedGames).toHaveLength(1));
  expect(storage.saveAttempts).toBe(2);
  expect(storage.savedGames[0]?.ui?.sectsAndVioletsSession?.setup.playerCount).toBe(8);
  expect(within(app).getByRole("status").textContent).toMatch(/^자동 저장 완료 \d{2}:\d{2}:\d{2}$/);
});

test("undoes one completed S&V phase checkpoint while keeping the current page", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const user = userEvent.setup();
  render(<SectsAndVioletsApp storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  await completeSevenPlayerSetup(user, app);
  await user.click(within(app).getByRole("button", { name: "진행" }));
  await user.click(await within(app).findByRole("button", { name: "다음 단계" }));
  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events).toHaveLength(2));

  await user.click(within(app).getByRole("button", { name: "저장 / 불러오기" }));
  const storagePage = within(app).getByRole("region", { name: "저장 및 불러오기" });
  const undo = within(storagePage).getByRole("button", { name: "최근 페이즈 되돌리기" });
  const savesBeforeCancel = storage.saveAttempts;
  await user.click(undo);
  let dialog = screen.getByRole("dialog", { name: "최근 페이즈 되돌리기" });
  expect(within(dialog).getByText(/단계 확정: firstNight:minionInfo/)).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "취소" }));
  expect(storage.saveAttempts).toBe(savesBeforeCancel);
  expect(storage.savedGames.at(-1)?.game.events).toHaveLength(2);

  await user.click(within(storagePage).getByRole("button", { name: "최근 페이즈 되돌리기" }));
  dialog = screen.getByRole("dialog", { name: "최근 페이즈 되돌리기" });
  await user.click(within(dialog).getByRole("button", { name: "되돌리기" }));

  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events).toHaveLength(1));
  expect(within(app).getByRole("button", { name: "저장 / 불러오기" }).getAttribute("aria-current")).toBe("page");
});

test("imports a replay-valid S&V checkpoint and restores its saved page", async () => {
  const sourceStorage = new MemorySectsAndVioletsStorageDriver();
  const user = userEvent.setup();
  const source = render(<SectsAndVioletsApp storageDriver={sourceStorage} />);
  let app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  await completeSevenPlayerSetup(user, app);
  await user.click(within(app).getByRole("button", { name: "진행" }));
  await user.click(await within(app).findByRole("button", { name: "다음 단계" }));
  await waitFor(() => expect(sourceStorage.savedGames.at(-1)?.game.events).toHaveLength(2));
  const exported = sourceStorage.savedGames.at(-1)!;
  expect(exported.ui?.sectsAndVioletsSession?.activeTab).toBe("play");
  source.unmount();

  const targetStorage = new MemorySectsAndVioletsStorageDriver();
  const target = render(<SectsAndVioletsApp storageDriver={targetStorage} />);
  app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  await user.click(within(app).getByRole("button", { name: "저장 / 불러오기" }));
  const input = target.container.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  await user.upload(input!, new File([JSON.stringify(exported)], "sv.json", { type: "application/json" }));

  await waitFor(() => expect(within(app).getByRole("button", { name: "진행" }).getAttribute("aria-current")).toBe("page"));
  expect(targetStorage.savedGames.at(-1)?.game.events).toHaveLength(2);
  expect(targetStorage.savedGames.at(-1)?.ui?.sectsAndVioletsSession?.activeTab).toBe("play");
});

test("replaces autosave with a fresh baseline only after new-game confirmation", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const user = userEvent.setup();
  render(<SectsAndVioletsApp storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  await completeSevenPlayerSetup(user, app);
  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events).toHaveLength(1));

  await user.click(within(app).getByRole("button", { name: "새 게임" }));
  let dialog = screen.getByRole("dialog", { name: "새 게임 시작 확인" });
  const attemptsBeforeCancel = storage.saveAttempts;
  await user.click(within(dialog).getByRole("button", { name: "취소" }));
  expect(storage.saveAttempts).toBe(attemptsBeforeCancel);
  expect(storage.savedGames.at(-1)?.game.events).toHaveLength(1);

  await user.click(within(app).getByRole("button", { name: "새 게임" }));
  dialog = screen.getByRole("dialog", { name: "새 게임 시작 확인" });
  await user.click(within(dialog).getByRole("button", { name: "새 게임 시작" }));
  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events).toHaveLength(0));
  expect(storage.savedGames.at(-1)?.ui?.sectsAndVioletsSession).toMatchObject({
    activeTab: "roles",
    setup: {
      playerCount: 7,
      demon: "fangGu",
      selectedIds: ["fangGu"],
      rosterConfirmed: false,
      seatingConfirmed: false,
    },
  });
});

test("returns to the preserved roster and seating with progress removed", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const user = userEvent.setup();
  render(<SectsAndVioletsApp storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  await completeSevenPlayerSetup(user, app);
  await user.click(within(app).getByRole("button", { name: "진행" }));
  await user.click(await within(app).findByRole("button", { name: "다음 단계" }));
  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events).toHaveLength(2));
  await user.click(within(app).getByRole("button", { name: "마도서" }));

  await user.click(within(app).getByRole("button", { name: "배치로 돌아가기" }));
  let dialog = screen.getByRole("dialog", { name: "진행 상태 초기화 확인" });
  const attemptsBeforeCancel = storage.saveAttempts;
  await user.click(within(dialog).getByRole("button", { name: "취소" }));
  expect(storage.saveAttempts).toBe(attemptsBeforeCancel);
  expect(storage.savedGames.at(-1)?.game.events).toHaveLength(2);

  await user.click(within(app).getByRole("button", { name: "배치로 돌아가기" }));
  dialog = screen.getByRole("dialog", { name: "진행 상태 초기화 확인" });
  await user.click(within(dialog).getByRole("button", { name: "초기화하고 돌아가기" }));
  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events).toHaveLength(0));
  const baseline = storage.savedGames.at(-1)?.ui?.sectsAndVioletsSession;
  expect(baseline).toMatchObject({
    activeTab: "seating",
    setup: { rosterConfirmed: true, seatingConfirmed: false },
    phaseCheckpoints: [],
  });
  expect(Object.keys(baseline?.setup.seatAssignments ?? {})).toHaveLength(7);
  expect(baseline?.setup.selectedIds).toHaveLength(7);
});

test("invalid import and valid replacement cancellation preserve the current S&V session", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const view = render(<SectsAndVioletsApp storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  await completeSevenPlayerSetup(user, app);
  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events).toHaveLength(1));
  const current = structuredClone(storage.savedGames.at(-1)!);
  await user.click(within(app).getByRole("button", { name: "저장 / 불러오기" }));
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;

  await user.upload(input, new File([
    JSON.stringify({ ...current, schemaVersion: 1 }),
  ], "invalid.json", { type: "application/json" }));
  expect((await within(app).findByRole("alert")).textContent).toContain("지원하지 않는 게임 파일 버전");
  expect(confirm).not.toHaveBeenCalled();
  expect(storage.savedGames.at(-1)).toEqual(current);

  const replacement = structuredClone(current);
  replacement.game.id = "replacement";
  await user.upload(input, new File([JSON.stringify(replacement)], "valid.json", { type: "application/json" }));
  await waitFor(() => expect(confirm).toHaveBeenCalledWith("현재 게임을 가져온 게임으로 교체할까요?"));
  expect(storage.savedGames.at(-1)).toEqual(current);
  expect(within(app).getByRole("button", { name: "저장 / 불러오기" }).getAttribute("aria-current")).toBe("page");
  confirm.mockRestore();
});

test("preserves an unreadable autosave until confirmed new-game recovery", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  storage.loadError = new Error("지원하지 않는 게임 파일 버전입니다.");
  const user = userEvent.setup();
  render(<SectsAndVioletsApp storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  expect((await within(app).findByRole("alert")).textContent).toContain("지원하지 않는 게임 파일 버전");

  await user.click(within(app).getByRole("button", { name: "9명" }));
  await new Promise((resolve) => window.setTimeout(resolve, 20));
  expect(storage.saveAttempts).toBe(0);

  await user.click(within(app).getByRole("button", { name: "새 게임" }));
  await user.click(within(screen.getByRole("dialog", { name: "새 게임 시작 확인" })).getByRole("button", { name: "새 게임 시작" }));
  await waitFor(() => expect(storage.savedGames).toHaveLength(1));
  expect(storage.savedGames[0]?.game.events).toEqual([]);
  expect(storage.savedGames[0]?.ui?.sectsAndVioletsSession?.setup.playerCount).toBe(7);
});

test("downloads the latest completed S&V checkpoint as JSON", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const user = userEvent.setup();
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const createObjectUrl = vi.fn((_value: Blob | MediaSource) => "blob:sv-checkpoint");
  const revokeObjectUrl = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });
  const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  try {
    render(<SectsAndVioletsApp storageDriver={storage} />);
    const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
    await completeSevenPlayerSetup(user, app);
    await user.click(within(app).getByRole("button", { name: "저장 / 불러오기" }));
    await user.click(within(app).getByRole("button", { name: "export JSON" }));

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(createObjectUrl.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:sv-checkpoint");
  } finally {
    anchorClick.mockRestore();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectUrl });
  }
});

class MemorySectsAndVioletsStorageDriver implements GameStorageDriver {
  readonly savedGames: GameFile[] = [];
  saveAttempts = 0;
  failNextSave = false;
  loadError?: Error;

  async loadLatestGame(): Promise<GameFile | undefined> {
    if (this.loadError) throw this.loadError;
    const latest = this.savedGames.at(-1);
    return latest ? structuredClone(latest) : undefined;
  }

  async saveLatestGame(gameFile: GameFile): Promise<void> {
    this.saveAttempts += 1;
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error("테스트 저장 실패");
    }
    this.savedGames.push(structuredClone(gameFile));
  }
}

function savedDayGame(players: SetupPlayerInput[]): GameFile {
  return {
    schemaVersion: 3,
    game: {
      scriptId: "sectsAndViolets",
      id: "saved-day",
      name: "S&V day",
      createdAt: "2026-07-23T00:00:00.000Z",
      updatedAt: "2026-07-23T00:01:00.000Z",
      events: [
        {
          id: "setup-1",
          type: "setupConfirmed",
          phase: "setup",
          payload: { players },
          summary: "초기 설정 확정: 7명",
          createdAt: "2026-07-23T00:00:00.000Z",
        },
        {
          id: "phase-2",
          type: "phaseStepConfirmed",
          phase: "day",
          payload: { stepId: "day:discussion", input: null },
          summary: "낮 토론 완료",
          createdAt: "2026-07-23T00:01:00.000Z",
        },
      ],
    },
  };
}

async function completeSevenPlayerSetup(
  user: ReturnType<typeof userEvent.setup>,
  app: HTMLElement,
) {
  for (const character of ["시계공", "꿈꾸는 자", "뱀 조련사", "수학자", "변종", "사악한 쌍둥이"]) {
    await user.click(within(app).getByRole("button", { name: character }));
  }
  await user.click(within(app).getByRole("button", { name: "직업 선택 확정" }));
  await user.click(within(app).getByRole("button", { name: "무작위 배치" }));
  await user.click(within(app).getByRole("button", { name: "배치 확정" }));
}
