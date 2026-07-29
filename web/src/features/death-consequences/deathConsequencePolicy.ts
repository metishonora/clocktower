import type { Command, PendingDeathConsequence } from "../../core/types.js";

export type DeathConsequenceResolution = {
  targetPlayerId?: string;
  chooserDemonPlayerId?: string;
  decision?: { kind: "decline" } | { kind: "swap"; playerIds: [string, string] };
};

export function deathConsequenceIsNoEffect(pending: PendingDeathConsequence): boolean {
  return pending.actorImpairedAtTrigger
    || (pending.kind === "barber" && pending.eligibleChooserPlayerIds.length === 0);
}

export function deathConsequenceCommand(
  pending: PendingDeathConsequence,
  resolution: DeathConsequenceResolution,
  expectedEventCount: number,
): Command {
  const common = { stepId: pending.stepId, expectedEventCount };
  if (pending.kind === "sweetheart") {
    return {
      type: "resolveSweetheartConsequence",
      payload: { ...common, targetPlayerId: resolution.targetPlayerId },
    };
  }
  if (pending.kind === "barber") {
    return {
      type: "resolveBarberConsequence",
      payload: {
        ...common,
        chooserDemonPlayerId: resolution.chooserDemonPlayerId,
        decision: resolution.decision,
      },
    };
  }
  return {
    type: "resolveKlutzConsequence",
    payload: { ...common, targetPlayerId: resolution.targetPlayerId },
  };
}
