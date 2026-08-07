import { useEffect, useMemo, useState } from "react";
import type { CoreAdapter } from "./core/coreAdapter.js";
import {
  CanonicalSessionController,
  replayMatches,
  type CanonicalReplaySnapshot,
} from "./core/canonicalSessionController.js";
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
  SeatLayoutState,
  SetupDistribution,
} from "./core/types.js";
import { scriptDisplayName, type ScriptId } from "./core/scripts.js";
import {
  exportGameFileJson,
  importGameFileJson,
} from "./gameStorage.js";
import { proposalRevealPayload } from "./core/revealPayload.js";
import {
  latestCanonicalUndoUnit,
} from "./core/canonicalUndo.js";
import { syncSetupDraftFromReplayState } from "./gameStoreSync.js";
import {
  createSetupDraft,
  createSetupDraftFromConfirmedPlayers,
  setupDraftSelectedCharacterIds,
  toCreateGamePlayers,
  type SetupDraft,
} from "./setupDraft.js";
import {
  loadCompatibleWebSession,
  saveCompatibleWebSession,
  type CompatibleWebSessionStorage,
  type WebSessionSnapshot,
} from "./webSessionStorage.js";

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
  storage: CompatibleWebSessionStorage<SetupDraft, TbSessionPresentation>;
};

export type TbSessionPresentation = Record<string, never>;

export type PendingConfirmedReveal = {
  payload: RevealPayload;
  step: PhaseStep;
  confirmedEventCount: number;
};

export function useGameStore({ scriptId, core, storage }: GameStoreDependencies) {
  const [storageDriver] = useState<CompatibleWebSessionStorage<SetupDraft, TbSessionPresentation>>(
    () => storage,
  );
  const canonicalSession = useMemo(
    () => new CanonicalSessionController(scriptId, core),
    [core, scriptId],
  );
  const [gameFile, setGameFile] = useState<GameFile>(() => createGameFile(scriptId));
  const [setupDraft, setSetupDraft] = useState<SetupDraft>(() => createSetupDraft());
  const [replayResult, setReplayResult] = useState<CoreResult<CanonicalReplaySnapshot>>();
  const [proposalResult, setProposalResult] = useState<CoreResult<Proposal>>();
  const [pendingConfirmedReveal, setPendingConfirmedReveal] = useState<PendingConfirmedReveal>();
  const [asyncSetupExpectedCounts, setAsyncSetupExpectedCounts] = useState<{
    requestKey: string;
    counts: SetupDistribution;
  }>();
  const [busy, setBusy] = useState(false);
  const [undoReplayPending, setUndoReplayPending] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [storageReady, setStorageReady] = useState(false);
  const [autosaveRecoveryError, setAutosaveRecoveryError] = useState<string>();
  const [storageWriteError, setStorageWriteError] = useState<string>();
  const [gameSessionRevision, setGameSessionRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;

    loadCompatibleWebSession(
      storageDriver,
      (canonical) => createTbSessionSnapshot(
        scriptId,
        canonical ?? createGameFile(scriptId),
        createSetupDraft(),
      ),
    )
      .then(async (storedSession) => {
        if (cancelled) return;
        const storedReplay = await canonicalSession.replay(storedSession.canonical);
        if (cancelled) return;
        if (!storedReplay.ok) {
          if (storedReplay.error.code === "STALE_REPLAY") {
            setGameFile(storedSession.canonical);
            setSetupDraft(storedSession.setupDraft);
          }
          setAutosaveRecoveryError(storedReplay.error.messageKo);
          setStorageReady(true);
          return;
        }
        setSetupDraft(syncSetupDraftFromReplayState(
          storedSession.setupDraft,
          storedReplay.value,
          storedSession.canonical.ui?.seatLayout,
        ));
        setReplayResult(storedReplay);
        setGameFile(storedSession.canonical);
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
  }, [canonicalSession, scriptId, storageDriver]);

  useEffect(() => {
    if (!storageReady || autosaveRecoveryError) return;

    saveCompatibleWebSession(
      createTbSessionSnapshot(scriptId, gameFile, setupDraft),
      storageDriver,
    )
      .then(() => setStorageWriteError(undefined))
      .catch((error: unknown) => {
        setStorageWriteError(error instanceof Error ? error.message : "게임 자동 저장 실패");
      });
  }, [autosaveRecoveryError, gameFile, scriptId, setupDraft, storageDriver, storageReady]);

  useEffect(() => {
    if (replayResult?.ok && replayMatches(gameFile, replayResult.value)) return;
    let cancelled = false;

    canonicalSession.replay(gameFile)
      .then((result) => {
        if (cancelled) return;
        setReplayResult(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "앱 상태 로드 실패");
      });

    return () => {
      cancelled = true;
    };
  }, [canonicalSession, gameFile, replayResult]);

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
  const replayCaughtUp = replayMatches(gameFile, replayState);
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
      actualCharacters: setupDraftSelectedCharacterIds(setupDraft),
    }),
    [scriptId, setupDraft],
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
    canonicalSession.propose(gameFile, replayState, {
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
  }, [canonicalSession, createGamePlayers, gameFile, hasConfirmedEvents, replayState]);

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

    const result = await executeCommand(
      { type: "createGame", payload: { players: createGamePlayers } },
      {
        preset: setupDraft.seatLayoutPreset,
        positions: structuredClone(setupDraft.seatPositions),
      },
      true,
    );

    setProposalResult(result);
    setBusy(false);
  }

  async function confirmCurrentStep(confirmation: PhaseStepConfirmation = {}) {
    await proposeCurrentStep("confirmStep", confirmation);
  }

  async function useSlayerAbility(targetPlayerId: string, targetRegistration: import("./core/types").UseSlayerAbilityPayload["targetRegistration"]) {
    const ability = ruleState?.slayerAbility;
    if (!currentStep || !ability) return;
    setBusy(true);
    setLoadError(undefined);
    const result = await executeCommand({
      type: "useSlayerAbility",
      payload: {
        discussionStepId: currentStep.id,
        expectedEventCount: gameFile.game.events.length,
        actorPlayerId: ability.actorPlayerId,
        targetPlayerId,
        targetRegistration,
      },
    });
    setProposalResult(result);
    setBusy(false);
  }

  async function endGame(winningTeam: "good" | "evil") {
    if (!setupConfirmed || gameEnd) return;
    setBusy(true);
    setLoadError(undefined);
    const result = await executeCommand({
      type: "endGame",
      payload: {
        winningTeam,
        expectedEventCount: gameFile.game.events.length,
      },
    });
    setProposalResult(result);
    setBusy(false);
  }

  async function updatePlayerAnnotations(
    playerId: string,
    annotations: PlayerAnnotationsInput,
  ): Promise<CoreResult<Proposal> | undefined> {
    if (!setupConfirmed || gameEnd || transitionBusy) return undefined;
    setBusy(true);
    setLoadError(undefined);
    const result = await executeCommand({
      type: "updatePlayerAnnotations",
      payload: {
        playerId,
        expectedEventCount: gameFile.game.events.length,
        ...annotations,
      },
    });
    setProposalResult(result);
    setBusy(false);
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
    const result = await executeCommand(command, undefined, false, (proposed) => {
      if (commandType !== "confirmStep") return;
      const payload = proposalRevealPayload(proposed);
      if (!payload) return;
      setPendingConfirmedReveal({
        payload,
        step: currentStep,
        confirmedEventCount: gameFile.game.events.length + 1,
      });
    });

    setProposalResult(result);
    setBusy(false);

  }

  async function executeCommand(
    command: import("./core/types.js").Command,
    seatLayout?: SeatLayoutState,
    durable = false,
    onProposed?: (proposal: Proposal) => void,
  ): Promise<CoreResult<Proposal>> {
    const executed = await canonicalSession.execute(gameFile, replayState, command, onProposed);
    if (!executed.ok) return executed;
    const nextGameFile = seatLayout
      ? { ...executed.value.gameFile, ui: { seatLayout } }
      : executed.value.gameFile;
    if (durable) {
      try {
        await saveCompatibleWebSession(
          createTbSessionSnapshot(scriptId, nextGameFile, setupDraft),
          storageDriver,
        );
        setStorageWriteError(undefined);
      } catch (error) {
        const messageKo = error instanceof Error ? error.message : "게임 자동 저장 실패";
        setStorageWriteError(messageKo);
        return { ok: false, error: { code: "STORAGE_WRITE_FAILED", messageKo } };
      }
    }
    setReplayResult({ ok: true, value: executed.value.replayState });
    setGameFile(nextGameFile);
    return { ok: true, value: executed.value.proposal };
  }

  function resetSetup() {
    if (hasConfirmedEvents && !window.confirm("현재 확정된 이벤트를 새 게임으로 교체할까요?")) {
      return;
    }

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

    setUndoReplayPending(true);
    setStorageWriteError(undefined);
    setLoadError(undefined);
    setProposalResult(undefined);
    setPendingConfirmedReveal(undefined);
    if (expectedType === "live") {
      const prepared = canonicalSession.prepareUndo(gameFile, replayState, expectedEventId);
      if (!prepared.ok) {
        setLoadError(prepared.error.messageKo);
        setUndoReplayPending(false);
        return false;
      }
      setGameFile(prepared.value.gameFile);
      void canonicalSession.replay(prepared.value.gameFile).then((result) => {
        if (!result.ok) setLoadError(result.error.messageKo);
        else setReplayResult(result);
        setUndoReplayPending(false);
      });
    } else {
      const nextGameFile: GameFile = {
        schemaVersion: 3,
        game: {
          ...gameFile.game,
          updatedAt: new Date().toISOString(),
          events: gameFile.game.events.slice(0, -1),
        },
      };
      void canonicalSession.replay(nextGameFile).then((result) => {
        if (!result.ok) {
          setLoadError(result.error.messageKo);
        } else {
          setGameFile(nextGameFile);
          setReplayResult(result);
        }
        setUndoReplayPending(false);
      });
    }
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
      const importedReplay = await canonicalSession.replay(importedGameFile);
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

function createTbSessionSnapshot(
  scriptId: ScriptId,
  canonical: GameFile,
  setupDraft: SetupDraft,
): WebSessionSnapshot<SetupDraft, TbSessionPresentation> {
  return {
    version: 1,
    scriptId,
    savedAt: new Date().toISOString(),
    canonical,
    setupDraft,
    presentation: {},
  };
}
