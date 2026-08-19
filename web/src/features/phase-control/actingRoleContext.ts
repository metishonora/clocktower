import type { AbilityOrigin, AbilityUseRef, PhaseStep, Player } from "../../core/types.js";

type ActingRoleStep = Partial<Pick<PhaseStep, "abilityUse" | "abilityOrigin" | "character" | "playerId">>;

export type AbilityContext = {
  owner: Pick<Player, "id" | "actualCharacter">;
  abilityUse: AbilityUseRef;
  origin: AbilityOrigin;
};

export function isAcquiredAbility(origin: AbilityOrigin | undefined): origin is Extract<AbilityOrigin, { kind: "acquired" }> {
  return origin?.kind === "acquired";
}

export function abilityContextForStep(
  step: ActingRoleStep | null | undefined,
  actor: Pick<Player, "id" | "actualCharacter"> | null | undefined,
): AbilityContext | undefined {
  if (!step?.abilityUse || !step.abilityOrigin || !actor) return undefined;
  if (step.playerId !== actor.id || step.abilityUse.ownerPlayerId !== actor.id) return undefined;
  if (step.character !== step.abilityUse.characterId) return undefined;
  if (step.abilityOrigin.kind === "acquired" && step.abilityOrigin.source.ownerPlayerId !== actor.id) return undefined;
  return { owner: actor, abilityUse: step.abilityUse, origin: step.abilityOrigin };
}

/** Resolve the acquired ability represented by a canonical phase step. */
export function acquiredAbilityCharacterForStep(
  step: ActingRoleStep | null | undefined,
  actor: Pick<Player, "id" | "actualCharacter"> | null | undefined,
): string | undefined {
  const context = abilityContextForStep(step, actor);
  return context && isAcquiredAbility(context.origin) ? context.abilityUse.characterId : undefined;
}

export type AbilityPresentationRelation =
  | {
      kind: "acquired";
      abilityCharacterId: string;
      abilityOrigin: Extract<AbilityOrigin, { kind: "acquired" }>;
    }
  | {
      kind: "shown";
      abilityCharacterId: string;
    };

/**
 * Resolve the identity/ability relationship represented by a phase step.
 *
 * Acquired abilities use explicit replay provenance. TB setup roles predate
 * that provenance, so a shown ability is derived from the structural identity
 * relationship: the step acts as the player's shown character while the
 * canonical identity differs.
 */
export function abilityPresentationForStep(
  step: ActingRoleStep | null | undefined,
  actor: Pick<Player, "id" | "actualCharacter" | "shownCharacter"> | null | undefined,
): AbilityPresentationRelation | undefined {
  if (!step || !actor) return undefined;

  const context = abilityContextForStep(step, actor);
  if (context && isAcquiredAbility(context.origin)) {
    return {
      kind: "acquired",
      abilityCharacterId: context.abilityUse.characterId,
      abilityOrigin: context.origin,
    };
  }

  if (step.playerId !== actor.id) return undefined;

  const shownCharacterId = actor.shownCharacter;
  if (
    shownCharacterId
    && shownCharacterId !== actor.actualCharacter
    && step.character === shownCharacterId
  ) {
    return { kind: "shown", abilityCharacterId: shownCharacterId };
  }

  return undefined;
}
