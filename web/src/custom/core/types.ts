

export type CustomScriptDefinition = {
  id: string;
  name: string;
  characterIds: string[];
  firstNightOrder: FirstNightOrderPlan;
};


/**
 * Authoring input for the read-only custom first-night-plan query.
 * Persisted and game-snapshot definitions always carry an explicit order.
 */
export type CustomScriptDefinitionDraft = Omit<CustomScriptDefinition, "firstNightOrder"> & {
  firstNightOrder?: FirstNightOrderPlan;
};


export type SystemFirstNightActionId = "dusk" | "minionInfo" | "demonInfo" | "dawn";


export type FirstNightActionRef =
  | { kind: "system"; actionId: SystemFirstNightActionId }
  | { kind: "character"; characterId: string; actionId: string };


export type FirstNightOrderPlan = FirstNightActionRef[];


export type CustomFirstNightPlanResult = {
  source: "definition" | "default";
  plan: FirstNightOrderPlan;
};


export type CustomScriptReference = {
  type: "custom";
  definition: CustomScriptDefinition;
};
export type ScriptReference = CustomScriptReference;
type GameFileMetadata = { ui?: { seatLayout?: SeatLayoutState } };


export type GameFileV4 = GameFileMetadata & {
  schemaVersion: 4;
  game: {
    script: ScriptReference;
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    events: GameEvent[];
  };
};
export type GameFile = GameFileV4;


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
      automaticReminders?: AutomaticReminder[];
    }>;
  };


export type MathematicianAudit = {
  records: MathematicianAuditRecord[];
};


export type MathematicianAuditRecord = {
  subjectPlayerId: string;
  characterId: string;
  abilityInstanceId: string;
  evidence: MathematicianAuditEvidence[];
};


export type MathematicianAuditEvidence = {
  resolutionEventId: string;
  stepId: string;
  phase: "setup" | "night" | "day" | "firstNight";
  characterId: string;
  abilityInstanceId: string;
  outcome: MathematicianAuditOutcome;
  causes: DeliveryReason[];
};


export type MathematicianAuditOutcome =
  | {
    kind: "incorrectInformation";
    computedResult: InformationResult;
    deliveredResult: InformationResult;
  }
  | { kind: "invalidSavantPattern"; truthfulCount: number }
  | {
    kind: "effectFailure";
    effect:
    | "philosopherAcquisition"
    | "witchCurse"
    | "cerenovusMadness"
    | "evilTwinRelationship"
    | "snakeCharmerSwap"
    | "witchDeath"
    | "sweetheartDrunkenness"
    | "demonDeath"
    | "pitHagCharacterChange"
    | "noDashiiPoison"
    | "vigormortisOngoingEffect"
    | "vortoxFalseInformation"
    | "vortoxExecution";
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
  numberConstraint?: {
    min: number;
    max: number;
    excludedValues: number[];
  };
  booleanChoices?: Array<{
    value: boolean;
    isComputed: boolean;
    registrationJudgments: RegistrationJudgment[];
  }>;
  setupInfoRegistrationOptions: SetupInfoRegistrationOption[];
  targetChecks?: TargetCheck[];
  mathematicianAudit?: MathematicianAudit;
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
export type Command = { type: "createGame"; payload: { players: SetupPlayerInput[]; setupChoiceId?: never } } | { type: "confirmStep"; payload: PhaseStepCommandPayload };


export type CoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; messageKo: string } };
export type ReplayState = { schemaVersion: 4; script: CustomScriptReference; eventCount: number; phase: Phase; players: Player[]; currentStep: PhaseStep | null; phaseOverview: PhaseOverviewItem[]; ruleState: RuleState; warnings: CoreWarning[]; gameEnd?: null; pendingIdentityReveals?: PendingIdentityReveal[]; madnessAssignments?: MadnessAssignment[] };


export type PendingIdentityReveal = {
  sourceEventId: string;
  sequence: number;
  payload: CharacterChangeRevealPayload | MadnessAssignmentRevealPayload | EvilTwinPairRevealPayload;
};
export type RuleState = { unannouncedNightDeathPlayerIds: string[]; activeImpairments?: ActiveImpairment[]; abilityGrants?: AbilityGrant[]; abilityUses?: AbilityUseRecord[]; philosopherChoices?: PhilosopherChoiceFact[]; witchCurses?: WitchCurse[]; twinRelationships?: TwinRelationship[] };


export type ActiveImpairment = {
  kind: "poisoned" | "drunk";
  playerId: string;
  sourceEventId: string;
  sourceCharacterId: string;
  expires: "never" | "whileSourceAbilityActive";
};


export type AbilityUseRef = {
  ownerPlayerId: string;
  characterId: string;
  abilityInstanceId: string;
};


export type AbilityOrigin =
  | { kind: "identityBound" }
  | {
    kind: "acquired";
    acquisitionEventId: string;
    source: AbilityUseRef;
  };


export type AbilityGrant = {
  ownerPlayerId: string;
  characterId: string;
  sourceEventId: string;
  sourceAbilityInstanceId: string;
  abilityInstanceId: string;
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


export type AutomaticReminder = {
  playerId: string;
  characterId: string;
  tokenId: string;
  label: string;
  description: string;
  count?: number;
  sourceEventId?: string;
  inactiveReason?: string;
};


export type SpyGrimoireRevealPayload = {
  kind: "spyGrimoire";
  players: Array<{
    playerId: string;
    seat: number;
    name: string;
    characterId: string;
    alive: boolean;
    ghostVoteUsed: boolean;
    reminderTokens?: SpyReminderToken[];
    automaticReminders?: AutomaticReminder[];
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
  characterId: "chef" | "empath" | "clockmaker" | "mathematician" | "oracle" | "juggler";
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


export type EvilTwinPairRevealPayload = {
  kind: "evilTwinPair";
  players: Array<{
    playerId: string;
    seat: number;
    name: string;
    alignment: "good" | "evil";
    characterId: string;
  }>;
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


export type RevealPayload = TextRevealPayload | SpyGrimoireRevealPayload | RoleInformationRevealPayload | EvilTwinPairRevealPayload | MadnessAssignmentRevealPayload;
export type SetupDistributionRequest = { customDefinition: CustomScriptDefinition; playerCount: number; actualCharacters: string[] };


export type SetupDistribution = {
  Townsfolk: number;
  Outsider: number;
  Minion: number;
  Demon: number;
};
export type SetupDistributionResult = SetupDistribution;


type EventCommon = {
  id: string;
  phase: Phase;
  summary: string;
  createdAt: string;
};


/**
 * Typed result carried by a custom Character action.  Fixture-only state-changing outcomes are
 * intentionally absent from the production wire type and parser; the fixture test path may
 * extend this boundary when it builds its dedicated WASM artifact.
 */
export type CustomActionResult =
  | { kind: "information"; value: InformationResult }
  | { kind: "noEffect" }
  | { kind: "philosopherDeferred" | "seamstressDeferred" }
  | { kind: "philosopherChoice"; characterId: string; outcome: "acquired" | "selfDrunk" | "failed" }
  | { kind: "snakeCharmer"; targetPlayerId: string; outcome: "swapped" | "impaired" | "notDemon" }
  | { kind: "evilTwin"; targetPlayerId: string; effective: boolean }
  | { kind: "witch"; targetPlayerId: string; day: number; effective: boolean }
  | { kind: "cerenovus"; targetPlayerId: string; characterId: string; day: number; effective: boolean }
  | { kind: "informationDelivered"; information: ConfirmedInformation; spent: boolean }
  | { kind: "simulation"; information: ConfirmedInformation | null; spent: boolean };


export type PhilosopherSimulationSource = { selectionEventId: string; sourceAbilityUse: AbilityUseRef };
export type FollowUpCause = { triggerEventId: string; relationshipEventId: string };
export type CustomActionSource =
  | { abilityUse: AbilityUseRef; simulationSource?: never }
  | { abilityUse?: never; simulationSource: PhilosopherSimulationSource };
export type CustomActionConfirmedPayload = CustomActionSource & {
  stepId: string;
  actionRef: Extract<FirstNightActionRef, { kind: "character" }>;
  followUpCause?: FollowUpCause;
  deliveredResult?: InformationResult;
  registrationJudgments?: RegistrationJudgment[];
  input: PhaseStepInput;
  result: CustomActionResult;
};
export type GameEvent = EventCommon & ({ type: "setupConfirmed"; payload: { players: SetupPlayerInput[]; setupChoiceId?: never } } | { type: "phaseStepConfirmed"; payload: { stepId: string; actionRef?: FirstNightActionRef; abilityUse?: AbilityUseRef; input: PhaseStepInput; information?: ConfirmedInformation } } | { type: "customActionConfirmed"; payload: CustomActionConfirmedPayload });


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
  | "witchDeath"
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
  abilityUse?: AbilityUseRef;
  simulationSource?: PhilosopherSimulationSource;
  followUpCause?: FollowUpCause;
  abilityOrigin?: AbilityOrigin;
  requiredInput: RequiredInput;
  canSkip: boolean;
  support?: "automated" | "manual";
  informationPrompt?: InformationPrompt;
  preActionReveal?: PreActionReveal;
  actionRef?: FirstNightActionRef;
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

export type AbilityUseRecord = { sourceEventId: string; abilityUse: AbilityUseRef };
export type PhilosopherChoiceFact = AbilityUseRecord & { characterId: string; outcome: "acquired" | "selfDrunk" | "failed" };
export type TwinRelationship = AbilityUseRecord & { targetPlayerId: string; effective: boolean };
export type WitchCurse = TwinRelationship & { day: number; initiallyEffective: boolean };
export type MadnessAssignment = WitchCurse & { characterId: string };
