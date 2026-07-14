import type { Proposal, RevealPayload } from "./types.js";

export function proposalRevealPayload(proposal?: Proposal): RevealPayload | undefined {
  if (!proposal?.revealPayload) return undefined;
  return isRevealPayload(proposal.revealPayload) ? proposal.revealPayload : undefined;
}

export function isRevealPayload(value: unknown): value is RevealPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  if (!nonEmptyString(payload.messageKo)) return false;
  if (!optionalNonEmptyString(payload.previewMessageKo)) return false;
  if (!optionalNonEmptyString(payload.labelKo) || !optionalNonEmptyString(payload.valueKo)) return false;
  return (payload.labelKo === undefined) === (payload.valueKo === undefined);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalNonEmptyString(value: unknown): boolean {
  return value === undefined || nonEmptyString(value);
}
