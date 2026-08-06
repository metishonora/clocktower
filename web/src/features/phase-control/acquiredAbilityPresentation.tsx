import type { ReactNode } from "react";
import type { AbilityOrigin, AbilityUseRef, PhaseStep, Player } from "../../core/types";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import { sectsAndVioletsCharacterDetail } from "../../characterDetails";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";
import "./sectsAndVioletsInformationTask.css";

export type AbilityContext = {
  owner: Pick<Player, "id" | "actualCharacter">;
  abilityUse: AbilityUseRef;
  origin: AbilityOrigin;
};

export function isAcquiredAbility(origin: AbilityOrigin | undefined): origin is Extract<AbilityOrigin, { kind: "acquired" }> {
  return origin?.kind === "acquired";
}

export function abilityContextForStep(
  step: Pick<PhaseStep, "abilityUse" | "abilityOrigin"> | null | undefined,
  actor: Pick<Player, "id" | "actualCharacter"> | null | undefined,
): AbilityContext | undefined {
  if (!step?.abilityUse || !step.abilityOrigin || !actor) return undefined;
  if (step.abilityUse.ownerPlayerId !== actor.id) return undefined;
  if (step.abilityOrigin.kind === "acquired" && step.abilityOrigin.source.ownerPlayerId !== actor.id) return undefined;
  return { owner: actor, abilityUse: step.abilityUse, origin: step.abilityOrigin };
}

/** Resolve the acquired ability represented by a canonical phase step. */
export function acquiredAbilityCharacterForStep(
  step: Pick<PhaseStep, "abilityUse" | "abilityOrigin"> | null | undefined,
  actor: Pick<Player, "id" | "actualCharacter"> | null | undefined,
): string | undefined {
  const context = abilityContextForStep(step, actor);
  return isAcquiredAbility(context?.origin) ? context.abilityUse.characterId : undefined;
}

export type AcquiredAbilityPresentationProps = {
  actor: Player;
  abilityCharacterId: string;
  abilityOrigin: AbilityOrigin;
  theme?: "light" | "snv-day" | "snv-night";
  actorRoleName?: string;
  actorPlayerLabel?: string;
  actorPlayerNode?: ReactNode;
  actorRoleNode?: ReactNode;
  abilityNameNode?: ReactNode;
  abilityStatusNode?: ReactNode;
  actorIdentityClassName?: string;
  abilityClassName?: string;
  abilitySummary?: string;
};

type AbilityOwnerIdentityProps = Pick<
  AcquiredAbilityPresentationProps,
  | "actor"
  | "theme"
  | "actorRoleName"
  | "actorPlayerLabel"
  | "actorPlayerNode"
  | "actorRoleNode"
  | "actorIdentityClassName"
>;

export function AbilityOwnerIdentity({
  actor,
  theme = "snv-night",
  actorRoleName,
  actorPlayerLabel,
  actorPlayerNode,
  actorRoleNode,
  actorIdentityClassName = "snvCurrentStepIdentity interactive snvInformationIdentity issue107ActorIdentity",
}: AbilityOwnerIdentityProps) {
  const character = sectsAndVioletsCharacters.find((candidate) => candidate.id === actor.actualCharacter);
  const asset = sectsAndVioletsCharacterAsset(actor.actualCharacter);
  const roleName = actorRoleName ?? character?.name ?? actor.actualCharacter;
  return (
    <CharacterDetailButton
      details={sectsAndVioletsCharacterDetail(actor.actualCharacter)}
      className={actorIdentityClassName}
      theme={theme}
    >
      {asset ? <img src={asset.src} alt={`${roleName} 공식 캐릭터 아이콘`} /> : null}
      <div>
        {actorRoleNode ?? <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{roleName}</span>}
        {actorPlayerNode ?? <strong>{actorPlayerLabel ?? actor.name}</strong>}
      </div>
    </CharacterDetailButton>
  );
}

type ActingAbilityIdentityProps = Pick<
  AcquiredAbilityPresentationProps,
  | "abilityCharacterId"
  | "theme"
  | "abilityNameNode"
  | "abilityStatusNode"
  | "abilityClassName"
  | "abilitySummary"
>;

export function ActingAbilityIdentity({
  abilityCharacterId,
  theme = "snv-night",
  abilityNameNode,
  abilityStatusNode,
  abilityClassName = "issue107AbilityResult interactive",
  abilitySummary,
}: ActingAbilityIdentityProps) {
  const character = sectsAndVioletsCharacters.find((candidate) => candidate.id === abilityCharacterId);
  const asset = sectsAndVioletsCharacterAsset(abilityCharacterId);
  const name = character?.name ?? abilityCharacterId;
  const summary = abilitySummary ?? character?.ability;
  return (
    <CharacterDetailButton
      details={sectsAndVioletsCharacterDetail(abilityCharacterId)}
      className={abilityClassName}
      theme={theme}
    >
      <span>획득한 능력</span>
      {asset ? <img src={asset.src} alt={`${name} 공식 캐릭터 아이콘`} /> : null}
      <div>{abilityNameNode ?? <strong>{name}</strong>}{abilityStatusNode}{summary ? <p>{summary}</p> : null}</div>
    </CharacterDetailButton>
  );
}

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
  abilityOrigin,
  theme = "snv-night",
  actorRoleName,
  actorPlayerLabel,
  actorPlayerNode,
  actorRoleNode,
  abilityNameNode,
  abilityStatusNode,
  actorIdentityClassName = "snvCurrentStepIdentity interactive snvInformationIdentity issue107ActorIdentity",
  abilityClassName = "issue107AbilityResult interactive",
  abilitySummary,
}: AcquiredAbilityPresentationProps) {
  if (!isAcquiredAbility(abilityOrigin)) return null;

  return (
    <>
      <AbilityOwnerIdentity
        actor={actor}
        theme={theme}
        actorRoleName={actorRoleName}
        actorPlayerLabel={actorPlayerLabel}
        actorPlayerNode={actorPlayerNode}
        actorRoleNode={actorRoleNode}
        actorIdentityClassName={actorIdentityClassName}
      />
      <ActingAbilityIdentity
        abilityCharacterId={abilityCharacterId}
        theme={theme}
        abilityNameNode={abilityNameNode}
        abilityStatusNode={abilityStatusNode}
        abilityClassName={abilityClassName}
        abilitySummary={abilitySummary}
      />
    </>
  );
}
