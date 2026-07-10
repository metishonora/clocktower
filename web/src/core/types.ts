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
  warnings: CoreWarning[];
};

export type Proposal = {
  event: GameEvent;
  warnings: CoreWarning[];
  followUpSteps: unknown[];
  preview: unknown;
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
