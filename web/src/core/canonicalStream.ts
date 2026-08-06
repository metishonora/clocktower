import type { GameEvent, GameFile, ReplayState } from "./types.js";

export function replayCaughtUp(
  gameFile: GameFile,
  replayState: ReplayState | undefined,
): boolean {
  return replayState?.eventCount === gameFile.game.events.length;
}

export function appendCanonicalEvent(gameFile: GameFile, event: GameEvent): GameFile {
  if (gameFile.game.events.some((candidate) => candidate.id === event.id)) {
    throw new Error(`중복 이벤트 ID: ${event.id}`);
  }
  return {
    ...gameFile,
    game: {
      ...gameFile.game,
      updatedAt: new Date().toISOString(),
      events: [...gameFile.game.events, event],
    },
  };
}
