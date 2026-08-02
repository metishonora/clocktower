import { act, render, screen, waitFor, within } from "@testing-library/react";
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
      requiredInput: step.id === "firstNight:demonInfo" ? {
        kind: "characterIds" as const,
        minSelections: 3,
        maxSelections: 3,
        optional: false,
        allowedCharacterIds: ["philosopher", "artist", "savant", "juggler"],
      } : { kind: "none" as const, optional: false },
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
  propose: vi.fn(async (gameFile, command) => {
    const setup = command.type === "createGame";
    const manual = command.type === "resolveManualStep";
    const nextEventId = `event-${gameFile.game.events.length + 1}`;
    const evilInfo = command.type === "confirmStep"
      && (command.payload.stepId === "firstNight:minionInfo" || command.payload.stepId === "firstNight:demonInfo");
    const demon = playersForMock(gameFile).find((player) => player.actualCharacter === "fangGu")!;
    const minions = playersForMock(gameFile).filter((player) => player.actualCharacter === "evilTwin");
    const revealPayload = command.type === "confirmStep" && command.payload.stepId === "firstNight:minionInfo"
      ? {
          kind: "minionInformation" as const,
          demonPlayers: [{ seat: demon.seat, name: demon.name }],
          minionPlayers: minions.map(({ seat, name }) => ({ seat, name })),
        }
      : command.type === "confirmStep" && command.payload.stepId === "firstNight:demonInfo"
        ? {
            kind: "demonInformation" as const,
            minionPlayers: minions.map(({ seat, name }) => ({ seat, name })),
            bluffCharacterIds: command.payload.input && "characterIds" in command.payload.input
              ? command.payload.input.characterIds
              : [],
          }
        : undefined;
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
          id: nextEventId,
          type: "manualPhaseStepResolved" as const,
          phase: command.payload.stepId.startsWith("day:") ? "day" as const : command.payload.stepId.startsWith("night:") ? "night" as const : "firstNight" as const,
          payload: command.payload,
          summary: `수동 단계 처리: ${command.payload.stepId}`,
          createdAt: "2026-07-22T00:01:00.000Z",
        } : {
          id: nextEventId,
          type: "phaseStepConfirmed" as const,
          phase: "firstNight" as const,
          payload: { stepId: command.payload.stepId, input: command.payload.input ?? null },
          summary: `단계 확정: ${command.payload.stepId}`,
          createdAt: "2026-07-22T00:01:00.000Z",
        },
        warnings: [],
        followUpSteps: [],
        preview: null,
        ...(evilInfo ? { revealPayload } : {}),
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

const defaultReplayImplementation = core.replay.getMockImplementation()!;
const defaultProposeImplementation = core.propose.getMockImplementation()!;

beforeEach(() => {
  vi.clearAllMocks();
  core.replay.mockReset().mockImplementation(defaultReplayImplementation);
  core.propose.mockReset().mockImplementation(defaultProposeImplementation);
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
  const phaseActions = app.querySelector(".snvPhaseActions");
  const emptyUndo = phaseActions?.querySelector(".snvGlobalUndo.empty");
  expect(emptyUndo?.getAttribute("data-visual-state")).toBe("muted");
  expect(emptyUndo?.querySelector("svg")).toBeTruthy();
  expect(emptyUndo?.nextElementSibling?.classList.contains("snvPhaseMark")).toBe(true);
  expect(within(app).queryByRole("button", { name: /최근 행동 되돌리기/ })).toBeNull();

  await userEvent.setup().click(within(utilities).getByRole("button", { name: "저장 / 불러오기" }));
  const eventLog = within(app).getByRole("region", { name: "이벤트 로그" });
  expect(within(eventLog).getByText("0건")).toBeTruthy();
  expect(within(eventLog).getByText("확정된 이벤트가 없습니다.")).toBeTruthy();
  expect(eventLog.querySelector("details")).toBeNull();
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

test("does not expose a confirmed Grimoire until the canonical setup is durably saved", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const user = userEvent.setup();
  const firstRender = render(<SectsAndVioletsApp storageDriver={storage} />);
  let app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  for (const character of ["시계공", "꿈꾸는 자", "뱀 조련사", "수학자", "변종", "사악한 쌍둥이"]) {
    await user.click(within(app).getByRole("button", { name: character }));
  }
  await user.click(within(app).getByRole("button", { name: "직업 선택 확정" }));
  await user.click(within(app).getByRole("button", { name: "무작위 배치" }));
  await waitFor(() => expect(
    Object.keys(storage.savedGames.at(-1)?.ui?.sectsAndVioletsSession?.setup.seatAssignments ?? {}),
  ).toHaveLength(7));

  storage.pauseCanonicalSave = true;
  await user.click(within(app).getByRole("button", { name: "배치 확정" }));
  await waitFor(() => expect(storage.canonicalSaveStarted).toBe(true));

  expect(within(app).queryByLabelText("1일차 밤 경과 시간 00:00")).toBeNull();
  expect(within(app).getByRole("button", { name: "확정 중" })).toBeTruthy();

  storage.releaseCanonicalSave?.();
  expect(await within(app).findByLabelText("1일차 밤 경과 시간 00:00")).toBeTruthy();

  firstRender.unmount();
  render(<SectsAndVioletsApp storageDriver={storage} />);
  app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  expect(await within(app).findByLabelText("1일차 밤 경과 시간 00:00")).toBeTruthy();
  expect(screen.queryByRole("dialog", { name: "작업 실패" })).toBeNull();
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

  const errorDialog = await screen.findByRole("dialog", { name: "작업 실패" });
  expect(within(errorDialog).getByText("구성을 다시 확인하세요")).toBeTruthy();
  expect(errorDialog.getAttribute("data-theme")).toBe("night");
  expect(within(errorDialog).getByRole("button", { name: "확인" })).toBeTruthy();
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
  await completeCurrentEvilInformation(user, app);
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

  await completeCurrentEvilInformation(user, app);
  await completeCurrentEvilInformation(user, app);
  expect(await within(app).findByRole("heading", { name: "뱀 조련사" })).toBeTruthy();
  expect(within(app).getByText("매일 밤, 생존한 플레이어 1명을 선택합니다: 악마를 선택한다면, 악마는 당신과 소속 및 캐릭터를 맞바꾼 다음 중독됩니다.")).toBeTruthy();
  expect(within(app).queryByText("선택한 플레이어를 확인하고 필요하면 직업과 성향을 교환합니다.")).toBeNull();
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

test("shows one transient S&V phase stopwatch across the Grimoire and progression surfaces", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const user = userEvent.setup();
  let now = Date.parse("2026-07-24T00:00:00.000Z");
  const dateNow = vi.spyOn(Date, "now").mockImplementation(() => now);

  try {
    const firstRender = render(<SectsAndVioletsApp storageDriver={storage} />);
    const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
    await completeSevenPlayerSetup(user, app);

    expect(await within(app).findByLabelText("1일차 밤 경과 시간 00:00")).toBeTruthy();
    const savesBeforeTick = storage.saveAttempts;
    const replaysBeforeTick = core.replay.mock.calls.length;

    now += 5 * 60_000 + 7_000;
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(within(app).getByLabelText("1일차 밤 경과 시간 05:07")).toBeTruthy();
    expect(storage.saveAttempts).toBe(savesBeforeTick);
    expect(core.replay).toHaveBeenCalledTimes(replaysBeforeTick);

    await user.click(within(app).getByRole("button", { name: "진행" }));
    const progression = within(app).getByRole("region", { name: "첫날 밤 진행" });
    const progressionTimer = within(progression).getByLabelText("1일차 밤 경과 시간 05:07");
    expect(progressionTimer.closest(".snvProgressPhaseHeader")).toBeTruthy();

    await completeCurrentEvilInformation(user, app);
    expect(await within(app).findByLabelText("1일차 밤 경과 시간 05:07")).toBeTruthy();
    await completeCurrentEvilInformation(user, app);
    await user.click(within(app).getByRole("button", { name: "처리 완료" }));
    expect(await within(app).findByRole("heading", { name: "1일차 밤 종료" })).toBeTruthy();

    now += 10_000;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(within(app).getByLabelText("1일차 밤 경과 시간 05:17")).toBeTruthy();

    await user.click(within(app).getByRole("button", { name: "낮으로" }));
    expect(await within(app).findByLabelText("2일차 낮 경과 시간 00:00")).toBeTruthy();

    firstRender.unmount();
    render(<SectsAndVioletsApp storageDriver={storage} />);
    const restoredApp = await screen.findByRole("main", { name: "Sects & Violets 게임" });
    expect(await within(restoredApp).findByLabelText("2일차 낮 경과 시간 00:00")).toBeTruthy();
  } finally {
    dateNow.mockRestore();
  }
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
    eventCount: 2,
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
    .mockResolvedValueOnce({ ok: true, value: { ...replayState, eventCount: 3 } } as never)
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
  await completeCurrentEvilInformation(user, app);
  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events).toHaveLength(2));

  const headerUndo = within(app).getByRole("button", { name: /최근 행동 되돌리기: 단계 확정: firstNight:minionInfo/ });
  expect(headerUndo.nextElementSibling?.classList.contains("snvPhaseMark")).toBe(true);
  await user.click(within(app).getByRole("button", { name: "저장 / 불러오기" }));
  const storagePage = within(app).getByRole("region", { name: "저장 및 불러오기" });
  expect(within(storagePage).queryByRole("button", { name: /되돌리기/ })).toBeNull();
  const eventLog = within(storagePage).getByRole("region", { name: "이벤트 로그" });
  expect(within(eventLog).getByText("2건")).toBeTruthy();
  const eventItems = within(within(eventLog).getByRole("list", { name: "확정 이벤트 최신순" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
  expect(eventItems).toEqual([
    "02단계 확정: firstNight:minionInfo",
    "01초기 설정 확정: 7명",
  ]);
  const savesBeforeCancel = storage.saveAttempts;
  await user.click(headerUndo);
  let dialog = screen.getByRole("dialog", { name: "Undo" });
  expect(dialog.getAttribute("data-theme")).toBe("night");
  expect(within(dialog).getByText("되돌릴 행동")).toBeTruthy();
  expect(within(within(dialog).getByRole("list", { name: "취소될 이벤트" })).getByRole("listitem").textContent)
    .toBe("02단계 확정: firstNight:minionInfo");
  expect(within(dialog).getByText("위 이벤트를 취소하고 직전 상태로 돌아갑니다.")).toBeTruthy();
  const cancel = within(dialog).getByRole("button", { name: "취소" });
  const confirm = within(dialog).getByRole("button", { name: "되돌리기" });
  await waitFor(() => expect(document.activeElement).toBe(cancel));
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(confirm);
  await user.tab();
  expect(document.activeElement).toBe(cancel);
  await user.click(cancel);
  expect(storage.saveAttempts).toBe(savesBeforeCancel);
  expect(storage.savedGames.at(-1)?.game.events).toHaveLength(2);

  await user.click(headerUndo);
  dialog = screen.getByRole("dialog", { name: "Undo" });
  await user.click(within(dialog).getByRole("button", { name: "되돌리기" }));

  await waitFor(() => expect(storage.savedGames.at(-1)?.game.events).toHaveLength(1));
  expect(within(app).getByRole("button", { name: "저장 / 불러오기" }).getAttribute("aria-current")).toBe("page");
  expect(within(eventLog).getByText("1건")).toBeTruthy();
  expect(within(eventLog).queryByText("단계 확정: firstNight:minionInfo")).toBeNull();
  expect(within(app).queryByRole("button", { name: /최근 행동 되돌리기/ })).toBeNull();
  expect(app.querySelector(".snvGlobalUndo.empty")?.getAttribute("data-visual-state")).toBe("muted");
});

test("lists every canonical event owned by the latest S&V checkpoint", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const players: SetupPlayerInput[] = [
    "clockmaker", "dreamer", "snakeCharmer", "mathematician", "mutant", "evilTwin", "fangGu",
  ].map((actualCharacter, index) => ({ seat: index + 1, name: `플레이어 ${index + 1}`, actualCharacter }));
  const grouped = savedDayGame(players);
  grouped.game.events.push({
    id: "phase-3",
    type: "phaseStepConfirmed",
    phase: "day",
    payload: { stepId: "day:executionDeath", input: { died: true } },
    summary: "처형 결과: 4번 도윤 사망",
    createdAt: "2026-07-23T00:02:00.000Z",
  });
  grouped.ui = {
    sectsAndVioletsSession: {
      version: 1,
      activeTab: "storage",
      savedAt: "2026-07-23T00:02:00.000Z",
      setup: {
        playerCount: 7,
        demon: "fangGu",
        selectedIds: players.map(({ actualCharacter }) => actualCharacter),
        seatAssignments: Object.fromEntries(players.map(({ seat, actualCharacter }) => [seat, actualCharacter])),
        seatAlignments: Object.fromEntries(players.map(({ seat }, index) => [seat, index >= 5 ? "evil" : "good"])),
        seatNames: Object.fromEntries(players.map(({ seat, name }) => [seat, name])),
        rosterConfirmed: true,
        seatingConfirmed: true,
      },
      phaseCheckpoints: [
        { id: "setup-1", kind: "setup", eventCount: 1, summary: "초기 설정 확정: 7명", activeTab: "seating" },
        { id: "execution", kind: "phase", eventCount: 3, summary: "4번 도윤 처형 · 사망", activeTab: "play" },
      ],
    },
  };
  storage.savedGames.push(grouped);
  const user = userEvent.setup();
  render(<SectsAndVioletsApp storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  await user.click(await within(app).findByRole("button", { name: "최근 행동 되돌리기: 4번 도윤 처형 · 사망" }));
  const dialog = screen.getByRole("dialog", { name: "Undo" });
  expect(within(within(dialog).getByRole("list", { name: "취소될 이벤트" })).getAllByRole("listitem").map((item) => item.textContent))
    .toEqual(["03처형 결과: 4번 도윤 사망", "02낮 토론 완료"]);
});

test("imports a replay-valid S&V checkpoint and restores its saved page", async () => {
  const sourceStorage = new MemorySectsAndVioletsStorageDriver();
  const user = userEvent.setup();
  const source = render(<SectsAndVioletsApp storageDriver={sourceStorage} />);
  let app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  await completeSevenPlayerSetup(user, app);
  await user.click(within(app).getByRole("button", { name: "진행" }));
  await completeCurrentEvilInformation(user, app);
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
  await completeCurrentEvilInformation(user, app);
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
  const errorDialog = await screen.findByRole("dialog", { name: "작업 실패" });
  expect(within(errorDialog).getByText(/지원하지 않는 게임 파일 버전/)).toBeTruthy();
  await user.click(within(errorDialog).getByRole("button", { name: "확인" }));
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
  const errorDialog = await screen.findByRole("dialog", { name: "작업 실패" });
  expect(within(errorDialog).getByText(/지원하지 않는 게임 파일 버전/)).toBeTruthy();
  await user.click(within(errorDialog).getByRole("button", { name: "확인" }));

  await user.click(within(app).getByRole("button", { name: "9명" }));
  await new Promise((resolve) => window.setTimeout(resolve, 20));
  expect(storage.saveAttempts).toBe(0);

  await user.click(within(app).getByRole("button", { name: "새 게임" }));
  await user.click(within(screen.getByRole("dialog", { name: "새 게임 시작 확인" })).getByRole("button", { name: "새 게임 시작" }));
  await waitFor(() => expect(storage.savedGames).toHaveLength(1));
  expect(storage.savedGames[0]?.game.events).toEqual([]);
  expect(storage.savedGames[0]?.ui?.sectsAndVioletsSession?.setup.playerCount).toBe(7);
});

test("shows actionable replay warnings but not the expected pending night-death state", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const warningState = {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 0,
    phase: "setup",
    players: [],
    currentStep: null,
    phaseOverview: [],
    ruleState: { unannouncedNightDeathPlayerIds: ["player-4"] },
    warnings: [
      { code: "NIGHT_DEATH_UNANNOUNCED", severity: "warning", messageKo: "공개하지 않은 밤 사망이 있습니다." },
      { code: "VORTOX_INFO", severity: "warning", messageKo: "보르톡스가 살아 있습니다. 정보가 거짓이어야 하는지 확인하세요." },
    ],
    gameEnd: null,
  } satisfies ReplayState;
  core.replay
    .mockResolvedValueOnce({ ok: true, value: warningState } as never)
    .mockResolvedValueOnce({ ok: true, value: warningState } as never);
  const user = userEvent.setup();
  render(<SectsAndVioletsApp storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });

  const warning = await within(app).findByRole("status", { name: "게임 경고" });
  expect(within(warning).getByText("보르톡스가 살아 있습니다. 정보가 거짓이어야 하는지 확인하세요.")).toBeTruthy();
  expect(within(warning).queryByText("공개하지 않은 밤 사망이 있습니다.")).toBeNull();
  await user.click(within(warning).getByRole("button", { name: "경고 닫기" }));
  expect(within(app).queryByRole("status", { name: "게임 경고" })).toBeNull();
});

test("restores a pending rules-owned game end dialog from autosave", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const setupPlayers = standardSetupPlayers();
  const saved = savedDayGame(setupPlayers);
  storage.savedGames.push(saved);
  const base = await defaultReplayImplementation(saved) as { ok: true; value: ReplayState };
  const pendingState: ReplayState = {
    ...base.value,
    phase: "day",
    pendingGameEnd: {
      sourceEventId: "phase-2",
      winningTeam: "evil",
      cause: "vortoxNoExecution",
      reasonKo: "보르톡스가 존재하지만 낮에 아무도 처형되지 않았습니다.",
    },
  };
  core.replay.mockResolvedValue({ ok: true, value: pendingState } as never);

  render(<SectsAndVioletsApp storageDriver={storage} />);

  const dialog = await screen.findByRole("dialog", { name: "악 진영 승리" });
  expect(within(dialog).getByText(pendingState.pendingGameEnd!.reasonKo)).toBeTruthy();
  expect(within(dialog).queryByRole("button", { name: /닫기|취소|최소화/ })).toBeNull();
});

test("restores an ended autosave to the final read-only Grimoire", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const user = userEvent.setup();
  const setupPlayers = standardSetupPlayers();
  const saved = savedDayGame(setupPlayers);
  saved.game.events.push({
    id: "game-ended-3",
    type: "gameEnded",
    phase: "day",
    payload: { winningTeam: "evil", source: { kind: "vortoxNoExecution", sourceEventId: "phase-2" } },
    summary: "게임 종료 · 악한 팀 승리",
    createdAt: "2026-07-23T00:02:00.000Z",
  });
  storage.savedGames.push(saved);
  const base = await defaultReplayImplementation(saved) as { ok: true; value: ReplayState };
  const endedState: ReplayState = {
    ...base.value,
    phase: "day",
    currentStep: null,
    phaseOverview: [],
    availableDayActions: [{ actorPlayerId: "player-1", characterId: "artist", dayId: "day" }],
    madnessAssignments: [{
      assignmentId: "madness-1",
      sourcePlayerId: "player-6",
      sourceCharacterId: "cerenovus",
      targetPlayerId: "player-1",
      requiredCharacterId: "artist",
      status: "unchecked",
      sourceEffective: true,
      canCheck: true,
      canExecute: false,
    }],
    gameEnd: {
      eventId: "game-ended-3",
      sourceEventId: "phase-2",
      winningTeam: "evil",
      cause: "vortoxNoExecution",
      reasonKo: "보르톡스가 존재하지만 낮에 아무도 처형되지 않았습니다.",
    },
  };
  core.replay.mockResolvedValue({ ok: true, value: endedState } as never);

  render(<SectsAndVioletsApp storageDriver={storage} />);

  const grimoire = await screen.findByRole("region", { name: "종료된 게임의 읽기 전용 마도서" });
  const dock = screen.getByRole("region", { name: "게임 종료 상태" });
  expect(within(dock).getByText("악 진영 승리")).toBeTruthy();
  expect(within(dock).queryByRole("button")).toBeNull();
  expect(screen.getByRole("button", { name: /최근 행동 되돌리기/ })).toBeTruthy();
  expect(screen.queryByLabelText("사용 가능한 낮 자유 행동")).toBeNull();
  expect(screen.queryByLabelText("집착 확인 자유 행동")).toBeNull();

  await user.click(within(grimoire).getByRole("button", { name: /1번 좌석/ }));
  const details = screen.getByRole("dialog", { name: "1번 플레이어 1 플레이어 상세" });
  expect(details.closest(".playerTokenDetailBackdrop")?.classList.contains("day")).toBe(true);
});

test("ends a pending game and one Undo removes both the end and its causal checkpoint", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const saved = savedDayGame(standardSetupPlayers());
  storage.savedGames.push(saved);
  const pendingBase = await defaultReplayImplementation(saved) as { ok: true; value: ReplayState };
  const pendingState: ReplayState = {
    ...pendingBase.value,
    phase: "day",
    pendingGameEnd: {
      sourceEventId: "phase-2",
      winningTeam: "evil",
      cause: "vortoxNoExecution",
      reasonKo: "보르톡스가 존재하지만 낮에 아무도 처형되지 않았습니다.",
    },
  };
  const endedState: ReplayState = {
    ...pendingState,
    eventCount: 3,
    currentStep: null,
    phaseOverview: [],
    pendingGameEnd: undefined,
    gameEnd: {
      eventId: "game-ended-3",
      sourceEventId: "phase-2",
      winningTeam: "evil",
      cause: "vortoxNoExecution",
      reasonKo: pendingState.pendingGameEnd!.reasonKo,
    },
  };
  core.replay.mockImplementation(async (gameFile: GameFile) => {
    if (gameFile.game.events.some((event) => event.type === "gameEnded")) {
      return { ok: true, value: endedState } as never;
    }
    if (gameFile.game.events.some((event) => event.id === "phase-2")) {
      return { ok: true, value: pendingState } as never;
    }
    return defaultReplayImplementation(gameFile);
  });
  core.propose.mockImplementation(async (gameFile: GameFile, command: { type: string }) => {
    if (command.type === "endGame") {
      return {
        ok: true,
        value: {
          event: {
            id: "game-ended-3",
            type: "gameEnded",
            phase: "day",
            payload: { winningTeam: "evil", source: { kind: "vortoxNoExecution", sourceEventId: "phase-2" } },
            summary: "게임 종료 · 악한 팀 승리",
            createdAt: "2026-07-23T00:02:00.000Z",
          },
          warnings: [],
          followUpSteps: [],
          preview: null,
        },
      } as never;
    }
    return defaultProposeImplementation(gameFile, command as never);
  });
  const user = userEvent.setup();
  render(<SectsAndVioletsApp storageDriver={storage} />);

  await user.click(within(await screen.findByRole("dialog", { name: "악 진영 승리" }))
    .getByRole("button", { name: "게임 종료" }));
  await screen.findByRole("region", { name: "게임 종료 상태" });
  await user.click(screen.getByRole("button", { name: /최근 행동 되돌리기/ }));
  const undo = screen.getByRole("dialog", { name: "Undo" });
  expect(within(undo).getAllByRole("listitem")).toHaveLength(2);
  await user.click(within(undo).getByRole("button", { name: "되돌리기" }));

  await waitFor(() => {
    const lastReplayFile = core.replay.mock.calls.at(-1)?.[0] as GameFile;
    expect(lastReplayFile.game.events.map((event) => event.id)).toEqual(["setup-1"]);
  });
  expect(screen.queryByRole("dialog", { name: "악 진영 승리" })).toBeNull();
  expect(screen.queryByRole("region", { name: "게임 종료 상태" })).toBeNull();
});

test("places game warnings in layout before Grimoire reminder tokens", async () => {
  const storage = new MemorySectsAndVioletsStorageDriver();
  const setupPlayers: SetupPlayerInput[] = [
    "clockmaker", "dreamer", "snakeCharmer", "mathematician", "mutant", "evilTwin", "fangGu",
  ].map((actualCharacter, index) => ({
    id: `player-${index + 1}`,
    seat: index + 1,
    name: `플레이어 ${index + 1}`,
    actualCharacter,
    shownCharacter: actualCharacter,
  }));
  const players = setupPlayers.map((player, index) => ({
    ...player,
    id: player.id!,
    shownCharacter: player.shownCharacter!,
    alignment: index >= 5 ? "evil" as const : "good" as const,
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  }));
  const currentStep = {
    id: "day:discussion",
    phase: "day" as const,
    stepType: "discussion" as const,
    requiredInput: { kind: "none" as const, optional: false },
    canSkip: false,
    support: "manual" as const,
  };
  const replayState = {
    schemaVersion: 3,
    scriptId: "sectsAndViolets",
    eventCount: 2,
    phase: "day",
    players,
    currentStep,
    phaseOverview: [{ ...currentStep, status: "current" as const }],
    ruleState: {
      unannouncedNightDeathPlayerIds: [],
      automaticReminders: [{
        playerId: "player-7",
        characterId: "flowergirl",
        tokenId: "demon-voted",
        label: "악마 투표함",
        description: "오늘 악마가 투표했습니다.",
      }],
    },
    warnings: [{
      code: "VORTOX_INFO",
      severity: "warning",
      messageKo: "보르톡스가 살아 있습니다. 정보가 거짓이어야 하는지 확인하세요.",
    }],
    gameEnd: null,
  } satisfies ReplayState;
  core.replay
    .mockResolvedValueOnce({ ok: true, value: replayState } as never)
    .mockResolvedValueOnce({ ok: true, value: replayState } as never);
  storage.savedGames.push(savedDayGame(setupPlayers));

  const user = userEvent.setup();
  render(<SectsAndVioletsApp storageDriver={storage} />);
  const app = await screen.findByRole("main", { name: "Sects & Violets 게임" });
  await user.click(within(app).getByRole("button", { name: "마도서" }));

  const warning = within(app).getByRole("status", { name: "게임 경고" });
  const grimoire = within(app).getByRole("region", { name: "낮 마도서" });
  expect(within(grimoire).getByText("+1")).toBeTruthy();
  expect(warning.compareDocumentPosition(grimoire) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
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
  pauseCanonicalSave = false;
  canonicalSaveStarted = false;
  releaseCanonicalSave?: () => void;

  async loadLatestGame(): Promise<GameFile | undefined> {
    if (this.loadError) throw this.loadError;
    const latest = this.savedGames.at(-1);
    return latest ? structuredClone(latest) : undefined;
  }

  async saveLatestGame(gameFile: GameFile): Promise<void> {
    this.saveAttempts += 1;
    if (this.pauseCanonicalSave && gameFile.game.events.length > 0) {
      this.canonicalSaveStarted = true;
      await new Promise<void>((resolve) => { this.releaseCanonicalSave = resolve; });
      this.pauseCanonicalSave = false;
    }
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

function playersForMock(gameFile: GameFile): SetupPlayerInput[] {
  const setup = gameFile.game.events.find((event) => event.type === "setupConfirmed");
  return setup?.type === "setupConfirmed" ? setup.payload.players : [];
}

function standardSetupPlayers(): SetupPlayerInput[] {
  return ["clockmaker", "dreamer", "snakeCharmer", "mathematician", "mutant", "evilTwin", "fangGu"]
    .map((actualCharacter, index) => ({
      id: `player-${index + 1}`,
      seat: index + 1,
      name: `플레이어 ${index + 1}`,
      actualCharacter,
      shownCharacter: actualCharacter,
    }));
}

async function completeCurrentEvilInformation(
  user: ReturnType<typeof userEvent.setup>,
  app: HTMLElement,
) {
  if (within(app).queryByRole("heading", { name: "악마 정보" })) {
    const candidates = app.querySelector<HTMLElement>(".snvBluffCandidateGrid")!;
    for (const candidate of within(candidates).getAllByRole("button").slice(0, 3)) {
      await user.click(candidate);
    }
  }
  await user.click(await within(app).findByRole("button", { name: "정보 공개" }));
  const reveal = await screen.findByRole("dialog", { name: /정보 공개$/ });
  await user.click(within(reveal).getByRole("button", { name: "악한 팀 정보 공개 닫기" }));
  await user.click(await within(app).findByRole("button", { name: "다음으로" }));
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
