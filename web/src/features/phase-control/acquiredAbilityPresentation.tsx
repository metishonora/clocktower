import type { ReactNode } from "react";
import type { AbilityOrigin, Player } from "../../core/types";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import type { CharacterDetail } from "../../characterDetails";
import { sectsAndVioletsCharacterDetail } from "../../characterDetails";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";
import { isAcquiredAbility, type AbilityPresentationRelation } from "./actingRoleContext.js";
export {
  abilityContextForStep,
  acquiredAbilityCharacterForStep,
  isAcquiredAbility,
  type AbilityContext,
} from "./actingRoleContext.js";

export type CharacterPresentation = {
  label: string;
  details?: CharacterDetail;
  icon?: { label: string; src: string };
  ability?: string;
};

export type CharacterPresentationResolver = (characterId: string) => CharacterPresentation | undefined;

export type AcquiredAbilityPresentationProps = {
  actor: Player;
  abilityCharacterId: string;
  abilityOrigin: AbilityOrigin;
  theme?: "light" | "snv-day" | "snv-night" | "tb-day" | "tb-night";
  characterPresentation?: CharacterPresentationResolver;
  actorRoleName?: string;
  actorPlayerLabel?: string;
  actorPlayerNode?: ReactNode;
  actorRoleNode?: ReactNode;
  abilityNameNode?: ReactNode;
  abilityStatusNode?: ReactNode;
  actorIdentityClassName?: string;
  abilityClassName?: string;
  abilityLabel?: string;
  abilityRegionLabel?: string;
  abilityRegionClassName?: string;
  abilitySummary?: string;
};

type AbilityOwnerIdentityProps = Pick<
  AcquiredAbilityPresentationProps,
  | "actor"
  | "theme"
  | "characterPresentation"
  | "actorRoleName"
  | "actorPlayerLabel"
  | "actorPlayerNode"
  | "actorRoleNode"
  | "actorIdentityClassName"
>;

export function AbilityOwnerIdentity({
  actor,
  theme = "snv-night",
  characterPresentation = defaultCharacterPresentation,
  actorRoleName,
  actorPlayerLabel,
  actorPlayerNode,
  actorRoleNode,
  actorIdentityClassName = "snvCurrentStepIdentity interactive snvInformationIdentity issue107ActorIdentity",
}: AbilityOwnerIdentityProps) {
  const character = characterPresentation(actor.actualCharacter);
  const roleName = actorRoleName ?? character?.label ?? actor.actualCharacter;
  return (
    <CharacterDetailButton
      details={character?.details}
      className={actorIdentityClassName}
      theme={theme}
    >
      {character?.icon ? <img src={character.icon.src} alt={`${roleName} 공식 캐릭터 아이콘`} /> : null}
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
  | "characterPresentation"
  | "abilityNameNode"
  | "abilityStatusNode"
  | "abilityClassName"
  | "abilityLabel"
  | "abilityRegionLabel"
  | "abilityRegionClassName"
  | "abilitySummary"
>;

const defaultCharacterPresentation: CharacterPresentationResolver = (characterId) => {
  const character = sectsAndVioletsCharacters.find((candidate) => candidate.id === characterId);
  if (!character) return undefined;
  const asset = sectsAndVioletsCharacterAsset(characterId);
  return {
    label: character.name,
    details: sectsAndVioletsCharacterDetail(characterId),
    icon: asset,
    ability: character.ability,
  };
};

export function ActingAbilityIdentity({
  abilityCharacterId,
  theme = "snv-night",
  characterPresentation = defaultCharacterPresentation,
  abilityNameNode,
  abilityStatusNode,
  abilityClassName = "issue107AbilityResult interactive",
  abilityLabel,
  abilityRegionLabel,
  abilityRegionClassName,
  abilitySummary,
}: ActingAbilityIdentityProps) {
  const character = characterPresentation(abilityCharacterId);
  const name = character?.label ?? abilityCharacterId;
  const summary = abilitySummary ?? character?.ability;
  const identity = (
    <CharacterDetailButton
      details={character?.details}
      className={abilityClassName}
      theme={theme}
    >
      <span>{abilityLabel ?? "획득한 능력"}</span>
      {character?.icon ? <img src={character.icon.src} alt={`${name} 공식 캐릭터 아이콘`} /> : null}
      <div>{abilityNameNode ?? <strong>{name}</strong>}{abilityStatusNode}{summary ? <p>{summary}</p> : null}</div>
    </CharacterDetailButton>
  );
  return abilityRegionLabel ? (
    <section className={abilityRegionClassName} aria-label={`${abilityRegionLabel} · ${name}`}>
      {identity}
    </section>
  ) : identity;
}

export type AbilityPresentationProps = Omit<AcquiredAbilityPresentationProps, "abilityCharacterId" | "abilityOrigin"> & {
  relation: AbilityPresentationRelation;
};

export function AbilityPresentation({ relation, ...props }: AbilityPresentationProps) {
  const abilityLabel = props.abilityLabel ?? (relation.kind === "shown" ? "보여준 직업" : "획득한 능력");
  const abilityRegionLabel = props.abilityRegionLabel ?? (relation.kind === "shown" ? "보여준 직업" : undefined);
  return (
    <>
      <AbilityOwnerIdentity {...props} />
      <ActingAbilityIdentity
        {...props}
        abilityCharacterId={relation.abilityCharacterId}
        abilityLabel={abilityLabel}
        abilityRegionLabel={abilityRegionLabel}
      />
    </>
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
  characterPresentation,
  actorRoleName,
  actorPlayerLabel,
  actorPlayerNode,
  actorRoleNode,
  abilityNameNode,
  abilityStatusNode,
  actorIdentityClassName = "snvCurrentStepIdentity interactive snvInformationIdentity issue107ActorIdentity",
  abilityClassName = "issue107AbilityResult interactive",
  abilityLabel,
  abilityRegionLabel,
  abilityRegionClassName,
  abilitySummary,
}: AcquiredAbilityPresentationProps) {
  if (!isAcquiredAbility(abilityOrigin)) return null;

  return <AbilityPresentation
    actor={actor}
    relation={{ kind: "acquired", abilityCharacterId, abilityOrigin }}
    theme={theme}
    characterPresentation={characterPresentation}
    actorRoleName={actorRoleName}
    actorPlayerLabel={actorPlayerLabel}
    actorPlayerNode={actorPlayerNode}
    actorRoleNode={actorRoleNode}
    abilityNameNode={abilityNameNode}
    abilityStatusNode={abilityStatusNode}
    actorIdentityClassName={actorIdentityClassName}
    abilityClassName={abilityClassName}
    abilityLabel={abilityLabel}
    abilityRegionLabel={abilityRegionLabel}
    abilityRegionClassName={abilityRegionClassName}
    abilitySummary={abilitySummary}
  />;
}
