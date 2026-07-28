import type { ActiveImpairment, PendingDeathConsequence, PendingForcedGameEnd, Player } from "../../core/types";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import { sectsAndVioletsCharacterDetail } from "../../characterDetails";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";

export type DeathConsequenceResolution =
  | { targetPlayerId?: string }
  | {
      chooserDemonPlayerId?: string;
      decision: { kind: "decline" } | { kind: "swap"; playerIds: [string, string] };
    };

export function DeathConsequencePanel({
  pending,
  players,
  activeImpairments = [],
  operationBusy,
  onResolve,
  onChooseTarget = () => undefined,
}: {
  pending: PendingDeathConsequence;
  players: Player[];
  activeImpairments?: ActiveImpairment[];
  operationBusy: boolean;
  onResolve: (resolution: DeathConsequenceResolution) => void;
  onChooseTarget?: () => void;
}) {
  const actor = players.find((player) => player.id === pending.actorPlayerId);
  const character = sectsAndVioletsCharacters.find((candidate) => candidate.id === pending.kind);
  const asset = sectsAndVioletsCharacterAsset(pending.kind);
  const barberNoEffect = pending.kind === "barber" && (
    pending.actorImpairedAtTrigger
    || pending.eligibleChooserPlayerIds.length === 0
    || actor?.actualCharacter !== "barber"
    || actor.abilityInstance?.id !== pending.sourceAbilityInstanceId
    || activeImpairments.some((impairment) => impairment.playerId === pending.actorPlayerId)
  );
  const noEffect = pending.kind === "sweetheart"
    ? pending.actorImpairedAtTrigger
    : pending.kind === "barber" && barberNoEffect;

  return (
    <article
      className={`snvCurrentStep issue116CurrentStep snvDeathConsequence${pending.stepId.startsWith("day") ? " snvDayStep" : ""}`}
      role="group"
      aria-label={`${character?.name ?? pending.kind} 능력 처리`}
    >
      <CharacterDetailButton
        details={sectsAndVioletsCharacterDetail(pending.kind)}
        className="snvCurrentStepIdentity interactive snvInformationIdentity"
        theme={pending.stepId.startsWith("day") ? "snv-day" : "snv-night"}
      >
        {asset ? <img src={asset.src} alt={`${character?.name ?? pending.kind} 공식 캐릭터 아이콘`} /> : null}
        <div>
          <strong>{actor ? `${actor.seat}번 ${actor.name}` : "행동자 없음"}</strong>
          <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{character?.name ?? pending.kind}</span>
        </div>
      </CharacterDetailButton>
      <p className="snvInformationAbility">{character?.ability}</p>
      <div className="snvStepActions">
        {noEffect ? (
          <button
            type="button"
            disabled={operationBusy}
            onClick={() => onResolve(pending.kind === "barber" ? { decision: { kind: "decline" } } : {})}
          >효과 없음 확정</button>
        ) : (
          <button type="button" disabled={operationBusy} onClick={onChooseTarget}>← 선택</button>
        )}
      </div>
    </article>
  );
}

export function ForcedGameEndPanel({ pending, operationBusy, onConfirm }: {
  pending: PendingForcedGameEnd;
  operationBusy: boolean;
  onConfirm: () => void;
}) {
  return (
    <article className="snvCurrentStep issue116CurrentStep snvDayStep" role="group" aria-label="얼뜨기 패배 확정">
      <h3>{pending.winningTeam === "good" ? "선" : "악"} 진영 승리</h3>
      <div className="snvStepActions">
        <button type="button" disabled={operationBusy} onClick={onConfirm}>게임 종료 확정</button>
      </div>
    </article>
  );
}
