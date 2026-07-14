export type GameFile = {
  schemaVersion: 1;
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
  | { nominatorId: string; nomineeId: string; voterIds: string[] }
  | { execute: boolean };

export type Command =
  | { type: "smoke" }
  | { type: "createGame"; payload: { players: SetupPlayerInput[] } }
  | { type: "confirmStep"; payload: { stepId: string; input?: PhaseStepInput } }
  | { type: "skipStep"; payload: { stepId: string; input?: null } };

export type CoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; messageKo: string } };

export type ReplayState = {
  schemaVersion: number;
  eventCount: number;
  phase: Phase;
  players: Player[];
  currentStep: PhaseStep | null;
  phaseOverview: PhaseOverviewItem[];
  dayState?: DayState;
  warnings: CoreWarning[];
};

export type Proposal = {
  event: GameEvent;
  warnings: CoreWarning[];
  followUpSteps: unknown[];
  preview: unknown;
  revealPayload?: RevealPayload;
};

export type RevealPayload = {
  messageKo: string;
  previewMessageKo?: string;
  labelKo?: string;
  valueKo?: string;
};

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
    | { type: "phaseStepConfirmed"; payload: { stepId: string; input: PhaseStepInput } }
    | { type: "phaseStepSkipped"; payload: { stepId: string } }
    | { type: "phaseStepNeedsFollowUp"; payload: { stepId: string } }
    | { type: "nominationVoteConfirmed"; payload: { stepId: string; input: NominationRecord } }
    | {
        type: "executionConfirmed" | "noExecutionConfirmed";
        payload: { stepId: string; input: { execute: boolean; playerId?: string | null } };
      }
    | { type: "deathConfirmed"; payload: { playerId: string } }
  );

export type Phase = "setup" | "firstNight" | "day" | "night";

export type StepType =
  | "evilInfo"
  | "character"
  | "phaseTransition"
  | "announcement"
  | "nomination"
  | "execution";

export type NumericReason = "drunk" | "poisoned" | "registration";

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
  notes: string;
};

export type CoreWarning = {
  code: string;
  severity: "warning" | "info";
  messageKo: string;
};

export type PhaseStep = {
  id: string;
  phase: Phase;
  stepType: StepType;
  character?: string;
  playerId?: string;
  requiredInput: RequiredInput;
  canSkip: boolean;
};

export type PhaseOverviewItem = PhaseStep & {
  status: "waiting" | "current" | "complete" | "skipped" | "needsFollowUp";
};

export type DayState = {
  nominations: NominationRecord[];
  executionCandidate?: ExecutionCandidate;
  confirmedExecution?: ConfirmedExecution;
};

export type NominationRecord = {
  stepId: string;
  nominatorId: string;
  nomineeId: string;
  voterIds: string[];
  voteCount: number;
  ghostVoteSpentPlayerIds: string[];
  updatesExecutionCandidate: boolean;
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
  | "executionDecision"
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
  zeroAllowed?: boolean;
  optional: boolean;
};
