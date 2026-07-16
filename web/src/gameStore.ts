import { useEffect, useMemo, useState } from "react";
import type { CoreAdapter } from "./core/coreAdapter.js";
import type {
  CoreResult,
  GameEvent,
  GameFile,
  PhaseInputSuggestion,
  PhaseInputSuggestionRequest,
  PhaseStep,
  PhaseStepConfirmation,
  Proposal,
  RevealPayload,
  ReplayState,
  SetupDistribution,
} from "./core/types.js";
import {
  exportGameFileJson,
  importGameFileJson,
  loadLatestGame,
  saveLatestGame,
  type GameStorageDriver,
} from "./gameStorage.js";
import { proposalRevealPayload } from "./core/revealPayload.js";
import { syncSetupDraftFromReplayState } from "./gameStoreSync.js";
import {
  createSetupDraft,
  createSetupDraftFromConfirmedPlayers,
  toCreateGamePlayers,
  type SetupDraft,
} from "./setupDraft.js";

export function createGameFile(events: GameEvent[] = []): GameFile {
  const now = new Date().toISOString();

  return {
    schemaVersion: 2,
    game: {
      id: "local-game",
      name: "Trouble Brewing",
      createdAt: now,
      updatedAt: now,
      events,
    },
  };
}

export type GameStoreDependencies = {
  core: CoreAdapter;
  storage: GameStorageDriver;
};

export type PendingConfirmedReveal = {
  payload: RevealPayload;
  step: PhaseStep;
  confirmedEventCount: number;
};

export function useGameStore({ core, storage }: GameStoreDependencies) {
  const [storageDriver] = useState<GameStorageDriver>(() => storage);
  const [gameFile, setGameFile] = useState<GameFile>(() => createGameFile());
  const [setupDraft, setSetupDraft] = useState<SetupDraft>(() => createSetupDraft());
  const [replayResult, setReplayResult] = useState<CoreResult<ReplayState>>();
  const [proposalResult, setProposalResult] = useState<CoreResult<Proposal>>();
  const [pendingConfirmedReveal, setPendingConfirmedReveal] = useState<PendingConfirmedReveal>();
  const [asyncSetupExpectedCounts, setAsyncSetupExpectedCounts] = useState<{
    requestKey: string;
    counts: SetupDistribution;
  }>();
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    loadLatestGame(storageDriver)
      .then(async (storedGameFile) => {
        if (cancelled) return;
        if (storedGameFile) {
          const storedReplay = await core.replay(storedGameFile);
          if (cancelled) return;
          if (!storedReplay.ok) {
            setStorageError(storedReplay.error.messageKo);
            setStorageReady(true);
            return;
          }
          setReplayResult(storedReplay);
          setGameFile(storedGameFile);
        }
        setStorageReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStorageError(error instanceof Error ? error.message : "저장된 게임 로드 실패");
        setStorageReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [core, storageDriver]);

  useEffect(() => {
    if (!storageReady || storageError) return;

    saveLatestGame(gameFile, storageDriver)
      .then(() => setStorageError(undefined))
      .catch((error: unknown) => {
        setStorageError(error instanceof Error ? error.message : "게임 자동 저장 실패");
      });
  }, [gameFile, storageDriver, storageError, storageReady]);

  useEffect(() => {
    let cancelled = false;

    core.replay(gameFile)
      .then((result) => {
        if (!cancelled) setReplayResult(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "앱 상태 로드 실패");
      });

    return () => {
      cancelled = true;
    };
  }, [core, gameFile]);

  const hasConfirmedEvents = gameFile.game.events.length > 0;
  const replayState = replayResult?.ok ? replayResult.value : undefined;
  const players = replayState?.players ?? [];
  const currentStep = replayState?.currentStep ?? undefined;
  const phaseOverview = replayState?.phaseOverview ?? [];
  const dayState = replayState?.dayState;
  const ruleState = replayState?.ruleState;
  const setupConfirmed = players.length > 0;
  const createGamePlayers = useMemo(() => toCreateGamePlayers(setupDraft.players), [setupDraft.players]);
  const setupDistributionRequest = useMemo(
    () => ({
      playerCount: setupDraft.players.length,
      actualCharacters: setupDraft.players.flatMap((player) =>
        player.actualCharacter ? [player.actualCharacter] : [],
      ),
    }),
    [setupDraft.players],
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
    setSetupDraft((current) => syncSetupDraftFromReplayState(current, replayState));
  }, [replayState, setupConfirmed]);

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
    if (!createGamePlayers) {
      setProposalResult({
        ok: false,
        error: {
          code: "SETUP_INCOMPLETE",
          messageKo: "모든 좌석에 Actual Character를 배정해야 합니다.",
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

    appendProposalEvent(result.value);
  }

  async function confirmCurrentStep(confirmation: PhaseStepConfirmation = {}) {
    await proposeCurrentStep("confirmStep", confirmation);
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

  function appendProposalEvent(proposal: Proposal) {
    setGameFile((current) => ({
      ...current,
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

    setStorageError(undefined);
    setLoadError(undefined);
    setGameFile(createGameFile());
    setProposalResult(undefined);
    setPendingConfirmedReveal(undefined);
    setSetupDraft(createSetupDraft());
  }

  function undoLatestEvent() {
    if (!window.confirm("설정 확정을 되돌리고 다시 수정할까요?")) return;

    if (players.length > 0) {
      setSetupDraft(createSetupDraftFromConfirmedPlayers(players));
    }
    setProposalResult(undefined);
    setPendingConfirmedReveal(undefined);
    setGameFile((current) => {
      if (current.game.events.length === 0) return current;
      return {
        ...current,
        game: {
          ...current.game,
          updatedAt: new Date().toISOString(),
          events: current.game.events.slice(0, -1),
        },
      };
    });
  }

  function clearProposalResult() {
    setProposalResult(undefined);
  }

  function continueAfterConfirmedReveal() {
    if (!pendingConfirmedRevealReady) return;
    setPendingConfirmedReveal(undefined);
  }

  async function importGameFile(json: string) {
    if (hasConfirmedEvents && !window.confirm("현재 확정된 이벤트를 가져온 게임으로 교체할까요?")) {
      return;
    }

    setBusy(true);
    setLoadError(undefined);
    try {
      const importedGameFile = importGameFileJson(json);
      const importedReplay = await core.replay(importedGameFile);
      if (!importedReplay.ok) {
        setLoadError(importedReplay.error.messageKo);
        return;
      }
      setReplayResult(importedReplay);
      setSetupDraft((current) => syncSetupDraftFromReplayState(current, importedReplay.value));
      setStorageError(undefined);
      setGameFile(importedGameFile);
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
    busy,
    loadError: loadError ?? storageError,
    storageReady,
    hasConfirmedEvents,
    players,
    currentStep,
    phaseOverview,
    dayState,
    ruleState,
    setupConfirmed,
    setupExpectedCounts,
    setupHintsReady,
    shownWarnings,
    suggestionContextFingerprint,
    confirmSetup,
    confirmCurrentStep,
    skipCurrentStep,
    suggestPhaseInput,
    resetSetup,
    undoLatestEvent,
    clearProposalResult,
    continueAfterConfirmedReveal,
    importGameFile,
    exportGameFile: () => exportGameFileJson(gameFile),
  };
}
