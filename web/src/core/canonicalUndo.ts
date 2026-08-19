import type { GameEvent, GameFile } from "./types.js";

export type CanonicalUndoUnit = {
  id: string;
  eventIds: string[];
  summary: string;
};

export type LiveUndoTarget = CanonicalUndoUnit & { events: GameEvent[] };

export function inferCanonicalUndoUnits(events: GameEvent[]): CanonicalUndoUnit[] {
  return events.reduce<CanonicalUndoUnit[]>((units, event, index) => {
    const unit: CanonicalUndoUnit = {
      id: event.id,
      eventIds: [event.id],
      summary: event.summary,
    };
    if (event.type === "setupConfirmed" && index === 0) {
      units.push(unit);
      return units;
    }

    const nominationEventId = event.type === "nominationVoteConfirmed"
      ? event.payload.nominationEventId
      : undefined;
    if (nominationEventId && units.at(-1)?.id === nominationEventId) {
      const nomination = units.pop()!;
      units.push({
        ...unit,
        id: nomination.id,
        eventIds: [...nomination.eventIds, event.id],
      });
      return units;
    }

    const sourceEventId = event.type === "gameEnded"
      ? event.payload.source?.sourceEventId
      : deathConfirmationSourceEventId(events, event, index);
    if (sourceEventId) {
      const sourceIndex = units.findIndex(({ eventIds }) => eventIds.includes(sourceEventId));
      if (sourceIndex >= 0) {
        const source = units[sourceIndex];
        const groupedEventIds = units
          .slice(sourceIndex)
          .flatMap(({ eventIds }) => eventIds);
        units.splice(sourceIndex);
        units.push({
          ...unit,
          id: source.id,
          eventIds: [...groupedEventIds, event.id],
        });
        return units;
      }
    }

    units.push(unit);
    return units;
  }, []);
}

function deathConfirmationSourceEventId(
  events: GameEvent[],
  event: GameEvent,
  eventIndex: number,
): string | undefined {
  if (event.type !== "deathConfirmed" || !event.payload.stepId) return undefined;

  for (let index = eventIndex - 1; index >= 0; index -= 1) {
    const candidate = events[index];
    if (
      event.payload.stepId.endsWith(":slayerDeath")
      && candidate?.type === "slayerAbilityUsed"
      && candidate.payload.outcome.kind === "deathPending"
      && candidate.payload.outcome.playerId === event.payload.playerId
      && `${candidate.payload.discussionStepId}:slayerDeath` === event.payload.stepId
    ) return candidate.id;
    if (
      event.payload.stepId.endsWith(":executionDeath")
      && candidate?.type === "executionConfirmed"
      && candidate.payload.input.execute
      && candidate.payload.input.playerId === event.payload.playerId
      && `${candidate.payload.stepId}Death` === event.payload.stepId
    ) return candidate.id;
  }
  return undefined;
}

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
    },
  };
}
