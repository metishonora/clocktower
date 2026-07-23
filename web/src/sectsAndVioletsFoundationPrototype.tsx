import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import "./sectsAndVioletsFoundationPrototype.css";
import type { CoreAdapter } from "./core/coreAdapter";
import { SECTS_AND_VIOLETS } from "./core/scripts";
import type {
  Command,
  GameEvent,
  GameFile,
  PhaseStep,
  ReplayState,
  SectsAndVioletsPhaseCheckpoint,
  SectsAndVioletsSessionState,
  SetupDistribution,
} from "./core/types";
import {
  SectsAndVioletsLiveGrimoire,
  SectsAndVioletsLiveProgress,
  type LiveHandoff,
  type LivePlayer,
} from "./sectsAndVioletsLivePhase";
import {
  grimoireHeights,
  rectangularSeatPositions,
} from "./sectsAndVioletsGrimoireLayout";
export { grimoireHeights, rectangularSeatPositions } from "./sectsAndVioletsGrimoireLayout";
import {
  exportGameFileJson,
  importGameFileJson,
  loadLatestGame,
  saveLatestGame,
  type GameStorageDriver,
} from "./gameStorage";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacterDetail } from "./characterDetails";
import { CharacterDetailButton } from "./components/CharacterRulesCard";
import { SectsAndVioletsReveal } from "./features/reveal/SectsAndVioletsReveal";
import {
  SnakeCharmerIdentityReveal,
  SnakeCharmerIdentityRevealPrompt,
} from "./features/snakeCharmer/SnakeCharmerIdentityReveal";
import type { PlayerTokensByPlayerId } from "./features/grimoire/playerTokenPresentation";
import {
  exportLatestSectsAndVioletsCheckpoint,
  inferSectsAndVioletsCheckpoints,
  removeLatestSectsAndVioletsPhaseCheckpoint,
  withSectsAndVioletsSession,
} from "./sectsAndVioletsSession";
import {
  sectsAndVioletsCharacters as characters,
  type SectsAndVioletsCharacter as CatalogCharacter,
  type SectsAndVioletsCharacterKind as CharacterKind,
} from "./sectsAndVioletsCharacters";

type DemonChoice = "fangGu" | "vigormortis" | "noDashii" | "vortox";
type Alignment = "good" | "evil";
type PrototypeTab = "roles" | "seating" | "play" | "storage";
type TabMotion = "tabForward" | "tabBackward" | "";
type PlayPhase = "firstNight" | "day" | "laterNight";
type FirstNightStep = {
  id: string;
  name: string;
  characterId?: string;
  support: "manual" | "automated";
  summary: string;
};

const kindLabels: Record<CharacterKind, string> = {
  townsfolk: "마을 주민",
  outsider: "외부인",
  minion: "하수인",
  demon: "악마",
};

const kindOrder: CharacterKind[] = ["townsfolk", "outsider", "minion", "demon"];

const firstNightOrder: FirstNightStep[] = [
  { id: "philosopher", name: "철학자", characterId: "philosopher", support: "manual", summary: "철학자의 선택과 능력 획득을 마도서에서 처리합니다." },
  { id: "minionInfo", name: "하수인 정보", support: "automated", summary: "하수인에게 악마와 다른 하수인을 알려줍니다." },
  { id: "demonInfo", name: "악마 정보", support: "automated", summary: "악마에게 하수인과 블러프 직업을 알려줍니다." },
  { id: "snakeCharmer", name: "뱀 조련사", characterId: "snakeCharmer", support: "manual", summary: "선택한 플레이어를 확인하고 필요하면 직업과 성향을 교환합니다." },
  { id: "evilTwin", name: "사악한 쌍둥이", characterId: "evilTwin", support: "manual", summary: "두 쌍둥이가 서로를 확인하도록 안내합니다." },
  { id: "witch", name: "마녀", characterId: "witch", support: "manual", summary: "저주할 플레이어를 선택합니다." },
  { id: "cerenovus", name: "세레노버스", characterId: "cerenovus", support: "manual", summary: "플레이어와 광기 직업을 선택합니다." },
  { id: "clockmaker", name: "시계공", characterId: "clockmaker", support: "automated", summary: "악마와 가장 가까운 하수인 사이의 거리를 알려줍니다." },
  { id: "dreamer", name: "꿈꾸는 자", characterId: "dreamer", support: "manual", summary: "플레이어를 선택하고 직업 정보 두 개를 확인합니다." },
  { id: "seamstress", name: "재봉사", characterId: "seamstress", support: "manual", summary: "선택한 두 플레이어의 성향이 같은지 확인합니다." },
  { id: "mathematician", name: "수학자", characterId: "mathematician", support: "automated", summary: "비정상적으로 작동한 능력의 수를 알려줍니다." },
];

const demonChoices = characters.filter((character) => character.kind === "demon") as Array<CatalogCharacter & { id: DemonChoice }>;

const baseDistribution: Record<number, [number, number, number, number]> = {
  7: [5, 0, 1, 1],
  8: [5, 1, 1, 1],
  9: [5, 2, 1, 1],
  10: [7, 0, 2, 1],
  11: [7, 1, 2, 1],
  12: [7, 2, 2, 1],
  13: [9, 0, 3, 1],
  14: [9, 1, 3, 1],
  15: [9, 2, 3, 1],
};

export type SectsAndVioletsFoundationPrototypeProps = {
  coreAdapter?: CoreAdapter;
  storageDriver?: GameStorageDriver;
  production?: boolean;
};

export function SectsAndVioletsFoundationPrototype() {
  return <SectsAndVioletsFoundation />;
}

export function SectsAndVioletsFoundation({
  coreAdapter,
  storageDriver,
  production = false,
}: SectsAndVioletsFoundationPrototypeProps = {}) {
  const [activeTab, setActiveTab] = useState<PrototypeTab>("roles");
  const [tabMotion, setTabMotion] = useState<TabMotion>("");
  const [rosterConfirmed, setRosterConfirmed] = useState(false);
  const [seatingConfirmed, setSeatingConfirmed] = useState(false);
  const [playerCount, setPlayerCount] = useState(7);
  const [demon, setDemon] = useState<DemonChoice>("fangGu");
  const [selectedIds, setSelectedIds] = useState<string[]>(["fangGu"]);
  const [seatAssignments, setSeatAssignments] = useState<Record<number, string>>({});
  const [seatAlignments, setSeatAlignments] = useState<Record<number, Alignment>>({});
  const [seatNames, setSeatNames] = useState<Record<number, string>>({});
  const [selectedSeat, setSelectedSeat] = useState<number>();
  const [pendingCharacterId, setPendingCharacterId] = useState<string>();
  const [activeCharacterId, setActiveCharacterId] = useState("fangGu");
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [newGameConfirmOpen, setNewGameConfirmOpen] = useState(false);
  const [undoCheckpoint, setUndoCheckpoint] = useState<SectsAndVioletsPhaseCheckpoint>();
  const [firstNightStepIndex, setFirstNightStepIndex] = useState(0);
  const [revealedStepIds, setRevealedStepIds] = useState<string[]>([]);
  const [informationStepId, setInformationStepId] = useState<string>();
  const [playPhase, setPlayPhase] = useState<PlayPhase>("firstNight");
  const [dayComplete, setDayComplete] = useState(false);
  const [gameFile, setGameFile] = useState<GameFile>(createSectsAndVioletsGameFile);
  const [replayState, setReplayState] = useState<ReplayState>();
  const [phaseCheckpoints, setPhaseCheckpoints] = useState<SectsAndVioletsPhaseCheckpoint[]>([]);
  const [canonicalDistribution, setCanonicalDistribution] = useState<SetupDistribution>();
  const [operationBusy, setOperationBusy] = useState(false);
  const [operationError, setOperationError] = useState<string>();
  const [dismissedWarningKey, setDismissedWarningKey] = useState<string>();
  const [storageReady, setStorageReady] = useState(!storageDriver);
  const [autosaveRecoveryBlocked, setAutosaveRecoveryBlocked] = useState(false);
  const [autosaveRevision, setAutosaveRevision] = useState(0);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string>();
  const [liveHandoff, setLiveHandoff] = useState<LiveHandoff>();
  const [liveNominatorId, setLiveNominatorId] = useState<string>();
  const [liveNomineeId, setLiveNomineeId] = useState<string>();
  const [liveVoterIds, setLiveVoterIds] = useState<string[]>([]);
  const [liveTargetId, setLiveTargetId] = useState<string>();
  const [liveNominationCheckpointId, setLiveNominationCheckpointId] = useState<string>();
  const [acknowledgedIdentityRevealKeys, setAcknowledgedIdentityRevealKeys] = useState<string[]>([]);
  const [openedIdentityRevealKey, setOpenedIdentityRevealKey] = useState<string>();
  const lastEnqueuedAutosaveRevisionRef = useRef(0);
  const pendingAutosaveRef = useRef<GameFile | undefined>(undefined);
  const autosaveInFlightRef = useRef(false);
  const textAutosaveTimerRef = useRef<number | undefined>(undefined);
  const textAutosaveDirtyRef = useRef(false);
  const returnTriggerRef = useRef<HTMLButtonElement>(null);
  const returnCancelRef = useRef<HTMLButtonElement>(null);
  const newGameTriggerRef = useRef<HTMLButtonElement>(null);
  const newGameCancelRef = useRef<HTMLButtonElement>(null);
  const informationCloseRef = useRef<HTMLButtonElement>(null);
  const undoTriggerRef = useRef<HTMLButtonElement>(null);
  const undoDialogRef = useRef<HTMLElement>(null);
  const undoCancelRef = useRef<HTMLButtonElement>(null);
  const errorDialogRef = useRef<HTMLElement>(null);
  const errorConfirmRef = useRef<HTMLButtonElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const localDistribution = useMemo(() => {
    const base = baseDistribution[playerCount];
    const delta: [number, number, number, number] = demon === "fangGu"
      ? [-1, 1, 0, 0]
      : demon === "vigormortis" && base[1] > 0
        ? [1, -1, 0, 0]
        : [0, 0, 0, 0];
    return {
      delta,
      final: base.map((value, index) => value + delta[index]) as [number, number, number, number],
    };
  }, [demon, playerCount]);

  const distribution = useMemo(() => {
    if (!canonicalDistribution) return localDistribution;
    const final: [number, number, number, number] = [
      canonicalDistribution.Townsfolk,
      canonicalDistribution.Outsider,
      canonicalDistribution.Minion,
      canonicalDistribution.Demon,
    ];
    const base = baseDistribution[playerCount];
    return {
      final,
      delta: final.map((value, index) => value - base[index]) as [number, number, number, number],
    };
  }, [canonicalDistribution, localDistribution, playerCount]);

  const requiredByKind = Object.fromEntries(kindOrder.map((kind, index) => [kind, distribution.final[index]])) as Record<CharacterKind, number>;
  const selectedByKind = Object.fromEntries(kindOrder.map((kind) => [kind, selectedIds.filter((id) => characters.find((character) => character.id === id)?.kind === kind).length])) as Record<CharacterKind, number>;
  const remaining = playerCount - selectedIds.length;
  const rosterComplete = remaining === 0 && kindOrder.every((kind) => selectedByKind[kind] === requiredByKind[kind]);
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? characters[0];
  const activeCharacterAsset = sectsAndVioletsCharacterAsset(activeCharacter.id);
  const selectedDemon = demonChoices.find((choice) => choice.id === demon) ?? demonChoices[0];
  const assignedCount = Object.keys(seatAssignments).length;
  const seatingComplete = assignedCount === playerCount;
  const localFirstNightSteps = useMemo(
    () => firstNightOrder.filter((step) => !step.characterId || selectedIds.includes(step.characterId)),
    [selectedIds],
  );
  const canonicalSteps = useMemo(
    () => replayState?.phaseOverview.map(workflowStepFromCanonical) ?? [],
    [replayState?.phaseOverview],
  );
  const firstNightSteps = coreAdapter && replayState?.phase === "firstNight"
    ? canonicalSteps
    : localFirstNightSteps;
  const currentFirstNightStep = coreAdapter && replayState?.currentStep
    ? workflowStepFromCanonical(replayState.currentStep)
    : localFirstNightSteps[firstNightStepIndex];
  const effectivePlayPhase: PlayPhase = coreAdapter && replayState?.phase && replayState.phase !== "setup"
    ? replayState.phase === "firstNight" ? "firstNight" : replayState.phase === "day" ? "day" : "laterNight"
    : playPhase;
  const currentFirstNightAsset = sectsAndVioletsCharacterAsset(currentFirstNightStep?.characterId);
  const livePlayers = useMemo<LivePlayer[]>(() => (replayState?.players ?? []).map((player) => {
    const character = characters.find((candidate) => candidate.id === player.actualCharacter);
    return {
      ...player,
      characterName: character?.name ?? player.actualCharacter,
      characterKind: character?.kind ?? "townsfolk",
    };
  }), [replayState?.players]);
  const liveActor = replayState?.players.find((player) => player.id === replayState.currentStep?.playerId);
  const liveActorCharacter = characters.find((character) => character.id === liveActor?.actualCharacter);
  const pendingIdentityReveals = replayState?.pendingIdentityReveals ?? [];
  const nextIdentityReveal = pendingIdentityReveals.find(
    (reveal) => !acknowledgedIdentityRevealKeys.includes(identityRevealKey(gameFile.game.id, reveal.sourceEventId, reveal.sequence)),
  );
  const nextIdentityRevealKey = nextIdentityReveal
    ? identityRevealKey(gameFile.game.id, nextIdentityReveal.sourceEventId, nextIdentityReveal.sequence)
    : undefined;
  const identityRevealOpen = nextIdentityRevealKey === openedIdentityRevealKey;
  const identityRevealPlayer = replayState?.players.find(
    (player) => player.id === nextIdentityReveal?.payload.playerId,
  );
  const canonicalTokensByPlayerId = useMemo<PlayerTokensByPlayerId>(() => {
    const result: Record<string, Array<{
      instanceId: string;
      label: string;
      sourceLabel: string;
      sourceIconSrc?: string;
      visualKind: "impairment";
      description: string;
    }>> = {};
    for (const impairment of replayState?.ruleState.activeImpairments ?? []) {
      const token = {
        instanceId: `canonical-${impairment.sourceEventId}-${impairment.playerId}`,
        label: "중독",
        sourceLabel: "뱀 조련사",
        sourceIconSrc: sectsAndVioletsCharacterAsset(impairment.sourceCharacterId)?.src,
        visualKind: "impairment" as const,
        description: "뱀 조련사 교환으로 영구 중독된 상태입니다.",
      };
      (result[impairment.playerId] ??= []).push(token);
    }
    return result;
  }, [replayState?.ruleState.activeImpairments]);
  const informationStep = firstNightSteps.find((step) => step.id === informationStepId);
  const selectedSeatCharacterId = selectedSeat ? seatAssignments[selectedSeat] : undefined;
  const selectedSeatCharacter = characters.find((character) => character.id === selectedSeatCharacterId);
  const selectedSeatAsset = sectsAndVioletsCharacterAsset(selectedSeatCharacterId);
  const desktopSeatPositions = rectangularSeatPositions(playerCount, false);
  const mobileSeatPositions = rectangularSeatPositions(playerCount, true);
  const heights = grimoireHeights(playerCount);
  const grimoireSizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;
  const latestUndoCheckpoint = [...phaseCheckpoints].reverse().find(
    (checkpoint) => checkpoint.kind === "phase",
  );
  const undoEventEntries = useMemo(() => {
    if (!undoCheckpoint) return [];
    const checkpointIndex = phaseCheckpoints.findIndex((checkpoint) => checkpoint.id === undoCheckpoint.id);
    if (checkpointIndex < 0) return [];
    const previousEventCount = phaseCheckpoints[checkpointIndex - 1]?.eventCount ?? 0;
    return gameFile.game.events
      .slice(previousEventCount, undoCheckpoint.eventCount)
      .map((event, index) => ({ event, number: previousEventCount + index + 1 }))
      .reverse();
  }, [gameFile.game.events, phaseCheckpoints, undoCheckpoint]);
  const visibleWarnings = (replayState?.warnings ?? []).filter(
    (warning) => warning.code !== "NIGHT_DEATH_UNANNOUNCED",
  );
  const warningKey = visibleWarnings.map((warning) => `${warning.code}:${warning.messageKo}`).join("\u001f");
  const warningVisible = visibleWarnings.length > 0 && warningKey !== dismissedWarningKey;
  const storageLoading = Boolean(storageDriver && !storageReady);

  useEffect(() => {
    if (!warningKey) setDismissedWarningKey(undefined);
  }, [warningKey]);

  useEffect(() => {
    if (pendingIdentityReveals.length === 0) {
      if (acknowledgedIdentityRevealKeys.length > 0) setAcknowledgedIdentityRevealKeys([]);
      if (openedIdentityRevealKey !== undefined) setOpenedIdentityRevealKey(undefined);
    }
  }, [pendingIdentityReveals.length, acknowledgedIdentityRevealKeys.length, openedIdentityRevealKey]);

  useEffect(() => {
    if (nextIdentityRevealKey && !identityRevealOpen) setActiveTab("seating");
  }, [nextIdentityRevealKey, identityRevealOpen]);

  useEffect(() => {
    if (!returnConfirmOpen) return;
    returnCancelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeReturnConfirmation();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [returnConfirmOpen]);

  useEffect(() => {
    if (!newGameConfirmOpen) return;
    newGameCancelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNewGameConfirmation();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [newGameConfirmOpen]);

  useEffect(() => {
    if (!undoCheckpoint) return;
    undoCancelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeUndoConfirmation();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(undoDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [undoCheckpoint]);

  useEffect(() => {
    if (!operationError) return;
    errorConfirmRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOperationError(undefined);
      } else if (event.key === "Tab") {
        event.preventDefault();
        errorConfirmRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [operationError]);

  useEffect(() => {
    if (!informationStepId) return;
    informationCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInformationStepId(undefined);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [informationStepId]);

  useEffect(() => () => {
    if (textAutosaveTimerRef.current !== undefined) {
      window.clearTimeout(textAutosaveTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!coreAdapter || !storageDriver) return;
    let cancelled = false;
    loadLatestGame(storageDriver)
      .then(async (storedGameFile) => {
        if (cancelled) return;
        if (!storedGameFile) {
          setAutosaveRecoveryBlocked(false);
          setStorageReady(true);
          return;
        }
        const replayed = await coreAdapter.replay(storedGameFile);
        if (cancelled) return;
        if (!replayed.ok) {
          setOperationError(replayed.error.messageKo);
          setAutosaveRecoveryBlocked(true);
          setStorageReady(true);
          return;
        }
        restoreStoredSession(storedGameFile, replayed.value);
        setStorageReady(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setOperationError(error instanceof Error ? error.message : "저장된 게임 로드 실패");
          setAutosaveRecoveryBlocked(true);
          setStorageReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [coreAdapter, storageDriver]);

  useEffect(() => {
    if (
      !storageDriver ||
      !storageReady ||
      autosaveRecoveryBlocked ||
      autosaveRevision === 0 ||
      lastEnqueuedAutosaveRevisionRef.current === autosaveRevision
    ) {
      return;
    }
    lastEnqueuedAutosaveRevisionRef.current = autosaveRevision;
    const savedAt = new Date().toISOString();
    pendingAutosaveRef.current = withSectsAndVioletsSession(
      gameFile,
      currentSessionState(savedAt),
    );
    void drainAutosaveQueue();
  }, [
    activeTab,
    autosaveRecoveryBlocked,
    autosaveRevision,
    demon,
    gameFile,
    phaseCheckpoints,
    playerCount,
    rosterConfirmed,
    seatAlignments,
    seatAssignments,
    seatNames,
    seatingConfirmed,
    selectedIds,
    storageDriver,
    storageReady,
  ]);

  useEffect(() => {
    if (!coreAdapter || (storageDriver && !storageReady)) return;
    let cancelled = false;
    coreAdapter.replay(gameFile)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setReplayState(result.value);
          setOperationError(undefined);
        } else {
          setOperationError(result.error.messageKo);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setOperationError(error instanceof Error ? error.message : "게임 상태 복원 실패");
      });
    return () => {
      cancelled = true;
    };
  }, [coreAdapter, gameFile, storageDriver, storageReady]);

  useEffect(() => {
    if (!coreAdapter || rosterConfirmed) return;
    let cancelled = false;
    coreAdapter.setupDistribution({
      scriptId: SECTS_AND_VIOLETS,
      playerCount,
      actualCharacters: [demon],
    }).then((result) => {
      if (cancelled) return;
      if (result.ok) setCanonicalDistribution(result.value);
      else setOperationError(result.error.messageKo);
    }).catch((error: unknown) => {
      if (!cancelled) setOperationError(error instanceof Error ? error.message : "인원 구성 계산 실패");
    });
    return () => {
      cancelled = true;
    };
  }, [coreAdapter, demon, playerCount, rosterConfirmed]);

  const navigateToTab = (nextTab: PrototypeTab) => {
    const tabOrder: PrototypeTab[] = ["roles", "seating", "play", "storage"];
    setTabMotion(tabOrder.indexOf(nextTab) >= tabOrder.indexOf(activeTab) ? "tabForward" : "tabBackward");
    setActiveTab(nextTab);
  };

  function markAutosaveNeeded() {
    if (!storageDriver) return;
    setAutosaveRevision((current) => current + 1);
  }

  function scheduleTextAutosave() {
    textAutosaveDirtyRef.current = true;
    if (textAutosaveTimerRef.current !== undefined) {
      window.clearTimeout(textAutosaveTimerRef.current);
    }
    textAutosaveTimerRef.current = window.setTimeout(() => {
      textAutosaveTimerRef.current = undefined;
      textAutosaveDirtyRef.current = false;
      markAutosaveNeeded();
    }, 350);
  }

  function flushTextAutosave() {
    if (!textAutosaveDirtyRef.current) return;
    if (textAutosaveTimerRef.current !== undefined) {
      window.clearTimeout(textAutosaveTimerRef.current);
      textAutosaveTimerRef.current = undefined;
    }
    textAutosaveDirtyRef.current = false;
    markAutosaveNeeded();
  }

  function currentSessionState(savedAt: string): SectsAndVioletsSessionState {
    return {
      version: 1,
      activeTab,
      savedAt,
      setup: {
        playerCount,
        demon,
        selectedIds: [...selectedIds],
        seatAssignments: structuredClone(seatAssignments),
        seatAlignments: structuredClone(seatAlignments),
        seatNames: structuredClone(seatNames),
        rosterConfirmed,
        seatingConfirmed,
      },
      phaseCheckpoints: structuredClone(phaseCheckpoints),
    };
  }

  async function drainAutosaveQueue() {
    if (!storageDriver || autosaveInFlightRef.current) return;
    const candidate = pendingAutosaveRef.current;
    if (!candidate) return;
    pendingAutosaveRef.current = undefined;
    autosaveInFlightRef.current = true;
    setAutosaveStatus("saving");
    let saved = false;
    try {
      await saveLatestGame(candidate, storageDriver);
      const savedAt = candidate.ui?.sectsAndVioletsSession?.savedAt;
      setLastSavedAt(savedAt);
      setAutosaveStatus("saved");
      saved = true;
    } catch {
      pendingAutosaveRef.current = undefined;
      setAutosaveStatus("error");
    } finally {
      autosaveInFlightRef.current = false;
    }
    if (saved && pendingAutosaveRef.current) void drainAutosaveQueue();
  }

  function restoreStoredSession(storedGameFile: GameFile, replayed: ReplayState) {
    const storedSession = storedGameFile.ui?.sectsAndVioletsSession;
    const canonicalPlayers = replayed.players;
    const canonicalDemon = canonicalPlayers.find((player) =>
      demonChoices.some((choice) => choice.id === player.actualCharacter),
    )?.actualCharacter as DemonChoice | undefined;
    const fallbackSetup = {
      playerCount: canonicalPlayers.length || 7,
      demon: canonicalDemon ?? "fangGu",
      selectedIds: canonicalPlayers.length
        ? canonicalPlayers.map((player) => player.actualCharacter)
        : ["fangGu"],
      seatAssignments: Object.fromEntries(
        canonicalPlayers.map((player) => [player.seat, player.actualCharacter]),
      ),
      seatAlignments: Object.fromEntries(
        canonicalPlayers.map((player) => [player.seat, player.alignment]),
      ),
      seatNames: Object.fromEntries(canonicalPlayers.map((player) => [player.seat, player.name])),
      rosterConfirmed: canonicalPlayers.length > 0,
      seatingConfirmed: canonicalPlayers.length > 0,
    } satisfies SectsAndVioletsSessionState["setup"];
    const setup = storedSession?.setup ?? fallbackSetup;
    const fallbackTab: PrototypeTab = replayed.eventCount > 1
      ? "play"
      : replayed.eventCount === 1
        ? "seating"
        : "roles";
    const requestedTab = storedSession?.activeTab ?? fallbackTab;
    const restoredTab = requestedTab === "play" && !setup.seatingConfirmed
      ? setup.rosterConfirmed ? "seating" : "roles"
      : requestedTab === "seating" && !setup.rosterConfirmed
        ? "roles"
        : requestedTab;

    setGameFile(storedGameFile);
    setReplayState(replayed);
    setPlayerCount(setup.playerCount);
    setDemon(setup.demon);
    setSelectedIds([...setup.selectedIds]);
    setSeatAssignments(structuredClone(setup.seatAssignments));
    setSeatAlignments(structuredClone(setup.seatAlignments));
    setSeatNames(structuredClone(setup.seatNames));
    setRosterConfirmed(setup.rosterConfirmed);
    setSeatingConfirmed(setup.seatingConfirmed);
    setPhaseCheckpoints(
      storedSession?.phaseCheckpoints ?? inferSectsAndVioletsCheckpoints(storedGameFile, fallbackTab),
    );
    setActiveTab(restoredTab);
    setPlayPhase(
      replayed.phase === "firstNight" ? "firstNight" : replayed.phase === "day" ? "day" : "laterNight",
    );
    setLastSavedAt(storedSession?.savedAt);
    setAutosaveStatus(storedSession?.savedAt ? "saved" : "idle");
    setOperationError(undefined);
    setAutosaveRecoveryBlocked(false);
  }

  const closeReturnConfirmation = () => {
    setReturnConfirmOpen(false);
    window.setTimeout(() => returnTriggerRef.current?.focus(), 0);
  };

  const returnToSeating = () => {
    setReturnConfirmOpen(false);
    setSeatingConfirmed(false);
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
    setFirstNightStepIndex(0);
    setRevealedStepIds([]);
    setInformationStepId(undefined);
    setPlayPhase("firstNight");
    setDayComplete(false);
    setGameFile(createSectsAndVioletsGameFile());
    setReplayState(undefined);
    setPhaseCheckpoints([]);
    setAutosaveRecoveryBlocked(false);
    navigateToTab("seating");
    markAutosaveNeeded();
  };

  const closeNewGameConfirmation = () => {
    setNewGameConfirmOpen(false);
    window.setTimeout(() => newGameTriggerRef.current?.focus(), 0);
  };

  const closeUndoConfirmation = () => {
    setUndoCheckpoint(undefined);
    window.setTimeout(() => undoTriggerRef.current?.focus(), 0);
  };

  const startNewGame = () => {
    setNewGameConfirmOpen(false);
    setReturnConfirmOpen(false);
    setRosterConfirmed(false);
    setSeatingConfirmed(false);
    setPlayerCount(7);
    setDemon("fangGu");
    setSelectedIds(["fangGu"]);
    setSeatAssignments({});
    setSeatAlignments({});
    setSeatNames({});
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
    setActiveCharacterId("fangGu");
    setFirstNightStepIndex(0);
    setRevealedStepIds([]);
    setInformationStepId(undefined);
    setPlayPhase("firstNight");
    setDayComplete(false);
    setGameFile(createSectsAndVioletsGameFile());
    setReplayState(undefined);
    setPhaseCheckpoints([]);
    setCanonicalDistribution(undefined);
    setOperationError(undefined);
    setAutosaveRecoveryBlocked(false);
    navigateToTab("roles");
    markAutosaveNeeded();
  };

  const confirmPhaseUndo = async () => {
    if (!undoCheckpoint || !coreAdapter || operationBusy) return;
    const currentWithSession = withSectsAndVioletsSession(
      gameFile,
      currentSessionState(new Date().toISOString()),
    );
    const removal = removeLatestSectsAndVioletsPhaseCheckpoint(currentWithSession);
    if (!removal || removal.removed.id !== undoCheckpoint.id) {
      setUndoCheckpoint(undefined);
      setOperationError("최근 페이즈가 변경되어 되돌리지 않았습니다.");
      return;
    }
    setOperationBusy(true);
    setOperationError(undefined);
    const replayed = await coreAdapter.replay(removal.gameFile).catch((error: unknown) => ({
      ok: false as const,
      error: {
        code: "WASM_LOAD_FAILED",
        messageKo: error instanceof Error ? error.message : "페이즈 되돌리기 실패",
      },
    }));
    if (!replayed.ok) {
      setOperationBusy(false);
      setUndoCheckpoint(undefined);
      setOperationError(replayed.error.messageKo);
      return;
    }
    setGameFile(removal.gameFile);
    setReplayState(replayed.value);
    setPhaseCheckpoints(removal.gameFile.ui?.sectsAndVioletsSession?.phaseCheckpoints ?? []);
    setProposalTransientStateAfterHistoryChange();
    setUndoCheckpoint(undefined);
    setOperationBusy(false);
    markAutosaveNeeded();
  };

  const exportCurrentCheckpoint = () => {
    const currentWithSession = withSectsAndVioletsSession(
      gameFile,
      currentSessionState(new Date().toISOString()),
    );
    const exported = exportLatestSectsAndVioletsCheckpoint(currentWithSession);
    const blob = new Blob([exportGameFileJson(exported)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clocktower-sects-and-violets-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importCheckpoint = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !coreAdapter || operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    try {
      const imported = importGameFileJson(await file.text(), SECTS_AND_VIOLETS);
      const replayed = await coreAdapter.replay(imported);
      if (!replayed.ok) {
        setOperationError(replayed.error.messageKo);
        return;
      }
      if (hasMeaningfulCurrentSession() && !window.confirm("현재 게임을 가져온 게임으로 교체할까요?")) {
        return;
      }
      restoreStoredSession(imported, replayed.value);
      setAutosaveRecoveryBlocked(false);
      setProposalTransientStateAfterHistoryChange();
      markAutosaveNeeded();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "게임 파일 가져오기 실패");
    } finally {
      setOperationBusy(false);
    }
  };

  function hasMeaningfulCurrentSession() {
    return gameFile.game.events.length > 0 ||
      playerCount !== 7 ||
      demon !== "fangGu" ||
      selectedIds.length !== 1 ||
      selectedIds[0] !== "fangGu" ||
      Object.keys(seatAssignments).length > 0 ||
      Object.values(seatNames).some(Boolean);
  }

  function setProposalTransientStateAfterHistoryChange() {
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
    setInformationStepId(undefined);
    setRevealedStepIds([]);
    setDayComplete(false);
    setLiveHandoff(undefined);
    setLiveNominatorId(undefined);
    setLiveNomineeId(undefined);
    setLiveVoterIds([]);
    setLiveTargetId(undefined);
    setLiveNominationCheckpointId(undefined);
  }

  const choosePlayerCount = (count: number) => {
    if (rosterConfirmed) return;
    if (count === playerCount) return;
    setPlayerCount(count);
    setCanonicalDistribution(undefined);
    setSelectedIds([demon]);
    setSeatAssignments({});
    setSeatAlignments({});
    setSeatNames({});
    setSeatingConfirmed(false);
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
    setRosterConfirmed(false);
    setFirstNightStepIndex(0);
    setRevealedStepIds([]);
    setInformationStepId(undefined);
    setPlayPhase("firstNight");
    setDayComplete(false);
    setActiveTab("roles");
    markAutosaveNeeded();
  };

  const chooseDemon = (choice: DemonChoice) => {
    setActiveCharacterId(choice);
    if (rosterConfirmed) return;
    if (choice === demon) return;
    setDemon(choice);
    setCanonicalDistribution(undefined);
    setSelectedIds([choice]);
    setSeatAssignments({});
    setSeatAlignments({});
    setSeatingConfirmed(false);
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
    setRosterConfirmed(false);
    setFirstNightStepIndex(0);
    setRevealedStepIds([]);
    setInformationStepId(undefined);
    setPlayPhase("firstNight");
    setDayComplete(false);
    setActiveTab("roles");
    markAutosaveNeeded();
  };

  const toggleCharacter = (character: CatalogCharacter) => {
    setActiveCharacterId(character.id);
    if (rosterConfirmed || character.kind === "demon") return;
    setRosterConfirmed(false);
    setFirstNightStepIndex(0);
    setRevealedStepIds([]);
    setInformationStepId(undefined);
    setPlayPhase("firstNight");
    setDayComplete(false);
    setSelectedIds((selected) => {
      if (selected.includes(character.id)) return selected.filter((id) => id !== character.id);
      if (selectedByKind[character.kind] >= requiredByKind[character.kind]) return selected;
      return [...selected, character.id];
    });
    markAutosaveNeeded();
  };

  const advanceFirstNight = async (manualOutcome: "handled" | "notApplicable" = "handled") => {
    if (coreAdapter && replayState?.currentStep) {
      if (operationBusy) return;
      setOperationBusy(true);
      setOperationError(undefined);
      const step = replayState.currentStep;
      const command = step.support === "manual"
        ? { type: "resolveManualStep" as const, payload: { stepId: step.id, outcome: manualOutcome } }
        : { type: "confirmStep" as const, payload: { stepId: step.id, input: null as null } };
      const result = await coreAdapter.propose(gameFile, command).catch((error: unknown) => ({
        ok: false as const,
        error: {
          code: "WASM_LOAD_FAILED",
          messageKo: error instanceof Error ? error.message : "단계 확정 실패",
        },
      }));
      if (!result.ok) {
        setOperationBusy(false);
        setOperationError(result.error.messageKo);
        return;
      }
      await applyCanonicalEvent(result.value.event, "phase");
      setOperationBusy(false);
      return;
    }
    setInformationStepId(undefined);
    setFirstNightStepIndex((current) => Math.min(current + 1, firstNightSteps.length));
  };

  const showCurrentStepInformation = () => {
    if (!currentFirstNightStep) return;
    setRevealedStepIds((current) => current.includes(currentFirstNightStep.id) ? current : [...current, currentFirstNightStep.id]);
    setInformationStepId(currentFirstNightStep.id);
  };

  const assignCharacterToSeat = (characterId: string, seat: number, preserveSelectedSeat = false) => {
    const previousSeat = Object.entries(seatAssignments).find(([, assignedCharacterId]) => assignedCharacterId === characterId)?.[0];
    setSeatingConfirmed(false);
    setSeatAssignments((current) => {
      const next = { ...current };
      for (const [assignedSeat, assignedCharacterId] of Object.entries(next)) {
        if (assignedCharacterId === characterId) delete next[Number(assignedSeat)];
      }
      next[seat] = characterId;
      return next;
    });
    setSeatAlignments((current) => {
      const next = { ...current };
      if (previousSeat && Number(previousSeat) !== seat) delete next[Number(previousSeat)];
      next[seat] = defaultAlignment(characterId);
      return next;
    });
    setSelectedSeat(preserveSelectedSeat ? seat : undefined);
    setPendingCharacterId(undefined);
    markAutosaveNeeded();
  };

  const chooseSeat = (seat: number) => {
    if (seatingConfirmed) {
      setSelectedSeat(seat);
      return;
    }
    if (pendingCharacterId) {
      assignCharacterToSeat(pendingCharacterId, seat);
      return;
    }
    setSelectedSeat(seat);
  };

  const unassignSeat = (seat: number) => {
    setSeatAssignments((current) => {
      const next = { ...current };
      delete next[seat];
      return next;
    });
    setSeatAlignments((current) => {
      const next = { ...current };
      delete next[seat];
      return next;
    });
    setSeatingConfirmed(false);
    markAutosaveNeeded();
  };

  const chooseCharacterForSeating = (characterId: string) => {
    const assignedSeat = Object.entries(seatAssignments).find(([, id]) => id === characterId)?.[0];
    if (selectedSeat) {
      if (assignedSeat && Number(assignedSeat) === selectedSeat) {
        unassignSeat(selectedSeat);
        setPendingCharacterId(undefined);
        return;
      }
      assignCharacterToSeat(characterId, selectedSeat, true);
      return;
    }
    if (assignedSeat) {
      unassignSeat(Number(assignedSeat));
      setPendingCharacterId(undefined);
      return;
    }
    setPendingCharacterId((current) => current === characterId ? undefined : characterId);
  };

  const randomizeSeating = () => {
    const shuffled = [...selectedIds];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    setSeatAssignments(Object.fromEntries(shuffled.map((characterId, index) => [index + 1, characterId])));
    setSeatAlignments(Object.fromEntries(shuffled.map((characterId, index) => [index + 1, defaultAlignment(characterId)])));
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
    setSeatingConfirmed(false);
    markAutosaveNeeded();
  };

  const resetSeating = () => {
    setSeatAssignments({});
    setSeatAlignments({});
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
    setSeatingConfirmed(false);
    markAutosaveNeeded();
  };

  const confirmSeating = async () => {
    if (!seatingComplete || operationBusy) return;
    if (!coreAdapter) {
      setSeatingConfirmed(true);
      setSelectedSeat(undefined);
      setPendingCharacterId(undefined);
      return;
    }

    const players = Array.from({ length: playerCount }, (_, index) => {
      const seat = index + 1;
      return {
        seat,
        name: seatNames[seat]?.trim() || `플레이어 ${seat}`,
        actualCharacter: seatAssignments[seat],
      };
    });
    if (players.some((player) => !player.actualCharacter)) return;

    setOperationBusy(true);
    setOperationError(undefined);
    const result = await coreAdapter.propose(gameFile, {
      type: "createGame",
      payload: { players: players as Array<{ seat: number; name: string; actualCharacter: string }> },
    }).catch((error: unknown) => ({
      ok: false as const,
      error: {
        code: "WASM_LOAD_FAILED",
        messageKo: error instanceof Error ? error.message : "설정 확정 실패",
      },
    }));
    if (!result.ok) {
      setOperationBusy(false);
      setOperationError(result.error.messageKo);
      return;
    }

    const applied = await applyCanonicalEvent(result.value.event, "setup");
    if (!applied) {
      setOperationBusy(false);
      return;
    }
    setOperationBusy(false);
    setSeatingConfirmed(true);
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
  };

  const applyCanonicalEvent = async (
    event: GameEvent,
    checkpointKind: SectsAndVioletsPhaseCheckpoint["kind"],
    baseGameFile: GameFile = gameFile,
  ): Promise<{ gameFile: GameFile; replayState: ReplayState } | undefined> => {
    if (!coreAdapter) return undefined;
    const nextGameFile: GameFile = {
      ...baseGameFile,
      game: {
        ...baseGameFile.game,
        updatedAt: new Date().toISOString(),
        events: [...baseGameFile.game.events, event],
      },
    };
    const replayed = await coreAdapter.replay(nextGameFile).catch((error: unknown) => ({
      ok: false as const,
      error: {
        code: "WASM_LOAD_FAILED",
        messageKo: error instanceof Error ? error.message : "게임 상태 복원 실패",
      },
    }));
    if (!replayed.ok) {
      setOperationError(replayed.error.messageKo);
      return undefined;
    }
    setReplayState(replayed.value);
    setGameFile(nextGameFile);
    setPhaseCheckpoints((current) => [
      ...current,
      {
        id: event.id,
        kind: checkpointKind,
        eventCount: nextGameFile.game.events.length,
        summary: event.summary,
        activeTab: checkpointKind === "setup" ? "seating" : activeTab,
      },
    ]);
    setInformationStepId(undefined);
    setDayComplete(false);
    markAutosaveNeeded();
    return { gameFile: nextGameFile, replayState: replayed.value };
  };

  const proposeAndApplyLiveCommand = async (
    command: Command,
    baseGameFile: GameFile = gameFile,
  ) => {
    if (!coreAdapter) return undefined;
    const result = await coreAdapter.propose(baseGameFile, command).catch((error: unknown) => ({
      ok: false as const,
      error: {
        code: "WASM_LOAD_FAILED",
        messageKo: error instanceof Error ? error.message : "단계 확정 실패",
      },
    }));
    if (!result.ok) {
      setOperationError(result.error.messageKo);
      return undefined;
    }
    return applyCanonicalEvent(result.value.event, "phase", baseGameFile);
  };

  const startLiveHandoff = (kind: LiveHandoff["kind"]) => {
    setLiveHandoff({
      kind,
      complete: false,
      actorPlayerId: kind === "demon" || kind === "snakeCharmer"
        ? replayState?.currentStep?.playerId
        : undefined,
    });
    if (kind === "nomination") {
      setLiveNominatorId(undefined);
      setLiveNomineeId(undefined);
      setLiveVoterIds([]);
      setLiveNominationCheckpointId(undefined);
    }
    if (kind === "demon" || kind === "snakeCharmer") setLiveTargetId(undefined);
    navigateToTab("seating");
  };

  const chooseLiveSeat = (playerId: string) => {
    if (!liveHandoff || liveHandoff.complete) return;
    if (liveHandoff.kind === "nomination") {
      if (!liveNominatorId) {
        if (!replayState?.dayState?.eligibleNominatorIds.includes(playerId)) return;
        setLiveNominatorId(playerId);
        return;
      }
      if (playerId === liveNominatorId) {
        if (!replayState?.dayState?.eligibleNomineeIds.includes(playerId)) return;
        setLiveNomineeId((current) => current === playerId ? undefined : playerId);
        return;
      }
      if (!replayState?.dayState?.eligibleNomineeIds.includes(playerId)) return;
      setLiveNomineeId((current) => current === playerId ? undefined : playerId);
      return;
    }
    if (liveHandoff.kind === "vote") {
      const player = replayState?.players.find((candidate) => candidate.id === playerId);
      if (!player || (!player.alive && player.ghostVoteUsed)) return;
      setLiveVoterIds((current) => current.includes(playerId)
        ? current.filter((candidate) => candidate !== playerId)
        : [...current, playerId]);
      return;
    }
    setLiveTargetId((current) => current === playerId ? undefined : playerId);
  };

  const confirmLiveHandoff = async () => {
    const step = replayState?.currentStep;
    if (!step || !liveHandoff || operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    if (liveHandoff.kind === "nomination") {
      if (!liveNominatorId || !liveNomineeId) {
        setOperationBusy(false);
        return;
      }
      const applied = await proposeAndApplyLiveCommand({
        type: "confirmStep",
        payload: {
          stepId: step.id,
          input: { nominatorId: liveNominatorId, nomineeId: liveNomineeId },
        },
      });
      if (applied) {
        setLiveVoterIds([]);
        setLiveNominationCheckpointId(applied.gameFile.game.events.at(-1)?.id);
        setLiveHandoff({ kind: "vote", complete: false });
      }
    } else if (liveHandoff.kind === "vote") {
      const applied = await proposeAndApplyLiveCommand({
        type: "confirmStep",
        payload: { stepId: step.id, input: { voterIds: liveVoterIds } },
      });
      if (applied) setLiveHandoff({ kind: "vote", complete: true });
    } else if (liveTargetId) {
      const applied = await proposeAndApplyLiveCommand({
        type: "confirmStep",
        payload: { stepId: step.id, input: { playerIds: [liveTargetId] } },
      });
      if (applied) setLiveHandoff({ ...liveHandoff, complete: true });
    }
    setOperationBusy(false);
  };

  const returnFromLiveHandoff = () => {
    setLiveHandoff(undefined);
    setLiveNominatorId(undefined);
    setLiveNomineeId(undefined);
    setLiveVoterIds([]);
    setLiveTargetId(undefined);
    setLiveNominationCheckpointId(undefined);
    navigateToTab("play");
  };

  const acknowledgeIdentityReveal = () => {
    if (!nextIdentityReveal) return;
    setOpenedIdentityRevealKey(undefined);
    setAcknowledgedIdentityRevealKeys((current) => [
      ...current,
      identityRevealKey(gameFile.game.id, nextIdentityReveal.sourceEventId, nextIdentityReveal.sequence),
    ]);
    const isLast = pendingIdentityReveals.every(
      (reveal) => reveal.sequence <= nextIdentityReveal.sequence,
    );
    if (isLast) {
      setLiveHandoff(undefined);
      setLiveTargetId(undefined);
      navigateToTab("seating");
    }
  };

  const resetLiveDaySelection = () => {
    if (liveHandoff?.kind === "nomination") {
      setLiveNominatorId(undefined);
      setLiveNomineeId(undefined);
    } else if (liveHandoff?.kind === "vote") {
      setLiveVoterIds([]);
    }
  };

  const cancelLiveDayHandoff = async () => {
    if (operationBusy || (liveHandoff?.kind !== "nomination" && liveHandoff?.kind !== "vote")) return;
    if (liveHandoff.kind === "nomination") {
      setLiveHandoff(undefined);
      setLiveNominatorId(undefined);
      setLiveNomineeId(undefined);
      setLiveVoterIds([]);
      setLiveNominationCheckpointId(undefined);
      navigateToTab("play");
      return;
    }
    if (!coreAdapter || !liveNominationCheckpointId) return;
    const currentWithSession = withSectsAndVioletsSession(
      gameFile,
      currentSessionState(new Date().toISOString()),
    );
    const removal = removeLatestSectsAndVioletsPhaseCheckpoint(currentWithSession);
    if (!removal || removal.removed.id !== liveNominationCheckpointId) {
      setOperationError("현재 지명 기록이 변경되어 투표를 취소하지 않았습니다.");
      return;
    }
    setOperationBusy(true);
    setOperationError(undefined);
    const replayed = await coreAdapter.replay(removal.gameFile).catch((error: unknown) => ({
      ok: false as const,
      error: {
        code: "WASM_LOAD_FAILED",
        messageKo: error instanceof Error ? error.message : "투표 취소 실패",
      },
    }));
    if (!replayed.ok) {
      setOperationBusy(false);
      setOperationError(replayed.error.messageKo);
      return;
    }
    setGameFile(removal.gameFile);
    setReplayState(replayed.value);
    setPhaseCheckpoints(removal.gameFile.ui?.sectsAndVioletsSession?.phaseCheckpoints ?? []);
    setProposalTransientStateAfterHistoryChange();
    setLiveNominationCheckpointId(undefined);
    setOperationBusy(false);
    navigateToTab("play");
    markAutosaveNeeded();
  };

  const endLiveNominations = async () => {
    const step = replayState?.currentStep;
    if (!step || operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    await proposeAndApplyLiveCommand({ type: "skipStep", payload: { stepId: step.id } });
    setOperationBusy(false);
  };

  const confirmLiveExecution = async () => {
    const step = replayState?.currentStep;
    if (!step || operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    if (step.stepType === "executionDeath") {
      await proposeAndApplyLiveCommand({
        type: "confirmStep",
        payload: { stepId: step.id, input: { died: true } },
      });
      setOperationBusy(false);
      return;
    }
    const first = await proposeAndApplyLiveCommand({
      type: "confirmStep",
      payload: {
        stepId: step.id,
        input: { execute: Boolean(replayState.dayState?.executionCandidate) },
      },
    });
    if (first?.replayState.currentStep?.stepType === "executionDeath") {
      await proposeAndApplyLiveCommand({
        type: "confirmStep",
        payload: { stepId: first.replayState.currentStep.id, input: { died: true } },
      }, first.gameFile);
    }
    setOperationBusy(false);
  };

  return (
    <main className={`snvFoundationPrototype ${tabMotion} ${effectivePlayPhase === "day" ? "snvDayMode" : "snvNightMode"}`} aria-label={production ? "Sects & Violets 게임" : "Sects & Violets 기반 화면 프로토타입"}>
      {production ? <a className="snvScriptHomeLink" href="/clocktower/" aria-label="스크립트 선택">←</a> : null}
      {production ? <input ref={importInputRef} hidden type="file" accept=".json,application/json" onChange={(event) => void importCheckpoint(event)} /> : null}
      <header className="snvPrototypeHeader">
        <div>
          <span className="snvEyebrow">{production ? "STORYTELLER CONSOLE" : "ISSUE 97 · REVIEW PROTOTYPE"}</span>
          <h1>Sects &amp; Violets</h1>
          <p>7–15명</p>
        </div>
        <div className="snvPhaseActions" aria-label="현재 페이즈와 되돌리기">
          {latestUndoCheckpoint ? (
            <button
              ref={undoTriggerRef}
              type="button"
              className="snvGlobalUndo"
              aria-label={`최근 행동 되돌리기: ${latestUndoCheckpoint.summary}`}
              aria-haspopup="dialog"
              disabled={operationBusy}
              onClick={() => setUndoCheckpoint(latestUndoCheckpoint)}
            >
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <path d="M12.2 9.2 6.5 14.8l5.7 5.7" />
                <path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" />
              </svg>
              <span className="snvIconTooltip" role="tooltip">최근 행동 되돌리기</span>
            </button>
          ) : (
            <button
              type="button"
              className="snvGlobalUndo empty"
              data-visual-state="muted"
              aria-hidden="true"
              tabIndex={-1}
              disabled
            >
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <path d="M12.2 9.2 6.5 14.8l5.7 5.7" />
                <path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" />
              </svg>
            </button>
          )}
          <span
            className={`snvPhaseMark ${effectivePlayPhase === "day" ? "snvSunMark" : "snvMoonMark"}`}
            role="img"
            aria-label={effectivePlayPhase === "day" ? "낮" : "밤"}
          >{effectivePlayPhase === "day" ? "☀" : "☾"}</span>
        </div>
      </header>

      <nav className="snvUtilityTabs" aria-label="게임 데이터">
        <button ref={newGameTriggerRef} type="button" className="snvNewGameTab" disabled={storageLoading} onClick={() => setNewGameConfirmOpen(true)}>새 게임</button>
        <button type="button" className={`snvStorageTab ${activeTab === "storage" ? "active" : ""}`} aria-current={activeTab === "storage" ? "page" : undefined} onClick={() => navigateToTab("storage")}>저장 / 불러오기</button>
      </nav>
      {autosaveStatus !== "idle" ? (
        <p className={`snvAutosaveStatus ${autosaveStatus}`} role="status" aria-live="polite">
          {autosaveStatus === "saving"
            ? "자동 저장 중…"
            : autosaveStatus === "error"
              ? "자동 저장 실패"
              : `자동 저장 완료 ${formatAutosaveTime(lastSavedAt)}`}
        </p>
      ) : null}

      <nav className="snvSurfaceTabs" aria-label="작업 단계">
        <button type="button" className={activeTab === "roles" ? "active" : ""} aria-current={activeTab === "roles" ? "page" : undefined} onClick={() => navigateToTab("roles")}>직업</button>
        <button type="button" className={activeTab === "seating" ? "active" : ""} aria-current={activeTab === "seating" ? "page" : undefined} disabled={!rosterConfirmed} onClick={() => navigateToTab("seating")}>마도서</button>
        <button
          type="button"
          className={activeTab === "play" ? "active" : ""}
          aria-current={activeTab === "play" ? "page" : undefined}
          disabled={(production && !seatingConfirmed) || Boolean(liveHandoff && !liveHandoff.complete) || Boolean(nextIdentityReveal)}
          onClick={() => navigateToTab("play")}
        >{liveHandoff && !liveHandoff.complete ? "마도서 작업을 완료하세요" : "진행"}</button>
      </nav>
      {activeTab === "roles" ? (
        <section className="snvSetupSurface snvTabPanel" aria-label="S&V 설정 검토">
          <div className="snvSetupControls">
            <section className="snvControlCard">
              <span>플레이어</span>
              <div className="snvChoiceRow">
                {Object.keys(baseDistribution).map((count) => (
                  <button key={count} type="button" aria-pressed={playerCount === Number(count)} disabled={storageLoading || rosterConfirmed} onClick={() => choosePlayerCount(Number(count))}>{count}명</button>
                ))}
              </div>
            </section>
            <section className="snvControlCard">
              <span>악마 선택</span>
              <div className="snvChoiceRow">
                {demonChoices.map((choice) => (
                  <button key={choice.id} type="button" aria-pressed={demon === choice.id} disabled={storageLoading || rosterConfirmed} onClick={() => chooseDemon(choice.id)}>{choice.name}</button>
                ))}
              </div>
            </section>
            <section className="snvDistributionFlow" aria-label="인원 구성">
              <DistributionValues values={distribution.final} />
              <p className="snvModifierNote">
                {distribution.delta[0] === 0 && distribution.delta[1] === 0
                  ? `${selectedDemon.name} · 인원 보정 없음`
                  : `${selectedDemon.name} 보정 · 마을 주민 ${signed(distribution.delta[0])} · 외부인 ${signed(distribution.delta[1])}`}
              </p>
            </section>
          </div>

          <section className="snvCatalogPreview" aria-label="직업 선택 패널">
            <div className="snvCatalogGroups">
              {kindOrder.map((kind) => (
                <article key={kind}>
                  <h2>{kindLabels[kind]} · {selectedByKind[kind]}/{requiredByKind[kind]}</h2>
                  <div>{characters.filter((character) => character.kind === kind).map((character) => {
                    const selected = selectedIds.includes(character.id);
                    const demonLocked = kind === "demon";
                    const capacityReached = !selected && selectedByKind[kind] >= requiredByKind[kind];
                    const ariaLabel = demonLocked
                      ? character.id === demon ? `${character.name} 고정됨` : `${character.name} 악마 선택에서 변경`
                      : character.name;
                    return (
                      <button
                        key={character.id}
                        type="button"
                        className={selected ? "selected" : ""}
                        aria-label={ariaLabel}
                        aria-pressed={selected}
                        disabled={storageLoading || demonLocked || capacityReached}
                        onClick={() => toggleCharacter(character)}
                      >
                        {sectsAndVioletsCharacterAsset(character.id) ? <img src={sectsAndVioletsCharacterAsset(character.id)?.src} alt="" /> : null}
                        <span>{character.name}</span>
                      </button>
                    );
                  })}</div>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : activeTab === "seating" ? production && seatingConfirmed && replayState?.currentStep ? (
        <SectsAndVioletsLiveGrimoire
          players={livePlayers}
          phaseLabel={phaseLabel(effectivePlayPhase, replayState.currentStep)}
          currentStep={replayState.currentStep}
          dayState={replayState.dayState}
          handoff={liveHandoff}
          nominatorId={liveNominatorId}
          nomineeId={liveNomineeId}
          voterIds={liveVoterIds}
          targetId={liveTargetId}
          centerPrompt={nextIdentityReveal && !identityRevealOpen ? (
            <SnakeCharmerIdentityRevealPrompt
              player={identityRevealPlayer}
              sequence={nextIdentityReveal.sequence}
              total={pendingIdentityReveals.length}
              onReveal={() => setOpenedIdentityRevealKey(nextIdentityRevealKey)}
            />
          ) : undefined}
          operationBusy={operationBusy}
          tokensByPlayerId={canonicalTokensByPlayerId}
          onSeatClick={chooseLiveSeat}
          onConfirm={() => void confirmLiveHandoff()}
          onReturn={returnFromLiveHandoff}
          onCancelDayHandoff={() => void cancelLiveDayHandoff()}
          onResetDaySelection={resetLiveDaySelection}
          onGoToProgress={() => navigateToTab("play")}
          onReturnToSetup={() => setReturnConfirmOpen(true)}
        />
      ) : (
        <section className={`snvSeatingSurface snvTabPanel ${!seatingConfirmed ? "assignmentStarted" : ""}`} aria-label="그리모어 배치 단계">
          <div className="snvSeatingToolbar" aria-label="마도서 배치 도구">
            {seatingConfirmed ? (
              <>
                <button ref={returnTriggerRef} type="button" className="snvToolbarBack destructive" aria-label="배치로 돌아가기" onClick={() => setReturnConfirmOpen(true)}><span aria-hidden="true">←</span></button>
                {currentFirstNightStep?.characterId ? <div className="snvCurrentActorLegend" aria-label="현재 행동자 안내"><span aria-hidden="true" />현재 행동자</div> : null}
              </>
            ) : (
              <>
              <button type="button" className="snvToolbarBack" aria-label="직업 선택으로 돌아가기" onClick={() => navigateToTab("roles")}><span aria-hidden="true">←</span></button>
              <button type="button" onClick={randomizeSeating}>무작위 배치</button>
              <button type="button" onClick={resetSeating}>배치 초기화</button>
              </>
            )}
          </div>
          <div className="snvSeatingWorkspace stable" style={grimoireSizeStyle}>
            <div className="snvGrimoireDraft rectangular" aria-label={`${playerCount}자리 그리모어`} style={grimoireSizeStyle}>
              {Array.from({ length: playerCount }, (_, index) => {
                const seat = index + 1;
                const characterId = seatAssignments[seat];
                const character = characters.find((candidate) => candidate.id === characterId);
                const asset = sectsAndVioletsCharacterAsset(characterId);
                const playerName = seatNames[seat]?.trim() || `플레이어 ${seat}`;
                const desktopPosition = desktopSeatPositions[index];
                const mobilePosition = mobileSeatPositions[index];
                const canonicalActorSeat = replayState?.players.find((player) => player.id === replayState.currentStep?.playerId)?.seat;
                const isCurrentActor = Boolean(
                  seatingConfirmed && characterId && (
                    canonicalActorSeat ? canonicalActorSeat === seat : currentFirstNightStep?.characterId === characterId
                  ),
                );
                return (
                  <button
                    key={seat}
                    type="button"
                    className={`fixedSize ${selectedSeat === seat ? "selected " : ""}${isCurrentActor ? "snvCurrentActorSeat " : ""}${character ? `assigned alignment-${seatAlignments[seat] ?? defaultAlignment(character.id)} kind-${character.kind}` : "unassigned"}`}
                    aria-label={`${seat}번 좌석, ${playerName}, ${character?.name ?? "미할당"}${isCurrentActor ? ", 현재 행동자" : ""}`}
                    aria-pressed={selectedSeat === seat}
                    style={{
                      "--seat-x": `${desktopPosition.x}%`,
                      "--seat-y": `${desktopPosition.y}%`,
                      "--mobile-seat-x": `${mobilePosition.x}%`,
                      "--mobile-seat-y": `${mobilePosition.y}%`,
                    } as CSSProperties}
                    onClick={() => chooseSeat(seat)}
                  >
                    <span className="snvSeatNumber">{seat}</span>
                    {asset ? <img src={asset.src} alt="" /> : null}
                    <span className="snvSeatPlayerName">{playerName}</span>
                    <small>{character?.name ?? "미할당"}</small>
                  </button>
                );
              })}
              <div className={`snvGrimoireCenter ${seatingConfirmed ? "live" : ""}`}>
                <strong>{seatingConfirmed ? phaseLabel(effectivePlayPhase, replayState?.currentStep) : `${assignedCount}/${playerCount}`}</strong>
                <span>{seatingConfirmed ? "00:00" : "배치"}</span>
                {seatingConfirmed ? <button type="button" aria-label="진행으로 이동" onClick={() => navigateToTab("play")}>진행 →</button> : null}
              </div>
            </div>
            {selectedSeat ? (
              <button
                type="button"
                className="snvMobileSeatPanelBackdrop"
                aria-label="좌석 설정 패널 닫기 배경"
                onClick={() => { setSelectedSeat(undefined); setPendingCharacterId(undefined); }}
              />
            ) : null}
            {seatingConfirmed ? (
              <aside className={`snvLiveSeatDetails transitionIn ${selectedSeat ? "mobileOpen" : "mobileCollapsed"}`} aria-label="좌석 상세 정보">
                {selectedSeat && selectedSeatCharacter ? (
                  <>
                    <header>
                      <span>{selectedSeat}번 좌석</span>
                      <h2>{seatNames[selectedSeat]?.trim() || `플레이어 ${selectedSeat}`}</h2>
                    </header>
                    <CharacterDetailButton
                      details={sectsAndVioletsCharacterDetail(selectedSeatCharacter.id)}
                      className="snvLiveIdentity"
                      theme={effectivePlayPhase === "day" ? "snv-day" : "snv-night"}
                    >
                      {selectedSeatAsset ? <img src={selectedSeatAsset.src} alt={`${selectedSeatCharacter.name} 공식 캐릭터 아이콘`} /> : null}
                      <div>
                        <span className={`snvAlignmentIcon alignment-${seatAlignments[selectedSeat] ?? defaultAlignment(selectedSeatCharacter.id)}`} aria-label={`${(seatAlignments[selectedSeat] ?? defaultAlignment(selectedSeatCharacter.id)) === "evil" ? "악한" : "선한"} 진영`}>
                          {(seatAlignments[selectedSeat] ?? defaultAlignment(selectedSeatCharacter.id)) === "evil" ? "악" : "선"}
                        </span>
                        <strong>{selectedSeatCharacter.name}</strong>
                      </div>
                    </CharacterDetailButton>
                    <div className="snvLiveStatuses" aria-label="현재 상태">
                      <span>생존</span>
                    </div>
                  </>
                ) : <span>좌석을 선택하세요</span>}
              </aside>
            ) : (
            <>
            <aside className={`snvSeatingTray contentHeight ${selectedSeat ? "mobileOpen" : "mobileCollapsed"}`} aria-label="선택한 직업">
              {selectedSeat ? (
                <div className="snvSeatInspector fixed compactTwoRow" aria-label="좌석 편집기">
                    <div className="snvSeatInspectorHeader" aria-label="좌석 편집기 머리글">
                      <span>{selectedSeat}번 좌석</span>
                      <strong>{characters.find((character) => character.id === seatAssignments[selectedSeat])?.name ?? "미할당"}</strong>
                      <span
                        className={`snvAlignmentIcon ${seatAssignments[selectedSeat] ? `alignment-${seatAlignments[selectedSeat] ?? defaultAlignment(seatAssignments[selectedSeat])}` : "unassigned"}`}
                        aria-label={seatAssignments[selectedSeat] ? `${(seatAlignments[selectedSeat] ?? defaultAlignment(seatAssignments[selectedSeat])) === "evil" ? "악한" : "선한"} 진영` : "진영 미정"}
                      >{seatAssignments[selectedSeat] ? ((seatAlignments[selectedSeat] ?? defaultAlignment(seatAssignments[selectedSeat])) === "evil" ? "악" : "선") : "-"}</span>
                    </div>
                    <input
                      type="text"
                      aria-label={`${selectedSeat}번 좌석 이름`}
                      placeholder="플레이어 이름"
                      value={seatNames[selectedSeat] ?? ""}
                      onChange={(event) => {
                        setSeatNames((current) => ({ ...current, [selectedSeat]: event.target.value }));
                        scheduleTextAutosave();
                      }}
                      onBlur={flushTextAutosave}
                    />
                </div>
              ) : null}
              <div className="snvSelectedRosterTray">
                {selectedIds.map((id) => {
                  const character = characters.find((candidate) => candidate.id === id)!;
                  const asset = sectsAndVioletsCharacterAsset(id);
                  const assignedSeat = Object.entries(seatAssignments).find(([, characterId]) => characterId === id)?.[0];
                  const selectedForSeat = Boolean(selectedSeat && seatAssignments[selectedSeat] === id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`${assignedSeat ? "assigned " : ""}${selectedForSeat ? "selectedForSeat " : ""}compact`}
                      aria-label={assignedSeat ? `${character.name}, ${assignedSeat}번 배치됨` : `${character.name} 배치`}
                      aria-pressed={selectedForSeat || pendingCharacterId === id}
                      onClick={() => chooseCharacterForSeating(id)}
                    >
                      {asset ? <img className="compactIcon" src={asset.src} alt="" /> : null}
                      <span>{character.name}</span>
                    </button>
                  );
                })}
              </div>
            </aside>
            </>
            )}
          </div>
          <div className={`snvSeatingActions ${seatingConfirmed ? "placeholder" : ""}`}>
            {!seatingConfirmed ? (
              <button type="button" className="snvConfirmRoster snvConfirmSeating prominent floatingAction" disabled={!seatingComplete || operationBusy} onClick={() => void confirmSeating()}>{operationBusy ? "확정 중" : "배치 확정"}</button>
            ) : null}
          </div>
        </section>
      ) : activeTab === "play" ? production && replayState?.currentStep && effectivePlayPhase !== "firstNight" ? (
        <SectsAndVioletsLiveProgress
          replayState={replayState}
          phaseLabel={phaseLabel(effectivePlayPhase, replayState.currentStep)}
          operationBusy={operationBusy}
          actorRoleName={liveActorCharacter?.name ?? replayState.currentStep.character}
          actorCharacterId={liveActor?.actualCharacter ?? replayState.currentStep.character}
          actorSummary={liveActorCharacter?.ability}
          onGoToGrimoire={() => navigateToTab("seating")}
          onStartNomination={() => startLiveHandoff("nomination")}
          onEndNominations={() => void endLiveNominations()}
          onConfirmExecution={() => void confirmLiveExecution()}
          onStartDemonAttack={() => startLiveHandoff("demon")}
          onStartSnakeCharmer={() => startLiveHandoff("snakeCharmer")}
          onAdvance={() => void advanceFirstNight()}
          onResolveManual={(outcome) => void advanceFirstNight(outcome)}
        />
      ) : (
        <section
          className={`snvManualSurface snvFirstNightSurface snvTabPanel ${effectivePlayPhase === "day" ? "snvDaySurface" : "snvNightSurface"}`}
          aria-label={effectivePlayPhase === "firstNight" ? "첫날 밤 진행" : effectivePlayPhase === "day" ? "낮 진행" : "이후 밤 진행"}
        >
          <header className="snvFirstNightHeader">
            <button type="button" aria-label="마도서로 이동" onClick={() => navigateToTab("seating")}>← 마도서</button>
            <h2>{phaseLabel(effectivePlayPhase, replayState?.currentStep)}</h2>
          </header>

          <div className="snvFirstNightPrimary">
            {effectivePlayPhase === "firstNight" && currentFirstNightStep && !isTransitionStep(currentFirstNightStep) ? (
              <article className="snvCurrentStep">
                <p className="snvCurrentStepLabel">현재 할 일</p>
                {currentFirstNightAsset && currentFirstNightStep.characterId ? (
                  <CharacterDetailButton
                    details={sectsAndVioletsCharacterDetail(currentFirstNightStep.characterId)}
                    className="snvCurrentStepIdentity interactive"
                    theme="snv-night"
                  >
                    <img src={currentFirstNightAsset.src} alt={`${currentFirstNightStep.name} 공식 캐릭터 아이콘`} />
                    <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{currentFirstNightStep.name}</span>
                  </CharacterDetailButton>
                ) : <div className="snvCurrentStepIdentity"><h3>{currentFirstNightStep.name}</h3></div>}
                <p>{currentFirstNightStep.summary}</p>
                <div className="snvStepActions">
                  {replayState?.currentStep?.character === "snakeCharmer" && replayState.currentStep.requiredInput.kind === "playerIds" ? null : currentFirstNightStep.support === "automated" ? (
                    <button
                      type="button"
                      className={`informationReveal ${revealedStepIds.includes(currentFirstNightStep.id) ? "" : "prominent"}`}
                      onClick={showCurrentStepInformation}
                    >정보 공개</button>
                  ) : null}
                  {replayState?.currentStep?.character === "snakeCharmer" && replayState.currentStep.requiredInput.kind === "playerIds" ? (
                    <button type="button" disabled={operationBusy} onClick={() => startLiveHandoff("snakeCharmer")}>대상 선택</button>
                  ) : (
                    <button type="button" disabled={operationBusy} onClick={() => void advanceFirstNight()}>{currentFirstNightStep.support === "manual" ? "처리 완료" : "다음 단계"}</button>
                  )}
                  {currentFirstNightStep.support === "manual" && !(replayState?.currentStep?.character === "snakeCharmer" && replayState.currentStep.requiredInput.kind === "playerIds") ? <button type="button" className="secondary" disabled={operationBusy} onClick={() => void advanceFirstNight("notApplicable")}>해당 없음</button> : null}
                </div>
              </article>
            ) : effectivePlayPhase === "firstNight" ? (
              <article className="snvCurrentStep complete">
                <h3>1일차 밤 종료</h3>
                <div className="snvStepActions">
                  <button type="button" disabled={operationBusy} onClick={() => coreAdapter ? void advanceFirstNight() : (() => { setPlayPhase("day"); setDayComplete(false); })()}>낮으로</button>
                </div>
              </article>
            ) : effectivePlayPhase === "day" && !dayComplete ? (
              <article className="snvCurrentStep snvDayStep">
                <p className="snvCurrentStepLabel">현재 할 일</p>
                <h3>낮 진행</h3>
                <p>능력 사용, 지명, 투표와 처형을 진행합니다.</p>
                <div className="snvStepActions">
                  <button type="button" onClick={() => setDayComplete(true)}>낮 종료</button>
                </div>
              </article>
            ) : effectivePlayPhase === "day" ? (
              <article className="snvCurrentStep snvDayStep complete">
                <h3>2일차 낮 종료</h3>
                <div className="snvStepActions">
                  <button type="button" disabled={operationBusy} onClick={() => coreAdapter ? void advanceFirstNight() : setPlayPhase("laterNight")}>2일차 밤으로</button>
                </div>
              </article>
            ) : (
              <article className="snvCurrentStep">
                <p className="snvCurrentStepLabel">현재 할 일</p>
                <h3>밤 진행 준비</h3>
                <p>오늘 밤 행동 순서를 확인하고 첫 번째 플레이어를 깨울 준비를 합니다.</p>
              </article>
            )}
          </div>

          {effectivePlayPhase === "firstNight" ? (
            <ol className="snvPhaseOverview" aria-label="첫날 밤 순서">
              {firstNightSteps.map((step, index) => (
                <li key={step.id} className={phaseStepPresentation(step.id, index, firstNightStepIndex, replayState?.phaseOverview).className}>
                  <span>{phaseStepPresentation(step.id, index, firstNightStepIndex, replayState?.phaseOverview).label}</span>
                  <strong>{step.name}</strong>
                </li>
              ))}
            </ol>
          ) : effectivePlayPhase === "day" ? (
            <ol className="snvPhaseOverview" aria-label="낮 순서">
              <li className={dayComplete ? "complete" : "current"}>
                <span>{dayComplete ? "완료" : "현재"}</span>
                <strong>낮 진행</strong>
              </li>
            </ol>
          ) : (
            <ol className="snvPhaseOverview" aria-label="이후 밤 순서">
              <li className="current"><span>현재</span><strong>밤 진행 준비</strong></li>
            </ol>
          )}
        </section>
      ) : (
        <section className="snvStorageSurface snvTabPanel" aria-label="저장 및 불러오기">
          <article>
            <span>현재 게임</span>
            <h2>이 기기에 저장</h2>
            <button type="button" disabled={!phaseCheckpoints.length} onClick={exportCurrentCheckpoint}>export JSON</button>
          </article>
          <article>
            <span>저장된 게임</span>
            <h2>계속 진행</h2>
            <button type="button" disabled={storageLoading || operationBusy} onClick={() => importInputRef.current?.click()}>import JSON</button>
          </article>
          <section className="snvEventLog" aria-label="이벤트 로그">
            <header><h2>이벤트 로그</h2><strong>{gameFile.game.events.length}건</strong></header>
            {gameFile.game.events.length ? (
              <ol className="snvScrollableEventList" aria-label="확정 이벤트 최신순" tabIndex={0}>
                {[...gameFile.game.events].reverse().map((event, index) => (
                  <li key={event.id}>
                    <span>{String(gameFile.game.events.length - index).padStart(2, "0")}</span>
                    <p>{event.summary}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="snvEmptyEventLog">확정된 이벤트가 없습니다.</p>}
          </section>
        </section>
      )}
      {activeTab === "roles" ? (
        <aside className="snvRoleDetail fixed floatingAction" aria-label="직업 설명">
          <CharacterDetailButton
            details={sectsAndVioletsCharacterDetail(activeCharacter.id)}
            className="snvRoleDetailIdentity"
            theme={effectivePlayPhase === "day" ? "snv-day" : "snv-night"}
          >
            {activeCharacterAsset ? <img className="snvRoleDetailIcon" src={activeCharacterAsset.src} alt={`${activeCharacter.name} 공식 캐릭터 아이콘`} /> : null}
            <div className="snvRoleDetailCopy">
              <div><span>{kindLabels[activeCharacter.kind]}</span></div>
              <h2>{activeCharacter.name}</h2>
              <p>{activeCharacter.ability}</p>
            </div>
          </CharacterDetailButton>
          <div className="snvRoleDetailActions">
            <button type="button" className="snvConfirmRoster snvStageForward prominent" disabled={storageLoading || !rosterComplete} onClick={() => { setRosterConfirmed(true); navigateToTab("seating"); markAutosaveNeeded(); }}>
              <span>직업 선택 확정</span><small aria-hidden="true">마도서 →</small>
            </button>
          </div>
        </aside>
      ) : null}
      {informationStep ? (
        <SectsAndVioletsReveal
          dialogLabel={`${informationStep.name} 공개`}
          closeLabel="닫기"
          closeAriaLabel="정보 공개 닫기"
          closeButtonRef={informationCloseRef}
          onClose={() => setInformationStepId(undefined)}
        >
          <span>정보 공개</span>
          <h2>{informationStep.name}</h2>
          <p>{informationStep.summary}</p>
        </SectsAndVioletsReveal>
      ) : null}
      {returnConfirmOpen ? (
        <div className="snvDetailsBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeReturnConfirmation(); }}>
          <section className="snvReturnDialog" role="dialog" aria-modal="true" aria-label="진행 상태 초기화 확인">
            <h2>배치 단계로 돌아갈까요?</h2>
            <p>진행 중인 게임과 모든 상태가 초기화됩니다. 좌석 이름과 직업 배치는 유지됩니다.</p>
            <div>
              <button ref={returnCancelRef} type="button" onClick={closeReturnConfirmation}>취소</button>
              <button type="button" onClick={returnToSeating}>초기화하고 돌아가기</button>
            </div>
          </section>
        </div>
      ) : null}
      {newGameConfirmOpen ? (
        <div className="snvDetailsBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeNewGameConfirmation(); }}>
          <section className="snvReturnDialog" role="dialog" aria-modal="true" aria-label="새 게임 시작 확인">
            <h2>새 게임을 시작할까요?</h2>
            <p>현재 직업 선택, 좌석, 진행 상태가 모두 초기화됩니다.</p>
            <div>
              <button ref={newGameCancelRef} type="button" onClick={closeNewGameConfirmation}>취소</button>
              <button type="button" className="snvDestructiveAction" onClick={startNewGame}>새 게임 시작</button>
            </div>
          </section>
        </div>
      ) : null}
      {undoCheckpoint ? (
        <div className="snvDetailsBackdrop snvHistoryDialogBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeUndoConfirmation(); }}>
          <section ref={undoDialogRef} className="snvHistoryDialog snvUndoHistoryDialog" data-theme={effectivePlayPhase === "day" ? "day" : "night"} role="dialog" aria-modal="true" aria-labelledby="snv-undo-title">
            <h2 id="snv-undo-title">Undo</h2>
            <p className="snvUndoLabel">되돌릴 행동</p>
            <ol className="snvUndoEventStack" aria-label="취소될 이벤트">
              {undoEventEntries.map(({ event, number }) => (
                <li key={event.id}><span>{String(number).padStart(2, "0")}</span><p>{event.summary}</p></li>
              ))}
            </ol>
            <p className="snvUndoNotice">위 이벤트를 취소하고 직전 상태로 돌아갑니다.</p>
            <footer>
              <button ref={undoCancelRef} type="button" onClick={closeUndoConfirmation}>취소</button>
              <button type="button" className="snvDestructiveAction" onClick={() => void confirmPhaseUndo()}>되돌리기</button>
            </footer>
          </section>
        </div>
      ) : null}
      {operationError ? (
        <div className="snvDetailsBackdrop snvHistoryDialogBackdrop">
          <section ref={errorDialogRef} className="snvHistoryDialog snvFailureDialog" data-theme={effectivePlayPhase === "day" ? "day" : "night"} role="dialog" aria-modal="true" aria-labelledby="snv-error-title">
            <h2 id="snv-error-title">작업 실패</h2>
            <p>{operationError}</p>
            <footer><button ref={errorConfirmRef} type="button" onClick={() => setOperationError(undefined)}>확인</button></footer>
          </section>
        </div>
      ) : null}
      {warningVisible ? (
        <aside className="snvWarningNotification" role="status" aria-live="polite" aria-label="게임 경고">
          <span aria-hidden="true">!</span>
          <div>
            <strong>{visibleWarnings.length > 1 ? `게임 경고 · ${visibleWarnings.length}건` : "게임 경고"}</strong>
            {visibleWarnings.map((warning) => <p key={`${warning.code}:${warning.messageKo}`}>{warning.messageKo}</p>)}
          </div>
          <button type="button" aria-label="경고 닫기" onClick={() => setDismissedWarningKey(warningKey)}>×</button>
        </aside>
      ) : null}
      {nextIdentityReveal && identityRevealOpen ? (
        <SnakeCharmerIdentityReveal
          reveal={nextIdentityReveal}
          total={pendingIdentityReveals.length}
          onConfirm={acknowledgeIdentityReveal}
        />
      ) : null}
    </main>
  );
}

function identityRevealKey(gameId: string, sourceEventId: string, sequence: number) {
  return `${gameId}:${sourceEventId}:${sequence}`;
}

function workflowStepFromCanonical(step: PhaseStep): FirstNightStep {
  const suffix = step.id.split(":").at(-1) ?? step.id;
  const known = firstNightOrder.find((candidate) => (
    candidate.id === suffix || (step.character !== undefined && candidate.characterId === step.character)
  ));
  if (suffix === "toDay") {
    return {
      id: step.id,
      name: "낮으로",
      support: step.support ?? "automated",
      summary: "밤을 마치고 낮으로 전환합니다.",
    };
  }
  if (suffix === "manual" && step.phase === "day") {
    return {
      id: step.id,
      name: "낮 진행",
      support: step.support ?? "manual",
      summary: "능력 사용, 지명, 투표와 처형을 진행합니다.",
    };
  }
  const character = characters.find((candidate) => candidate.id === step.character);
  return {
    id: step.id,
    name: known?.name ?? character?.name ?? suffix,
    characterId: step.character,
    support: step.support ?? "automated",
    summary: known?.summary ?? character?.ability ?? "이 단계를 진행합니다.",
  };
}

function isTransitionStep(step: FirstNightStep) {
  return step.id.split(":").at(-1) === "toDay";
}

function phaseLabel(phase: PlayPhase, currentStep?: PhaseStep | null) {
  if (phase === "firstNight") return "1일차 밤";
  const prefix = currentStep?.id.split(":")[0] ?? (phase === "day" ? "day" : "night");
  const cycle = Number(prefix.match(/\d+$/)?.[0] ?? "1");
  return `${cycle + 1}일차 ${phase === "day" ? "낮" : "밤"}`;
}

function phaseStepPresentation(
  stepId: string,
  index: number,
  localIndex: number,
  overview?: ReplayState["phaseOverview"],
) {
  const canonicalStatus = overview?.find((step) => step.id === stepId)?.status;
  if (canonicalStatus) {
    if (canonicalStatus === "current") return { className: "current", label: "현재" };
    if (canonicalStatus === "waiting" || canonicalStatus === "needsFollowUp") return { className: "", label: "대기" };
    if (canonicalStatus === "notApplicable") return { className: "complete", label: "해당 없음" };
    return { className: "complete", label: "완료" };
  }
  if (index < localIndex) return { className: "complete", label: "완료" };
  if (index === localIndex) return { className: "current", label: "현재" };
  return { className: "", label: "대기" };
}

function createSectsAndVioletsGameFile(): GameFile {
  const now = new Date().toISOString();
  return {
    schemaVersion: 3,
    game: {
      scriptId: SECTS_AND_VIOLETS,
      id: "local-snv-game",
      name: "Sects & Violets",
      createdAt: now,
      updatedAt: now,
      events: [],
    },
  };
}

function formatAutosaveTime(value: string | undefined) {
  if (!value) return "--:--:--";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function defaultAlignment(characterId: string): Alignment {
  const kind = characters.find((character) => character.id === characterId)?.kind;
  return kind === "minion" || kind === "demon" ? "evil" : "good";
}

function DistributionValues({ values }: { values: [number, number, number, number] }) {
  return (
    <div className="snvDistributionCard emphasized">
      <h2>인원 구성</h2>
      <div className="snvDistributionValues">
        {values.map((value, index) => (
          <div key={kindOrder[index]} aria-label={`인원 구성 ${kindLabels[kindOrder[index]]} ${value}명`}><strong>{value}</strong><span>{kindLabels[kindOrder[index]]}</span></div>
        ))}
      </div>
    </div>
  );
}

function signed(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}
