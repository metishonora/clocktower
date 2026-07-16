import type { NewImpRevealPayload, Proposal, RevealPayload, SpyGrimoireRevealPayload } from "./types.js";
import { characters } from "../setupDraft.js";

const characterIds = new Set(characters.map((character) => character.id));
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
  if ("kind" in payload) return isSpyGrimoireRevealPayload(payload) || isNewImpRevealPayload(payload);
  if (!nonEmptyString(payload.messageKo)) return false;
  if (!optionalNonEmptyString(payload.previewMessageKo)) return false;
  if (!optionalNonEmptyString(payload.labelKo) || !optionalNonEmptyString(payload.valueKo)) return false;
  return (payload.labelKo === undefined) === (payload.valueKo === undefined);
}

export function isNewImpRevealPayload(value: unknown): value is NewImpRevealPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return payload.kind === "newImp" && payload.characterId === "imp" && nonEmptyString(payload.playerId)
    && hasExactKeys(payload, ["characterId", "kind", "playerId"]);
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
