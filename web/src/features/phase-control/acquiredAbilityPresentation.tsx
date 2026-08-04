import type { ReactNode } from "react";
import type { AbilityGrant, PhaseStep, Player } from "../../core/types";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import { sectsAndVioletsCharacterDetail } from "../../characterDetails";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";
import "./sectsAndVioletsInformationTask.css";

/**
 * Returns true when the ability being presented belongs to a different
 * character than the actor's actual identity.  This is intentionally based
 * on the two ids only: a Philosopher grant is not a special-case character
 * presentation and the same rule applies to every acquired ability.
 */
export function isAcquiredAbility(
  actorCharacterId: string | undefined,
  abilityCharacterId: string | undefined,
): abilityCharacterId is string {
  return Boolean(actorCharacterId && abilityCharacterId && actorCharacterId !== abilityCharacterId);
}

/** Resolve the acquired ability represented by a canonical phase step. */
export function acquiredAbilityCharacterForStep(
  step: { abilityUse?: PhaseStep["abilityUse"]; character?: string } | null | undefined,
  actor: Pick<Player, "id" | "actualCharacter"> | null | undefined,
  abilityGrants: readonly Pick<AbilityGrant, "ownerPlayerId" | "characterId">[] = [],
): string | undefined {
  const projectedGrant = step?.character && actor
    ? abilityGrants.find((grant) => (
        grant.ownerPlayerId === actor.id && grant.characterId === step.character
      ))
    : undefined;
  const abilityCharacterId = step?.abilityUse?.characterId ?? projectedGrant?.characterId;
  return isAcquiredAbility(actor?.actualCharacter, abilityCharacterId) ? abilityCharacterId : undefined;
}

export type AcquiredAbilityPresentationProps = {
  actor: Player;
  abilityCharacterId: string;
  theme?: "light" | "snv-day" | "snv-night";
  actorRoleName?: string;
  actorPlayerLabel?: string;
  actorPlayerNode?: ReactNode;
  actorRoleNode?: ReactNode;
  abilityNameNode?: ReactNode;
  actorIdentityClassName?: string;
  abilityClassName?: string;
  abilitySummary?: string;
};

/**
 * Shared acquired-ability identity presentation.
 *
 * The component deliberately renders nothing for a self-selection (or an
 * otherwise non-acquired ability), so callers can use it as a data-driven
 * guard without introducing character-specific branches.
 */
export function AcquiredAbilityPresentation({
  actor,
  abilityCharacterId,
  theme = "snv-night",
  actorRoleName,
  actorPlayerLabel,
  actorPlayerNode,
  actorRoleNode,
  abilityNameNode,
  actorIdentityClassName = "snvCurrentStepIdentity interactive snvInformationIdentity issue107ActorIdentity",
  abilityClassName = "issue107AbilityResult interactive",
  abilitySummary,
}: AcquiredAbilityPresentationProps) {
  if (!isAcquiredAbility(actor.actualCharacter, abilityCharacterId)) return null;

  const actorCharacter = sectsAndVioletsCharacters.find((candidate) => candidate.id === actor.actualCharacter);
  const acquiredCharacter = sectsAndVioletsCharacters.find((candidate) => candidate.id === abilityCharacterId);
  const actorAsset = sectsAndVioletsCharacterAsset(actor.actualCharacter);
  const acquiredAsset = sectsAndVioletsCharacterAsset(abilityCharacterId);
  const resolvedActorRoleName = actorRoleName ?? actorCharacter?.name ?? actor.actualCharacter;
  const resolvedAbilityName = acquiredCharacter?.name ?? abilityCharacterId;
  const resolvedAbilitySummary = abilitySummary ?? acquiredCharacter?.ability;

  return (
    <>
      <CharacterDetailButton
        details={sectsAndVioletsCharacterDetail(actor.actualCharacter)}
        className={actorIdentityClassName}
        theme={theme}
      >
        {actorAsset ? <img src={actorAsset.src} alt={`${resolvedActorRoleName} 공식 캐릭터 아이콘`} /> : null}
        <div>
          {actorRoleNode ?? <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{resolvedActorRoleName}</span>}
          {actorPlayerNode ?? <strong>{actorPlayerLabel ?? actor.name}</strong>}
        </div>
      </CharacterDetailButton>
      <CharacterDetailButton
        details={sectsAndVioletsCharacterDetail(abilityCharacterId)}
        className={abilityClassName}
        theme={theme}
      >
        <span>획득한 능력</span>
        {acquiredAsset ? <img src={acquiredAsset.src} alt={`${resolvedAbilityName} 공식 캐릭터 아이콘`} /> : null}
        <div>{abilityNameNode ?? <strong>{resolvedAbilityName}</strong>}{resolvedAbilitySummary ? <p>{resolvedAbilitySummary}</p> : null}</div>
      </CharacterDetailButton>
    </>
  );
}
