import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ProductionApplicationShell } from "./shared-ui/ProductionApplicationShell";
import type { CoreAdapter } from "./core/coreAdapter";
import {
  CanonicalSessionController,
  replayMatches,
  type CanonicalReplaySnapshot,
} from "./core/canonicalSessionController";
import { SECTS_AND_VIOLETS } from "./core/scripts";
import type {
  Command,
  AvailableDayAction,
  DayActionRecordInput,
  EvilInformationRevealPayload,
  GameEvent,
  GameFile,
  InformationResult,
  MadnessCheckResult,
  PhaseStep,
  Player,
  ReplayState,
  RevealPayload,
  SetupDistribution,
} from "./core/types";
import { proposalRevealPayload } from "./core/revealPayload";
import {
  automatedInformationCharacterId,
  scalarInformationLabel,
  scalarInformationValueLabel,
} from "./core/informationPresentation.js";
import {
  SectsAndVioletsLiveGrimoire,
  SectsAndVioletsLiveProgress,
  type LiveHandoff,
  type LivePlayer,
} from "./sectsAndVioletsLivePhase";
export { grimoireHeights, rectangularSeatPositions } from "./sectsAndVioletsGrimoireLayout";
import {
  exportGameFileJson,
  importGameFileJson,
} from "./gameStorage";
import {
  loadCompatibleWebSession,
  saveCompatibleWebSession,
  type CompatibleWebSessionStorage,
  type WebSessionSnapshot,
} from "./webSessionStorage";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacterDetail } from "./characterDetails";
import { CharacterDetailButton } from "./components/CharacterRulesCard";
import { SectsAndVioletsReveal } from "./features/reveal/SectsAndVioletsReveal";
import {
  SectsAndVioletsEvilInformationReveal,
  SectsAndVioletsEvilInformationTask,
} from "./features/evil-information/SectsAndVioletsEvilInformation";
import "./features/evil-information/sectsAndVioletsEvilInformation.css";
import {
  DeathConsequencePanel,
  type DeathConsequenceResolution,
} from "./features/death-consequences/DeathConsequencePanel";
import { SnvGameEndDialog, SnvGameEndDock } from "./features/snv-game-end/SnvGameEnd";
import { deathConsequenceCommand } from "./features/death-consequences/deathConsequencePolicy";
import {
  CharacterChangeReveal,
  CharacterChangeRevealPrompt,
} from "./features/identity-change/CharacterChangeReveal";
import {
  BarberAbilityReveal,
  BarberAbilityRevealPrompt,
} from "./features/death-consequences/BarberAbilityReveal";
import {
  CerenovusMadnessReveal,
  CerenovusMadnessRevealPrompt,
} from "./features/madness/CerenovusMadnessReveal";
import { EvilTwinReveal, EvilTwinRevealPrompt } from "./features/evil-twin/EvilTwinReveal";
import { WitchDeathPrompt } from "./features/death-consequences/WitchDeathPrompt";
import { PlayerTokenCountBadge, type PlayerTokenPresentation, type PlayerTokensByPlayerId } from "./features/grimoire/playerTokenPresentation";
import {
  browserRuntimeClock,
  numberedPhaseForStep,
  type RuntimeClock,
} from "./features/phase-control/phaseRuntime";
import { usePhaseRuntime } from "./features/phase-control/usePhaseRuntime";
import {
  browserCryptoChoiceToken,
  type ChoiceTokenSource,
} from "./features/phase-control/randomSuggestion";
import {
  informationValueLabel,
  SectsAndVioletsInformationTask,
} from "./features/phase-control/SectsAndVioletsInformationTask";
import {
  acquiredAbilityCharacterForStep,
  AcquiredAbilityPresentation,
} from "./features/phase-control/acquiredAbilityPresentation";
import { PlayerImpairmentBadges } from "./features/phase-control/ImpairmentBadges";
import { inferCanonicalUndoUnits } from "./core/canonicalUndo";
import {
  exportLatestSectsAndVioletsCheckpoint,
  inferSectsAndVioletsCheckpoints,
  type SectsAndVioletsPhaseCheckpoint,
  type SectsAndVioletsSetupSession,
} from "./sectsAndVioletsSession";
import { DayActionDock } from "./features/day-actions/DayActionDock";
import { MadnessActionDock } from "./features/madness/MadnessActionDock";
import { SectsAndVioletsBugReportDialog } from "./features/bug-report/SectsAndVioletsBugReportDialog";
import {
  DEFAULT_BUG_REPORT_EMAIL,
  currentBugReportEnvironment,
  type BugReportDelivery,
} from "./bugReportDelivery";
import type {
  SectsAndVioletsBugReportContextInput,
  SectsAndVioletsBugReportEnvironment,
} from "./sectsAndVioletsBugReport";
import {
  sectsAndVioletsCharacters as characters,
  type SectsAndVioletsCharacter as CatalogCharacter,
  type SectsAndVioletsCharacterKind as CharacterKind,
} from "./sectsAndVioletsCharacters";
import { SectsAndVioletsSetupPresentation } from "./features/setup/SectsAndVioletsSetupPresentation";
import { SectsAndVioletsAssignment } from "./features/grimoire/SectsAndVioletsAssignment";
import {
  sectsAndVioletsBaseDistribution as baseDistribution,
  sectsAndVioletsDemonChoices as demonChoices,
  sectsAndVioletsKindOrder as kindOrder,
  type SectsAndVioletsDemonChoice as DemonChoice,
} from "./features/setup/sectsAndVioletsSetupAdapter";

type Alignment = "good" | "evil";
type ApplicationTab = "roles" | "seating" | "play" | "storage";
type TabMotion = "tabForward" | "tabBackward" | "";
type PlayPhase = "firstNight" | "day" | "laterNight";
type FirstNightStep = {
  id: string;
  name: string;
  characterId?: string;
  support: "manual" | "automated";
  summary: string;
  playerId?: string;
};
type InformationCheckpoint = {
  step: PhaseStep;
  actor: Player;
  targetPlayerIds: string[];
  deliveredResult: InformationResult;
  revealPayload: Extract<RevealPayload, { kind: "numericInformation" | "booleanInformation" | "dreamerInformation" | "seamstressInformation" | "sageInformation" }>;
};
type EvilInformationCheckpoint = {
  sourceEventId: string;
  stepId: string;
  step: PhaseStep;
  payload: EvilInformationRevealPayload;
};

const firstNightOrder: FirstNightStep[] = [
  { id: "philosopher", name: "철학자", characterId: "philosopher", support: "manual", summary: "철학자의 선택과 능력 획득을 마도서에서 처리합니다." },
  { id: "minionInfo", name: "하수인 정보", support: "automated", summary: "하수인에게 악마와 다른 하수인을 알려줍니다." },
  { id: "demonInfo", name: "악마 정보", support: "automated", summary: "악마에게 하수인과 블러프 직업을 알려줍니다." },
  { id: "snakeCharmer", name: "뱀 조련사", characterId: "snakeCharmer", support: "manual", summary: characters.find((character) => character.id === "snakeCharmer")!.ability },
  { id: "evilTwin", name: "사악한 쌍둥이", characterId: "evilTwin", support: "automated", summary: "선택한 두 쌍둥이가 서로와 직업을 확인합니다." },
  { id: "witch", name: "마녀", characterId: "witch", support: "automated", summary: "저주할 플레이어를 선택합니다." },
  { id: "cerenovus", name: "세레노버스", characterId: "cerenovus", support: "manual", summary: "플레이어와 광기 직업을 선택합니다." },
  { id: "clockmaker", name: "시계공", characterId: "clockmaker", support: "automated", summary: "악마와 가장 가까운 하수인 사이의 거리를 알려줍니다." },
  { id: "dreamer", name: "꿈꾸는 자", characterId: "dreamer", support: "manual", summary: "플레이어를 선택하고 직업 정보 두 개를 확인합니다." },
  { id: "seamstress", name: "재봉사", characterId: "seamstress", support: "manual", summary: "선택한 두 플레이어의 성향이 같은지 확인합니다." },
  { id: "mathematician", name: "수학자", characterId: "mathematician", support: "automated", summary: "비정상적으로 작동한 능력의 수를 알려줍니다." },
];

export type SectsAndVioletsGameSurfaceProps = {
  coreAdapter?: CoreAdapter;
  storageDriver?: CompatibleWebSessionStorage<SnvSetupDraft, SnvPresentation>;
  production?: boolean;
  phaseRuntimeClock?: RuntimeClock;
  choiceTokenSource?: ChoiceTokenSource;
  bugReportEmail?: string;
  bugReportDelivery?: BugReportDelivery;
};

export type SnvSetupDraft = SectsAndVioletsSetupSession | null;
export type SnvPresentation = {
  activeTab?: ApplicationTab;
  phaseCheckpoints?: SectsAndVioletsPhaseCheckpoint[];
};
type SnvWebSessionSnapshot = WebSessionSnapshot<SnvSetupDraft, SnvPresentation>;

export function SectsAndVioletsGameSurface({
  coreAdapter,
  storageDriver,
  production = false,
  phaseRuntimeClock = browserRuntimeClock,
  choiceTokenSource = browserCryptoChoiceToken,
  bugReportEmail = DEFAULT_BUG_REPORT_EMAIL,
  bugReportDelivery,
}: SectsAndVioletsGameSurfaceProps = {}) {
  const canonicalSession = useMemo(
    () => coreAdapter ? new CanonicalSessionController(SECTS_AND_VIOLETS, coreAdapter) : undefined,
    [coreAdapter],
  );
  const [activeTab, setActiveTab] = useState<ApplicationTab>("roles");
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
  const [informationCheckpoint, setInformationCheckpoint] = useState<InformationCheckpoint>();
  const [informationRevealOpen, setInformationRevealOpen] = useState(false);
  const [evilInformationCheckpoint, setEvilInformationCheckpoint] = useState<EvilInformationCheckpoint>();
  const [evilInformationRevealOpen, setEvilInformationRevealOpen] = useState(false);
  const [selectedBluffCharacterIds, setSelectedBluffCharacterIds] = useState<string[]>([]);
  const [selectedPhilosopherCharacterId, setSelectedPhilosopherCharacterId] = useState("");
  const [suggestingBluffs, setSuggestingBluffs] = useState(false);
  const [selectedInformationResult, setSelectedInformationResult] = useState<InformationResult>();
  const [playPhase, setPlayPhase] = useState<PlayPhase>("firstNight");
  const [dayComplete, setDayComplete] = useState(false);
  const [gameFile, setGameFile] = useState<GameFile>(createSectsAndVioletsGameFile);
  const [replayState, setReplayState] = useState<CanonicalReplaySnapshot>();
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
  const [livePoisonTargetId, setLivePoisonTargetId] = useState<string>();
  const [liveTargetIds, setLiveTargetIds] = useState<string[]>([]);
  const [liveChooserId, setLiveChooserId] = useState<string>();
  const [liveCharacterId, setLiveCharacterId] = useState<string>();
  const [liveMadnessCharacterId, setLiveMadnessCharacterId] = useState("");
  const [activeFreeActionGroup, setActiveFreeActionGroup] = useState<"day" | "madness">();
  const [selectedInformationTargetIds, setSelectedInformationTargetIds] = useState<string[]>([]);
  const [liveNominationCheckpointId, setLiveNominationCheckpointId] = useState<string>();
  const [acknowledgedIdentityRevealKeys, setAcknowledgedIdentityRevealKeys] = useState<string[]>([]);
  const [openedIdentityRevealKey, setOpenedIdentityRevealKey] = useState<string>();
  const [barberAbilityRevealOpen, setBarberAbilityRevealOpen] = useState(false);
  const [bugReportSnapshot, setBugReportSnapshot] = useState<{
    gameFile: GameFile;
    environment: SectsAndVioletsBugReportEnvironment;
    reproductionContext: SectsAndVioletsBugReportContextInput;
  }>();
  const lastEnqueuedAutosaveRevisionRef = useRef(0);
  const pendingAutosaveRef = useRef<SnvWebSessionSnapshot | undefined>(undefined);
  const pendingAutosaveCompletionRef = useRef<((saved: boolean) => void) | undefined>(undefined);
  const autoResolvedVigormortisPoisonRef = useRef<string | undefined>(undefined);
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
  const bugReportTriggerRef = useRef<HTMLButtonElement>(null);

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
  const assignedCount = Object.keys(seatAssignments).length;
  const seatingComplete = assignedCount === playerCount;
  const localFirstNightSteps = useMemo(
    () => firstNightOrder.filter((step) => !step.characterId || selectedIds.includes(step.characterId)),
    [selectedIds],
  );
  const canonicalSteps = useMemo(
    () => replayState?.phaseOverview.map((step) => workflowStepFromCanonical(
      step,
      replayState.players,
    )) ?? [],
    [replayState?.phaseOverview, replayState?.players],
  );
  const firstNightSteps = coreAdapter && replayState?.phase === "firstNight"
    ? canonicalSteps
    : localFirstNightSteps;
  const currentFirstNightStep = coreAdapter && replayState?.currentStep
    ? workflowStepFromCanonical(replayState.currentStep, replayState.players)
    : localFirstNightSteps[firstNightStepIndex];
  const effectivePlayPhase: PlayPhase = coreAdapter && replayState?.phase && replayState.phase !== "setup"
    ? replayState.phase === "firstNight" ? "firstNight" : replayState.phase === "day" ? "day" : "laterNight"
    : playPhase;
  const activeNumberedPhase = numberedPhaseForStep(
    replayState?.phase,
    replayState?.currentStep?.id,
  );
  const phaseRuntime = usePhaseRuntime({
    activePhase: activeNumberedPhase,
    gameSessionRevision: 0,
    clock: phaseRuntimeClock,
  });
  const currentFirstNightAsset = sectsAndVioletsCharacterAsset(currentFirstNightStep?.characterId);
  const seatTokenCharacterByPlayerId = useMemo(() => {
    const display = new Map<string, string>();
    for (const grant of replayState?.ruleState.abilityGrants ?? []) {
      const selectedInPlay = replayState?.players.some((player) => player.actualCharacter === grant.characterId);
      if (!selectedInPlay) display.set(grant.ownerPlayerId, grant.characterId);
    }
    return display;
  }, [replayState?.players, replayState?.ruleState.abilityGrants]);
  const livePlayers = useMemo<LivePlayer[]>(() => (replayState?.players ?? []).map((player) => {
    const displayedCharacter = seatTokenCharacterByPlayerId.get(player.id) ?? player.actualCharacter;
    const character = characters.find((candidate) => candidate.id === displayedCharacter);
    return {
      ...player,
      seatCharacterId: displayedCharacter,
      characterName: character?.name ?? displayedCharacter,
      characterKind: character?.kind ?? "townsfolk",
    };
  }), [seatTokenCharacterByPlayerId, replayState?.players]);
  const liveActor = replayState?.players.find((player) => player.id === replayState.currentStep?.playerId);
  const currentFirstNightAcquiredAbilityCharacterId = acquiredAbilityCharacterForStep(
    replayState?.currentStep,
    liveActor,
  );
  const liveActorCharacter = characters.find((character) => character.id === liveActor?.actualCharacter);
  useEffect(() => {
    setSelectedPhilosopherCharacterId("");
  }, [replayState?.currentStep?.id]);
  const pitHagDemonIntents = useMemo(() => {
    const prefix = replayState?.currentStep?.id.split(":")[0];
    if (!prefix) return [];
    return gameFile.game.events.flatMap((event) => {
      if (event.type !== "nightActionResolved"
        || !event.payload.stepId.startsWith(`${prefix}:demon:`)
        || event.payload.resolution.kind !== "demonAttack"
        || event.payload.resolution.outcome.kind !== "noEffect"
        || event.payload.resolution.outcome.reason !== "pitHagCreatedDemon") return [];
      const actor = replayState?.players.find((player) => player.id === event.payload.actorPlayerId);
      const target = replayState?.players.find((player) => player.id === event.payload.resolution.targetPlayerId);
      const role = characters.find((character) => character.id === event.payload.actorCharacterId)?.name ?? event.payload.actorCharacterId;
      return [{
        actorLabel: actor ? `${actor.seat}번 ${actor.name} · ${role}` : role ?? "악마",
        targetLabel: target ? `${target.seat}번 ${target.name}` : event.payload.resolution.targetPlayerId,
      }];
    });
  }, [gameFile.game.events, replayState?.currentStep?.id, replayState?.players]);
  const canonicalInformationStep = replayState?.currentStep?.informationPrompt && isAutomatedInformationCharacter(replayState.currentStep.character)
    ? replayState.currentStep
    : undefined;
  const canonicalEvilInformationStep = replayState?.currentStep?.stepType === "evilInfo"
    ? replayState.currentStep
    : undefined;
  const activeEvilInformationStep = evilInformationCheckpoint?.step ?? canonicalEvilInformationStep;
  const evilInformationWakePlayers = activeEvilInformationStep
    ? evilInformationPlayersToWake(activeEvilInformationStep, replayState?.players ?? [])
    : [];
  const activeInformationStep = informationCheckpoint?.step ?? canonicalInformationStep;
  const activeInformationActor = informationCheckpoint?.actor ?? (
    activeInformationStep?.playerId
      ? replayState?.players.find((player) => player.id === activeInformationStep.playerId)
      : undefined
  );
  const activeInformationTargetIds = informationCheckpoint?.targetPlayerIds ?? selectedInformationTargetIds;
  const activeInformationResult = informationCheckpoint?.deliveredResult ?? selectedInformationResult;
  const pendingIdentityReveals = replayState?.pendingIdentityReveals ?? [];
  const nextIdentityReveal = pendingIdentityReveals.find(
    (reveal) => !acknowledgedIdentityRevealKeys.includes(identityRevealKey(gameFile.game.id, reveal.sourceEventId, reveal.sequence)),
  );
  const nextIdentityRevealKey = nextIdentityReveal
    ? identityRevealKey(gameFile.game.id, nextIdentityReveal.sourceEventId, nextIdentityReveal.sequence)
    : undefined;
  const identityRevealOpen = nextIdentityRevealKey === openedIdentityRevealKey;
  const identityRevealPlayerId = nextIdentityReveal?.payload.kind === "evilTwinPair"
    ? undefined
    : nextIdentityReveal?.payload.playerId;
  const identityRevealPlayer = replayState?.players.find(
    (player) => player.id === identityRevealPlayerId,
  );
  const witchDeathPlayer = replayState?.currentStep?.stepType === "witchDeath"
    ? replayState.players.find((player) => player.id === replayState.currentStep?.playerId)
    : undefined;
  const barberAbilityActor = replayState?.players.find((player) => player.id === liveChooserId);
  const effectiveMadnessAssignments = replayState?.madnessAssignments ?? [];
  const pendingVigormortisPoison = replayState?.pendingVigormortisPoisonChoices?.[0];
  const pendingDeathConsequence = replayState?.pendingDeathConsequences?.[0];
  const vigormortisDependentSelection = liveTargetId
    ? replayState?.currentStep?.requiredInput.dependentPlayerSelections?.find(
      (selection) => selection.triggerPlayerId === liveTargetId && selection.selectionIndex === 1,
    )
    : undefined;
  const liveSelectablePlayerIds = liveHandoff?.kind === "vigormortisPoison"
    ? pendingVigormortisPoison?.allowedPlayerIds
    : liveHandoff?.kind === "barber" && liveHandoff.selectionStage === "chooser"
      ? pendingDeathConsequence?.eligibleChooserPlayerIds
    : liveHandoff?.kind === "barber" && liveHandoff.selectionStage === "reveal"
      ? []
    : liveHandoff?.kind === "barber"
      ? pendingDeathConsequence?.allowedPlayerIds.filter((playerId) => {
          const player = replayState?.players.find((candidate) => candidate.id === playerId);
          return characters.find((character) => character.id === player?.actualCharacter)?.kind !== "demon"
            || playerId === liveChooserId;
        })
    : liveHandoff?.kind === "sweetheart" || liveHandoff?.kind === "klutz"
      ? pendingDeathConsequence?.allowedPlayerIds
    : liveHandoff?.kind === "demon" && liveHandoff.selectionStage === "poison"
      ? vigormortisDependentSelection?.allowedPlayerIds
      : undefined;
  const canonicalTokensByPlayerId = useMemo<PlayerTokensByPlayerId>(() => {
    const result: Record<string, PlayerTokenPresentation[]> = {};
    for (const impairment of replayState?.ruleState.activeImpairments ?? []) {
      const source = characters.find((character) => character.id === impairment.sourceCharacterId);
      const description = impairment.kind === "drunk"
        ? impairment.sourceCharacterId === "philosopher"
          ? "철학자의 능력이 작동하는 동안 취한 상태입니다."
          : "사랑꾼의 능력으로 영구히 취한 상태입니다."
        : impairment.sourceCharacterId === "vigormortis"
        ? "비고르모르티스가 죽인 하수인의 주민 이웃으로 중독된 상태입니다."
        : impairment.sourceCharacterId === "noDashii"
          ? "노 다시의 가장 가까운 주민 이웃으로 중독된 상태입니다."
          : "뱀 조련사 교환으로 영구 중독된 상태입니다.";
      const token = {
        instanceId: `canonical-${impairment.sourceEventId}-${impairment.playerId}`,
        label: impairment.kind === "drunk" ? "취함" : "중독",
        sourceLabel: source?.name ?? impairment.sourceCharacterId,
        sourceIconSrc: sectsAndVioletsCharacterAsset(impairment.sourceCharacterId)?.src,
        visualKind: "impairment" as const,
        description,
      };
      (result[impairment.playerId] ??= []).push(token);
    }
    for (const reminder of replayState?.ruleState.automaticReminders ?? []) {
      if (reminder.tokenId === "drunk" && replayState?.ruleState.activeImpairments?.some((impairment) => impairment.playerId === reminder.playerId && impairment.sourceCharacterId === reminder.characterId)) continue;
      const source = characters.find((character) => character.id === reminder.characterId);
      (result[reminder.playerId] ??= []).push({
        instanceId: reminder.sourceEventId
          ? `canonical-${reminder.sourceEventId}-${reminder.tokenId}-${reminder.playerId}`
          : `canonical-${reminder.characterId}-${reminder.tokenId}-${reminder.playerId}`,
        label: reminder.label,
        sourceLabel: source?.name ?? reminder.characterId,
        sourceIconSrc: sectsAndVioletsCharacterAsset(reminder.characterId)?.src,
        visualKind: reminder.tokenId === "isThePhilosopher"
          ? "assignment"
          : reminder.tokenId === "drunk" || reminder.tokenId === "poisoned"
            ? "impairment"
            : "usage",
        description: reminder.description,
        count: reminder.count,
        inactiveReason: reminder.inactiveReason,
      });
    }
    for (const assignment of effectiveMadnessAssignments) {
      if (assignment.sourceCharacterId === "mutant" && assignment.status !== "violated") continue;
      const requiredCharacter = characters.find((character) => character.id === assignment.requiredCharacterId);
      const status = assignment.status === "violated" ? "위반 발견" : assignment.status === "clear" ? "위반 없음" : "확인 전";
      (result[assignment.targetPlayerId] ??= []).push({
        instanceId: `madness-${assignment.assignmentId}`,
        label: assignment.sourceCharacterId === "mutant" ? "외지인 집착" : `집착 · ${requiredCharacter?.name ?? assignment.requiredCharacterId}`,
        sourceLabel: assignment.sourceCharacterId === "mutant" ? "변종" : "세레노버스",
        sourceIconSrc: sectsAndVioletsCharacterAsset(assignment.sourceCharacterId)?.src,
        visualKind: assignment.status === "violated" ? "impairment" : "usage",
        description: `${status}${assignment.sourceEffective ? "" : " · 능력 효력 없음"}`,
        inactiveReason: assignment.sourceCharacterId === "cerenovus" && !assignment.sourceEffective
          ? "세레노버스가 취하거나 중독되어 능력이 일시적으로 무효입니다."
          : undefined,
      });
    }
    return result;
  }, [effectiveMadnessAssignments, replayState?.ruleState.activeImpairments, replayState?.ruleState.automaticReminders]);
  const informationStep = firstNightSteps.find((step) => step.id === informationStepId);
  const displayedCharacterForSeat = (seat: number) => {
    const player = replayState?.players.find((candidate) => candidate.seat === seat);
    return player ? seatTokenCharacterByPlayerId.get(player.id) ?? seatAssignments[seat] : seatAssignments[seat];
  };
  const latestUndoCheckpoint = [...phaseCheckpoints].reverse().find(
    (checkpoint) => checkpoint.kind === "phase",
  );
  const undoEventEntries = useMemo(() => {
    if (!undoCheckpoint) return [];
    const checkpointIndex = phaseCheckpoints.findIndex((checkpoint) => checkpoint.id === undoCheckpoint.id);
    if (checkpointIndex < 0) return [];
    const previousEventCount = phaseCheckpoints[checkpointIndex - 1]?.eventCount ?? 0;
    const eventIds = undoCheckpoint.eventIds ? new Set(undoCheckpoint.eventIds) : undefined;
    return gameFile.game.events
      .map((event, index) => ({ event, number: index + 1 }))
      .filter(({ event, number }) => eventIds?.has(event.id)
        ?? (number > previousEventCount && number <= undoCheckpoint.eventCount))
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
    const activeNomination = replayState?.dayState?.activeNomination;
    if (
      replayState?.currentStep?.requiredInput.kind !== "nominationVote" ||
      !activeNomination
    ) {
      return;
    }
    setLiveHandoff((current) => current?.kind === "vote"
      ? current
      : { kind: "vote", complete: false });
    setLiveNominatorId(activeNomination.nominatorId);
    setLiveNomineeId(activeNomination.nomineeId);
    setLiveNominationCheckpointId(activeNomination.eventId);
  }, [
    replayState?.currentStep?.id,
    replayState?.currentStep?.requiredInput.kind,
    replayState?.dayState?.activeNomination?.eventId,
    replayState?.dayState?.activeNomination?.nominatorId,
    replayState?.dayState?.activeNomination?.nomineeId,
    liveHandoff?.kind,
  ]);

  useEffect(() => {
    if (informationCheckpoint) return;
    const prompt = canonicalInformationStep?.informationPrompt;
    const targetCheck = prompt?.targetChecks?.find((check) => check.targetPlayerIds.length === selectedInformationTargetIds.length && check.targetPlayerIds.every((id) => selectedInformationTargetIds.includes(id)))
      ?? prompt?.targetChecks?.find((check) => check.targetPlayerIds.length === 0);
    const vortoxActive = prompt?.activeReasons.some((reason) => reason.type === "vortox") ?? false;
    const firstPromptChoice = prompt?.numberChoices[0]
      ? { kind: "number" as const, value: prompt.numberChoices[0].value }
      : prompt?.booleanChoices?.[0]
        ? { kind: "boolean" as const, value: prompt.booleanChoices[0].value }
        : undefined;
    setSelectedInformationResult(targetCheck?.choices[0]?.result ?? (vortoxActive ? firstPromptChoice : prompt?.computedResult));
  }, [canonicalInformationStep?.id, informationCheckpoint, selectedInformationTargetIds]);

  useEffect(() => {
    setSelectedInformationTargetIds([]);
  }, [canonicalInformationStep?.id]);

  useEffect(() => {
    if (!evilInformationCheckpoint) setSelectedBluffCharacterIds([]);
  }, [canonicalEvilInformationStep?.id, evilInformationCheckpoint]);

  useEffect(() => {
    if (!evilInformationCheckpoint) return;
    const sourceStillExists = gameFile.game.events.some(
      (event) => event.id === evilInformationCheckpoint.sourceEventId,
    );
    if (sourceStillExists) return;
    setEvilInformationCheckpoint(undefined);
    setEvilInformationRevealOpen(false);
  }, [evilInformationCheckpoint, gameFile.game.events]);

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
    if (!canonicalSession || !storageDriver) return;
    let cancelled = false;
    loadCompatibleWebSession(storageDriver, (canonical) => createSnvWebSessionSnapshot(
      canonical ?? createSectsAndVioletsGameFile(),
      null,
      {},
    ))
      .then(async (storedSession) => {
        if (cancelled) return;
        const replayed = await canonicalSession.replay(storedSession.canonical);
        if (cancelled) return;
        if (!replayed.ok) {
          setOperationError(replayed.error.messageKo);
          setAutosaveRecoveryBlocked(true);
          setStorageReady(true);
          return;
        }
        restoreStoredSession(storedSession, replayed.value);
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
  }, [canonicalSession, storageDriver]);

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
    enqueueAutosave(currentWebSession(savedAt));
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
    if (!canonicalSession || (storageDriver && !storageReady)) return;
    if (replayMatches(gameFile, replayState)) return;
    let cancelled = false;
    canonicalSession.replay(gameFile)
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
  }, [canonicalSession, gameFile, replayState, storageDriver, storageReady]);

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

  const navigateToTab = (nextTab: ApplicationTab) => {
    const tabOrder: ApplicationTab[] = ["roles", "seating", "play", "storage"];
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

  function currentSetupDraft(): SectsAndVioletsSetupSession {
    return {
        playerCount,
        demon,
        selectedIds: [...selectedIds],
        seatAssignments: structuredClone(seatAssignments),
        seatAlignments: structuredClone(seatAlignments),
        seatNames: structuredClone(seatNames),
        rosterConfirmed,
        seatingConfirmed,
    };
  }

  function currentWebSession(
    savedAt: string,
    canonical: GameFile = gameFile,
    setupDraft: SectsAndVioletsSetupSession = currentSetupDraft(),
    presentation: SnvPresentation = {
      activeTab,
      phaseCheckpoints: structuredClone(phaseCheckpoints),
    },
  ): SnvWebSessionSnapshot {
    return createSnvWebSessionSnapshot(canonical, setupDraft, presentation, savedAt);
  }

  async function drainAutosaveQueue() {
    if (!storageDriver || autosaveInFlightRef.current) return;
    const candidate = pendingAutosaveRef.current;
    if (!candidate) return;
    const completion = pendingAutosaveCompletionRef.current;
    pendingAutosaveRef.current = undefined;
    pendingAutosaveCompletionRef.current = undefined;
    autosaveInFlightRef.current = true;
    setAutosaveStatus("saving");
    let saved = false;
    try {
      await saveCompatibleWebSession(candidate, storageDriver);
      setLastSavedAt(candidate.savedAt);
      setAutosaveStatus("saved");
      saved = true;
    } catch {
      discardPendingAutosave();
      setAutosaveStatus("error");
    } finally {
      autosaveInFlightRef.current = false;
    }
    completion?.(saved);
    if (saved && pendingAutosaveRef.current) void drainAutosaveQueue();
  }

  function enqueueAutosave(candidate: SnvWebSessionSnapshot, completion?: (saved: boolean) => void) {
    pendingAutosaveCompletionRef.current?.(false);
    pendingAutosaveRef.current = candidate;
    pendingAutosaveCompletionRef.current = completion;
    void drainAutosaveQueue();
  }

  function discardPendingAutosave() {
    const completion = pendingAutosaveCompletionRef.current;
    pendingAutosaveRef.current = undefined;
    pendingAutosaveCompletionRef.current = undefined;
    completion?.(false);
  }

  function restoreStoredSession(storedSession: SnvWebSessionSnapshot, replayed: CanonicalReplaySnapshot) {
    const storedGameFile = storedSession.canonical;
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
    } satisfies SectsAndVioletsSetupSession;
    const setup = storedSession.setupDraft ?? fallbackSetup;
    const fallbackTab: ApplicationTab = replayed.gameEnd ? "seating" : replayed.eventCount > 1
      ? "play"
      : replayed.eventCount === 1
        ? "seating"
        : "roles";
    const requestedTab = replayed.gameEnd ? "seating" : storedSession.presentation.activeTab ?? fallbackTab;
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
    setCanonicalDistribution(setup.rosterConfirmed
      ? distributionForCharacterIds(setup.selectedIds)
      : undefined);
    setSeatAssignments(structuredClone(setup.seatAssignments));
    setSeatAlignments(structuredClone(setup.seatAlignments));
    setSeatNames(structuredClone(setup.seatNames));
    setRosterConfirmed(setup.rosterConfirmed);
    setSeatingConfirmed(setup.seatingConfirmed);
    setPhaseCheckpoints(
      storedSession.presentation.phaseCheckpoints
        ?? inferSectsAndVioletsCheckpoints(storedGameFile, fallbackTab),
    );
    setActiveTab(restoredTab);
    setPlayPhase(
      replayed.phase === "firstNight" ? "firstNight" : replayed.phase === "day" ? "day" : "laterNight",
    );
    setLastSavedAt(storedSession.savedAt);
    setAutosaveStatus("saved");
    setOperationError(undefined);
    setAutosaveRecoveryBlocked(false);
  }

  const closeReturnConfirmation = () => {
    setReturnConfirmOpen(false);
    window.setTimeout(() => returnTriggerRef.current?.focus(), 0);
  };

  const returnToSeating = () => {
    setReturnConfirmOpen(false);
    setProposalTransientStateAfterHistoryChange();
    setSeatingConfirmed(false);
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
    setFirstNightStepIndex(0);
    setRevealedStepIds([]);
    setInformationStepId(undefined);
    setInformationCheckpoint(undefined);
    setInformationRevealOpen(false);
    setEvilInformationCheckpoint(undefined);
    setEvilInformationRevealOpen(false);
    setSelectedBluffCharacterIds([]);
    setSuggestingBluffs(false);
    setSelectedInformationResult(undefined);
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

  const closeBugReport = useCallback(() => {
    setBugReportSnapshot(undefined);
    window.setTimeout(() => bugReportTriggerRef.current?.focus(), 0);
  }, []);

  function openBugReport() {
    const capturedAt = new Date().toISOString();
    setBugReportSnapshot({
      gameFile,
      environment: currentBugReportEnvironment(),
      reproductionContext: {
        activeTab,
        replayPhase: replayState?.phase ?? null,
        currentStepId: replayState?.currentStep?.id ?? null,
        currentStepType: replayState?.currentStep?.stepType ?? null,
      },
    });
  }

  const startNewGame = () => {
    setNewGameConfirmOpen(false);
    setReturnConfirmOpen(false);
    setProposalTransientStateAfterHistoryChange();
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
    setInformationCheckpoint(undefined);
    setInformationRevealOpen(false);
    setEvilInformationCheckpoint(undefined);
    setEvilInformationRevealOpen(false);
    setSelectedBluffCharacterIds([]);
    setSuggestingBluffs(false);
    setSelectedInformationResult(undefined);
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
    if (!undoCheckpoint || !canonicalSession || operationBusy) return;
    const removal = canonicalSession.prepareUndo(gameFile, replayState, undoCheckpoint.id);
    if (!removal.ok) {
      setUndoCheckpoint(undefined);
      setOperationError(removal.error.messageKo);
      return;
    }
    setOperationBusy(true);
    setOperationError(undefined);
    const replayed = await canonicalSession.replay(removal.value.gameFile);
    if (!replayed.ok) {
      setOperationBusy(false);
      setUndoCheckpoint(undefined);
      setOperationError(replayed.error.messageKo);
      return;
    }
    setGameFile(removal.value.gameFile);
    setReplayState(replayed.value);
    setPhaseCheckpoints((current) => current.filter((checkpoint) => checkpoint.id !== removal.value.removed.id));
    setProposalTransientStateAfterHistoryChange();
    setUndoCheckpoint(undefined);
    setOperationBusy(false);
    markAutosaveNeeded();
  };

  const exportCurrentCheckpoint = () => {
    const exported = exportLatestSectsAndVioletsCheckpoint(gameFile, phaseCheckpoints);
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
    if (!file || !canonicalSession || operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    try {
      const imported = importGameFileJson(await file.text(), SECTS_AND_VIOLETS);
      const replayed = await canonicalSession.replay(imported);
      if (!replayed.ok) {
        setOperationError(replayed.error.messageKo);
        return;
      }
      if (hasMeaningfulCurrentSession() && !window.confirm("현재 게임을 가져온 게임으로 교체할까요?")) {
        return;
      }
      restoreStoredSession(createSnvWebSessionSnapshot(imported, null, {}), replayed.value);
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
    setInformationCheckpoint(undefined);
    setInformationRevealOpen(false);
    setEvilInformationCheckpoint(undefined);
    setEvilInformationRevealOpen(false);
    setSelectedBluffCharacterIds([]);
    setSuggestingBluffs(false);
    setSelectedInformationResult(undefined);
    setSelectedInformationTargetIds([]);
    setRevealedStepIds([]);
    setDayComplete(false);
    setLiveHandoff(undefined);
    setLiveNominatorId(undefined);
    setLiveNomineeId(undefined);
    setLiveVoterIds([]);
    setLiveTargetId(undefined);
    setLiveTargetIds([]);
    setLiveCharacterId(undefined);
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
    if (canonicalSession && replayState?.currentStep) {
      if (operationBusy) return;
      setOperationBusy(true);
      setOperationError(undefined);
      const step = replayState.currentStep;
      const command = step.support === "manual"
        ? { type: "resolveManualStep" as const, payload: { stepId: step.id, outcome: manualOutcome } }
        : { type: "confirmStep" as const, payload: { stepId: step.id, input: null as null } };
      await executeCanonicalCommand(command);
      setOperationBusy(false);
      return;
    }
    setInformationStepId(undefined);
    setFirstNightStepIndex((current) => Math.min(current + 1, firstNightSteps.length));
  };

  const resolvePhilosopher = async (defer = false) => {
    const step = replayState?.currentStep;
    if (!canonicalSession || !step || step.character !== "philosopher" || operationBusy) return;
    if (!defer && !selectedPhilosopherCharacterId) return;
    setOperationBusy(true);
    setOperationError(undefined);
    const command: Command = defer
      ? { type: "skipStep", payload: { stepId: step.id } }
      : {
          type: "confirmStep",
          payload: {
            stepId: step.id,
            input: { characterIds: [selectedPhilosopherCharacterId] },
          },
        };
    await executeCanonicalCommand(command);
    setSelectedPhilosopherCharacterId("");
    setOperationBusy(false);
  };

  const toggleBluffCharacter = (characterId: string) => {
    if (operationBusy || suggestingBluffs) return;
    setSelectedBluffCharacterIds((current) => {
      if (current.includes(characterId)) return current.filter((id) => id !== characterId);
      if (current.length >= 3) return current;
      return [...current, characterId];
    });
  };

  const suggestDemonBluffs = async () => {
    if (!coreAdapter || !canonicalEvilInformationStep?.id.endsWith(":demonInfo") || suggestingBluffs) return;
    setSuggestingBluffs(true);
    setOperationError(undefined);
    const stepId = canonicalEvilInformationStep.id;
    const result = await coreAdapter.suggestPhaseInput(gameFile, {
      stepId,
      ...(selectedBluffCharacterIds.length > 0
        ? { currentInput: { characterIds: selectedBluffCharacterIds } }
        : {}),
      choiceToken: choiceTokenSource(),
    });
    setSuggestingBluffs(false);
    if (!result.ok) {
      setOperationError(result.error.messageKo);
      return;
    }
    if (replayState?.currentStep?.id !== stepId || result.value.stepId !== stepId) return;
    const input = result.value.input;
    if (!input || !("characterIds" in input) || input.characterIds.length !== 3) {
      setOperationError("속임수 추천 결과가 올바르지 않습니다.");
      return;
    }
    setSelectedBluffCharacterIds([...input.characterIds]);
  };

  const confirmEvilInformation = async () => {
    if (!canonicalSession || !canonicalEvilInformationStep || operationBusy) return;
    const isDemon = canonicalEvilInformationStep.id.endsWith(":demonInfo");
    if (isDemon && selectedBluffCharacterIds.length !== 3) return;
    setOperationBusy(true);
    setOperationError(undefined);
    const executed = await executeCanonicalCommand({
      type: "confirmStep",
      payload: {
        stepId: canonicalEvilInformationStep.id,
        input: isDemon ? { characterIds: selectedBluffCharacterIds } : null,
      },
    });
    if (!executed) {
      setOperationBusy(false);
      return;
    }
    const revealPayload = proposalRevealPayload(executed.proposal);
    if (!revealPayload || !("kind" in revealPayload)
      || (revealPayload.kind !== "minionInformation" && revealPayload.kind !== "demonInformation")) {
      setOperationBusy(false);
      setOperationError("공개할 악한 팀 정보가 없습니다.");
      return;
    }
    setEvilInformationCheckpoint({
      sourceEventId: executed.proposal.event.id,
      stepId: canonicalEvilInformationStep.id,
      step: canonicalEvilInformationStep,
      payload: revealPayload,
    });
    setEvilInformationRevealOpen(true);
    setOperationBusy(false);
  };

  const revealEvilInformation = () => {
    if (evilInformationCheckpoint) {
      setEvilInformationRevealOpen(true);
      return;
    }
    void confirmEvilInformation();
  };

  const continueAfterEvilInformation = () => {
    setEvilInformationRevealOpen(false);
    setEvilInformationCheckpoint(undefined);
    setSelectedBluffCharacterIds([]);
  };

  const showCurrentStepInformation = () => {
    if (!currentFirstNightStep) return;
    setRevealedStepIds((current) => current.includes(currentFirstNightStep.id) ? current : [...current, currentFirstNightStep.id]);
    setInformationStepId(currentFirstNightStep.id);
  };

  const showCanonicalInformation = async () => {
    if (informationCheckpoint) {
      setInformationRevealOpen(true);
      return;
    }
    if (!canonicalSession || !canonicalInformationStep || !activeInformationActor || operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    const deliveredResult = selectedInformationResult ?? canonicalInformationStep.informationPrompt?.computedResult;
    if (!deliveredResult) {
      setOperationBusy(false);
      setOperationError("공개할 정보가 없습니다.");
      return;
    }
    const targeted = canonicalInformationStep.character === "dreamer" || canonicalInformationStep.character === "seamstress";
    const executed = await executeCanonicalCommand({
      type: "confirmStep",
      payload: {
        stepId: canonicalInformationStep.id,
        input: targeted ? { playerIds: selectedInformationTargetIds } : null,
        ...((canonicalInformationStep.informationPrompt?.deliveryMode === "selectable" || canonicalInformationStep.character === "dreamer" || canonicalInformationStep.character === "sage") && deliveredResult
          ? { deliveredResult }
          : {}),
      },
    });
    if (!executed) {
      setOperationBusy(false);
      return;
    }
    const revealPayload = automatedInformationRevealPayload(executed.proposal.revealPayload);
    if (!revealPayload) {
      setOperationBusy(false);
      setOperationError("공개할 정보가 없습니다.");
      return;
    }
    setInformationCheckpoint({
      step: canonicalInformationStep,
      actor: activeInformationActor,
      targetPlayerIds: [...selectedInformationTargetIds],
      deliveredResult,
      revealPayload,
    });
    setInformationRevealOpen(true);
    setOperationBusy(false);
  };

  const advanceCanonicalInformation = () => {
    setInformationRevealOpen(false);
    setInformationCheckpoint(undefined);
    setSelectedInformationTargetIds([]);
    setSelectedInformationResult(undefined);
  };

  const skipCanonicalInformation = async () => {
    if (!canonicalSession || !canonicalInformationStep || operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    await executeCanonicalCommand({ type: "skipStep", payload: { stepId: canonicalInformationStep.id } });
    setOperationBusy(false);
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
    if (!canonicalSession) {
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
    const applied = await executeCanonicalCommand({
      type: "createGame",
      payload: { players: players as Array<{ seat: number; name: string; actualCharacter: string }> },
    }, "setup", gameFile, false);
    if (!applied) {
      setOperationBusy(false);
      return;
    }
    if (storageDriver) {
      const savedAt = new Date().toISOString();
      const confirmedSetup = {
          ...currentSetupDraft(),
          seatingConfirmed: true,
      };
      const confirmedSession = currentWebSession(
        savedAt,
        applied.gameFile,
        confirmedSetup,
        {
          activeTab: "seating",
          phaseCheckpoints: [...phaseCheckpoints, applied.checkpoint],
        },
      );
      const saved = await new Promise<boolean>((resolve) => enqueueAutosave(confirmedSession, resolve));
      if (!saved) {
        setOperationBusy(false);
        setOperationError("설정을 저장하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
    }
    setOperationBusy(false);
    setSeatingConfirmed(true);
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
  };

  const commitCanonicalEvent = (
    event: GameEvent,
    nextGameFile: GameFile,
    nextReplayState: CanonicalReplaySnapshot,
    checkpointKind: SectsAndVioletsPhaseCheckpoint["kind"],
    scheduleAutosave: boolean,
  ) => {
    setReplayState(nextReplayState);
    setGameFile(nextGameFile);
    const checkpoint: SectsAndVioletsPhaseCheckpoint = {
      id: event.id,
      eventIds: [event.id],
      kind: checkpointKind,
      eventCount: nextGameFile.game.events.length,
      summary: event.summary,
      activeTab: checkpointKind === "setup" ? "seating" : activeTab,
    };
    const canonicalUnits = inferCanonicalUndoUnits(nextGameFile.game.events);
    setPhaseCheckpoints((current) => {
      const canonical = canonicalUnits.at(-1);
      if (canonical && canonical.eventIds.length > 1 && canonical.eventIds.includes(event.id)) {
        const groupedIds = new Set(canonical.eventIds);
        return [...current.filter((candidate) =>
          !(candidate.eventIds ?? [candidate.id]).some((id) => groupedIds.has(id))), {
          ...checkpoint,
          id: canonical.id,
          eventIds: canonical.eventIds,
        }];
      }
      return [...current, checkpoint];
    });
    setInformationStepId(undefined);
    setDayComplete(false);
    if (scheduleAutosave) markAutosaveNeeded();
    return { gameFile: nextGameFile, replayState: nextReplayState, checkpoint };
  };

  const executeCanonicalCommand = async (
    command: Command,
    checkpointKind: SectsAndVioletsPhaseCheckpoint["kind"] = "phase",
    baseGameFile: GameFile = gameFile,
    scheduleAutosave = true,
    baseReplayState: CanonicalReplaySnapshot | undefined = replayState,
  ) => {
    if (!canonicalSession) return undefined;
    const executed = await canonicalSession.execute(baseGameFile, baseReplayState, command);
    if (!executed.ok) {
      setOperationError(executed.error.messageKo);
      return undefined;
    }
    return {
      proposal: executed.value.proposal,
      ...commitCanonicalEvent(
        executed.value.proposal.event,
        executed.value.gameFile,
        executed.value.replayState,
        checkpointKind,
        scheduleAutosave,
      ),
    };
  };

  const proposeAndApplyLiveCommand = async (
    command: Command,
    baseGameFile: GameFile = gameFile,
    baseReplayState: CanonicalReplaySnapshot | undefined = replayState,
  ) => {
    if (!canonicalSession) return undefined;
    return executeCanonicalCommand(command, "phase", baseGameFile, true, baseReplayState);
  };

  const resolveDeathConsequence = async (resolution: DeathConsequenceResolution) => {
    if (!pendingDeathConsequence || operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    const command = deathConsequenceCommand(
      pendingDeathConsequence,
      resolution,
      gameFile.game.events.length,
    );
    const applied = await proposeAndApplyLiveCommand(command);
    setOperationBusy(false);
    return Boolean(applied);
  };

  const confirmForcedGameEnd = async () => {
    const pending = replayState?.pendingGameEnd;
    if (!pending || operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    const applied = await proposeAndApplyLiveCommand({
      type: "endGame",
      payload: {
        winningTeam: pending.winningTeam,
        expectedEventCount: gameFile.game.events.length,
      },
    });
    if (applied?.replayState.gameEnd) {
      setLiveHandoff(undefined);
      navigateToTab("seating");
    }
    setOperationBusy(false);
  };

  const confirmWitchDeath = async () => {
    const step = replayState?.currentStep;
    if (!step || step.stepType !== "witchDeath" || operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    const applied = await proposeAndApplyLiveCommand({
      type: "confirmStep",
      payload: { stepId: step.id, input: null },
    });
    if (applied?.replayState.pendingGameEnd) {
      setLiveHandoff(undefined);
      navigateToTab("play");
    }
    setOperationBusy(false);
  };

  useEffect(() => {
    if (!pendingVigormortisPoison) {
      autoResolvedVigormortisPoisonRef.current = undefined;
      return;
    }
    if (nextIdentityRevealKey) return;
    if (pendingVigormortisPoison.allowedPlayerIds.length === 1) {
      const resolutionKey = `${pendingVigormortisPoison.sourceEventId}:${gameFile.game.events.length}`;
      if (operationBusy || autoResolvedVigormortisPoisonRef.current === resolutionKey) return;
      autoResolvedVigormortisPoisonRef.current = resolutionKey;
      setOperationBusy(true);
      setOperationError(undefined);
      void proposeAndApplyLiveCommand({
        type: "resolveVigormortisPoison",
        payload: {
          sourceEventId: pendingVigormortisPoison.sourceEventId,
          targetPlayerId: pendingVigormortisPoison.allowedPlayerIds[0],
          expectedEventCount: gameFile.game.events.length,
        },
      }).finally(() => setOperationBusy(false));
      return;
    }
    if (pendingVigormortisPoison.allowedPlayerIds.length === 2
      && (liveHandoff?.kind !== "vigormortisPoison"
        || liveHandoff.sourceEventId !== pendingVigormortisPoison.sourceEventId)) {
      setLiveTargetId(undefined);
      setLiveHandoff({
        kind: "vigormortisPoison",
        complete: false,
        actorPlayerId: pendingVigormortisPoison.vigormortisPlayerId,
        sourceEventId: pendingVigormortisPoison.sourceEventId,
      });
      navigateToTab("seating");
    }
  }, [
    gameFile.game.events.length,
    liveHandoff?.kind,
    liveHandoff?.sourceEventId,
    operationBusy,
    nextIdentityRevealKey,
    pendingVigormortisPoison?.sourceEventId,
    pendingVigormortisPoison?.vigormortisPlayerId,
    pendingVigormortisPoison?.allowedPlayerIds,
  ]);

  const recordDayAction = async (
    action: AvailableDayAction,
    record: DayActionRecordInput,
  ) => {
    if (operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    await proposeAndApplyLiveCommand({
      type: "recordDayAction",
      payload: {
        dayId: action.dayId,
        expectedEventCount: gameFile.game.events.length,
        actorPlayerId: action.actorPlayerId,
        record,
      },
    });
    setOperationBusy(false);
  };

  const updateMadnessJudgment = async (assignmentId: string, result: MadnessCheckResult) => {
    const assignment = replayState?.madnessAssignments?.find(
      (candidate) => candidate.assignmentId === assignmentId,
    );
    const currentResult = assignment?.status === "clear"
      ? "clear"
      : assignment?.status === "violated" ? "violation" : undefined;
    if (operationBusy || currentResult === result) return;
    setOperationBusy(true);
    setOperationError(undefined);
    await proposeAndApplyLiveCommand({
      type: "recordMadnessCheck",
      payload: {
        assignmentId,
        result,
        expectedEventCount: gameFile.game.events.length,
      },
    });
    setOperationBusy(false);
  };

  const executeMadness = async (assignmentId: string) => {
    if (operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    const applied = await proposeAndApplyLiveCommand({
      type: "executeMadness",
      payload: { assignmentId, expectedEventCount: gameFile.game.events.length },
    });
    if (applied) navigateToTab("play");
    setOperationBusy(false);
  };

  const startLiveHandoff = (kind: LiveHandoff["kind"]) => {
    const soleBarberChooser = kind === "barber" && pendingDeathConsequence?.eligibleChooserPlayerIds.length === 1
      ? pendingDeathConsequence.eligibleChooserPlayerIds[0]
      : undefined;
    setLiveHandoff({
      kind,
      complete: false,
      actorPlayerId: kind === "barber"
        ? soleBarberChooser
        : kind === "sweetheart" || kind === "klutz"
        ? pendingDeathConsequence?.actorPlayerId
        : kind === "demon" || kind === "snakeCharmer" || kind === "pitHag" || kind === "cerenovus" || kind === "evilTwin" || kind === "witch" || kind === "dreamer" || kind === "seamstress"
        ? replayState?.currentStep?.playerId
        : undefined,
      selectionStage: kind === "demon" ? "attack" : kind === "barber" ? soleBarberChooser ? "reveal" : "chooser" : undefined,
    });
    if (kind === "nomination") {
      setLiveNominatorId(undefined);
      setLiveNomineeId(undefined);
      setLiveVoterIds([]);
      setLiveNominationCheckpointId(undefined);
    }
    if (kind === "demon" || kind === "snakeCharmer" || kind === "pitHag" || kind === "cerenovus" || kind === "evilTwin" || kind === "witch" || kind === "sweetheart" || kind === "klutz") setLiveTargetId(undefined);
    if (kind === "barber") {
      setBarberAbilityRevealOpen(false);
      setLiveChooserId(soleBarberChooser);
      setLiveTargetIds([]);
    }
    if (kind === "demon") setLivePoisonTargetId(undefined);
    if (kind === "pitHag") setLiveCharacterId(undefined);
    if (kind === "pitHagDeaths") setLiveTargetIds([]);
    if (kind === "cerenovus") setLiveMadnessCharacterId("");
    if (kind === "dreamer" || kind === "seamstress") setLiveTargetIds(selectedInformationTargetIds);
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
    if (liveHandoff.kind === "sweetheart" || liveHandoff.kind === "klutz") {
      if (!pendingDeathConsequence?.allowedPlayerIds.includes(playerId)) return;
      setLiveTargetId((current) => current === playerId ? undefined : playerId);
      return;
    }
    if (liveHandoff.kind === "barber") {
      if (liveHandoff.selectionStage === "chooser") {
        if (!pendingDeathConsequence?.eligibleChooserPlayerIds.includes(playerId)) return;
        setLiveChooserId(playerId);
        setLiveTargetIds([]);
        setLiveHandoff({ ...liveHandoff, actorPlayerId: playerId, selectionStage: "reveal" });
        return;
      }
      if (liveHandoff.selectionStage !== "swap") return;
      if (!pendingDeathConsequence?.allowedPlayerIds.includes(playerId)) return;
      const candidate = replayState?.players.find((player) => player.id === playerId);
      if (characters.find((character) => character.id === candidate?.actualCharacter)?.kind === "demon"
        && playerId !== liveChooserId) return;
      setLiveTargetIds((current) => current.includes(playerId)
        ? current.filter((candidateId) => candidateId !== playerId)
        : current.length >= 2 ? current : [...current, playerId]);
      return;
    }
    if (liveHandoff.kind === "dreamer" || liveHandoff.kind === "seamstress") {
      const max = liveHandoff.kind === "dreamer" ? 1 : 2;
      if (!replayState?.currentStep?.requiredInput.allowedPlayerIds?.includes(playerId)) return;
      setLiveTargetIds((current) => current.includes(playerId)
        ? current.filter((candidate) => candidate !== playerId)
        : current.length >= max ? (max === 1 ? [playerId] : current) : [...current, playerId]);
      return;
    }
    if (liveHandoff.kind === "pitHagDeaths") {
      if (!replayState?.currentStep?.requiredInput.allowedPlayerIds?.includes(playerId)) return;
      setLiveTargetIds((current) => current.includes(playerId)
        ? current.filter((candidate) => candidate !== playerId)
        : [...current, playerId]);
      return;
    }
    if (liveHandoff.kind === "vigormortisPoison") {
      if (!pendingVigormortisPoison?.allowedPlayerIds.includes(playerId)) return;
      setLiveTargetId((current) => current === playerId ? undefined : playerId);
      return;
    }
    if (liveHandoff.kind === "demon") {
      if (liveHandoff.selectionStage === "poison") {
        if (!vigormortisDependentSelection?.allowedPlayerIds.includes(playerId)) return;
        setLivePoisonTargetId((current) => current === playerId ? undefined : playerId);
        return;
      }
      setLiveTargetId(playerId);
      setLivePoisonTargetId(undefined);
      const dependent = replayState?.currentStep?.requiredInput.dependentPlayerSelections?.find(
        (selection) => selection.triggerPlayerId === playerId && selection.selectionIndex === 1,
      );
      if (dependent?.allowedPlayerIds.length === 1) {
        setLivePoisonTargetId(dependent.allowedPlayerIds[0]);
      }
      setLiveHandoff(dependent?.allowedPlayerIds.length
        ? { ...liveHandoff, selectionStage: "poison" }
        : { ...liveHandoff, selectionStage: "attack" });
      return;
    }
    if (liveHandoff.kind === "snakeCharmer" || liveHandoff.kind === "cerenovus" || liveHandoff.kind === "evilTwin" || liveHandoff.kind === "witch") {
      if (!replayState?.currentStep?.requiredInput.allowedPlayerIds?.includes(playerId)) return;
    }
    setLiveTargetId((current) => current === playerId ? undefined : playerId);
  };

  const confirmLiveHandoff = async () => {
    const step = replayState?.currentStep;
    if (!liveHandoff || operationBusy) return;
    setOperationBusy(true);
    setOperationError(undefined);
    if (liveHandoff.kind === "vigormortisPoison") {
      if (!pendingVigormortisPoison || !liveTargetId) {
        setOperationBusy(false);
        return;
      }
      const applied = await proposeAndApplyLiveCommand({
        type: "resolveVigormortisPoison",
        payload: {
          sourceEventId: pendingVigormortisPoison.sourceEventId,
          targetPlayerId: liveTargetId,
          expectedEventCount: gameFile.game.events.length,
        },
      });
      if (applied) {
        setLiveHandoff(undefined);
        setLiveTargetId(undefined);
        navigateToTab("play");
      }
    } else if (liveHandoff.kind === "sweetheart" || liveHandoff.kind === "klutz") {
      if (!liveTargetId) {
        setOperationBusy(false);
        return;
      }
      const applied = await resolveDeathConsequence({ targetPlayerId: liveTargetId });
      if (applied) {
        setLiveHandoff(undefined);
        setLiveTargetId(undefined);
        navigateToTab("play");
      }
    } else if (liveHandoff.kind === "barber") {
      if (!liveChooserId || liveTargetIds.length !== 2) {
        setOperationBusy(false);
        return;
      }
      const applied = await resolveDeathConsequence({
        chooserDemonPlayerId: liveChooserId,
        decision: { kind: "swap", playerIds: [liveTargetIds[0], liveTargetIds[1]] },
      });
      if (applied) {
        setLiveHandoff({ ...liveHandoff, complete: true });
      }
    } else if (!step) {
      setOperationBusy(false);
      return;
    } else if (liveHandoff.kind === "nomination") {
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
    } else if (liveHandoff.kind === "dreamer" || liveHandoff.kind === "seamstress") {
      const needed = liveHandoff.kind === "dreamer" ? 1 : 2;
      if (liveTargetIds.length === needed) {
        setSelectedInformationTargetIds(liveTargetIds);
        setLiveHandoff(undefined);
        navigateToTab("play");
      }
    } else if (liveHandoff.kind === "pitHag" && liveTargetId && liveCharacterId) {
      const applied = await proposeAndApplyLiveCommand({
        type: "confirmStep",
        payload: {
          stepId: step.id,
          input: { playerIds: [liveTargetId], characterIds: [liveCharacterId] },
        },
      });
      if (applied) {
        const event = applied.gameFile.game.events.at(-1);
        if (event?.type === "pitHagTransformationResolved" && event.payload.outcome.kind === "noChange") {
          setLiveHandoff(undefined);
          navigateToTab("play");
        } else {
          setLiveHandoff({ ...liveHandoff, complete: true });
        }
      }
    } else if (liveHandoff.kind === "pitHagDeaths") {
      const applied = await proposeAndApplyLiveCommand({
        type: "confirmStep",
        payload: { stepId: step.id, input: { playerIds: liveTargetIds } },
      });
      if (applied) {
        setLiveHandoff(undefined);
        setLiveTargetIds([]);
        navigateToTab("play");
      }
    } else if (liveHandoff.kind === "cerenovus" && liveTargetId && liveMadnessCharacterId) {
      const applied = await proposeAndApplyLiveCommand({
        type: "confirmStep",
        payload: { stepId: step.id, input: { playerIds: [liveTargetId], characterId: liveMadnessCharacterId } },
      });
      if (applied) setLiveHandoff({ ...liveHandoff, complete: true });
    } else if (liveTargetId) {
      const applied = await proposeAndApplyLiveCommand({
        type: "confirmStep",
        payload: {
          stepId: step.id,
          input: { playerIds: livePoisonTargetId ? [liveTargetId, livePoisonTargetId] : [liveTargetId] },
        },
      });
      if (applied) setLiveHandoff({ ...liveHandoff, complete: true });
    }
    setOperationBusy(false);
  };

  const declineLiveBarberSwap = async () => {
    if (operationBusy || liveHandoff?.kind !== "barber" || !liveChooserId) return;
    setOperationBusy(true);
    setOperationError(undefined);
    const applied = await resolveDeathConsequence({
      chooserDemonPlayerId: liveChooserId,
      decision: { kind: "decline" },
    });
    if (applied) {
      setLiveHandoff(undefined);
      setBarberAbilityRevealOpen(false);
      setLiveChooserId(undefined);
      setLiveTargetIds([]);
      navigateToTab("play");
    }
    setOperationBusy(false);
  };

  const returnFromLiveHandoff = () => {
    setLiveHandoff(undefined);
    setBarberAbilityRevealOpen(false);
    setLiveNominatorId(undefined);
    setLiveNomineeId(undefined);
    setLiveVoterIds([]);
    setLiveTargetId(undefined);
    setLivePoisonTargetId(undefined);
    setLiveTargetIds([]);
    setLiveChooserId(undefined);
    setLiveCharacterId(undefined);
    setLiveMadnessCharacterId("");
    setLiveNominationCheckpointId(undefined);
    navigateToTab("play");
  };

  const resetVigormortisAttackSelection = () => {
    setLiveTargetId(undefined);
    setLivePoisonTargetId(undefined);
    setLiveHandoff((current) => current?.kind === "demon"
      ? { ...current, selectionStage: "attack" }
      : current);
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
      setLiveCharacterId(undefined);
      navigateToTab("seating");
    }
  };

  const resetLiveDaySelection = () => {
    if (liveHandoff?.kind === "nomination") {
      setLiveNominatorId(undefined);
      setLiveNomineeId(undefined);
    } else if (liveHandoff?.kind === "vote") {
      setLiveVoterIds([]);
    } else if (liveHandoff?.kind === "dreamer" || liveHandoff?.kind === "seamstress" || liveHandoff?.kind === "barber") {
      setLiveTargetIds([]);
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
    if (!canonicalSession || !liveNominationCheckpointId) return;
    const removal = canonicalSession.prepareUndo(gameFile, replayState, liveNominationCheckpointId);
    if (!removal.ok) {
      setOperationError("현재 지명 기록이 변경되어 투표를 취소하지 않았습니다.");
      return;
    }
    setOperationBusy(true);
    setOperationError(undefined);
    const replayed = await canonicalSession.replay(removal.value.gameFile);
    if (!replayed.ok) {
      setOperationBusy(false);
      setOperationError(replayed.error.messageKo);
      return;
    }
    setGameFile(removal.value.gameFile);
    setReplayState(replayed.value);
    setPhaseCheckpoints((current) => current.filter((checkpoint) => checkpoint.id !== removal.value.removed.id));
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
      }, first.gameFile, first.replayState);
    }
    setOperationBusy(false);
  };

  return (
    <ProductionApplicationShell
      ariaLabel={production ? "Sects & Violets 게임" : "Sects & Violets 기반 화면 프로토타입"}
      theme={effectivePlayPhase === "day" ? "day" : "night"}
      motion={tabMotion === "tabForward" ? "forward" : tabMotion === "tabBackward" ? "backward" : "none"}
      className={`${tabMotion} ${effectivePlayPhase === "day" ? "snvDayMode" : "snvNightMode"}`}
      classes={{
        root: "snvFoundationPrototype",
        header: "snvPrototypeHeader",
        eyebrow: "snvEyebrow",
        headerActions: "snvPhaseActions",
        utilities: "snvUtilityTabs",
        stages: "snvSurfaceTabs",
      }}
      leading={production ? <a className="snvScriptHomeLink" href="/clocktower/" aria-label="스크립트 선택">←</a> : null}
      hiddenInputs={production ? <input ref={importInputRef} hidden type="file" accept=".json,application/json" onChange={(event) => void importCheckpoint(event)} /> : null}
      eyebrow={production ? "STORYTELLER CONSOLE" : "ISSUE 97 · REVIEW PROTOTYPE"}
      title="Sects & Violets"
      subtitle="7–15명"
      headerActionsAriaLabel="현재 페이즈와 되돌리기"
      headerActions={<>
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
      </>}
      utilities={[
        {
          id: "new-game",
          label: "새 게임",
          className: "snvNewGameTab",
          disabled: storageLoading,
          buttonRef: newGameTriggerRef,
          onSelect: () => setNewGameConfirmOpen(true),
        },
        {
          id: "storage",
          label: "저장 / 불러오기",
          className: `snvStorageTab ${activeTab === "storage" ? "active" : ""}`,
          active: activeTab === "storage",
          onSelect: () => navigateToTab("storage"),
        },
        ...(production ? [{
          id: "bug-report",
          label: "버그 제보",
          className: "snvBugReportTrigger",
          buttonRef: bugReportTriggerRef,
          onSelect: openBugReport,
        }] : []),
      ]}
      stages={[
        { id: "roles", label: "직업", active: activeTab === "roles", className: activeTab === "roles" ? "active" : "" },
        { id: "seating", label: "마도서", active: activeTab === "seating", className: activeTab === "seating" ? "active" : "", disabled: !rosterConfirmed },
        {
          id: "play",
          label: liveHandoff && !liveHandoff.complete ? "마도서 작업을 완료하세요" : "진행",
          active: activeTab === "play",
          className: activeTab === "play" ? "active" : "",
          disabled: (production && !seatingConfirmed) || Boolean(liveHandoff && !liveHandoff.complete) || Boolean(nextIdentityReveal),
        },
      ]}
      onNavigate={(destination) => navigateToTab(destination as ApplicationTab)}
      autosaveStatus={autosaveStatus !== "idle" ? (
        <p className={`snvAutosaveStatus ${autosaveStatus}`} role="status" aria-live="polite">
          {autosaveStatus === "saving"
            ? "자동 저장 중…"
            : autosaveStatus === "error"
              ? "자동 저장 실패"
              : `자동 저장 완료 ${formatAutosaveTime(lastSavedAt)}`}
        </p>
      ) : undefined}
      warning={warningVisible ? (
        <aside className="snvWarningNotification" role="status" aria-live="polite" aria-label="게임 경고">
          <span aria-hidden="true">!</span>
          <div>
            <strong>{visibleWarnings.length > 1 ? `게임 경고 · ${visibleWarnings.length}건` : "게임 경고"}</strong>
            {visibleWarnings.map((warning) => <p key={`${warning.code}:${warning.messageKo}`}>{warning.messageKo}</p>)}
          </div>
          <button type="button" aria-label="경고 닫기" onClick={() => setDismissedWarningKey(warningKey)}>×</button>
        </aside>
      ) : undefined}
    >
      {activeTab === "roles" ? (
        <SectsAndVioletsSetupPresentation
          playerCount={playerCount}
          demon={demon}
          selectedIds={selectedIds}
          activeCharacterId={activeCharacterId}
          selectedByKind={selectedByKind}
          requiredByKind={requiredByKind}
          distribution={distribution}
          storageLoading={storageLoading}
          rosterConfirmed={rosterConfirmed}
          rosterComplete={rosterComplete}
          theme={effectivePlayPhase === "day" ? "snv-day" : "snv-night"}
          onPlayerCountSelect={choosePlayerCount}
          onDemonSelect={chooseDemon}
          onCharacterSelect={toggleCharacter}
          onConfirmRoster={() => {
            setRosterConfirmed(true);
            navigateToTab("seating");
            markAutosaveNeeded();
          }}
        />
      ) : activeTab === "seating" ? production && seatingConfirmed && (replayState?.currentStep || replayState?.gameEnd) ? (
        <SectsAndVioletsLiveGrimoire
          players={livePlayers}
          currentActor={liveActor}
          phaseLabel={replayState.gameEnd ? "게임 종료" : phaseLabel(effectivePlayPhase, replayState.currentStep)}
          phaseRuntime={phaseRuntime ?? "00:00"}
          currentStep={replayState.currentStep}
          dayState={replayState.dayState}
          handoff={liveHandoff}
          nominatorId={liveNominatorId}
          nomineeId={liveNomineeId}
          voterIds={liveVoterIds}
          targetId={liveTargetId}
          secondaryTargetId={livePoisonTargetId}
          referenceTargetId={pendingVigormortisPoison?.previousTargetPlayerId}
          selectablePlayerIds={liveSelectablePlayerIds}
          targetIds={liveTargetIds}
          chooserId={liveChooserId}
          characterId={liveCharacterId}
          pitHagDemonIntents={pitHagDemonIntents}
          centerPrompt={replayState.gameEnd ? (
            <div className="snvEndedGrimoireCenter"><strong>게임 종료</strong><span>최종 상태</span></div>
          ) : replayState.currentStep?.stepType === "witchDeath" ? (
            <WitchDeathPrompt
              player={witchDeathPlayer}
              operationBusy={operationBusy}
              onConfirm={() => void confirmWitchDeath()}
            />
          ) : nextIdentityReveal && !identityRevealOpen ? (
            nextIdentityReveal.payload.kind === "evilTwinPair" ? (
              <EvilTwinRevealPrompt
                payload={nextIdentityReveal.payload}
                onReveal={() => setOpenedIdentityRevealKey(nextIdentityRevealKey)}
              />
            ) : nextIdentityReveal.payload.kind === "madnessAssignment" ? (
              <CerenovusMadnessRevealPrompt
                player={identityRevealPlayer}
                onReveal={() => setOpenedIdentityRevealKey(nextIdentityRevealKey)}
              />
            ) : (
              <CharacterChangeRevealPrompt
                player={identityRevealPlayer}
                sequence={nextIdentityReveal.sequence}
                total={pendingIdentityReveals.length}
                onReveal={() => setOpenedIdentityRevealKey(nextIdentityRevealKey)}
              />
            )
          ) : liveHandoff?.kind === "barber" && liveHandoff.selectionStage === "reveal" && !barberAbilityRevealOpen ? (
            <BarberAbilityRevealPrompt
              player={barberAbilityActor}
              onReveal={() => setBarberAbilityRevealOpen(true)}
            />
          ) : undefined}
          centerPromptClassName={!replayState.gameEnd
            && replayState.currentStep?.stepType !== "witchDeath"
            && nextIdentityReveal?.payload.kind === "evilTwinPair"
            && !identityRevealOpen
            ? "evilTwinCenterPrompt"
            : undefined}
          handoffSupplement={liveHandoff?.kind === "cerenovus" ? (
            <label className="snvMadnessCharacterChoice">
              집착할 캐릭터
              <select
                aria-label="집착할 캐릭터"
                value={liveMadnessCharacterId}
                disabled={operationBusy || liveHandoff.complete}
                onChange={(event) => setLiveMadnessCharacterId(event.target.value)}
              >
                <option value="">선택</option>
                {characters
                  .filter((character) => replayState.currentStep?.requiredInput.allowedCharacterIds?.includes(character.id))
                  .map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
              </select>
            </label>
          ) : undefined}
          handoffSupplementReady={liveHandoff?.kind !== "cerenovus" || Boolean(liveMadnessCharacterId)}
          operationBusy={operationBusy}
          tokensByPlayerId={canonicalTokensByPlayerId}
          dayActionRecords={replayState.dayActionRecords ?? []}
          onSeatClick={chooseLiveSeat}
          onCharacterChange={setLiveCharacterId}
          onConfirm={() => void confirmLiveHandoff()}
          onDecline={() => void declineLiveBarberSwap()}
          onReturn={returnFromLiveHandoff}
          onCancelDayHandoff={() => void cancelLiveDayHandoff()}
          onResetDaySelection={resetLiveDaySelection}
          onResetAttackSelection={resetVigormortisAttackSelection}
          onGoToProgress={() => navigateToTab("play")}
          onReturnToSetup={() => setReturnConfirmOpen(true)}
          readOnly={Boolean(replayState.gameEnd)}
          theme={effectivePlayPhase === "day" ? "day" : "night"}
        />
      ) : (
        <SectsAndVioletsAssignment
          seatingConfirmed={seatingConfirmed}
          playerCount={playerCount}
          selectedSeat={selectedSeat}
          pendingCharacterId={pendingCharacterId}
          seatAssignments={seatAssignments}
          seatAlignments={seatAlignments}
          seatNames={seatNames}
          selectedIds={selectedIds}
          assignedCount={assignedCount}
          seatingComplete={seatingComplete}
          operationBusy={operationBusy}
          phaseLabel={phaseLabel(effectivePlayPhase, replayState?.currentStep)}
          phaseTheme={effectivePlayPhase === "day" ? "day" : "night"}
          canonicalPlayers={replayState?.players ?? []}
          tokensByPlayerId={canonicalTokensByPlayerId}
          currentActorSeat={replayState?.players.find((player) => player.id === replayState.currentStep?.playerId)?.seat}
          currentActorCharacterId={currentFirstNightStep?.characterId}
          characterIdForSeat={displayedCharacterForSeat}
          returnButtonRef={returnTriggerRef}
          onReturnToSetup={() => setReturnConfirmOpen(true)}
          onGoToRoles={() => navigateToTab("roles")}
          onRandomize={randomizeSeating}
          onReset={resetSeating}
          onSeatSelect={chooseSeat}
          onCloseSeatPanel={() => { setSelectedSeat(undefined); setPendingCharacterId(undefined); }}
          onSeatNameChange={(seat, name) => {
            setSeatNames((current) => ({ ...current, [seat]: name }));
            scheduleTextAutosave();
          }}
          onSeatNameBlur={flushTextAutosave}
          onCharacterSelect={chooseCharacterForSeating}
          onGoToProgress={() => navigateToTab("play")}
          onConfirm={() => void confirmSeating()}
        />
      ) : activeTab === "play" && replayState?.gameEnd ? (
        <section className="snvEndedPlaySurface snvTabPanel" aria-label="종료된 게임">
          <span aria-hidden="true">{replayState.gameEnd.winningTeam === "good" ? "선" : "악"}</span>
          <h2>{replayState.gameEnd.winningTeam === "good" ? "선" : "악"} 진영 승리</h2>
          {replayState.gameEnd.reasonKo ? <p>{replayState.gameEnd.reasonKo}</p> : null}
          <button type="button" onClick={() => navigateToTab("seating")}>마도서 보기</button>
        </section>
      ) : activeTab === "play" ? production && replayState?.currentStep && effectivePlayPhase !== "firstNight" && !activeInformationStep && replayState.currentStep.character !== "philosopher" ? (
        <SectsAndVioletsLiveProgress
          replayState={replayState}
          phaseLabel={phaseLabel(effectivePlayPhase, replayState.currentStep)}
          phaseRuntime={phaseRuntime ?? "00:00"}
          operationBusy={operationBusy}
          actorRoleName={liveActorCharacter?.name ?? replayState.currentStep.character}
          actorCharacterId={liveActor?.actualCharacter ?? replayState.currentStep.character}
          actorSummary={liveActorCharacter?.ability}
          priorityPanel={pendingDeathConsequence ? (
            <DeathConsequencePanel
              pending={pendingDeathConsequence}
              players={replayState.players}
              activeImpairments={replayState.ruleState.activeImpairments}
              operationBusy={operationBusy}
              onResolve={(resolution) => void resolveDeathConsequence(resolution)}
              onChooseTarget={() => startLiveHandoff(pendingDeathConsequence.kind)}
            />
          ) : undefined}
          priorityPanelPlayerSafe={pendingDeathConsequence?.kind === "klutz"}
          onGoToGrimoire={() => navigateToTab("seating")}
          onStartNomination={() => startLiveHandoff("nomination")}
          onEndNominations={() => void endLiveNominations()}
          onConfirmExecution={() => void confirmLiveExecution()}
          onStartDemonAttack={() => startLiveHandoff("demon")}
          onStartSnakeCharmer={() => startLiveHandoff("snakeCharmer")}
          onStartPitHag={() => startLiveHandoff("pitHag")}
          onStartPitHagDeaths={() => startLiveHandoff("pitHagDeaths")}
          onStartCerenovus={() => startLiveHandoff("cerenovus")}
          onStartEvilTwin={() => startLiveHandoff("evilTwin")}
          onStartWitch={() => startLiveHandoff("witch")}
          onAdvance={() => void advanceFirstNight()}
          onResolveManual={(outcome) => void advanceFirstNight(outcome)}
        />
      ) : (
        <section
          className={`snvManualSurface snvFirstNightSurface snvTabPanel ${effectivePlayPhase === "day" ? "snvDaySurface" : "snvNightSurface"}`}
          aria-label={effectivePlayPhase === "firstNight" ? "첫날 밤 진행" : effectivePlayPhase === "day" ? "공개 토론" : "이후 밤 진행"}
        >
          <header className="snvFirstNightHeader">
            <button type="button" aria-label="마도서로 이동" onClick={() => navigateToTab("seating")}>← 마도서</button>
            <div className="snvProgressPhaseHeader">
              <h2>{phaseLabel(effectivePlayPhase, replayState?.currentStep)}</h2>
              {phaseRuntime ? (
                <time
                  className="snvProgressRuntime"
                  aria-label={`${activeNumberedPhase?.label} 경과 시간 ${phaseRuntime}`}
                >
                  {phaseRuntime}
                </time>
              ) : null}
            </div>
          </header>

          <div className="snvFirstNightPrimary">
            {activeEvilInformationStep ? (
              <SectsAndVioletsEvilInformationTask
                step={activeEvilInformationStep}
                wakePlayers={evilInformationWakePlayers}
                selectedCharacterIds={evilInformationCheckpoint?.payload.kind === "demonInformation"
                  ? evilInformationCheckpoint.payload.bluffCharacterIds
                  : selectedBluffCharacterIds}
                revealed={Boolean(evilInformationCheckpoint)}
                busy={operationBusy}
                suggesting={suggestingBluffs}
                onToggle={toggleBluffCharacter}
                onShuffle={() => void suggestDemonBluffs()}
                onReveal={revealEvilInformation}
                onContinue={continueAfterEvilInformation}
              />
            ) : activeInformationStep && activeInformationActor ? (
              <SectsAndVioletsInformationTask
                step={activeInformationStep}
                actor={activeInformationActor}
                players={replayState?.players}
                selectedPlayerIds={activeInformationTargetIds}
                revealed={Boolean(informationCheckpoint)}
                busy={operationBusy}
                deliveredResult={activeInformationResult}
                onDeliveredResultChange={setSelectedInformationResult}
                onChooseTargets={() => startLiveHandoff(activeInformationStep.character === "seamstress" ? "seamstress" : "dreamer")}
                onSkip={() => void skipCanonicalInformation()}
                onReveal={() => void showCanonicalInformation()}
                onContinue={advanceCanonicalInformation}
              />
            ) : replayState?.currentStep?.character === "philosopher" && liveActor ? (
              <PhilosopherAbilityTask
                step={replayState.currentStep}
                actor={liveActor}
                activeImpairments={replayState.ruleState.activeImpairments}
                value={selectedPhilosopherCharacterId}
                busy={operationBusy}
                onChange={setSelectedPhilosopherCharacterId}
                onConfirm={() => void resolvePhilosopher(false)}
                onDefer={() => void resolvePhilosopher(true)}
              />
            ) : effectivePlayPhase === "firstNight" && currentFirstNightStep && !isTransitionStep(currentFirstNightStep) ? (
              <article className="snvCurrentStep">
                <p className="snvCurrentStepLabel">현재 할 일</p>
                {currentFirstNightAcquiredAbilityCharacterId && liveActor ? <AcquiredAbilityPresentation
                  actor={liveActor}
                  abilityCharacterId={currentFirstNightAcquiredAbilityCharacterId}
                  abilityOrigin={replayState!.currentStep!.abilityOrigin!}
                  actorPlayerLabel={`${liveActor.seat}번 ${liveActor.name}`}
                  abilityStatusNode={<PlayerImpairmentBadges activeImpairments={replayState?.ruleState.activeImpairments} playerId={liveActor.id} />}
                  actorIdentityClassName="snvCurrentStepIdentity interactive snvInformationIdentity issue107ActorIdentity"
                  theme="snv-night"
                /> : currentFirstNightAsset && currentFirstNightStep.characterId ? (
                  <CharacterDetailButton
                    details={sectsAndVioletsCharacterDetail(currentFirstNightStep.characterId)}
                    className="snvCurrentStepIdentity interactive"
                    theme="snv-night"
                  >
                    <img src={currentFirstNightAsset.src} alt={`${currentFirstNightStep.name} 공식 캐릭터 아이콘`} />
                    <span className="snvInformationRoleLine">
                      <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{currentFirstNightStep.name}</span>
                      <PlayerImpairmentBadges activeImpairments={replayState?.ruleState.activeImpairments} playerId={replayState?.currentStep?.playerId} />
                    </span>
                  </CharacterDetailButton>
                ) : <div className="snvCurrentStepIdentity"><h3>{currentFirstNightStep.name}</h3></div>}
                {currentFirstNightAcquiredAbilityCharacterId ? null : <p>{currentFirstNightStep.summary}</p>}
                <div className="snvStepActions">
                  {(replayState?.currentStep?.requiredInput.kind === "playerIds"
                    && ["snakeCharmer", "evilTwin", "witch"].includes(replayState.currentStep.character ?? ""))
                    || replayState?.currentStep?.requiredInput.kind === "madnessAssignment" ? null : currentFirstNightStep.support === "automated" ? (
                    <button
                      type="button"
                      className={`informationReveal ${revealedStepIds.includes(currentFirstNightStep.id) ? "" : "prominent"}`}
                      onClick={showCurrentStepInformation}
                    >정보 공개</button>
                  ) : null}
                  {replayState?.currentStep?.character === "snakeCharmer" && replayState.currentStep.requiredInput.kind === "playerIds" ? (
                    <button type="button" disabled={operationBusy} onClick={() => startLiveHandoff("snakeCharmer")}>대상 선택</button>
                  ) : replayState?.currentStep?.character === "evilTwin" && replayState.currentStep.requiredInput.kind === "playerIds" ? (
                    <button type="button" disabled={operationBusy} onClick={() => startLiveHandoff("evilTwin")}>쌍둥이 선택</button>
                  ) : replayState?.currentStep?.character === "witch" && replayState.currentStep.requiredInput.kind === "playerIds" ? (
                    <button type="button" disabled={operationBusy} onClick={() => startLiveHandoff("witch")}>저주 대상 선택</button>
                  ) : replayState?.currentStep?.requiredInput.kind === "madnessAssignment" ? (
                    <button type="button" disabled={operationBusy} onClick={() => startLiveHandoff("cerenovus")}>집착 지정</button>
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
                <h3>공개 토론</h3>
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
                <li key={step.id} className={phaseStepPresentation(step.id, index, firstNightStepIndex, replayState?.phaseOverview, evilInformationCheckpoint?.stepId ?? informationCheckpoint?.step.id).className}>
                  <span>{phaseStepPresentation(step.id, index, firstNightStepIndex, replayState?.phaseOverview, evilInformationCheckpoint?.stepId ?? informationCheckpoint?.step.id).label}</span>
                  <span className="snvPhaseOverviewAction">
                    <strong>{step.name}</strong>
                    <PlayerImpairmentBadges activeImpairments={replayState?.ruleState.activeImpairments} playerId={step.playerId} label={`${step.name} 행동자 상태`} />
                  </span>
                </li>
              ))}
            </ol>
          ) : effectivePlayPhase === "day" ? (
            <ol className="snvPhaseOverview" aria-label="낮 순서">
              <li className={dayComplete ? "complete" : "current"}>
                <span>{dayComplete ? "완료" : "현재"}</span>
                <strong>공개 토론</strong>
              </li>
            </ol>
          ) : (
            <ol className="snvPhaseOverview" aria-label="이후 밤 순서">
              {canonicalSteps.length > 0 ? canonicalSteps.map((step, index) => (
                <li key={step.id} className={phaseStepPresentation(step.id, index, 0, replayState?.phaseOverview, evilInformationCheckpoint?.stepId ?? informationCheckpoint?.step.id).className}>
                  <span>{phaseStepPresentation(step.id, index, 0, replayState?.phaseOverview, evilInformationCheckpoint?.stepId ?? informationCheckpoint?.step.id).label}</span>
                  <strong>{step.name}</strong>
                </li>
              )) : <li className="current"><span>현재</span><strong>밤 진행 준비</strong></li>}
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
      {production
        && replayState?.phase === "day"
        && (activeTab === "seating" || activeTab === "play")
        && !liveHandoff
        && !pendingDeathConsequence
        && !replayState.pendingGameEnd
        && !replayState.gameEnd
        && !nextIdentityReveal ? (
          <DayActionDock
            players={replayState.players}
            availableActions={replayState.availableDayActions ?? []}
            activeImpairments={replayState.ruleState.activeImpairments}
            phaseLabel={phaseLabel(effectivePlayPhase, replayState.currentStep)}
            busy={operationBusy}
            groupActive={activeFreeActionGroup === "day"}
            onGroupActivate={() => setActiveFreeActionGroup("day")}
            onGroupDeactivate={() => setActiveFreeActionGroup((current) => current === "day" ? undefined : current)}
            onConfirm={(action, record) => void recordDayAction(action, record)}
          />
        ) : null}
      {production
        && replayState
        && (replayState.phase === "day" || replayState.phase === "night")
        && (activeTab === "seating" || activeTab === "play")
        && !liveHandoff
        && !pendingDeathConsequence
        && !replayState.pendingGameEnd
        && !replayState.gameEnd
        && !nextIdentityReveal
        && !replayState.pendingMadnessExecution ? (
          <MadnessActionDock
            players={replayState.players}
            assignments={effectiveMadnessAssignments}
            phaseLabel={phaseLabel(effectivePlayPhase, replayState.currentStep)}
            theme={replayState.phase === "day" ? "day" : "night"}
            precedingActionCount={replayState.phase === "day" ? replayState.availableDayActions?.length ?? 0 : 0}
            busy={operationBusy}
            groupActive={activeFreeActionGroup === "madness"}
            onGroupActivate={() => setActiveFreeActionGroup("madness")}
            onGroupDeactivate={() => setActiveFreeActionGroup((current) => current === "madness" ? undefined : current)}
            onJudge={updateMadnessJudgment}
            onExecute={(assignmentId) => void executeMadness(assignmentId)}
          />
        ) : null}
      {evilInformationCheckpoint && evilInformationRevealOpen ? (
        <SectsAndVioletsEvilInformationReveal
          payload={evilInformationCheckpoint.payload}
          onClose={() => setEvilInformationRevealOpen(false)}
        />
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
      {informationCheckpoint && informationRevealOpen ? (
        <SectsAndVioletsReveal
          dialogLabel={`${characters.find((character) => character.id === automatedInformationCharacterId(informationCheckpoint.revealPayload))?.name ?? automatedInformationCharacterId(informationCheckpoint.revealPayload)} 정보 공개`}
          className="snvProductionInformationReveal"
          closeLabel="확인했으면 눈을 감으세요"
          closeButtonRef={informationCloseRef}
          onClose={() => setInformationRevealOpen(false)}
        >
          <ProductionInformationRevealContent payload={informationCheckpoint.revealPayload} />
        </SectsAndVioletsReveal>
      ) : null}
      {replayState?.pendingGameEnd ? (
        <SnvGameEndDialog
          pending={replayState.pendingGameEnd}
          busy={operationBusy}
          onConfirm={() => void confirmForcedGameEnd()}
        />
      ) : null}
      {replayState?.gameEnd ? (
        <SnvGameEndDock gameEnd={replayState.gameEnd} />
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
      {bugReportSnapshot ? (
        <SectsAndVioletsBugReportDialog
          gameFile={bugReportSnapshot.gameFile}
          environment={bugReportSnapshot.environment}
          reproductionContext={bugReportSnapshot.reproductionContext}
          recipient={bugReportEmail}
          delivery={bugReportDelivery}
          onClose={closeBugReport}
        />
      ) : null}
      {nextIdentityReveal && identityRevealOpen ? (
        nextIdentityReveal.payload.kind === "evilTwinPair" ? (
          <EvilTwinReveal
            reveal={nextIdentityReveal}
            onConfirm={acknowledgeIdentityReveal}
          />
        ) : nextIdentityReveal.payload.kind === "madnessAssignment" ? (
          <CerenovusMadnessReveal
            reveal={nextIdentityReveal}
            onConfirm={acknowledgeIdentityReveal}
          />
        ) : (
          <CharacterChangeReveal
            reveal={nextIdentityReveal}
            total={pendingIdentityReveals.length}
            onConfirm={acknowledgeIdentityReveal}
          />
        )
      ) : liveHandoff?.kind === "barber" && liveHandoff.selectionStage === "reveal" && barberAbilityRevealOpen ? (
        <BarberAbilityReveal onConfirm={() => {
          setBarberAbilityRevealOpen(false);
          setLiveHandoff((current) => current?.kind === "barber"
            ? { ...current, selectionStage: "swap" }
            : current);
        }} />
      ) : null}
    </ProductionApplicationShell>
  );
}

function identityRevealKey(gameId: string, sourceEventId: string, sequence: number) {
  return `${gameId}:${sourceEventId}:${sequence}`;
}

function isAutomatedInformationCharacter(characterId: string | undefined): boolean {
  return ["clockmaker", "dreamer", "mathematician", "flowergirl", "townCrier", "oracle", "juggler", "seamstress", "sage"].includes(characterId ?? "");
}

function automatedInformationRevealPayload(
  payload: RevealPayload | undefined,
): InformationCheckpoint["revealPayload"] | undefined {
  if (!payload || !("kind" in payload)) return undefined;
  return payload.kind === "numericInformation" || payload.kind === "booleanInformation"
    || payload.kind === "dreamerInformation" || payload.kind === "seamstressInformation" || payload.kind === "sageInformation"
    ? payload
    : undefined;
}

export function ProductionInformationRevealContent({ payload }: { payload: InformationCheckpoint["revealPayload"] }) {
  if (payload.kind === "dreamerInformation") {
    return <><span>꿈꾸는 자</span><p className="snvInformationRevealLabel">이 자는…</p><div className="snvTargetedRevealPair">{payload.characterIds.map((id, index) => <Fragment key={id}>{index ? <b>또는</b> : null}<RevealCharacterCard characterId={id} /></Fragment>)}</div></>;
  }
  if (payload.kind === "seamstressInformation") {
    return <><span>재봉사</span><p className="snvInformationRevealLabel">{payload.targetPlayers.map((player) => `${player.seat}번 ${player.name}`).join(" · ")}</p><strong className="snvInformationRevealValue snvSeamstressRevealValue">{payload.sameAlignment ? "같은 진영" : "다른 진영"}</strong></>;
  }
  if (payload.kind === "sageInformation") {
    return <><span>현자</span><p className="snvInformationRevealLabel">당신을 죽인 악마는…</p><div className="snvTargetedRevealPair snvPlayerRevealPair">{payload.candidatePlayers.map((player, index) => <Fragment key={player.playerId}>{index ? <b>또는</b> : null}<div className="snvRevealPlayerCard"><span>{player.seat}</span><strong>{player.name}</strong></div></Fragment>)}</div></>;
  }
  const characterId = automatedInformationCharacterId(payload);
  const asset = sectsAndVioletsCharacterAsset(characterId);
  return <>
    {asset?.src ? <img src={asset.src} alt={`${characters.find((character) => character.id === characterId)?.name ?? characterId} 공식 캐릭터 아이콘`} /> : null}
    <span>{characters.find((character) => character.id === characterId)?.name}</span>
    <p className="snvInformationRevealLabel">{scalarInformationLabel(payload.characterId)}</p>
    <strong className="snvInformationRevealValue">{scalarInformationValueLabel(payload.characterId, payload.value)}</strong>
  </>;
}

function RevealCharacterCard({ characterId }: { characterId: string }) {
  const character = characters.find((candidate) => candidate.id === characterId);
  const asset = sectsAndVioletsCharacterAsset(characterId);
  return <div className="snvRevealCharacterCard">{asset ? <img src={asset.src} alt={`${character?.name ?? characterId} 공식 캐릭터 아이콘`} /> : null}<strong>{character?.name ?? characterId}</strong></div>;
}

function PhilosopherAbilityTask({
  step,
  actor,
  activeImpairments,
  value,
  busy,
  onChange,
  onConfirm,
  onDefer,
}: {
  step: PhaseStep;
  actor: Player;
  activeImpairments?: ReplayState["ruleState"]["activeImpairments"];
  value: string;
  busy: boolean;
  onChange: (characterId: string) => void;
  onConfirm: () => void;
  onDefer: () => void;
}) {
  const philosopher = characters.find((character) => character.id === "philosopher")!;
  const asset = sectsAndVioletsCharacterAsset("philosopher");
  const allowed = new Set(step.requiredInput.allowedCharacterIds ?? []);
  return <article className="snvCurrentStep issue107Step" aria-label="철학자 능력 선택">
    <p className="snvCurrentStepLabel">현재 할 일</p>
    <CharacterDetailButton details={sectsAndVioletsCharacterDetail("philosopher")} className="snvCurrentStepIdentity interactive issue107ActorIdentity" theme="snv-night">
      {asset ? <img src={asset.src} alt="철학자 공식 캐릭터 아이콘" /> : null}
      <div>
        <span className="snvInformationRoleLine">
          <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{philosopher.name}</span>
          <PlayerImpairmentBadges activeImpairments={activeImpairments} playerId={actor.id} />
        </span>
        <strong>{actor.seat}번 {actor.name}</strong>
      </div>
    </CharacterDetailButton>
    <p className="snvInformationAbility">{philosopher.ability}</p>
    <label className="issue107AbilitySelect">
      <span>능력</span>
      <select aria-label="얻을 선한 캐릭터 능력" value={value} disabled={busy} onChange={(event) => onChange(event.target.value)}>
        <option value="">선택</option>
        {characters.filter((character) => allowed.has(character.id)).map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
      </select>
    </label>
    <div className="snvStepActions">
      <button type="button" disabled={busy || !value} onClick={onConfirm}>선택 확정</button>
      <button type="button" className="secondary" disabled={busy} onClick={onDefer}>이번 밤 보류</button>
    </div>
  </article>;
}

function workflowStepFromCanonical(
  step: PhaseStep,
  players: Player[] = [],
): FirstNightStep {
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
      name: "공개 토론",
      support: step.support ?? "manual",
      summary: "능력 사용, 지명, 투표와 처형을 진행합니다.",
    };
  }
  const character = characters.find((candidate) => candidate.id === step.character);
  const actor = step.playerId ? players.find((player) => player.id === step.playerId) : undefined;
  const acquiredAbilityCharacterId = acquiredAbilityCharacterForStep(step, actor);
  const actorCharacter = actor
    ? characters.find((candidate) => candidate.id === actor.actualCharacter)
    : undefined;
  const displayName = acquiredAbilityCharacterId
    ? `${actorCharacter?.name ?? actor?.actualCharacter} · ${character?.name ?? acquiredAbilityCharacterId}`
    : known?.name ?? character?.name ?? suffix;
  return {
    id: step.id,
    name: displayName,
    characterId: step.character,
    support: step.support ?? "automated",
    summary: known?.summary ?? character?.ability ?? "이 단계를 진행합니다.",
    playerId: step.playerId,
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
  heldCurrentStepId?: string,
) {
  if (stepId === heldCurrentStepId) return { className: "current", label: "현재" };
  const canonicalStatus = overview?.find((step) => step.id === stepId)?.status;
  if (canonicalStatus) {
    if (canonicalStatus === "current") return heldCurrentStepId
      ? { className: "", label: "대기" }
      : { className: "current", label: "현재" };
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

function createSnvWebSessionSnapshot(
  canonical: GameFile,
  setupDraft: SnvSetupDraft,
  presentation: SnvPresentation,
  savedAt = new Date().toISOString(),
): SnvWebSessionSnapshot {
  return {
    version: 1,
    scriptId: SECTS_AND_VIOLETS,
    savedAt,
    canonical,
    setupDraft,
    presentation,
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

function distributionForCharacterIds(characterIds: string[]): SetupDistribution {
  return {
    Townsfolk: characterIds.filter((id) => characters.find((character) => character.id === id)?.kind === "townsfolk").length,
    Outsider: characterIds.filter((id) => characters.find((character) => character.id === id)?.kind === "outsider").length,
    Minion: characterIds.filter((id) => characters.find((character) => character.id === id)?.kind === "minion").length,
    Demon: characterIds.filter((id) => characters.find((character) => character.id === id)?.kind === "demon").length,
  };
}

function evilInformationPlayersToWake(step: PhaseStep, players: Player[]) {
  const kind = step.id.endsWith(":demonInfo") ? "demon" : "minion";
  return players
    .filter((player) => characters.find((character) => character.id === player.actualCharacter)?.kind === kind)
    .map(({ seat, name }) => ({ seat, name }));
}
