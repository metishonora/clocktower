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
  const target = typeof value.targetPlayerId === "string" && value.targetPlayerId.trim().length > 0;
  const effect = typeof value.effective === "boolean";
  const day = Number.isInteger(value.day) && (value.day as number) >= 1 && (value.day as number) <= 65535;
  switch (value.kind) {
    case "simulationChoice": return hasExactKeys(value, ["kind", "characterId", "spent"]) && (value.characterId === null || isKnownCharacter(value.characterId)) && typeof value.spent === "boolean";
    case "redHerringAssigned": case "twinAssigned": return hasExactKeys(value, ["kind", "targetPlayerId"]) && target;
    case "shownCharacterAssigned": return hasExactKeys(value, ["kind", "characterId"]) && isKnownCharacter(value.characterId);
    case "poisoner": case "butler": return hasExactKeys(value, ["kind", "targetPlayerId", "day", "effective"]) && target && day && effect;
    case "twinInformed": return hasExactKeys(value, ["kind", "relationshipEventId", "targetPlayerId", "effective"]) && textId(value.relationshipEventId) && target && effect;
    case "mutantJudgment": return hasExactKeys(value,["kind","result"]) && ["clear","violation"].includes(String(value.result));
    case "mutantExecution": return hasExactKeys(value, ["kind", "execute", "executed", "died"]) && [value.execute, value.executed, value.died].every(v => typeof v === "boolean");
    case "informationPrepared": {
      const p = value.preparation;
      return hasExactKeys(value, ["kind", "preparation"]) && isRecord(p) && hasExactKeys(p, ["information", "correctPlayerId"]) &&
        (p.correctPlayerId === null || textId(p.correctPlayerId)) && isCustomInformationResult(p.information, isKnownCharacter, isSpyGrimoirePlayer);
    }
    case "preparedInformationDelivered": return hasExactKeys(value, ["kind", "preparationEventId", "information", "spent"]) && textId(value.preparationEventId) &&
      isCustomActionResult({kind: "informationDelivered", information: value.information, spent: value.spent}, isKnownCharacter, isSpyGrimoirePlayer);

    case "philosopherDeferred": case "seamstressDeferred": return hasExactKeys(value, ["kind"]);
    case "philosopherChoice": return hasExactKeys(value, ["kind", "characterId", "outcome"]) && isKnownCharacter(value.characterId) && ["acquired", "selfDrunk", "failed"].includes(value.outcome as string);
    case "snakeCharmer": return hasExactKeys(value, ["kind", "targetPlayerId", "outcome"]) && target && ["swapped", "impaired", "notDemon"].includes(value.outcome as string);
    case "evilTwin": return hasExactKeys(value, ["kind", "targetPlayerId", "effective"]) && target && effect;
    case "witch": return hasExactKeys(value, ["kind", "targetPlayerId", "day", "effective"]) && target && day && effect;
    case "cerenovus": return hasExactKeys(value, ["kind", "targetPlayerId", "characterId", "day", "effective"]) && target && day && effect && isKnownCharacter(value.characterId);
    case "informationDelivered": case "simulation": {
      if (!hasExactKeys(value, ["kind", "information", "spent"]) || typeof value.spent !== "boolean") return false;
      if (value.kind === "simulation" && value.information === null) return true;
      const info = value.information;
      if (!isRecord(info) || !Object.keys(info).every(key => ["actor", "targetPlayerIds", "computedResult", "deliveredResult", "deliveryContext"].includes(key))) return false;
      return Array.isArray(info.targetPlayerIds) && info.targetPlayerIds.every(isString) &&
        isCustomInformationResult(info.deliveredResult, isKnownCharacter, isSpyGrimoirePlayer) &&
        (info.computedResult === undefined || isCustomInformationResult(info.computedResult, isKnownCharacter, isSpyGrimoirePlayer)) &&
        (info.actor === undefined || (isRecord(info.actor) && hasExactKeys(info.actor, ["playerId", "characterId"]) && typeof info.actor.playerId === "string" && isKnownCharacter(info.actor.characterId))) &&
        isCustomDeliveryContext(info.deliveryContext, isKnownCharacter);
    }
  }
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

function isCustomDeliveryContext(value: unknown, known: KnownCharacterPredicate): boolean {
  if (!isRecord(value)) return false;
  if (value.type === "fixed") return hasExactKeys(value, ["type"]);
  return value.type === "discretionary" && hasExactKeys(value, ["type", "reasons"]) &&
    Array.isArray(value.reasons) && value.reasons.every(reason => {
      if (!isRecord(reason)) return false;
      switch (reason.type) {
        case "abilityChoice": case "drunk": return hasExactKeys(reason, ["type"]);
        case "poisoned": return hasExactKeys(reason, ["type", "poisonerPlayerId", "poisonEventId"]) && typeof reason.poisonerPlayerId === "string" && typeof reason.poisonEventId === "string";
        case "vortox": return hasExactKeys(reason, ["type", "demonPlayerId"]) && typeof reason.demonPlayerId === "string";
        case "registrationJudgment": return hasExactKeys(reason, ["type", "judgments"]) && Array.isArray(reason.judgments) && reason.judgments.every(j =>
          isRecord(j) && Object.keys(j).every(key => ["playerId", "registeredAs", "characterId", "scope"].includes(key)) && (j.scope === undefined || (isRecord(j.scope) && hasExactKeys(j.scope, ["kind", "playerIds"]) && j.scope.kind === "adjacentPair" && Array.isArray(j.scope.playerIds) && j.scope.playerIds.length === 2 && j.scope.playerIds.every(id => typeof id === "string" && id.trim().length > 0) && j.scope.playerIds[0] !== j.scope.playerIds[1])) &&
          typeof j.playerId === "string" && ["good", "evil", "townsfolk", "outsider", "minion", "demon"].includes(j.registeredAs as string) &&
          (j.characterId === undefined || known(j.characterId)));
        default: return false;
      }
    });
}

function textId(v: unknown): v is string { return typeof v === "string" && v.trim().length > 0; }
export function isActionCause(v: unknown): boolean {
  if (!isRecord(v)) return false;
  switch (v.kind) {
    case "initialPreparation": return hasExactKeys(v, ["kind", "sourceEventId"]) && textId(v.sourceEventId);
    case "requiredPreparation": return hasExactKeys(v, ["kind", "triggerEventId", "previousPreparationEventId"]) && textId(v.triggerEventId) && (v.previousPreparationEventId === null || textId(v.previousPreparationEventId));
    case "delivery": return hasExactKeys(v, ["kind", "preparationEventId"]) && textId(v.preparationEventId);
    case "optional": return hasExactKeys(v, ["kind", "prefixEventId"]) && textId(v.prefixEventId);
    default: return false;
  }
}
export function isGuidanceCause(v: unknown): boolean {
  if (!isRecord(v)) return false;
  return v.kind === "choice" ? hasExactKeys(v, ["kind", "parentEventId"]) && textId(v.parentEventId) :
    (v.kind === "initialDrunk" || v.kind === "acquiredDrunk") && hasExactKeys(v, ["kind"]);
}
export function isCustomGameEnd(v: unknown): boolean {
  return isRecord(v) && hasExactKeys(v, ["winningAlignment", "reason", "sourceEventId"]) &&
    (v.winningAlignment === "good" || v.winningAlignment === "evil") && v.reason === "goodTwinExecuted" && textId(v.sourceEventId);
}
