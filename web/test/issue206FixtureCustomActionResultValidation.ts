import type { CustomActionResult } from "../src/core/types.js";
import {
  isCustomActionResult as isProductionCustomActionResult,
  isCustomInformationResult,
  type KnownCharacterPredicate,
  type SpyGrimoirePlayerPredicate,
} from "../src/core/customActionResultValidationBase.js";

type FixtureCustomActionResult = CustomActionResult | {
  kind: "fixtureAbilityGranted";
  targetCharacterId: string;
} | {
  kind: "fixtureIdentityChanged";
  playerId: string;
  targetCharacterId: string;
} | {
  kind: "fixtureAbilityRemoved";
  ownerPlayerId: string;
  characterId: string;
  abilityInstanceId: string;
} | {
  kind: "fixtureLifeChanged";
  playerId: string;
  alive: boolean;
} | {
  kind: "fixtureImpairmentAdded";
  playerId: string;
  impairmentKind: "poisoned" | "drunk";
} | {
  kind: "fixtureImpairmentRemoved";
  playerId: string;
  impairmentKind: "poisoned" | "drunk";
  sourceEventId: string;
  sourceCharacterId: string;
  expires: "never" | "whileSourceAbilityActive";
};

export function isCustomActionResult(
  value: unknown,
  isKnownCharacter: KnownCharacterPredicate,
  isSpyGrimoirePlayer: SpyGrimoirePlayerPredicate,
): value is FixtureCustomActionResult {
  if (isProductionCustomActionResult(value, isKnownCharacter, isSpyGrimoirePlayer)) return true;
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "fixtureAbilityGranted":
      return hasExactKeys(value, ["kind", "targetCharacterId"]) &&
        typeof value.targetCharacterId === "string";
    case "fixtureIdentityChanged":
      return hasExactKeys(value, ["kind", "playerId", "targetCharacterId"]) &&
        typeof value.playerId === "string" && typeof value.targetCharacterId === "string";
    case "fixtureAbilityRemoved":
      return hasExactKeys(value, ["kind", "ownerPlayerId", "characterId", "abilityInstanceId"]) &&
        typeof value.ownerPlayerId === "string" && typeof value.characterId === "string" &&
        typeof value.abilityInstanceId === "string";
    case "fixtureLifeChanged":
      return hasExactKeys(value, ["kind", "playerId", "alive"]) &&
        typeof value.playerId === "string" && typeof value.alive === "boolean";
    case "fixtureImpairmentAdded":
      return hasExactKeys(value, ["kind", "playerId", "impairmentKind"]) &&
        typeof value.playerId === "string" && isImpairmentKind(value.impairmentKind);
    case "fixtureImpairmentRemoved":
      return hasExactKeys(value, [
        "kind",
        "playerId",
        "impairmentKind",
        "sourceEventId",
        "sourceCharacterId",
        "expires",
      ]) &&
        typeof value.playerId === "string" &&
        isImpairmentKind(value.impairmentKind) &&
        typeof value.sourceEventId === "string" &&
        typeof value.sourceCharacterId === "string" &&
        isImpairmentExpiry(value.expires);
    default:
      return false;
  }
}

export { isCustomInformationResult };

function isImpairmentKind(value: unknown): value is "poisoned" | "drunk" {
  return value === "poisoned" || value === "drunk";
}

function isImpairmentExpiry(value: unknown): value is "never" | "whileSourceAbilityActive" {
  return value === "never" || value === "whileSourceAbilityActive";
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
