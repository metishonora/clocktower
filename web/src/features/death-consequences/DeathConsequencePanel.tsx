import type { ActiveImpairment, PendingDeathConsequence, Player } from "../../core/types";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import { sectsAndVioletsCharacterDetail } from "../../characterDetails";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";
import {
  AcquiredAbilityPresentation,
  isAcquiredAbility,
} from "../phase-control/acquiredAbilityPresentation";
import { PlayerImpairmentBadges } from "../phase-control/ImpairmentBadges";
import {
  deathConsequenceIsNoEffect,
  type DeathConsequenceResolution,
} from "./deathConsequencePolicy";

export type { DeathConsequenceResolution } from "./deathConsequencePolicy";

export function DeathConsequencePanel({
  pending,
  players,
  activeImpairments,
  operationBusy,
  onResolve,
  onChooseTarget = () => undefined,
}: {
  pending: PendingDeathConsequence;
  players: Player[];
  activeImpairments?: readonly ActiveImpairment[];
  operationBusy: boolean;
  onResolve: (resolution: DeathConsequenceResolution) => void;
  onChooseTarget?: () => void;
}) {
  const actor = players.find((player) => player.id === pending.actorPlayerId);
  const character = sectsAndVioletsCharacters.find((candidate) => candidate.id === pending.kind);
  const asset = sectsAndVioletsCharacterAsset(pending.kind);
  const noEffect = deathConsequenceIsNoEffect(pending);
  const acquiredAbility = isAcquiredAbility(pending.abilityOrigin);

  return (
    <article
      className={`snvCurrentStep issue116CurrentStep snvDeathConsequence${pending.stepId.startsWith("day") ? " snvDayStep" : ""}`}
      role="group"
      aria-label={`${character?.name ?? pending.kind} 능력 처리`}
    >
      {acquiredAbility && actor ? <AcquiredAbilityPresentation
        actor={actor}
        abilityCharacterId={pending.kind}
        abilityOrigin={pending.abilityOrigin}
        actorPlayerLabel={`${actor.seat}번 ${actor.name}`}
        abilityStatusNode={<PlayerImpairmentBadges activeImpairments={activeImpairments} playerId={actor.id} />}
        actorIdentityClassName="snvCurrentStepIdentity interactive snvInformationIdentity"
        theme={pending.stepId.startsWith("day") ? "snv-day" : "snv-night"}
      /> : <CharacterDetailButton
        details={sectsAndVioletsCharacterDetail(pending.kind)}
        className="snvCurrentStepIdentity interactive snvInformationIdentity"
        theme={pending.stepId.startsWith("day") ? "snv-day" : "snv-night"}
      >
        {asset ? <img src={asset.src} alt={`${character?.name ?? pending.kind} 공식 캐릭터 아이콘`} /> : null}
        <div>
          <strong>{actor ? `${actor.seat}번 ${actor.name}` : "행동자 없음"}</strong>
          <span className="snvInformationRoleLine">
            <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{character?.name ?? pending.kind}</span>
            <PlayerImpairmentBadges activeImpairments={activeImpairments} playerId={actor?.id} />
          </span>
        </div>
      </CharacterDetailButton>}
      {!acquiredAbility ? <p className="snvInformationAbility">{character?.ability}</p> : null}
      <div className="snvStepActions">
        {noEffect ? (
          <button
            type="button"
            disabled={operationBusy}
            onClick={() => onResolve({})}
          >효과 없음 확정</button>
        ) : (
          <button type="button" disabled={operationBusy} onClick={onChooseTarget}>← 선택</button>
        )}
      </div>
    </article>
  );
}
