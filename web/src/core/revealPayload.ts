import type { CharacterChangeRevealPayload, EvilTwinPairRevealPayload, MadnessAssignmentRevealPayload, Proposal, RevealPayload, RoleInformationRevealPayload, SpyGrimoireRevealPayload } from "./types.js";
import { characters } from "../setupDraft.js";
import { sectsAndVioletsCharacters } from "../sectsAndVioletsCharacters.js";

const characterIds = new Set([
  ...characters.map((character) => character.id),
  ...sectsAndVioletsCharacters.map((character) => character.id),
]);
const spyPayloadKeys = ["kind", "players"];
const spyPlayerKeys = [
  "alive",
  "characterId",
  "ghostVoteUsed",
  "name",
  "playerId",
  "reminderTokens",
  "seat",
];

export function proposalRevealPayload(proposal?: Proposal): RevealPayload | undefined {
  if (!proposal?.revealPayload) return undefined;
  return isRevealPayload(proposal.revealPayload) ? proposal.revealPayload : undefined;
}

export function isRevealPayload(value: unknown): value is RevealPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  if ("kind" in payload) return isSpyGrimoireRevealPayload(payload) || isRoleInformationRevealPayload(payload) || isEvilTwinPairRevealPayload(payload);
  if (!nonEmptyString(payload.messageKo)) return false;
  if (!optionalNonEmptyString(payload.previewMessageKo)) return false;
  if (!optionalNonEmptyString(payload.labelKo) || !optionalNonEmptyString(payload.valueKo)) return false;
  return (payload.labelKo === undefined) === (payload.valueKo === undefined);
}

export function isEvilTwinPairRevealPayload(value: unknown): value is EvilTwinPairRevealPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  if (payload.kind !== "evilTwinPair" || !hasExactKeys(payload, ["kind", "players"]) || !Array.isArray(payload.players) || payload.players.length !== 2) return false;
  const playerIds = new Set<string>();
  return payload.players.every((value) => {
    if (!value || typeof value !== "object") return false;
    const player = value as Record<string, unknown>;
    if (!hasExactKeys(player, ["alignment", "characterId", "name", "playerId", "seat"])) return false;
    if (!nonEmptyString(player.playerId) || playerIds.has(player.playerId) || !Number.isInteger(player.seat) || (player.seat as number) <= 0 || !nonEmptyString(player.name) || !nonEmptyString(player.characterId) || !characterIds.has(player.characterId) || (player.alignment !== "good" && player.alignment !== "evil")) return false;
    playerIds.add(player.playerId);
    return true;
  }) && new Set(payload.players.map((value) => (value as { alignment: string }).alignment)).size === 2;
}

export function isCharacterChangeRevealPayload(value: unknown): value is CharacterChangeRevealPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return payload.kind === "characterChange" && nonEmptyString(payload.characterId) && characterIds.has(payload.characterId)
    && nonEmptyString(payload.playerId)
    && (payload.alignment === "good" || payload.alignment === "evil")
    && hasExactKeys(payload, ["alignment", "characterId", "kind", "playerId"]);
}

export function isMadnessAssignmentRevealPayload(value: unknown): value is MadnessAssignmentRevealPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return payload.kind === "madnessAssignment"
    && nonEmptyString(payload.characterId) && characterIds.has(payload.characterId)
    && nonEmptyString(payload.playerId)
    && hasExactKeys(payload, ["characterId", "kind", "playerId"]);
}

export function isRoleInformationRevealPayload(value: unknown): value is RoleInformationRevealPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  if (payload.kind === "characterChange") return isCharacterChangeRevealPayload(payload);
  if (payload.kind === "minionInformation") {
    return hasExactKeys(payload, ["demonPlayers", "kind", "minionPlayers"])
      && isRevealIdentities(payload.demonPlayers)
      && isRevealIdentities(payload.minionPlayers);
  }
  if (payload.kind === "demonInformation") {
    return hasExactKeys(payload, ["bluffCharacterIds", "kind", "minionPlayers"])
      && isRevealIdentities(payload.minionPlayers)
      && Array.isArray(payload.bluffCharacterIds)
      && payload.bluffCharacterIds.length <= 3
      && new Set(payload.bluffCharacterIds).size === payload.bluffCharacterIds.length
      && payload.bluffCharacterIds.every((characterId) => typeof characterId === "string" && characterIds.has(characterId));
  }
  if (payload.kind === "numericInformation") {
    return ["chef", "empath", "clockmaker", "oracle", "juggler"].includes(String(payload.characterId))
      && Number.isInteger(payload.value) && (payload.value as number) >= 0
      && hasExactKeys(payload, ["characterId", "kind", "value"]);
  }
  if (payload.kind === "booleanInformation") {
    return (payload.characterId === "flowergirl" || payload.characterId === "townCrier")
      && typeof payload.value === "boolean"
      && hasExactKeys(payload, ["characterId", "kind", "value"]);
  }
  if (payload.kind === "fortuneTellerInformation") {
    return hasExactKeys(payload, ["hasDemon", "kind", "targetPlayers"])
      && typeof payload.hasDemon === "boolean" && isRevealPlayers(payload.targetPlayers, 2);
  }
  if (payload.kind === "characterInformation") {
    return (payload.characterId === "undertaker" || payload.characterId === "ravenkeeper")
      && characterIds.has(payload.revealedCharacterId as string)
      && isRevealPlayer(payload.targetPlayer)
      && hasExactKeys(payload, ["characterId", "kind", "revealedCharacterId", "targetPlayer"]);
  }
  if (payload.kind === "dreamerInformation") {
    return hasExactKeys(payload, ["characterIds", "kind"])
      && Array.isArray(payload.characterIds) && payload.characterIds.length === 2
      && payload.characterIds.every((id) => typeof id === "string" && characterIds.has(id));
  }
  if (payload.kind === "seamstressInformation") {
    return hasExactKeys(payload, ["kind", "sameAlignment", "targetPlayers"])
      && typeof payload.sameAlignment === "boolean" && isRevealPlayers(payload.targetPlayers, 2);
  }
  if (payload.kind === "sageInformation") {
    return hasExactKeys(payload, ["candidatePlayers", "kind"])
      && isRevealPlayers(payload.candidatePlayers, 2);
  }
  if (payload.kind === "setupInformation") {
    const setupCharacter = payload.characterId === "washerwoman" || payload.characterId === "librarian" || payload.characterId === "investigator";
    if (!setupCharacter || typeof payload.zeroOutsiders !== "boolean" || !Array.isArray(payload.candidatePlayers)) return false;
    if (payload.zeroOutsiders) {
      return payload.characterId === "librarian" && payload.candidatePlayers.length === 0
        && payload.revealedCharacterId === undefined
        && hasExactKeys(payload, ["candidatePlayers", "characterId", "kind", "zeroOutsiders"]);
    }
    return isRevealPlayers(payload.candidatePlayers, 2)
      && characterIds.has(payload.revealedCharacterId as string)
      && hasExactKeys(payload, ["candidatePlayers", "characterId", "kind", "revealedCharacterId", "zeroOutsiders"]);
  }
  return false;
}

function isRevealIdentities(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  let priorSeat = 0;
  return value.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const identity = entry as Record<string, unknown>;
    if (!hasExactKeys(identity, ["name", "seat"])) return false;
    if (!Number.isInteger(identity.seat) || (identity.seat as number) <= priorSeat || !nonEmptyString(identity.name)) return false;
    priorSeat = identity.seat as number;
    return true;
  });
}

function isRevealPlayers(value: unknown, count: number): boolean {
  return Array.isArray(value) && value.length === count && value.every(isRevealPlayer)
    && new Set(value.map((player) => (player as Record<string, unknown>).playerId)).size === count;
}

function isRevealPlayer(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const player = value as Record<string, unknown>;
  return hasExactKeys(player, ["name", "playerId", "seat"])
    && nonEmptyString(player.playerId) && Number.isInteger(player.seat) && (player.seat as number) > 0
    && nonEmptyString(player.name);
}

export function isSpyGrimoireRevealPayload(value: unknown): value is SpyGrimoireRevealPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  if (
    payload.kind !== "spyGrimoire" ||
    !hasExactKeys(payload, spyPayloadKeys) ||
    !Array.isArray(payload.players) ||
    payload.players.length === 0
  ) {
    return false;
  }
  let priorSeat = 0;
  const playerIds = new Set<string>();
  return payload.players.every((value) => {
    if (!value || typeof value !== "object") return false;
    const player = value as Record<string, unknown>;
    if (!hasExactKeys(player, spyPlayerKeys)) return false;
    if (
      !nonEmptyString(player.playerId) ||
      playerIds.has(player.playerId) ||
      !Number.isInteger(player.seat) ||
      (player.seat as number) <= priorSeat ||
      !nonEmptyString(player.name) ||
      !nonEmptyString(player.characterId) ||
      !characterIds.has(player.characterId) ||
      typeof player.alive !== "boolean" ||
      typeof player.ghostVoteUsed !== "boolean" ||
      !isOrderedReminderTokens(player.reminderTokens)
    ) {
      return false;
    }
    playerIds.add(player.playerId);
    priorSeat = player.seat as number;
    return true;
  });
}

function isOrderedReminderTokens(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > 2) return false;
  const expected = ["poisoned", "protected"];
  let expectedIndex = 0;
  for (const token of value) {
    while (expectedIndex < expected.length && expected[expectedIndex] !== token) expectedIndex += 1;
    if (expectedIndex >= expected.length) return false;
    expectedIndex += 1;
  }
  return true;
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalNonEmptyString(value: unknown): boolean {
  return value === undefined || nonEmptyString(value);
}
