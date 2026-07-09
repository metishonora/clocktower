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
};

export type CoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; messageKo: string } };

export type ReplayState = {
  schemaVersion: number;
  eventCount: number;
  phase: string;
  warnings: unknown[];
};

export type Proposal = {
  event: {
    id: string;
    type: string;
    phase: string;
    payload: unknown;
    summary: string;
    createdAt: string;
  };
  warnings: unknown[];
  followUpSteps: unknown[];
  preview: unknown;
};

