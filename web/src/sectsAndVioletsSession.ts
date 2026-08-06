import type {
  GameFile,
  SectsAndVioletsPhaseCheckpoint,
  SectsAndVioletsSessionState,
  SectsAndVioletsSetupSession,
  SectsAndVioletsTab,
} from "./core/types.js";
import { inferCanonicalUndoUnits } from "./core/canonicalUndo.js";

const tabs: SectsAndVioletsTab[] = ["roles", "seating", "play", "storage"];
const demons: SectsAndVioletsSetupSession["demon"][] = [
  "fangGu",
  "vigormortis",
  "noDashii",
  "vortox",
];
const characterIds = new Set([
  "clockmaker", "dreamer", "snakeCharmer", "mathematician", "flowergirl", "townCrier",
  "oracle", "savant", "seamstress", "philosopher", "artist", "juggler", "sage", "mutant",
  "sweetheart", "barber", "klutz", "evilTwin", "witch", "cerenovus", "pitHag", "fangGu",
  "vigormortis", "noDashii", "vortox",
]);

export function withSectsAndVioletsSession(
  gameFile: GameFile,
  session: SectsAndVioletsSessionState,
): GameFile {
  return {
    ...gameFile,
    ui: {
      ...gameFile.ui,
      sectsAndVioletsSession: structuredClone(session),
    },
  };
}

export function exportLatestSectsAndVioletsCheckpoint(gameFile: GameFile): GameFile {
  const session = gameFile.ui?.sectsAndVioletsSession;
  if (!session) return gameFile;
  const latest = session.phaseCheckpoints.at(-1);
  const eventCount = latest?.eventCount ?? 0;
  const phaseCheckpoints = session.phaseCheckpoints.filter(
    (checkpoint) => checkpoint.eventCount <= eventCount,
  );
  return withSectsAndVioletsSession(
    {
      ...gameFile,
      game: {
        ...gameFile.game,
        events: gameFile.game.events.slice(0, eventCount),
      },
    },
    {
      ...session,
      activeTab: latest?.activeTab ?? "roles",
      phaseCheckpoints,
    },
  );
}

export function latestUndoableSectsAndVioletsCheckpoint(
  gameFile: GameFile,
): SectsAndVioletsPhaseCheckpoint | undefined {
  const checkpoints = gameFile.ui?.sectsAndVioletsSession?.phaseCheckpoints
    ?? inferSectsAndVioletsCheckpoints(gameFile, "play");
  for (let index = checkpoints.length - 1; index >= 0; index -= 1) {
    if (checkpoints[index].kind === "phase") return checkpoints[index];
  }
  return undefined;
}

export function removeLatestSectsAndVioletsPhaseCheckpoint(
  gameFile: GameFile,
): { gameFile: GameFile; removed: SectsAndVioletsPhaseCheckpoint } | undefined {
  const session = gameFile.ui?.sectsAndVioletsSession;
  const checkpoints = session?.phaseCheckpoints ?? inferSectsAndVioletsCheckpoints(gameFile, "play");
  let removeIndex = -1;
  for (let index = checkpoints.length - 1; index >= 0; index -= 1) {
    if (checkpoints[index].kind === "phase") {
      removeIndex = index;
      break;
    }
  }
  if (removeIndex < 0) return undefined;
  const removed = checkpoints[removeIndex];
  const previousEventCount = checkpoints[removeIndex - 1]?.eventCount ?? 0;
  const phaseCheckpoints = checkpoints.slice(0, removeIndex);
  const removedEventIds = removed.eventIds ? new Set(removed.eventIds) : undefined;
  const nextGameFile: GameFile = {
    ...gameFile,
    game: {
      ...gameFile.game,
      updatedAt: new Date().toISOString(),
      events: removedEventIds
        ? gameFile.game.events.filter((event) => !removedEventIds.has(event.id))
        : gameFile.game.events.slice(0, previousEventCount),
    },
  };
  return {
    removed,
    gameFile: session
      ? withSectsAndVioletsSession(nextGameFile, { ...session, phaseCheckpoints })
      : nextGameFile,
  };
}

export function inferSectsAndVioletsCheckpoints(
  gameFile: GameFile,
  activeTab: SectsAndVioletsTab,
): SectsAndVioletsPhaseCheckpoint[] {
  return inferCanonicalUndoUnits(gameFile.game.events).map((unit) => {
    const firstIndex = gameFile.game.events.findIndex((event) => event.id === unit.eventIds[0]);
    const lastIndex = gameFile.game.events.findIndex((event) => event.id === unit.eventIds.at(-1));
    const isSetup = firstIndex === 0 && gameFile.game.events[0]?.type === "setupConfirmed";
    return {
      id: unit.id,
      eventIds: unit.eventIds,
      kind: isSetup ? "setup" : "phase",
      eventCount: lastIndex + 1,
      summary: unit.summary,
      activeTab: isSetup ? "seating" : activeTab,
    };
  });
}

export function parseSectsAndVioletsSessionState(
  value: unknown,
  eventCount: number,
): SectsAndVioletsSessionState {
  if (!isRecord(value) || value.version !== 1 || !isTab(value.activeTab)) throw invalidSession();
  if (
    typeof value.savedAt !== "string" ||
    Number.isNaN(Date.parse(value.savedAt)) ||
    !isRecord(value.setup)
  ) {
    throw invalidSession();
  }
  const setup = parseSetup(value.setup);
  if (!Array.isArray(value.phaseCheckpoints)) throw invalidSession();
  const phaseCheckpoints = value.phaseCheckpoints.map(parseCheckpoint);
  let madnessJudgments: Record<string, "clear" | "violation"> | undefined;
  if (value.madnessJudgments !== undefined) {
    if (
      !isRecord(value.madnessJudgments) ||
      !Object.values(value.madnessJudgments).every(
        (judgment) => judgment === "clear" || judgment === "violation",
      )
    ) {
      throw invalidSession();
    }
    madnessJudgments = Object.fromEntries(
      Object.entries(value.madnessJudgments) as [string, "clear" | "violation"][],
    );
  }
  let previousEventCount = 0;
  for (const checkpoint of phaseCheckpoints) {
    if (checkpoint.eventCount <= previousEventCount || checkpoint.eventCount > eventCount) {
      throw invalidSession();
    }
    previousEventCount = checkpoint.eventCount;
  }
  if (
    eventCount > 0 && (
      !setup.seatingConfirmed ||
      phaseCheckpoints[0]?.kind !== "setup" ||
      phaseCheckpoints[0].eventCount !== 1
    )
  ) {
    throw invalidSession();
  }
  return {
    version: 1,
    activeTab: value.activeTab,
    savedAt: value.savedAt,
    setup,
    phaseCheckpoints,
    ...(madnessJudgments ? { madnessJudgments } : {}),
  };
}

function parseSetup(value: Record<string, unknown>): SectsAndVioletsSetupSession {
  if (
    !Number.isInteger(value.playerCount) ||
    Number(value.playerCount) < 7 ||
    Number(value.playerCount) > 15 ||
    !isDemon(value.demon) ||
    !Array.isArray(value.selectedIds) ||
    !value.selectedIds.every((id) => typeof id === "string") ||
    !isRecord(value.seatAssignments) ||
    !isRecord(value.seatAlignments) ||
    !isRecord(value.seatNames) ||
    typeof value.rosterConfirmed !== "boolean" ||
    typeof value.seatingConfirmed !== "boolean"
  ) {
    throw invalidSession();
  }
  const playerCount = Number(value.playerCount);
  const selectedIds = [...value.selectedIds];
  const seatAssignments = parseSeatRecord(value.seatAssignments, playerCount, isString);
  const seatAlignments = parseSeatRecord(value.seatAlignments, playerCount, isAlignment);
  const seatNames = parseSeatRecord(value.seatNames, playerCount, isString);
  if (
    selectedIds.length > playerCount ||
    new Set(selectedIds).size !== selectedIds.length ||
    !selectedIds.every((id) => characterIds.has(id)) ||
    !selectedIds.includes(value.demon) ||
    Object.values(seatAssignments).some((id) => !selectedIds.includes(id)) ||
    new Set(Object.values(seatAssignments)).size !== Object.keys(seatAssignments).length ||
    (value.rosterConfirmed && selectedIds.length !== playerCount) ||
    (value.seatingConfirmed && (
      !value.rosterConfirmed || Object.keys(seatAssignments).length !== playerCount
    ))
  ) {
    throw invalidSession();
  }
  return {
    playerCount,
    demon: value.demon,
    selectedIds,
    seatAssignments,
    seatAlignments,
    seatNames,
    rosterConfirmed: value.rosterConfirmed,
    seatingConfirmed: value.seatingConfirmed,
  };
}

function parseCheckpoint(value: unknown): SectsAndVioletsPhaseCheckpoint {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    (value.kind !== "setup" && value.kind !== "phase") ||
    !Number.isInteger(value.eventCount) ||
    Number(value.eventCount) < 1 ||
    typeof value.summary !== "string" ||
    !isTab(value.activeTab) ||
    (value.eventIds !== undefined && (
      !Array.isArray(value.eventIds) ||
      value.eventIds.length === 0 ||
      !value.eventIds.every((eventId) => typeof eventId === "string") ||
      new Set(value.eventIds).size !== value.eventIds.length
    ))
  ) {
    throw invalidSession();
  }
  return {
    id: value.id,
    ...(value.eventIds ? { eventIds: [...value.eventIds] as string[] } : {}),
    kind: value.kind,
    eventCount: Number(value.eventCount),
    summary: value.summary,
    activeTab: value.activeTab,
  };
}

function parseSeatRecord<T>(
  value: Record<string, unknown>,
  playerCount: number,
  predicate: (candidate: unknown) => candidate is T,
): Record<number, T> {
  const parsed: Record<number, T> = {};
  for (const [seatKey, candidate] of Object.entries(value)) {
    const seat = Number(seatKey);
    if (!Number.isInteger(seat) || seat < 1 || seat > playerCount || !predicate(candidate)) {
      throw invalidSession();
    }
    parsed[seat] = candidate;
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTab(value: unknown): value is SectsAndVioletsTab {
  return tabs.includes(value as SectsAndVioletsTab);
}

function isDemon(value: unknown): value is SectsAndVioletsSetupSession["demon"] {
  return demons.includes(value as SectsAndVioletsSetupSession["demon"]);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isAlignment(value: unknown): value is "good" | "evil" {
  return value === "good" || value === "evil";
}

function invalidSession(): Error {
  return new Error("Sects & Violets 저장 상태가 올바르지 않습니다.");
}
