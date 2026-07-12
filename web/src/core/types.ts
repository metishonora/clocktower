export type GameFile = {
  schemaVersion: 1;
  game: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    events: unknown[];
  };
};

export type Command = {
  type: string;
  payload?: unknown;
};

export type CoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; messageKo: string } };

export type ReplayState = {
  schemaVersion: number;
  eventCount: number;
  phase: string;
  players: Player[];
  currentStep: PhaseStep | null;
  phaseOverview: PhaseOverviewItem[];
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

export type GameEvent = {
  id: string;
  type: string;
  phase: string;
  payload: unknown;
  summary: string;
  createdAt: string;
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
  notes: string;
};

export type CoreWarning = {
  code: string;
  severity: "warning" | "info";
  messageKo: string;
};

export type PhaseStep = {
  id: string;
  phase: string;
  stepType: string;
  character?: string;
  playerId?: string;
  requiredInput: RequiredInput;
  canSkip: boolean;
};

export type PhaseOverviewItem = PhaseStep & {
  status: "waiting" | "current" | "complete" | "skipped" | "needsFollowUp";
};

export type RequiredInput = {
  kind: string;
  target?: string;
  minSelections?: number;
  maxSelections?: number;
  setupInfo?: string;
  characterKind?: "Townsfolk" | "Outsider" | "Minion" | "Demon";
  zeroAllowed?: boolean;
  optional: boolean;
};
