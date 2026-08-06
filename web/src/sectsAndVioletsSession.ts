import type {
  GameFile,
} from "./core/types.js";
import { inferCanonicalUndoUnits } from "./core/canonicalUndo.js";

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

export function exportLatestSectsAndVioletsCheckpoint(
  gameFile: GameFile,
  phaseCheckpoints: SectsAndVioletsPhaseCheckpoint[],
): GameFile {
  const latest = phaseCheckpoints.at(-1);
  const eventCount = latest?.eventCount ?? 0;
  return {
    ...gameFile,
    game: {
      ...gameFile.game,
      events: gameFile.game.events.slice(0, eventCount),
    },
  };
}

export function latestUndoableSectsAndVioletsCheckpoint(
  gameFile: GameFile,
): SectsAndVioletsPhaseCheckpoint | undefined {
  const checkpoints = inferSectsAndVioletsCheckpoints(gameFile, "play");
  for (let index = checkpoints.length - 1; index >= 0; index -= 1) {
    if (checkpoints[index].kind === "phase") return checkpoints[index];
  }
  return undefined;
}

export function removeLatestSectsAndVioletsPhaseCheckpoint(
  gameFile: GameFile,
): { gameFile: GameFile; removed: SectsAndVioletsPhaseCheckpoint } | undefined {
  const checkpoints = inferSectsAndVioletsCheckpoints(gameFile, "play");
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
    gameFile: nextGameFile,
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
