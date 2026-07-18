export type GameFile = {
  schemaVersion: 2;
  game: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    events: GameEvent[];
  };
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
  | { type: "drunk" }
  | { type: "poisoned"; poisonerPlayerId: string; poisonEventId: string }
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

export type PhaseStepCommandPayload = PhaseStepConfirmation & { stepId: string };

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
  | { type: "skipStep"; payload: { stepId: string; input?: null } }
  | { type: "useSlayerAbility"; payload: UseSlayerAbilityPayload }
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

export type CoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; messageKo: string } };

export type ReplayState = {
  schemaVersion: 2;
  eventCount: number;
  phase: Phase;
  players: Player[];
  currentStep: PhaseStep | null;
  phaseOverview: PhaseOverviewItem[];
  dayState?: DayState;
  ruleState: RuleState;
  warnings: CoreWarning[];
  gameEnd?: GameEndState | null;
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
  slayerAbility?: { actorPlayerId: string; spent: boolean; canUseNow: boolean };
  virginAbility?: {
    actorPlayerId: string;
    spent: boolean;
    spentByNominationEventId?: string;
  };
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
  characterId: "chef" | "empath";
  value: number;
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

export type CharacterChangeRevealPayload = {
  kind: "characterChange";
  playerId: string;
  alignment: "good" | "evil";
  characterId: string;
};

export type RoleInformationRevealPayload =
  | SetupInformationRevealPayload
  | NumericInformationRevealPayload
  | FortuneTellerInformationRevealPayload
  | CharacterInformationRevealPayload
  | CharacterChangeRevealPayload;

export type RevealPayload = TextRevealPayload | SpyGrimoireRevealPayload | RoleInformationRevealPayload;

export type SetupDistributionRequest = {
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
        payload: { stepId: string; actorPlayerId: string; resolution: NightActionResolution };
      }
    | {
        type: "nightDeathsAnnounced";
        payload: { stepId: string; playerIds: string[] };
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
        type: "playerAnnotationsUpdated";
        payload: {
          playerId: string;
          systemTokenIds: SystemTokenId[];
          scriptTokens: ScriptTokenRef[];
          notes: string;
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
  | "redHerringAssignment";

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
  informationPrompt?: InformationPrompt;
};

export type PhaseOverviewItem = PhaseStep & {
  status: "waiting" | "current" | "complete" | "skipped" | "needsFollowUp";
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
  | "setupInfo"
  | "number"
  | "nominationVote"
  | "nomination"
  | "executionDecision"
  | "executionDeathDecision"
  | "slayerDeathDecision"
  | "demonSuccession"
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
