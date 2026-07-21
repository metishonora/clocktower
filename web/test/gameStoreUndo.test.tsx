import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { CoreAdapter } from "../src/core/coreAdapter";
import type { CoreResult, GameFile, ReplayState } from "../src/core/types";
import { useGameStore } from "../src/gameStore";
import {
  MemoryGameStorageDriver,
  event,
  gameFile,
  replayState,
  step,
} from "./clocktowerAppHarness";

function coreForReplay(replay: CoreAdapter["replay"]): CoreAdapter {
  return {
    replay,
    propose: vi.fn(),
    setupDistribution: vi.fn(async () => ({ ok: true, value: { Townsfolk: 3, Outsider: 0, Minion: 1, Demon: 1 } })),
    setupDistributionSync: vi.fn(() => ({ ok: true, value: { Townsfolk: 3, Outsider: 0, Minion: 1, Demon: 1 } })),
    suggestPhaseInput: vi.fn(),
  } as unknown as CoreAdapter;
}

function replayValue(game: GameFile): CoreResult<ReplayState> {
  const currentStep = step({ id: "firstNight:chef", character: "chef", playerId: "player-2" });
  return { ok: true, value: replayState({ currentStep, eventCount: game.game.events.length }) };
}

test("store creates a canonical script-bound game and passes script identity to setup queries", async () => {
  const replay = vi.fn(async (candidate: GameFile) => replayValue(candidate));
  const core = coreForReplay(replay);
  core.propose = vi.fn(async () => ({
    ok: false as const,
    error: { code: "TEST_PREVIEW", messageKo: "테스트 설정 검토" },
  }));
  const storage = new MemoryGameStorageDriver(undefined);
  const { result } = renderHook(() =>
    useGameStore({ scriptId: "troubleBrewing", core, storage }),
  );

  await waitFor(() => expect(replay).toHaveBeenCalled());
  expect(result.current.gameFile).toMatchObject({
    schemaVersion: 3,
    game: { scriptId: "troubleBrewing", name: "Trouble Brewing", events: [] },
  });
  await waitFor(() => expect(core.setupDistribution).toHaveBeenCalledWith(expect.objectContaining({
    scriptId: "troubleBrewing",
  })));
});

test("store exposes a guarded latest live event without treating setup recovery as generic Undo", async () => {
  const storedGame = gameFile();
  const latestEvent = event("event-chef", "요리사 정보 확정 · 1쌍 공개");
  storedGame.game.events.push(latestEvent);
  const core = coreForReplay(vi.fn(async (candidate) => replayValue(candidate)));
  const { result } = renderHook(() =>
    useGameStore({ scriptId: "troubleBrewing", core, storage: new MemoryGameStorageDriver(storedGame) }),
  );

  await waitFor(() => expect(result.current.latestLiveUndoEvent).toEqual({
    id: latestEvent.id,
    summary: latestEvent.summary,
  }));
  expect(result.current.canUndoLatestLiveEvent).toBe(true);
  expect(result.current.canRecoverConfirmedSetup).toBe(false);

  let removed = true;
  act(() => {
    removed = result.current.undoLatestLiveEvent("stale-event-id");
  });

  expect(removed).toBe(false);
  expect(result.current.gameFile.game.events).toHaveLength(2);
  expect(result.current.gameFile.game.events.at(-1)).toEqual(latestEvent);
  expect(result.current.loadError).toBe("최근 행동이 변경되어 되돌리지 않았습니다.");
});

test("store keeps eligible Undo visible but disabled until replay catches up", async () => {
  const storedGame = gameFile();
  const latestEvent = event("event-chef", "요리사 정보 확정");
  storedGame.game.events.push(latestEvent);
  const currentStep = step({ id: "firstNight:chef", character: "chef", playerId: "player-2" });
  const core = coreForReplay(vi.fn(async () => ({
    ok: true as const,
    value: replayState({ currentStep, eventCount: 1 }),
  })));
  const { result } = renderHook(() =>
    useGameStore({ scriptId: "troubleBrewing", core, storage: new MemoryGameStorageDriver(storedGame) }),
  );

  await waitFor(() => expect(result.current.latestLiveUndoEvent?.id).toBe(latestEvent.id));
  expect(result.current.canUndoLatestLiveEvent).toBe(false);
  expect(result.current.canRecoverConfirmedSetup).toBe(false);
});

test("store keeps the latest Undo target visible but disables it while a command is unresolved", async () => {
  const storedGame = gameFile();
  const latestEvent = event("event-chef", "요리사 정보 확정");
  storedGame.game.events.push(latestEvent);
  let resolveProposal!: (value: { ok: false; error: { code: string; messageKo: string } }) => void;
  const proposalResult = new Promise<{ ok: false; error: { code: string; messageKo: string } }>((resolve) => {
    resolveProposal = resolve;
  });
  const core = coreForReplay(vi.fn(async (candidate) => replayValue(candidate)));
  core.propose = vi.fn(async () => proposalResult);
  const { result } = renderHook(() =>
    useGameStore({ scriptId: "troubleBrewing", core, storage: new MemoryGameStorageDriver(storedGame) }),
  );

  await waitFor(() => expect(result.current.canUndoLatestLiveEvent).toBe(true));
  act(() => {
    void result.current.confirmCurrentStep();
  });
  await waitFor(() => expect(result.current.busy).toBe(true));
  expect(result.current.latestLiveUndoEvent?.id).toBe(latestEvent.id);
  expect(result.current.canUndoLatestLiveEvent).toBe(false);

  act(() => resolveProposal({ ok: false, error: { code: "TEST", messageKo: "테스트 종료" } }));
  await waitFor(() => expect(result.current.busy).toBe(false));
});

test("an unresolved Undo replay blocks overlap and setup recovery appears only after it resolves", async () => {
  const storedGame = gameFile();
  const latestEvent = event("event-chef", "요리사 정보 확정");
  storedGame.game.events.push(latestEvent);
  let resolveReducedReplay!: (value: CoreResult<ReplayState>) => void;
  const reducedReplay = new Promise<CoreResult<ReplayState>>((resolve) => {
    resolveReducedReplay = resolve;
  });
  const replay = vi.fn(async (candidate: GameFile) =>
    candidate.game.events.length === 1 ? reducedReplay : replayValue(candidate),
  );
  const core = coreForReplay(replay);
  const { result } = renderHook(() =>
    useGameStore({ scriptId: "troubleBrewing", core, storage: new MemoryGameStorageDriver(storedGame) }),
  );

  await waitFor(() => expect(result.current.canUndoLatestLiveEvent).toBe(true));
  act(() => {
    expect(result.current.undoLatestLiveEvent(latestEvent.id)).toBe(true);
  });
  expect(result.current.gameFile.game.events).toHaveLength(1);
  expect(result.current.gameFile.schemaVersion).toBe(3);
  expect(result.current.gameFile.game.scriptId).toBe("troubleBrewing");
  expect(result.current.canUndoLatestLiveEvent).toBe(false);
  expect(result.current.busy).toBe(true);

  act(() => {
    resolveReducedReplay(replayValue(result.current.gameFile));
  });
  await waitFor(() => expect(result.current.busy).toBe(false));
  expect(result.current.latestLiveUndoEvent).toBeUndefined();
  expect(result.current.canRecoverConfirmedSetup).toBe(true);
});

test("store proposes an explicit game end and exposes replayed ended state", async () => {
  const storedGame = gameFile();
  const endedEvent = {
    id: "game-ended-2",
    type: "gameEnded" as const,
    phase: "firstNight" as const,
    payload: { winningTeam: "evil" as const },
    summary: "게임 종료 · 악한 팀 승리",
    createdAt: "2026-07-16T00:00:00.000Z",
  };
  const core = coreForReplay(vi.fn(async (candidate: GameFile) => {
    const currentStep = step({ id: "firstNight:chef", character: "chef", playerId: "player-2" });
    const value = replayState({ currentStep, eventCount: candidate.game.events.length });
    if (candidate.game.events.length === 2) {
      value.currentStep = null;
      value.phaseOverview = [];
      value.gameEnd = { eventId: endedEvent.id, winningTeam: "evil" };
    }
    return { ok: true as const, value };
  }));
  core.propose = vi.fn(async () => ({
    ok: true as const,
    value: { event: endedEvent, warnings: [], followUpSteps: [], preview: {} },
  }));
  const { result } = renderHook(() =>
    useGameStore({ scriptId: "troubleBrewing", core, storage: new MemoryGameStorageDriver(storedGame) }),
  );

  await waitFor(() => expect(result.current.currentStep?.id).toBe("firstNight:chef"));
  act(() => { void result.current.endGame("evil"); });

  await waitFor(() => expect(result.current.gameEnd).toEqual({ eventId: endedEvent.id, winningTeam: "evil" }));
  expect(core.propose).toHaveBeenCalledWith(
    expect.anything(),
    { type: "endGame", payload: { winningTeam: "evil", expectedEventCount: 1 } },
  );
  expect(result.current.gameFile.game.events.at(-1)).toEqual(endedEvent);
});

test("store confirms one player annotation event and exposes it to generic Undo", async () => {
  const storedGame = gameFile();
  const annotationEvent = {
    id: "player-annotations-2",
    type: "playerAnnotationsUpdated" as const,
    phase: "firstNight" as const,
    payload: {
      playerId: "player-2",
      systemTokenIds: ["abilitySpent" as const],
      scriptTokens: [{ characterId: "fortuneTeller", tokenId: "redHerring" }],
      notes: "다음 낮에 확인",
    },
    summary: "플레이어 표시 수정: 2번 Bert",
    createdAt: "2026-07-17T00:00:00.000Z",
  };
  const currentStep = step({ id: "firstNight:chef", character: "chef", playerId: "player-2" });
  const core = coreForReplay(vi.fn(async (candidate: GameFile) => {
    const roster = replayState({ currentStep }).players.map((player) =>
      candidate.game.events.length === 2 && player.id === "player-2"
        ? { ...player, ...annotationEvent.payload }
        : player,
    );
    return {
      ok: true as const,
      value: replayState({ currentStep, eventCount: candidate.game.events.length, playerRoster: roster }),
    };
  }));
  core.propose = vi.fn(async () => ({
    ok: true as const,
    value: { event: annotationEvent, warnings: [], followUpSteps: [], preview: {} },
  }));
  const { result } = renderHook(() =>
    useGameStore({ scriptId: "troubleBrewing", core, storage: new MemoryGameStorageDriver(storedGame) }),
  );

  await waitFor(() => expect(result.current.players).toHaveLength(5));
  await act(async () => {
    const confirmed = await result.current.updatePlayerAnnotations("player-2", {
      systemTokenIds: ["abilitySpent"],
      scriptTokens: [{ characterId: "fortuneTeller", tokenId: "redHerring" }],
      notes: "다음 낮에 확인",
    });
    expect(confirmed?.ok).toBe(true);
  });

  expect(core.propose).toHaveBeenCalledWith(expect.anything(), {
    type: "updatePlayerAnnotations",
    payload: {
      playerId: "player-2",
      expectedEventCount: 1,
      systemTokenIds: ["abilitySpent"],
      scriptTokens: [{ characterId: "fortuneTeller", tokenId: "redHerring" }],
      notes: "다음 낮에 확인",
    },
  });
  await waitFor(() => expect(result.current.players[1]?.notes).toBe("다음 낮에 확인"));
  expect(result.current.latestLiveUndoEvent?.id).toBe(annotationEvent.id);
  act(() => expect(result.current.undoLatestLiveEvent(annotationEvent.id)).toBe(true));
  await waitFor(() => expect(result.current.players[1]?.notes).toBe(""));
});
