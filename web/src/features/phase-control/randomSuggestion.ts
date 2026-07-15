import type { PhaseStepConfirmation } from "../../core/types";

export type ChoiceTokenSource = () => number;

export const browserCryptoChoiceToken: ChoiceTokenSource = () => {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0];
};

export function suggestionRequestFingerprint(
  derivedContextFingerprint: string,
  confirmation: PhaseStepConfirmation,
): string {
  return JSON.stringify([derivedContextFingerprint, confirmation]);
}
