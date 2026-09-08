import type { GameEvent, GameFile } from "./types.js";

export type CanonicalUndoUnit = {
  id: string;
  eventIds: string[];
  summary: string;
};

export type LiveUndoTarget = CanonicalUndoUnit & { events: GameEvent[] };
export function inferCanonicalUndoUnits(events: GameEvent[]): CanonicalUndoUnit[] { return events.map(event => ({ id: event.id, eventIds: [event.id], summary: event.summary })); }



export function latestCanonicalUndoUnit(gameFile: GameFile): CanonicalUndoUnit | undefined {
  const unit = inferCanonicalUndoUnits(gameFile.game.events).at(-1);
  if (!unit || unit.eventIds.includes(gameFile.game.events[0]?.id ?? "")) return undefined;
  return unit;
}

export function removeLatestCanonicalUndoUnit(
  gameFile: GameFile,
  expectedUnitId: string,
): { gameFile: GameFile; removed: CanonicalUndoUnit } | undefined {
  const removed = latestCanonicalUndoUnit(gameFile);
  if (!removed || removed.id !== expectedUnitId) return undefined;
  const removedIds = new Set(removed.eventIds);
  return {
    removed,
    gameFile: {
      ...gameFile,
      game: {
        ...gameFile.game,
        updatedAt: new Date().toISOString(),
        events: gameFile.game.events.filter(({ id }) => !removedIds.has(id)),
      },
    } as GameFile,
  };
}
