import type { ScriptId } from "./scripts.js";

export type GameFile = {
  schemaVersion: 3;
  ui?: {
    seatLayout?: SeatLayoutState;
    sectsAndVioletsSession?: SectsAndVioletsSessionState;
  };
  game: {
    scriptId: ScriptId;
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    events: GameEvent[];
  };
};

export type SectsAndVioletsTab = "roles" | "seating" | "play" | "storage";

export type SectsAndVioletsPhaseCheckpoint = {
  id: string;
  eventIds?: string[];
  kind: "setup" | "phase";
  eventCount: number;
  summary: string;
  activeTab: SectsAndVioletsTab;
};

export type SectsAndVioletsSetupSession = {
  playerCount: number;
  demon: "fangGu" | "vigormortis" | "noDashii" | "vortox";
  selectedIds: string[];
  seatAssignments: Record<number, string>;
  seatAlignments: Record<number, "good" | "evil">;
  seatNames: Record<number, string>;
  rosterConfirmed: boolean;
  seatingConfirmed: boolean;
};

export type SectsAndVioletsSessionState = {
  version: 1;
  activeTab: SectsAndVioletsTab;
  savedAt: string;
  setup: SectsAndVioletsSetupSession;
  phaseCheckpoints: SectsAndVioletsPhaseCheckpoint[];
  madnessJudgments?: Record<string, MadnessCheckResult>;
};

export type SeatPosition = {
  x: number;
  y: number;
};

export type SeatPositions = Record<number, SeatPosition>;

export type SeatLayoutPreset = "circle" | "oval" | "longTable" | "horseshoe";

export type SeatLayoutState = {
  preset: SeatLayoutPreset;
  positions: SeatPositions;
};

export type SetupPlayerInput = {
  id?: string;
  seat: number;
  name: string;
  actualCharacter: string;
  shownCharacter?: string;
};

export type PhaseStepInput =
  | null
  | { playerIds: string[]; characterId?: string; zeroOutsiders?: boolean }
  | { zeroOutsiders: true; playerIds?: string[] }
  | { characterIds: string[] }
  | { playerIds: string[]; characterIds: string[] }
  | { value: number; reason?: NumericReason | null }
  | { trueValue: number; displayedValue: number; reason?: NumericReason | null }
  | { nominatorId: string; nomineeId: string }
  | { voterIds: string[] }
  | { playerIds: string[]; mayorDecision: MayorDecisionInput }
  | { successorPlayerId: string }
  | { execute: boolean }
  | { died: boolean };

export type InformationResult =
  | { kind: "number"; value: number }
  | { kind: "boolean"; value: boolean }
  | { kind: "character"; characterId: string }
  | { kind: "characterPair"; characterIds: [string, string] }
  | { kind: "player"; playerId: string }
  | { kind: "playerPair"; playerIds: [string, string] }
  | {
      kind: "setupInfo";
      playerIds: string[];
      characterId?: string;
      zeroOutsiders: boolean;
    }
  | {
      kind: "teamInfo";
      demonPlayerIds: string[];
      minionPlayerIds: string[];
      bluffCharacterIds: string[];
    }
  | {
      kind: "spyGrimoire";
      players: Array<{
        playerId: string;
        seat: number;
        name: string;
        characterId: string;
        alive?: boolean;
        ghostVoteUsed?: boolean;
        reminderTokens?: SpyReminderToken[];
      }>;
    };

export type RegistrationJudgment = {
  playerId: string;
  registeredAs: "good" | "evil" | "townsfolk" | "outsider" | "minion" | "demon";
  characterId?: string;
};

export type DeliveryReason =
  | { type: "abilityChoice" }
  | { type: "drunk" }
  | { type: "poisoned"; poisonerPlayerId: string; poisonEventId: string }
  | { type: "vortox"; demonPlayerId: string }
  | { type: "registrationJudgment"; judgments: RegistrationJudgment[] };

export type DeliveryContext =
  | { type: "fixed" }
  | { type: "discretionary"; reasons: DeliveryReason[] };

export type ConfirmedInformation = {
  actor?: { playerId: string; characterId: string };
  targetPlayerIds: string[];
  computedResult?: InformationResult;
  deliveredResult: InformationResult;
  deliveryContext: DeliveryContext;
};

export type NumberChoice = {
  value: number;
  isComputed: boolean;
  registrationJudgments: RegistrationJudgment[];
};

export type SetupInfoRegistrationOption = {
  playerId: string;
  registeredAs: RegistrationJudgment["registeredAs"];
  characterIds: string[];
};

export type InformationPrompt = {
  computedResult?: InformationResult;
  deliveryMode: "fixed" | "selectable";
  activeReasons: DeliveryReason[];
  registrationCandidatePlayerIds: string[];
  numberChoices: NumberChoice[];
  booleanChoices?: Array<{
    value: boolean;
    isComputed: boolean;
    registrationJudgments: RegistrationJudgment[];
  }>;
  setupInfoRegistrationOptions: SetupInfoRegistrationOption[];
  targetChecks?: TargetCheck[];
};

export type TargetCheck = {
  targetPlayerIds: string[];
  computedResult: InformationResult;
  choices: Array<{
    result: InformationResult;
    isComputed: boolean;
    registrationJudgments: RegistrationJudgment[];
  }>;
};

export type PhaseStepConfirmation = {
  input?: PhaseStepInput;
  deliveredResult?: InformationResult;
  registrationJudgments?: RegistrationJudgment[];
};

export type PhaseStepCommandPayload = PhaseStepConfirmation & {
  stepId: string;
  expectedEventCount?: number;
};

export type PhaseInputSuggestionRequest = {
  stepId: string;
  currentInput?: PhaseStepInput;
  choiceToken: number;
};

export type PhaseInputSuggestion = {
  stepId: string;
  input: PhaseStepInput;
};

export type Command =
  | { type: "smoke" }
  | { type: "createGame"; payload: { players: SetupPlayerInput[] } }
  | { type: "confirmStep"; payload: PhaseStepCommandPayload }
  | {
      type: "skipStep";
      payload: { stepId: string; expectedEventCount?: number; input?: null };
    }
  | {
      type: "resolveManualStep";
      payload: {
        stepId: string;
        expectedEventCount?: number;
        outcome: "handled" | "notApplicable";
      };
    }
  | { type: "useSlayerAbility"; payload: UseSlayerAbilityPayload }
  | { type: "recordDayAction"; payload: RecordDayActionPayload }
  | { type: "recordMadnessCheck"; payload: RecordMadnessCheckPayload }
  | { type: "executeMadness"; payload: ExecuteMadnessPayload }
  | {
      type: "resolveVigormortisPoison";
      payload: { sourceEventId: string; targetPlayerId: string; expectedEventCount: number };
    }
  | { type: "endGame"; payload: { winningTeam: "good" | "evil"; expectedEventCount: number } }
  | {
      type: "updatePlayerAnnotations";
      payload: {
        playerId: string;
        expectedEventCount: number;
        systemTokenIds: SystemTokenId[];
        scriptTokens: ScriptTokenRef[];
        notes: string;
      };
    };

export type UseSlayerAbilityPayload = {
  discussionStepId: string;
  expectedEventCount: number;
  actorPlayerId: string;
  targetPlayerId: string;
  targetRegistration: { kind: "canonical" } | { kind: "recluseAsDemon"; registeredCharacterId: "imp" };
};

export type ArtistAnswer = "yes" | "no" | "unknown";

export type DayActionRecordInput =
  | { kind: "artist"; question: string; answer: ArtistAnswer }
  | { kind: "savant"; referenceSentences: string[] }
  | { kind: "juggler"; correctCount: number };

export type RecordDayActionPayload = {
  dayId: string;
  expectedEventCount: number;
  actorPlayerId: string;
  record: DayActionRecordInput;
};

export type MadnessCheckResult = "clear" | "violation";

export type RecordMadnessCheckPayload = {
  assignmentId: string;
  expectedEventCount: number;
  result: MadnessCheckResult;
};

export type ExecuteMadnessPayload = {
  assignmentId: string;
  expectedEventCount: number;
};

export type AvailableDayAction = {
  actorPlayerId: string;
  characterId: "artist" | "savant" | "juggler";
  dayId: string;
};

export type ConfirmedDayActionRecord = {
  eventId: string;
  dayId: string;
  actorPlayerId: string;
  characterId: "artist" | "savant" | "juggler";
  record: DayActionRecordInput;
};

export type CoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; messageKo: string } };

export type ReplayState = {
  schemaVersion: 3;
  scriptId: ScriptId;
  eventCount: number;
  phase: Phase;
  players: Player[];
  currentStep: PhaseStep | null;
  phaseOverview: PhaseOverviewItem[];
  dayState?: DayState;
  ruleState: RuleState;
  warnings: CoreWarning[];
  gameEnd?: GameEndState | null;
  pendingIdentityReveals?: PendingIdentityReveal[];
  availableDayActions?: AvailableDayAction[];
  dayActionRecords?: ConfirmedDayActionRecord[];
  madnessAssignments?: MadnessAssignmentState[];
  pendingMadnessExecution?: PendingMadnessExecution;
  pendingVigormortisPoisonChoices?: PendingVigormortisPoisonChoice[];
};

export type PendingVigormortisPoisonChoice = {
  sourceEventId: string;
  vigormortisPlayerId: string;
  minionPlayerId: string;
  previousTargetPlayerId?: string;
  allowedPlayerIds: string[];
  reason: "noCurrentTarget" | "targetNotTownsfolk" | "targetNotNearestTownsfolk";
};

export type MadnessAssignmentState = {
  assignmentId: string;
  sourcePlayerId: string;
  sourceCharacterId: "mutant" | "cerenovus";
  targetPlayerId: string;
  requiredCharacterId?: string;
  status: "unchecked" | "clear" | "violated";
  sourceEffective: boolean;
  canCheck: boolean;
  canExecute: boolean;
  violationCheckEventId?: string;
};

export type PendingMadnessExecution = {
  eventId: string;
  assignmentId: string;
  sourceCharacterId: "mutant" | "cerenovus";
  targetPlayerId: string;
  interruptedStepId: string;
};

export type PendingIdentityReveal = {
  sourceEventId: string;
  sequence: number;
  payload: CharacterChangeRevealPayload | MadnessAssignmentRevealPayload;
};

export type GameEndState = {
  eventId: string;
  winningTeam: "good" | "evil";
};

export type RuleState = {
  redHerringPlayerId?: string;
  activePoison?: ActiveRuleEffect;
  activeProtection?: ActiveRuleEffect;
  unannouncedNightDeathPlayerIds: string[];
  unannouncedNightResurrectionPlayerIds?: string[];
  slayerAbility?: { actorPlayerId: string; spent: boolean; canUseNow: boolean };
  virginAbility?: {
    actorPlayerId: string;
    spent: boolean;
    spentByNominationEventId?: string;
  };
  butlerVote?: ButlerVoteState;
  activeImpairments?: ActiveImpairment[];
  automaticReminders?: Array<{
    playerId: string;
    characterId: string;
    tokenId: string;
    label: string;
    description: string;
  }>;
};

export type ActiveImpairment = {
  kind: "poisoned";
  playerId: string;
  sourceEventId: string;
  sourceCharacterId: string;
  expires: "never";
};

export type ButlerVoteState = {
  butlerPlayerId: string;
  masterPlayerId?: string;
  restrictionApplies: boolean;
};

export type ActiveRuleEffect = {
  playerId: string;
  sourcePlayerId: string;
  sourceEventId: string;
};

export type Proposal = {
  event: GameEvent;
  warnings: CoreWarning[];
  followUpSteps: unknown[];
  preview: unknown;
  revealPayload?: RevealPayload;
};

export type TextRevealPayload = {
  messageKo: string;
  previewMessageKo?: string;
  labelKo?: string;
  valueKo?: string;
};

export type SpyReminderToken = "poisoned" | "protected";

export type SpyGrimoireRevealPayload = {
  kind: "spyGrimoire";
  players: Array<{
    playerId: string;
    seat: number;
    name: string;
    characterId: string;
    alive: boolean;
    ghostVoteUsed: boolean;
    reminderTokens: SpyReminderToken[];
  }>;
};

export type RevealPlayer = { playerId: string; seat: number; name: string };
export type RevealIdentity = { seat: number; name: string };

export type EvilInformationRevealPayload =
  | {
      kind: "minionInformation";
      demonPlayers: RevealIdentity[];
      minionPlayers: RevealIdentity[];
    }
  | {
      kind: "demonInformation";
      minionPlayers: RevealIdentity[];
      bluffCharacterIds: string[];
    };

export type SetupInformationRevealPayload =
  | {
      kind: "setupInformation";
      characterId: "washerwoman" | "librarian" | "investigator";
      candidatePlayers: [RevealPlayer, RevealPlayer];
      revealedCharacterId: string;
      zeroOutsiders: false;
    }
  | {
      kind: "setupInformation";
      characterId: "librarian";
      candidatePlayers: [];
      zeroOutsiders: true;
    };

export type NumericInformationRevealPayload = {
  kind: "numericInformation";
  characterId: "chef" | "empath" | "clockmaker" | "oracle" | "juggler";
  value: number;
};

export type BooleanInformationRevealPayload = {
  kind: "booleanInformation";
  characterId: "flowergirl" | "townCrier";
  value: boolean;
};

export type FortuneTellerInformationRevealPayload = {
  kind: "fortuneTellerInformation";
  targetPlayers: [RevealPlayer, RevealPlayer];
  hasDemon: boolean;
};

export type CharacterInformationRevealPayload = {
  kind: "characterInformation";
  characterId: "undertaker" | "ravenkeeper";
  targetPlayer: RevealPlayer;
  revealedCharacterId: string;
};

export type DreamerInformationRevealPayload = {
  kind: "dreamerInformation";
  characterIds: [string, string];
};

export type SeamstressInformationRevealPayload = {
  kind: "seamstressInformation";
  targetPlayers: [RevealPlayer, RevealPlayer];
  sameAlignment: boolean;
};

export type SageInformationRevealPayload = {
  kind: "sageInformation";
  candidatePlayers: [RevealPlayer, RevealPlayer];
};

export type CharacterChangeRevealPayload = {
  kind: "characterChange";
  playerId: string;
  alignment: "good" | "evil";
  characterId: string;
};

export type MadnessAssignmentRevealPayload = {
  kind: "madnessAssignment";
  playerId: string;
  characterId: string;
};

export type RoleInformationRevealPayload =
  | SetupInformationRevealPayload
  | NumericInformationRevealPayload
  | BooleanInformationRevealPayload
  | FortuneTellerInformationRevealPayload
  | CharacterInformationRevealPayload
  | DreamerInformationRevealPayload
  | SeamstressInformationRevealPayload
  | SageInformationRevealPayload
  | CharacterChangeRevealPayload
  | EvilInformationRevealPayload;

export type RevealPayload = TextRevealPayload | SpyGrimoireRevealPayload | RoleInformationRevealPayload;

export type SetupDistributionRequest = {
  scriptId: ScriptId;
  playerCount: number;
  actualCharacters: string[];
};

export type SetupDistribution = {
  Townsfolk: number;
  Outsider: number;
  Minion: number;
  Demon: number;
};

type EventCommon = {
  id: string;
  phase: Phase;
  summary: string;
  createdAt: string;
};

export type GameEvent = EventCommon &
  (
    | { type: "smokeConfirmed"; payload: { source: string } }
    | { type: "setupConfirmed"; payload: { players: SetupPlayerInput[] } }
    | {
        type: "phaseStepConfirmed";
        payload: { stepId: string; input: PhaseStepInput; information?: ConfirmedInformation };
      }
    | { type: "phaseStepSkipped"; payload: { stepId: string } }
    | { type: "phaseStepNeedsFollowUp"; payload: { stepId: string } }
    | {
        type: "manualPhaseStepResolved";
        payload: { stepId: string; outcome: "handled" | "notApplicable" };
      }
    | {
        type: "nominationVoteConfirmed";
        payload: {
          stepId: string;
          nominationEventId?: string;
          nominatorId?: string;
          nomineeId?: string;
          voterIds: string[];
          ghostVoteSpentPlayerIds: string[];
        };
      }
    | {
        type: "nominationStarted";
        payload: {
          stepId: string;
          nominatorId: string;
          nomineeId: string;
          registrationJudgments: RegistrationJudgment[];
          virginResolution:
            | { kind: "notApplicable" }
            | { kind: "spentNoExecution"; virginPlayerId: string; impairmentContext: VirginImpairmentContext }
            | { kind: "spentAndNominatorExecuted"; virginPlayerId: string; impairmentContext: VirginImpairmentContext };
        };
      }
    | {
        type: "executionConfirmed" | "noExecutionConfirmed";
        payload: { stepId: string; input: { execute: boolean; playerId?: string | null } };
      }
    | { type: "deathConfirmed"; payload: { playerId: string; stepId?: string } }
    | {
        type: "executionSurvivalConfirmed";
        payload: { stepId: string; playerId: string };
      }
    | {
        type: "redHerringAssigned";
        payload: { stepId: string; playerId: string; registrationJudgments: RegistrationJudgment[] };
      }
    | {
        type: "nightActionResolved";
        payload: {
          stepId: string;
          actorPlayerId: string;
          actorCharacterId?: string;
          resolution: NightActionResolution;
        };
      }
    | {
        type: "nightDeathsAnnounced";
        payload: { stepId: string; playerIds: string[]; resurrectedPlayerIds?: string[] };
      }
    | {
        type: "slayerAbilityUsed";
        payload: {
          discussionStepId: string;
          actorPlayerId: string;
          targetPlayerId: string;
          impairmentContext: { kind: "healthy" } | { kind: "poisoned"; sourcePlayerId: string; sourceEventId: string };
          registrationContext: { kind: "canonical"; registeredAsDemon: boolean } | { kind: "recluseDecision"; registeredAsDemon: boolean; registeredCharacterId?: "imp" };
          outcome: { kind: "noEffect"; reason: "actorPoisoned" | "targetNotDemon" | "targetAlreadyDead" } | { kind: "deathPending"; playerId: string };
        };
      }
    | {
        type: "dayActionRecorded";
        payload: {
          dayId: string;
          actorPlayerId: string;
          characterId: "artist" | "savant" | "juggler";
          record: DayActionRecordInput;
        };
      }
    | {
        type: "madnessAssigned";
        payload: {
          stepId: string;
          sourcePlayerId: string;
          targetPlayerId: string;
          requiredCharacterId: string;
        };
      }
    | {
        type: "madnessCheckRecorded";
        payload: {
          assignmentId: string;
          sourcePlayerId: string;
          sourceCharacterId: "mutant" | "cerenovus";
          targetPlayerId: string;
          result: MadnessCheckResult;
        };
      }
    | {
        type: "madnessExecutionConfirmed";
        payload: {
          assignmentId: string;
          checkEventId?: string;
          sourcePlayerId: string;
          sourceCharacterId: "mutant" | "cerenovus";
          targetPlayerId: string;
          interruptedStepId: string;
        };
      }
    | {
        type: "demonSuccessionConfirmed";
        payload: {
          triggerImpDeathEventId: string;
          deathCause: "execution" | "slayer" | "impSelfKill";
          previousImpPlayerId: string;
          successorPlayerId: string;
          successorPreviousActualCharacter: string;
          newCharacter: string;
          source: "scarletWoman" | "impSelfKill";
        };
      }
    | {
        type: "snakeCharmerActionResolved";
        payload: {
          stepId: string;
          actorPlayerId: string;
          targetPlayerId: string;
          outcome:
            | { kind: "noSwap"; reason: "targetNotDemon" | "actorImpaired" }
            | {
                kind: "swap";
                identityTransitions: PlayerIdentityTransition[];
                impairment: ActiveImpairment;
              };
        };
      }
    | {
        type: "pitHagTransformationResolved";
        payload: {
          stepId: string;
          actorPlayerId: string;
          targetPlayerId: string;
          characterId: string;
          outcome:
            | { kind: "noChange"; reason: "characterAlreadyInPlay" | "actorImpaired" | "notActualCharacter" }
            | { kind: "changed"; identityTransition: PlayerIdentityTransition; createdDemon: boolean };
        };
      }
    | {
        type: "pitHagArbitraryDeathsConfirmed";
        payload: {
          stepId: string;
          sourceTransformationEventId: string;
          deaths: NightDeath[];
        };
      }
    | {
        type: "playerTransitioned";
        payload: {
          stepId: string;
          sourcePlayerId: string;
          sourceCharacterId: string;
          transitions: PlayerTransition[];
        };
      }
    | {
        type: "playerAnnotationsUpdated";
        payload: {
          playerId: string;
          systemTokenIds: SystemTokenId[];
          scriptTokens: ScriptTokenRef[];
          notes: string;
        };
      }
    | {
        type: "vigormortisPoisonTargetChanged";
        payload: {
          sourceEventId: string;
          previousTargetPlayerId?: string;
          targetPlayerId: string;
        };
      }
    | { type: "gameEnded"; payload: { winningTeam: "good" | "evil" } }
  );

export type VirginImpairmentContext =
  | { kind: "healthy" }
  | { kind: "poisoned"; sourcePlayerId: string; sourceEventId: string };

export type NightActionResolution =
  | {
      kind: "poison" | "monkProtection";
      targetPlayerId: string;
      applied: boolean;
      noEffectReason?: "actorImpaired" | "notActualCharacter";
    }
  | {
      kind: "impAttack";
      targetPlayerId: string;
      mayorContext?:
        | { kind: "notApplicable" }
        | { kind: "mayorDies"; mayorPlayerId: string }
        | { kind: "bounced"; mayorPlayerId: string; bounceTargetPlayerId: string };
      outcome:
        | { kind: "death"; playerId: string }
        | { kind: "prevented"; reason: "monkProtection"; sourceEventId: string }
        | { kind: "soldierProtected"; playerId: string }
        | { kind: "noDeath"; reason: "alreadyDead" | "actorImpaired" | "notActualCharacter" };
    }
  | {
      kind: "demonAttack";
      targetPlayerId: string;
      outcome:
        | {
            kind: "deaths";
            deaths: NightDeath[];
            vigormortisEffect?: {
              minionPlayerId: string;
              sourceAbilityInstanceId: string;
              poisonTargetPlayerId?: string;
            };
          }
        | { kind: "noEffect"; reason: "targetAlreadyDead" | "actorImpaired" | "notActualCharacter" | "pitHagCreatedDemon" };
    };

export type NightDeath = {
  playerId: string;
  cause:
    | {
        kind: "demonAttack";
        actorPlayerId: string;
        actorCharacterId: string;
        targetPlayerId: string;
      }
    | {
        kind: "pitHagArbitraryDeath";
        actorPlayerId: string;
        sourceTransformationEventId: string;
      };
};

export type Phase = "setup" | "firstNight" | "day" | "night";

export type StepType =
  | "evilInfo"
  | "character"
  | "phaseTransition"
  | "announcement"
  | "whisper"
  | "discussion"
  | "nomination"
  | "execution"
  | "executionDeath"
  | "slayerDeath"
  | "demonSuccession"
  | "redHerringAssignment"
  | "pitHagArbitraryDeaths";

export type NumericReason = "drunk" | "poisoned" | "registration";

export type SystemTokenId =
  | "drunk"
  | "poisoned"
  | "protected"
  | "noAbility"
  | "abilitySpent"
  | "needsFollowUp";

export type ScriptTokenRef = {
  characterId: string;
  tokenId: string;
};

export type PlayerAnnotationsInput = {
  systemTokenIds: SystemTokenId[];
  scriptTokens: ScriptTokenRef[];
  notes: string;
};

export type Player = {
  id: string;
  seat: number;
  name: string;
  actualCharacter: string;
  shownCharacter: string;
  alignment: "good" | "evil";
  alive: boolean;
  ghostVoteUsed: boolean;
  deathAnnounced: boolean;
  systemTokenIds: SystemTokenId[];
  scriptTokens: ScriptTokenRef[];
  notes: string;
  abilityInstance?: AbilityInstance;
  identityHistory?: IdentityHistoryEntry[];
};

export type AbilityInstance = {
  id: string;
  characterId: string;
  sourceEventId: string;
};

export type PlayerStateSnapshot = IdentityState & { alive: boolean };

export type PlayerTransition = {
  kind: "characterChange" | "resurrection";
  playerId: string;
  before: PlayerStateSnapshot;
  after: PlayerStateSnapshot;
};

export type IdentityState = {
  actualCharacter: string;
  shownCharacter: string;
  alignment: "good" | "evil";
};

export type IdentityHistoryEntry = {
  sourceEventId: string;
  phase: Phase;
  before: IdentityState;
  after: IdentityState;
};

export type PlayerIdentityTransition = {
  playerId: string;
  before: IdentityState;
  after: IdentityState;
};

export type CoreWarning = {
  code: string;
  severity: "warning" | "info";
  messageKo: string;
  winningTeam?: "good" | "evil";
};

export type PhaseStep = {
  id: string;
  phase: Phase;
  stepType: StepType;
  character?: string;
  playerId?: string;
  requiredInput: RequiredInput;
  canSkip: boolean;
  support?: "automated" | "manual";
  informationPrompt?: InformationPrompt;
  preActionReveal?: PreActionReveal;
};

export type PreActionReveal = CharacterChangeRevealPayload & {
  sourceEventId: string;
};

export type PhaseOverviewItem = PhaseStep & {
  status:
    | "waiting"
    | "current"
    | "complete"
    | "skipped"
    | "needsFollowUp"
    | "interrupted"
    | "manualComplete"
    | "notApplicable";
};

export type DayState = {
  nominations: NominationRecord[];
  eligibleNominatorIds: string[];
  eligibleNomineeIds: string[];
  executionVoteThreshold: number;
  highestVoteCount: number;
  executionCandidate?: ExecutionCandidate;
  confirmedExecution?: ConfirmedExecution;
  activeNomination?: { eventId: string; stepId: string; nominatorId: string; nomineeId: string };
};

export type NominationRecord = {
  stepId: string;
  nominatorId: string;
  nomineeId: string;
  voterIds: string[];
  voteCount: number;
  ghostVoteSpentPlayerIds: string[];
};

export type ExecutionCandidate = {
  nomineeId: string;
  voteCount: number;
};

export type ConfirmedExecution = {
  playerId?: string;
};

export type RequiredInputKind =
  | "none"
  | "playerIds"
  | "characterIds"
  | "characterTransformation"
  | "setupInfo"
  | "number"
  | "nominationVote"
  | "nomination"
  | "executionDecision"
  | "executionDeathDecision"
  | "slayerDeathDecision"
  | "demonSuccession"
  | "madnessAssignment"
  | "day"
  | "night";

export type InputTarget =
  | "player"
  | "players"
  | "characters"
  | "setupInfo"
  | "number"
  | "nomination"
  | "execution"
  | "phase";

export type RequiredInput = {
  kind: RequiredInputKind;
  target?: InputTarget;
  minSelections?: number;
  maxSelections?: number;
  setupInfo?: "washerwoman" | "librarian" | "investigator";
  characterKind?: "Townsfolk" | "Outsider" | "Minion" | "Demon";
  allowedCharacterIds?: string[];
  allowedPlayerIds?: string[];
  playerRegistrationOptions?: RegistrationJudgment[];
  zeroAllowed?: boolean;
  supportsRandomSuggestion?: boolean;
  executionSurvivalAllowed?: boolean;
  playerId?: string;
  survivalAllowed?: boolean;
  mayorDecision?: MayorDecisionPrompt;
  demonSuccession?: DemonSuccessionPrompt;
  dependentPlayerSelections?: Array<{
    triggerPlayerId: string;
    selectionIndex: number;
    allowedPlayerIds: string[];
  }>;
  optional: boolean;
};

export type MayorDecisionInput =
  | { kind: "mayorDies" }
  | { kind: "bounce"; targetPlayerId: string };

export type MayorDecisionPrompt = {
  mayorPlayerId: string;
  bounceTargetPlayerIds: string[];
};

export type DemonSuccessionPrompt =
  | { kind: "fixed"; triggerEventId: string; successorPlayerId: string }
  | { kind: "selectable"; triggerEventId: string; allowedPlayerIds: string[] };
