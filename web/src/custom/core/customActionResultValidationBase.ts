import type { CustomActionResult, InformationResult } from "./types.js";

export type KnownCharacterPredicate = (value: unknown) => value is string;
export type SpyGrimoirePlayerPredicate = (value: unknown) => boolean;

/**
 * Validate the production custom action result boundary.  Fixture builds replace this small
 * module in their dedicated Vitest config, while all of the surrounding event and game-file
 * parsers stay shared with production.
 */
export function isCustomActionResult(
  value: unknown,
  isKnownCharacter: KnownCharacterPredicate,
  isSpyGrimoirePlayer: SpyGrimoirePlayerPredicate,
): value is CustomActionResult {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "noEffect") return hasExactKeys(value, ["kind"]);
  return value.kind === "information" &&
    hasExactKeys(value, ["kind", "value"]) &&
    isCustomInformationResult(value.value, isKnownCharacter, isSpyGrimoirePlayer);
}

export function isCustomInformationResult(
  value: unknown,
  isKnownCharacter: KnownCharacterPredicate,
  isSpyGrimoirePlayer: SpyGrimoirePlayerPredicate,
): value is InformationResult {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "number":
      return hasExactKeys(value, ["kind", "value"]) &&
        typeof value.value === "number" &&
        Number.isSafeInteger(value.value) &&
        value.value >= 0 && value.value <= Number.MAX_SAFE_INTEGER;
    case "boolean":
      return hasExactKeys(value, ["kind", "value"]) && typeof value.value === "boolean";
    case "character":
      return hasExactKeys(value, ["kind", "characterId"]) && isKnownCharacter(value.characterId);
    case "characterPair":
      return hasExactKeys(value, ["kind", "characterIds"]) &&
        Array.isArray(value.characterIds) &&
        value.characterIds.length === 2 &&
        value.characterIds.every(isKnownCharacter);
    case "player":
      return hasExactKeys(value, ["kind", "playerId"]) && typeof value.playerId === "string";
    case "playerPair":
      return hasExactKeys(value, ["kind", "playerIds"]) &&
        Array.isArray(value.playerIds) &&
        value.playerIds.length === 2 &&
        value.playerIds.every(isString) &&
        new Set(value.playerIds).size === 2;
    case "setupInfo":
      return (
        (hasExactKeys(value, ["kind", "playerIds", "characterId", "zeroOutsiders"]) ||
          hasExactKeys(value, ["kind", "playerIds", "zeroOutsiders"])) &&
        Array.isArray(value.playerIds) &&
        value.playerIds.every(isString) &&
        (value.characterId === undefined || isKnownCharacter(value.characterId)) &&
        typeof value.zeroOutsiders === "boolean"
      );
    case "teamInfo":
      return hasExactKeys(value, ["kind", "demonPlayerIds", "minionPlayerIds", "bluffCharacterIds"]) &&
        Array.isArray(value.demonPlayerIds) && value.demonPlayerIds.every(isString) &&
        Array.isArray(value.minionPlayerIds) && value.minionPlayerIds.every(isString) &&
        Array.isArray(value.bluffCharacterIds) && value.bluffCharacterIds.every(isKnownCharacter);
    case "spyGrimoire":
      return hasExactKeys(value, ["kind", "players"]) &&
        Array.isArray(value.players) && value.players.every(isSpyGrimoirePlayer);
    default:
      return false;
  }
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
