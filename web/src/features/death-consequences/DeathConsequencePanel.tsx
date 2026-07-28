import { useEffect, useMemo, useState } from "react";
import type { ActiveImpairment, PendingDeathConsequence, PendingForcedGameEnd, Player } from "../../core/types";

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
  onChooseSweetheartTarget = () => undefined,
}: {
  pending: PendingDeathConsequence;
  players: Player[];
  activeImpairments?: ActiveImpairment[];
  operationBusy: boolean;
  onResolve: (resolution: DeathConsequenceResolution) => void;
  onChooseSweetheartTarget?: () => void;
}) {
  const [targetPlayerId, setTargetPlayerId] = useState("");
  const [secondTargetPlayerId, setSecondTargetPlayerId] = useState("");
  const [chooserDemonPlayerId, setChooserDemonPlayerId] = useState("");
  useEffect(() => {
    setTargetPlayerId("");
    setSecondTargetPlayerId("");
    setChooserDemonPlayerId(pending.eligibleChooserPlayerIds.length === 1
      ? pending.eligibleChooserPlayerIds[0] ?? ""
      : "");
  }, [pending.stepId, pending.eligibleChooserPlayerIds]);

  const allowed = useMemo(
    () => pending.allowedPlayerIds
      .map((id) => players.find((player) => player.id === id))
      .filter((player): player is Player => Boolean(player))
      .sort((left, right) => left.seat - right.seat),
    [pending.allowedPlayerIds, players],
  );
  const actor = players.find((player) => player.id === pending.actorPlayerId);
  const barberNoEffect = pending.kind === "barber" && (
    pending.actorImpairedAtTrigger
    || pending.eligibleChooserPlayerIds.length === 0
    || actor?.actualCharacter !== "barber"
    || actor.abilityInstance?.id !== pending.sourceAbilityInstanceId
    || activeImpairments.some((impairment) => impairment.playerId === pending.actorPlayerId)
  );

  if (pending.kind === "klutz") {
    return (
      <article className="snvCurrentStep issue116CurrentStep snvDayStep" role="group" aria-label="얼뜨기 공개 선택">
        <h3>얼뜨기 선택</h3>
        <div className="deathConsequencePublicPlayers">
          {allowed.map((player) => (
            <button
              key={player.id}
              type="button"
              className={targetPlayerId === player.id ? "selected" : "secondary"}
              aria-pressed={targetPlayerId === player.id}
              disabled={operationBusy}
              onClick={() => setTargetPlayerId(player.id)}
            >{publicPlayerLabel(player)}</button>
          ))}
        </div>
        <div className="snvStepActions">
          <button
            type="button"
            disabled={operationBusy || !targetPlayerId}
            onClick={() => onResolve({ targetPlayerId })}
          >선택 확정</button>
        </div>
      </article>
    );
  }

  if (pending.kind === "sweetheart") {
    return (
      <article className="snvCurrentStep issue116CurrentStep" role="group" aria-label="사랑꾼 취함 지정">
        <h3>사랑꾼</h3>
        <div className="snvStepActions">
          {pending.actorImpairedAtTrigger ? (
            <button type="button" disabled={operationBusy} onClick={() => onResolve({})}>효과 없음 확정</button>
          ) : (
            <button type="button" disabled={operationBusy} onClick={onChooseSweetheartTarget}>마도서에서 취함 대상 선택</button>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="snvCurrentStep issue116CurrentStep" role="group" aria-label="이발사 직업 교환">
      <h3>이발사</h3>
      {barberNoEffect ? (
        <div className="snvStepActions">
          <button
            type="button"
            disabled={operationBusy}
            onClick={() => onResolve({ decision: { kind: "decline" } })}
          >효과 없음 확정</button>
        </div>
      ) : (
        <>
          <PlayerSelect
            label="결정할 악마"
            value={chooserDemonPlayerId}
            players={pending.eligibleChooserPlayerIds
              .map((id) => players.find((player) => player.id === id))
              .filter((player): player is Player => Boolean(player))}
            disabled={operationBusy}
            onChange={setChooserDemonPlayerId}
          />
          <PlayerSelect label="첫 번째 플레이어" value={targetPlayerId} players={allowed} disabled={operationBusy} onChange={setTargetPlayerId} />
          <PlayerSelect label="두 번째 플레이어" value={secondTargetPlayerId} players={allowed} disabled={operationBusy} onChange={setSecondTargetPlayerId} />
          <div className="snvStepActions">
            <button
              type="button"
              className="secondary"
              disabled={operationBusy || !chooserDemonPlayerId}
              onClick={() => onResolve({
                chooserDemonPlayerId,
                decision: { kind: "decline" },
              })}
            >교환하지 않음</button>
            <button
              type="button"
              disabled={operationBusy || !chooserDemonPlayerId || !targetPlayerId
                || !secondTargetPlayerId || targetPlayerId === secondTargetPlayerId}
              onClick={() => onResolve({
                chooserDemonPlayerId,
                decision: { kind: "swap", playerIds: [targetPlayerId, secondTargetPlayerId] },
              })}
            >직업 교환</button>
          </div>
        </>
      )}
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

function PlayerSelect({ label, value, players, disabled, onChange }: {
  label: string;
  value: string;
  players: Player[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="snvMadnessCharacterChoice">
      {label}
      <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">선택</option>
        {players.map((player) => <option key={player.id} value={player.id}>{publicPlayerLabel(player)}</option>)}
      </select>
    </label>
  );
}

function publicPlayerLabel(player: Player) {
  return `${player.seat}번 ${player.name} · ${player.alive ? "생존" : "사망"}`;
}
