import { useEffect, useMemo, useRef, useState } from "react";
import type { CoreAdapter } from "./core/coreAdapter.js";
import type {
  CoreResult,
  GameEvent,
  GameFile,
  PhaseInputSuggestion,
  PhaseInputSuggestionRequest,
  PhaseStep,
  PhaseStepConfirmation,
  PlayerAnnotationsInput,
  Proposal,
  RevealPayload,
  ReplayState,
  SeatLayoutState,
  SetupDistribution,
} from "./core/types.js";
import { scriptDisplayName, type ScriptId } from "./core/scripts.js";
import {
  exportGameFileJson,
  importGameFileJson,
  loadLatestGame,
  saveLatestGame,
  type GameStorageDriver,
} from "./gameStorage.js";
import { proposalRevealPayload } from "./core/revealPayload.js";
import {
  latestCanonicalUndoUnit,
  removeLatestCanonicalUndoUnit,
} from "./core/canonicalUndo.js";
import { syncSetupDraftFromReplayState } from "./gameStoreSync.js";
import {
  createSetupDraft,
  createSetupDraftFromConfirmedPlayers,
  toCreateGamePlayers,
  type SetupDraft,
} from "./setupDraft.js";

export function createGameFile(scriptId: ScriptId, events: GameEvent[] = []): GameFile {
  const now = new Date().toISOString();

  return {
    schemaVersion: 3,
    game: {
      scriptId,
      id: "local-game",
      name: scriptDisplayName(scriptId),
      createdAt: now,
      updatedAt: now,
      events,
    },
  };
}

export type GameStoreDependencies = {
  scriptId: ScriptId;
  core: CoreAdapter;
  storage: GameStorageDriver;
};

export type PendingConfirmedReveal = {
  payload: RevealPayload;
  step: PhaseStep;
  confirmedEventCount: number;
};

export function useGameStore({ scriptId, core, storage }: GameStoreDependencies) {
  const [storageDriver] = useState<GameStorageDriver>(() => storage);
  const [gameFile, setGameFile] = useState<GameFile>(() => createGameFile(scriptId));
  const [setupDraft, setSetupDraft] = useState<SetupDraft>(() => createSetupDraft());
  const [replayResult, setReplayResult] = useState<CoreResult<ReplayState>>();
  const [proposalResult, setProposalResult] = useState<CoreResult<Proposal>>();
  const [pendingConfirmedReveal, setPendingConfirmedReveal] = useState<PendingConfirmedReveal>();
  const [asyncSetupExpectedCounts, setAsyncSetupExpectedCounts] = useState<{
    requestKey: string;
    counts: SetupDistribution;
  }>();
  const [busy, setBusy] = useState(false);
  const [undoReplayPending, setUndoReplayPending] = useState(false);
  const undoReplayTargetEventCount = useRef<number | undefined>(undefined);
  const [loadError, setLoadError] = useState<string>();
  const [storageReady, setStorageReady] = useState(false);
  const [autosaveRecoveryError, setAutosaveRecoveryError] = useState<string>();
  const [storageWriteError, setStorageWriteError] = useState<string>();
  const [gameSessionRevision, setGameSessionRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;

    loadLatestGame(storageDriver)
      .then(async (storedGameFile) => {
        if (cancelled) return;
        if (storedGameFile) {
          const storedReplay = await core.replay(storedGameFile);
          if (cancelled) return;
          if (!storedReplay.ok) {
            setAutosaveRecoveryError(storedReplay.error.messageKo);
            setStorageReady(true);
            return;
          }
          setSetupDraft((current) =>
            syncSetupDraftFromReplayState(
              current,
              storedReplay.value,
              storedGameFile.ui?.seatLayout,
            ),
          );
          setReplayResult(storedReplay);
          setGameFile(storedGameFile);
        }
        setStorageReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAutosaveRecoveryError(error instanceof Error ? error.message : "저장된 게임 로드 실패");
        setStorageReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [core, storageDriver]);

  useEffect(() => {
    if (!storageReady || autosaveRecoveryError || storageWriteError) return;

    saveLatestGame(gameFile, storageDriver)
      .then(() => setStorageWriteError(undefined))
      .catch((error: unknown) => {
        setStorageWriteError(error instanceof Error ? error.message : "게임 자동 저장 실패");
      });
  }, [autosaveRecoveryError, gameFile, storageDriver, storageReady, storageWriteError]);

  useEffect(() => {
    let cancelled = false;

    core.replay(gameFile)
      .then((result) => {
        if (cancelled) return;
        setReplayResult(result);
        if (
          undoReplayTargetEventCount.current !== undefined &&
          (!result.ok || result.value.eventCount === undoReplayTargetEventCount.current)
        ) {
          undoReplayTargetEventCount.current = undefined;
          setUndoReplayPending(false);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        undoReplayTargetEventCount.current = undefined;
        setUndoReplayPending(false);
        setLoadError(error instanceof Error ? error.message : "앱 상태 로드 실패");
      });

    return () => {
      cancelled = true;
    };
  }, [core, gameFile]);

  const hasConfirmedEvents = gameFile.game.events.length > 0;
  const replayState = replayResult?.ok ? replayResult.value : undefined;
  const phase = replayState?.phase;
  const players = replayState?.players ?? [];
  const currentStep = replayState?.currentStep ?? undefined;
  const phaseOverview = replayState?.phaseOverview ?? [];
  const dayState = replayState?.dayState;
  const ruleState = replayState?.ruleState;
  const gameEnd = replayState?.gameEnd;
  const setupConfirmed = players.length > 0;
  const transitionBusy = busy || undoReplayPending;
  const replayCaughtUp = replayState?.eventCount === gameFile.game.events.length;
  const latestEvent = gameFile.game.events.at(-1);
  const latestUndoUnit = latestCanonicalUndoUnit(gameFile);
  const latestLiveUndoEvent = latestUndoUnit
    ? {
        ...latestUndoUnit,
        events: gameFile.game.events.filter((event) => latestUndoUnit.eventIds.includes(event.id)),
      }
    : undefined;
  const canUndoLatestLiveEvent = Boolean(latestLiveUndoEvent) && !transitionBusy && replayCaughtUp;
  const canRecoverConfirmedSetup =
    gameFile.game.events.length === 1 &&
    latestEvent?.type === "setupConfirmed" &&
    !transitionBusy &&
    replayCaughtUp;
  const createGamePlayers = useMemo(() => toCreateGamePlayers(setupDraft.players), [setupDraft.players]);
  const setupDistributionRequest = useMemo(
    () => ({
      scriptId,
      playerCount: setupDraft.players.length,
      actualCharacters: setupDraft.players.flatMap((player) =>
        player.actualCharacter ? [player.actualCharacter] : [],
      ),
    }),
    [scriptId, setupDraft.players],
  );
  const setupDistributionRequestKey = JSON.stringify(setupDistributionRequest);
  const setupExpectedCounts = useMemo(() => {
    const result = core.setupDistributionSync(setupDistributionRequest);
    if (result?.ok) return result.value;
    return asyncSetupExpectedCounts?.requestKey === setupDistributionRequestKey
      ? asyncSetupExpectedCounts.counts
      : undefined;
  }, [asyncSetupExpectedCounts, core, setupDistributionRequest, setupDistributionRequestKey]);
  const setupHintsReady = Boolean(setupExpectedCounts);
  const shownWarnings =
    !hasConfirmedEvents && proposalResult?.ok ? proposalResult.value.warnings : replayState?.warnings ?? [];
  const pendingConfirmedRevealReady = pendingConfirmedReveal
    ? replayState?.eventCount === pendingConfirmedReveal.confirmedEventCount
    : true;
  const suggestionContextFingerprint = useMemo(
    () => JSON.stringify([gameFile, replayState]),
    [gameFile, replayState],
  );

  useEffect(() => {
    if (!setupConfirmed) return;
    setSetupDraft((current) =>
      syncSetupDraftFromReplayState(current, replayState, gameFile.ui?.seatLayout),
    );
  }, [gameFile.ui?.seatLayout, replayState, setupConfirmed]);

  useEffect(() => {
    if (hasConfirmedEvents) return;

    let cancelled = false;
    const requestKey = setupDistributionRequestKey;
    core.setupDistribution(setupDistributionRequest)
      .then((result) => {
        if (!cancelled && result.ok) {
          setAsyncSetupExpectedCounts({
            requestKey,
            counts: result.value,
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "설정 힌트 계산 실패");
      });

    return () => {
      cancelled = true;
    };
  }, [core, hasConfirmedEvents, setupDistributionRequest, setupDistributionRequestKey]);

  useEffect(() => {
    if (hasConfirmedEvents) return;
    if (!createGamePlayers) {
      setProposalResult(undefined);
      return;
    }

    let cancelled = false;
    core.propose(gameFile, {
      type: "createGame",
      payload: { players: createGamePlayers },
    })
      .then((result) => {
        if (!cancelled) setProposalResult(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProposalResult({
          ok: false,
          error: {
            code: "SETUP_PREVIEW_FAILED",
            messageKo: error instanceof Error ? error.message : "설정 검토 실패",
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [core, createGamePlayers, gameFile, hasConfirmedEvents]);

  async function confirmSetup() {
    if (autosaveRecoveryError) return;

    if (!createGamePlayers) {
      setProposalResult({
        ok: false,
        error: {
          code: "SETUP_INCOMPLETE",
          messageKo: "모든 좌석에 실제 캐릭터를 배정해야 합니다.",
        },
      });
      return;
    }

    setBusy(true);
    setLoadError(undefined);

    const result = await core.propose(gameFile, {
      type: "createGame",
      payload: { players: createGamePlayers },
    }).catch((error: unknown): CoreResult<Proposal> => ({
      ok: false,
      error: {
        code: "WASM_LOAD_FAILED",
        messageKo: error instanceof Error ? error.message : "앱 상태 로드 실패",
      },
    }));

    setProposalResult(result);
    setBusy(false);

    if (!result.ok) return;

    appendProposalEvent(result.value, {
      preset: setupDraft.seatLayoutPreset,
      positions: structuredClone(setupDraft.seatPositions),
    });
  }

  async function confirmCurrentStep(confirmation: PhaseStepConfirmation = {}) {
    await proposeCurrentStep("confirmStep", confirmation);
  }

  async function useSlayerAbility(targetPlayerId: string, targetRegistration: import("./core/types").UseSlayerAbilityPayload["targetRegistration"]) {
    const ability = ruleState?.slayerAbility;
    if (!currentStep || !ability) return;
    setBusy(true);
    setLoadError(undefined);
    const result = await core.propose(gameFile, {
      type: "useSlayerAbility",
      payload: {
        discussionStepId: currentStep.id,
        expectedEventCount: gameFile.game.events.length,
        actorPlayerId: ability.actorPlayerId,
        targetPlayerId,
        targetRegistration,
      },
    }).catch((error: unknown): CoreResult<Proposal> => ({ ok: false, error: { code: "WASM_LOAD_FAILED", messageKo: error instanceof Error ? error.message : "처단자 능력 확정 실패" } }));
    setProposalResult(result);
    setBusy(false);
    if (result.ok) appendProposalEvent(result.value);
  }

  async function endGame(winningTeam: "good" | "evil") {
    if (!setupConfirmed || gameEnd) return;
    setBusy(true);
    setLoadError(undefined);
    const result = await core.propose(gameFile, {
      type: "endGame",
      payload: {
        winningTeam,
        expectedEventCount: gameFile.game.events.length,
      },
    }).catch((error: unknown): CoreResult<Proposal> => ({
      ok: false,
      error: {
        code: "WASM_LOAD_FAILED",
        messageKo: error instanceof Error ? error.message : "게임 종료 확정 실패",
      },
    }));
    setProposalResult(result);
    setBusy(false);
    if (result.ok) appendProposalEvent(result.value);
  }

  async function updatePlayerAnnotations(
    playerId: string,
    annotations: PlayerAnnotationsInput,
  ): Promise<CoreResult<Proposal> | undefined> {
    if (!setupConfirmed || gameEnd || transitionBusy) return undefined;
    setBusy(true);
    setLoadError(undefined);
    const result = await core.propose(gameFile, {
      type: "updatePlayerAnnotations",
      payload: {
        playerId,
        expectedEventCount: gameFile.game.events.length,
        ...annotations,
      },
    }).catch((error: unknown): CoreResult<Proposal> => ({
      ok: false,
      error: {
        code: "WASM_LOAD_FAILED",
        messageKo: error instanceof Error ? error.message : "플레이어 표시 수정 실패",
      },
    }));
    setProposalResult(result);
    setBusy(false);
    if (result.ok) appendProposalEvent(result.value);
    return result;
  }

  async function skipCurrentStep() {
    await proposeCurrentStep("skipStep");
  }

  async function suggestPhaseInput(
    request: PhaseInputSuggestionRequest,
  ): Promise<CoreResult<PhaseInputSuggestion>> {
    return core.suggestPhaseInput(gameFile, request).catch((error: unknown) => ({
      ok: false,
      error: {
        code: "WASM_LOAD_FAILED",
        messageKo: error instanceof Error ? error.message : "무작위 추천을 불러오지 못했습니다.",
      },
    }));
  }

  async function proposeCurrentStep(
    commandType: "confirmStep" | "skipStep",
    confirmation: PhaseStepConfirmation = {},
  ) {
    if (!currentStep) return;

    setBusy(true);
    setLoadError(undefined);

    const command =
      commandType === "confirmStep"
        ? {
            type: "confirmStep" as const,
            payload: {
              stepId: currentStep.id,
              input: confirmation.input ?? null,
              ...(confirmation.deliveredResult
                ? { deliveredResult: confirmation.deliveredResult }
                : {}),
              ...(confirmation.registrationJudgments
                ? { registrationJudgments: confirmation.registrationJudgments }
                : {}),
            },
          }
        : { type: "skipStep" as const, payload: { stepId: currentStep.id, input: null as null } };
    const result = await core.propose(gameFile, command).catch((error: unknown): CoreResult<Proposal> => ({
      ok: false,
      error: {
        code: "WASM_LOAD_FAILED",
        messageKo: error instanceof Error ? error.message : "앱 상태 로드 실패",
      },
    }));

    setProposalResult(result);
    setBusy(false);

    if (!result.ok) return;
    if (commandType === "confirmStep") {
      const payload = proposalRevealPayload(result.value);
      if (payload) {
        setPendingConfirmedReveal({
          payload,
          step: currentStep,
          confirmedEventCount: gameFile.game.events.length + 1,
        });
      }
    }
    appendProposalEvent(result.value);
  }

  function appendProposalEvent(proposal: Proposal, seatLayout?: SeatLayoutState) {
    setGameFile((current) => ({
      ...current,
      ...(seatLayout ? { ui: { seatLayout } } : {}),
      game: {
        ...current.game,
        updatedAt: new Date().toISOString(),
        events: [...current.game.events, proposal.event],
      },
    }));
  }

  function resetSetup() {
    if (hasConfirmedEvents && !window.confirm("현재 확정된 이벤트를 새 게임으로 교체할까요?")) {
      return;
    }

    undoReplayTargetEventCount.current = undefined;
    setUndoReplayPending(false);
    setAutosaveRecoveryError(undefined);
    setStorageWriteError(undefined);
    setLoadError(undefined);
    setGameFile(createGameFile(scriptId));
    setProposalResult(undefined);
    setPendingConfirmedReveal(undefined);
    setSetupDraft(createSetupDraft());
  }

  function removeLatestEvent(expectedEventId: string, expectedType: "live" | "setup"): boolean {
    const currentLatestEvent = gameFile.game.events.at(-1);
    const currentUndoUnit = expectedType === "live" ? latestCanonicalUndoUnit(gameFile) : undefined;
    const typeMatches = expectedType === "setup"
      ? currentLatestEvent?.type === "setupConfirmed" && gameFile.game.events.length === 1
      : currentUndoUnit !== undefined;
    const currentTargetId = expectedType === "setup" ? currentLatestEvent?.id : currentUndoUnit?.id;
    if (
      transitionBusy ||
      !replayCaughtUp ||
      !currentLatestEvent ||
      currentTargetId !== expectedEventId ||
      !typeMatches
    ) {
      setLoadError("최근 행동이 변경되어 되돌리지 않았습니다.");
      return false;
    }

    const removedEventCount = expectedType === "live" ? currentUndoUnit!.eventIds.length : 1;
    const nextEventCount = gameFile.game.events.length - removedEventCount;
    undoReplayTargetEventCount.current = nextEventCount;
    setUndoReplayPending(true);
    setStorageWriteError(undefined);
    setLoadError(undefined);
    setProposalResult(undefined);
    setPendingConfirmedReveal(undefined);
    setGameFile((current) => {
      if (expectedType === "live") {
        return removeLatestCanonicalUndoUnit(current, expectedEventId)?.gameFile ?? current;
      }
      const nextGame = {
        ...current.game,
        updatedAt: new Date().toISOString(),
        events: current.game.events.slice(0, -1),
      };
      return { schemaVersion: 3, game: nextGame };
    });
    return true;
  }

  function undoLatestLiveEvent(expectedEventId: string): boolean {
    return removeLatestEvent(expectedEventId, "live");
  }

  function recoverConfirmedSetup() {
    if (!canRecoverConfirmedSetup || !latestEvent) return;
    if (!window.confirm("설정 확정을 되돌리고 다시 수정할까요?")) return;
    if (removeLatestEvent(latestEvent.id, "setup") && players.length > 0) {
      setSetupDraft(createSetupDraftFromConfirmedPlayers(players, gameFile.ui?.seatLayout));
    }
  }

  function clearProposalResult() {
    setProposalResult(undefined);
  }

  function continueAfterConfirmedReveal() {
    if (!pendingConfirmedRevealReady) return;
    setPendingConfirmedReveal(undefined);
  }

  async function importGameFile(json: string) {
    setBusy(true);
    setLoadError(undefined);
    try {
      const importedGameFile = importGameFileJson(json, scriptId);
      const importedReplay = await core.replay(importedGameFile);
      if (!importedReplay.ok) {
        setLoadError(importedReplay.error.messageKo);
        return;
      }
      if (hasConfirmedEvents && !window.confirm("현재 확정된 이벤트를 가져온 게임으로 교체할까요?")) {
        return;
      }
      setReplayResult(importedReplay);
      setSetupDraft((current) =>
        syncSetupDraftFromReplayState(
          current,
          importedReplay.value,
          importedGameFile.ui?.seatLayout,
        ),
      );
      setAutosaveRecoveryError(undefined);
      setStorageWriteError(undefined);
      undoReplayTargetEventCount.current = undefined;
      setUndoReplayPending(false);
      setGameFile(importedGameFile);
      setGameSessionRevision((current) => current + 1);
      setProposalResult(undefined);
      setPendingConfirmedReveal(undefined);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "게임 파일 가져오기 실패");
    } finally {
      setBusy(false);
    }
  }

  return {
    gameFile,
    setupDraft,
    setSetupDraft,
    replayResult,
    proposalResult,
    pendingConfirmedReveal,
    pendingConfirmedRevealReady,
    busy: transitionBusy,
    loadError: loadError ?? autosaveRecoveryError ?? storageWriteError,
    storageReady,
    setupConfirmationBlocked: Boolean(autosaveRecoveryError),
    hasConfirmedEvents,
    players,
    currentStep,
    phase,
    gameSessionRevision,
    phaseOverview,
    dayState,
    ruleState,
    gameEnd,
    setupConfirmed,
    latestLiveUndoEvent,
    canUndoLatestLiveEvent,
    canRecoverConfirmedSetup,
    setupExpectedCounts,
    setupHintsReady,
    shownWarnings,
    suggestionContextFingerprint,
    confirmSetup,
    confirmCurrentStep,
    skipCurrentStep,
    suggestPhaseInput,
    useSlayerAbility,
    endGame,
    updatePlayerAnnotations,
    resetSetup,
    undoLatestLiveEvent,
    recoverConfirmedSetup,
    clearProposalResult,
    continueAfterConfirmedReveal,
    importGameFile,
    exportGameFile: () => exportGameFileJson(gameFile),
  };
}
