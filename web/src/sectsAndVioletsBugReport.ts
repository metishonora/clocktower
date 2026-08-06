import type { GameFile } from "./core/types.js";

export type SectsAndVioletsBugReportEnvironment = {
  appVersion: string;
  buildCommit: string;
  pageUrl: string;
  userAgent: string;
  viewport: { width: number; height: number };
};

export type SectsAndVioletsBugReportInput = {
  gameFile: GameFile;
  symptom: string;
  environment: SectsAndVioletsBugReportEnvironment;
  includeOriginalGameFile?: boolean;
};

export type SectsAndVioletsBugReport = {
  subject: string;
  body: string;
  attachmentJson: string;
  metadata: SectsAndVioletsBugReportMetadata;
};

export type SectsAndVioletsBugReportMetadata = {
  reportSchemaVersion: 1;
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

export function buildSectsAndVioletsBugReport(
  input: SectsAndVioletsBugReportInput,
): SectsAndVioletsBugReport {
  const players = setupPlayers(input.gameFile);
  const redaction = buildPlayerRedaction(players);
  const setup = players.map((player) => ({
    id: player.id,
    seat: player.seat,
    name: seatLabel(player.seat),
    actualCharacter: player.actualCharacter,
    ...(player.shownCharacter ? { shownCharacter: player.shownCharacter } : {}),
  }));
  const events = input.gameFile.game.events.map((event) => sanitizeValue(event, redaction));
  const symptom = replaceKnownNames(input.symptom.trim(), redaction.nameReplacements);
  const metadata: SectsAndVioletsBugReportMetadata = {
    reportSchemaVersion: 1,
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
    reportType: "clocktower.snv.bug-report",
    userReport: { symptom: symptom || null },
    environment: input.environment,
    game: {
      schemaVersion: metadata.schemaVersion,
      scriptId: metadata.scriptId,
      updatedAt: metadata.gameUpdatedAt,
      setup: { players: setup },
      events,
    },
    ...(input.includeOriginalGameFile ? { originalGameFile: input.gameFile } : {}),
  };

  const sections = [
      "# Clocktower S&V 버그 제보",
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
      "[게임 구성]",
      "```json",
      JSON.stringify({ players: setup }, null, 2),
      "```",
      "",
      "[확정 이벤트]",
      "```json",
      JSON.stringify(events, null, 2),
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
    subject: "[Clocktower S&V] 버그 제보",
    body: sections.join("\n"),
    attachmentJson: JSON.stringify(attachment, null, 2),
    metadata,
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

function sanitizeValue(value: unknown, redaction: PlayerRedaction): unknown {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, redaction));
  if (!isRecord(value)) return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === "createdAt") continue;
    if (key === "notes") {
      sanitized.notesOmitted = true;
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

function replaceKnownNames(value: string, replacements: Array<[string, string]>) {
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
