import type {
  GameFile,
  Phase,
  StepType,
} from "./core/types.js";

export type GameBugReportEnvironment = {
  appVersion: string;
  buildCommit: string;
  pageUrl: string;
  userAgent: string;
  viewport: { width: number; height: number };
};

export type GameBugReportContextInput<ActiveTab extends string = string> = {
  activeTab: ActiveTab;
  replayPhase: Phase | null;
  currentStepId: string | null;
  currentStepType: StepType | null;
};

export type GameBugReportContext<ActiveTab extends string = string> =
  GameBugReportContextInput<ActiveTab> & {
    eventCount: number;
  };

export type GameBugReportMetadata = {
  reportSchemaVersion: 2;
  schemaVersion: GameFile["schemaVersion"];
  scriptId: GameFile["game"]["scriptId"];
  appVersion: string;
  buildCommit: string;
  pageUrl: string;
  userAgent: string;
  viewport: string;
  gameUpdatedAt: string;
  eventCount: number;
};

export type GameBugReportInput<ActiveTab extends string = string> = {
  gameFile: GameFile;
  symptom: string;
  environment: GameBugReportEnvironment;
  reproductionContext: GameBugReportContextInput<ActiveTab>;
  includeOriginalGameFile?: boolean;
};

export type GameBugReportConfig = {
  subject: string;
  heading: string;
  reportType: string;
  privacyNotice?: string;
};

export type GameBugReport<ActiveTab extends string = string> = {
  subject: string;
  body: string;
  attachmentJson: string;
  metadata: GameBugReportMetadata;
  fixture: GameFile;
  reproductionContext: GameBugReportContext<ActiveTab>;
  reportType: string;
  reportSchemaVersion: 2;
};

export function buildGameBugReport<ActiveTab extends string = string>(
  config: GameBugReportConfig,
  input: GameBugReportInput<ActiveTab>,
): GameBugReport<ActiveTab> {
  const players = setupPlayers(input.gameFile);
  const redaction = buildPlayerRedaction(players);
  const fixture = sanitizeGameFile(input.gameFile);
  const events = fixture.game.events;
  const symptom = replaceKnownNames(input.symptom.trim(), redaction.nameReplacements);
  const reproductionContext: GameBugReportContext<ActiveTab> = {
    activeTab: input.reproductionContext.activeTab,
    replayPhase: input.reproductionContext.replayPhase,
    currentStepId: input.reproductionContext.currentStepId,
    currentStepType: input.reproductionContext.currentStepType,
    eventCount: events.length,
  };
  const metadata: GameBugReportMetadata = {
    reportSchemaVersion: 2,
    schemaVersion: input.gameFile.schemaVersion,
    scriptId: input.gameFile.game.scriptId,
    appVersion: input.environment.appVersion,
    buildCommit: input.environment.buildCommit,
    pageUrl: input.environment.pageUrl,
    userAgent: input.environment.userAgent,
    viewport: `${input.environment.viewport.width}x${input.environment.viewport.height}`,
    gameUpdatedAt: input.gameFile.game.updatedAt,
    eventCount: input.gameFile.game.events.length,
  };
  const attachment = {
    reportSchemaVersion: metadata.reportSchemaVersion,
    reportType: config.reportType,
    userReport: { symptom: symptom || null },
    environment: input.environment,
    redaction: {
      gameName: "replaced",
      playerNames: "seatLabels",
      storytellerNotes: "removed",
    },
    reproductionContext,
    fixture,
    ...(input.includeOriginalGameFile ? { originalGameFile: input.gameFile } : {}),
  };

  const sections = [
    config.heading,
    "",
    "[사용자 제보]",
    "문제 설명:",
    symptom || "(작성하지 않음)",
    "",
    "[환경]",
    `reportSchemaVersion: ${metadata.reportSchemaVersion}`,
    `schemaVersion: ${metadata.schemaVersion}`,
    `scriptId: ${metadata.scriptId}`,
    `appVersion: ${metadata.appVersion}`,
    `buildCommit: ${metadata.buildCommit}`,
    `pageUrl: ${metadata.pageUrl}`,
    `userAgent: ${metadata.userAgent}`,
    `viewport: ${metadata.viewport}`,
    `gameUpdatedAt: ${metadata.gameUpdatedAt}`,
    "",
    "[개인정보 처리]",
    config.privacyNotice ?? "게임 이름 및 플레이어 이름 대체됨 · Storyteller 메모 제거됨",
    "",
    "[재현 컨텍스트]",
    "```json",
    JSON.stringify(reproductionContext, null, 2),
    "```",
    "",
    "[재현 Fixture]",
    "```json",
    JSON.stringify(fixture, null, 2),
    "```",
  ];
  if (input.includeOriginalGameFile) {
    sections.push(
      "",
      "[원본 GameFile JSON — 플레이어 이름과 메모 포함 가능]",
      "```json",
      JSON.stringify(input.gameFile, null, 2),
      "```",
    );
  }

  return {
    subject: config.subject,
    body: sections.join("\n"),
    attachmentJson: JSON.stringify(attachment, null, 2),
    metadata,
    fixture,
    reproductionContext,
    reportType: config.reportType,
    reportSchemaVersion: metadata.reportSchemaVersion,
  };
}

type SetupPlayer = Extract<GameFile["game"]["events"][number], { type: "setupConfirmed" }>["payload"]["players"][number];

type PlayerRedaction = {
  labelsById: Map<string, string>;
  nameReplacements: Array<[name: string, replacement: string]>;
};

function setupPlayers(gameFile: GameFile): SetupPlayer[] {
  return gameFile.game.events.find((event) => event.type === "setupConfirmed")?.payload.players ?? [];
}

function buildPlayerRedaction(players: SetupPlayer[]): PlayerRedaction {
  const labelsById = new Map<string, string>();
  const nameReplacements: Array<[string, string]> = [];
  for (const player of players) {
    const label = seatLabel(player.seat);
    if (player.id) labelsById.set(player.id, label);
    if (player.name.trim()) nameReplacements.push([player.name, label]);
  }
  nameReplacements.sort(([left], [right]) => right.length - left.length);
  return { labelsById, nameReplacements };
}

export function sanitizeGameFile(gameFile: GameFile): GameFile {
  const redaction = buildPlayerRedaction(setupPlayers(gameFile));
  const events = gameFile.game.events.map(
    (event) => sanitizeValue(event, redaction),
  ) as GameFile["game"]["events"];
  return {
    schemaVersion: 3,
    game: {
      scriptId: gameFile.game.scriptId,
      id: gameFile.game.id,
      name: "Redacted bug report",
      createdAt: gameFile.game.createdAt,
      updatedAt: gameFile.game.updatedAt,
      events,
    },
  };
}

function sanitizeValue(value: unknown, redaction: PlayerRedaction): unknown {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, redaction));
  if (!isRecord(value)) return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === "notes") {
      sanitized.notes = "";
      continue;
    }
    if (key === "name") {
      sanitized.name = redactedName(value, nestedValue, redaction);
      continue;
    }
    if (key === "summary" && typeof nestedValue === "string") {
      sanitized.summary = replaceKnownNames(nestedValue, redaction.nameReplacements);
      continue;
    }
    sanitized[key] = sanitizeValue(nestedValue, redaction);
  }
  return sanitized;
}

function redactedName(record: Record<string, unknown>, value: unknown, redaction: PlayerRedaction) {
  if (typeof record.seat === "number") return seatLabel(record.seat);
  const playerId = typeof record.playerId === "string"
    ? record.playerId
    : typeof record.id === "string"
      ? record.id
      : undefined;
  if (playerId) return redaction.labelsById.get(playerId) ?? "[이름 제외됨]";
  if (typeof value === "string") {
    const replaced = replaceKnownNames(value, redaction.nameReplacements);
    if (replaced !== value) return replaced;
  }
  return "[이름 제외됨]";
}

export function replaceKnownNames(value: string, replacements: Array<[name: string, replacement: string]>) {
  return replacements.reduce(
    (result, [name, replacement]) => result.split(name).join(replacement),
    value,
  );
}

function seatLabel(seat: number) {
  return `${seat}번 플레이어`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
