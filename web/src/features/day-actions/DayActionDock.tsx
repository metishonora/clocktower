import {ArtistForm,SavantForm,JugglerForm} from '../../shared-ui/DayAbilityForms';
import { useEffect, useState } from "react";
import type {
  ArtistAnswer,
  ActiveImpairment,
  AvailableDayAction,
  ConfirmedDayActionRecord,
  DayActionRecordInput,
  DeliveryReason,
  Player,
} from "../../core/types";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import { sectsAndVioletsCharacterDetail } from "../../characterDetails";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";
import {
  AcquiredAbilityPresentation,
  isAcquiredAbility,
} from "../phase-control/acquiredAbilityPresentation";
import { visibleImpairmentsForPlayer } from "../phase-control/ImpairmentBadges";
import "./dayActionDock.css";

export function DayActionDock({
  players,
  availableActions,
  activeImpairments,
  phaseLabel,
  busy,
  groupActive = true,
  onGroupActivate = noop,
  onGroupDeactivate = noop,
  onConfirm,
}: {
  players: Player[];
  availableActions: AvailableDayAction[];
  activeImpairments?: readonly ActiveImpairment[];
  phaseLabel: string;
  busy: boolean;
  groupActive?: boolean;
  onGroupActivate?: () => void;
  onGroupDeactivate?: () => void;
  onConfirm: (action: AvailableDayAction, record: DayActionRecordInput) => void;
}) {
  const [activeKey, setActiveKey] = useState<string>();
  const selectedAction = availableActions.find((action) => actionKey(action) === activeKey);
  const activeAction = groupActive ? selectedAction : undefined;

  useEffect(() => {
    if (activeKey && (!selectedAction || !groupActive)) setActiveKey(undefined);
  }, [activeKey, groupActive, selectedAction]);

  if (availableActions.length === 0) return null;

  const activePlayer = activeAction
    ? players.find((player) => player.id === activeAction.actorPlayerId)
    : undefined;
  const informationInfluence = activeAction
    ? primaryInformationInfluence(activeAction.activeReasons)
    : undefined;
  const actorImpairment = activePlayer
    ? visibleImpairmentsForPlayer(activeImpairments, activePlayer.id)[0]
    : undefined;
  const displayedInfluence = informationInfluence ?? actorImpairment;

  return (
    <>
      <div className={`snvDayActionScrollClearance${activeAction ? " open" : ""}`} aria-hidden="true" />
      {activeAction && activePlayer ? (
        <section
          className={`snvDayActionPanel snvDayActionPanel--${activeAction.characterId}`}
          role="dialog"
          aria-label={`${characterLabel(activeAction.characterId)} 능력 사용`}
        >
          <DayActionHeader action={activeAction} player={activePlayer} phaseLabel={phaseLabel} influence={displayedInfluence} />
          {activeAction.characterId === "artist" ? (
            <ArtistForm influence={informationInfluence} busy={busy} onComplete={(record) => onConfirm(activeAction, record)} />
          ) : activeAction.characterId === "savant" ? (
            <SavantForm influence={informationInfluence} busy={busy} onComplete={(record) => onConfirm(activeAction, record)} />
          ) : (
            <JugglerForm busy={busy} onComplete={(record) => onConfirm(activeAction, record)} />
          )}
        </section>
      ) : null}
      <div className="snvDayActionDock" aria-label="사용 가능한 낮 자유 행동">
        {availableActions.map((action) => {
          const player = players.find((candidate) => candidate.id === action.actorPlayerId);
          if (!player) return null;
          const selected = groupActive && actionKey(action) === activeKey;
          const asset = sectsAndVioletsCharacterAsset(action.characterId);
          const label = characterLabel(action.characterId);
          return (
            <button
              key={actionKey(action)}
              type="button"
              className={selected ? "selected" : ""}
              aria-label={selected ? `${label} 행동 창 닫기` : `${label} 행동 열기, ${player.seat}번 ${player.name}`}
              aria-expanded={selected}
              disabled={busy}
              onClick={() => {
                if (selected) {
                  setActiveKey(undefined);
                  onGroupDeactivate();
                } else {
                  onGroupActivate();
                  setActiveKey(actionKey(action));
                }
              }}
            >
              {selected ? <span aria-hidden="true">×</span> : asset ? <img src={asset.src} alt={`${label} 공식 캐릭터 아이콘`} /> : <span aria-hidden="true">{label.slice(0, 1)}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function noop() {}

function DayActionHeader({ action, player, phaseLabel, influence }: {
  action: AvailableDayAction;
  player: Player;
  phaseLabel: string;
  influence?: InformationInfluence;
}) {
  const label = characterLabel(action.characterId);
  const actorLabel = characterLabel(player.actualCharacter);
  const asset = sectsAndVioletsCharacterAsset(action.characterId);
  const ability = sectsAndVioletsCharacters.find((character) => character.id === action.characterId)?.ability;
  const acquiredAbility = isAcquiredAbility(action.abilityOrigin);
  if (acquiredAbility) {
    return (
      <header className="snvDayActionHeader">
        <AcquiredAbilityPresentation
          actor={player}
          abilityCharacterId={action.characterId}
          abilityOrigin={action.abilityOrigin}
          actorPlayerNode={<span>{phaseLabel} · {player.seat}번 {player.name}</span>}
          actorRoleNode={<span className="snvDayActionRoleLine"><h2>{actorLabel}</h2></span>}
          abilityNameNode={<span className="snvDayActionRoleLine"><strong>{label}</strong>{influence ? <em className={`snvInformationInfluenceBadge ${influence}`}>{informationInfluencePresentation[influence].badge}</em> : null}</span>}
          actorIdentityClassName="snvDayActionIdentity"
          abilityClassName="snvDayActionAcquiredResult issue107AbilityResult interactive"
          theme="snv-day"
        />
      </header>
    );
  }
  return (
    <header className="snvDayActionHeader">
      <CharacterDetailButton
        details={sectsAndVioletsCharacterDetail(action.characterId)}
        className="snvDayActionIdentity"
        theme="snv-day"
      >
        {asset ? <img src={asset.src} alt={`${label} 공식 캐릭터 아이콘`} /> : null}
        <div>
          <span>{phaseLabel} · {player.seat}번 {player.name}</span>
          <span className="snvDayActionRoleLine">
            <h2>{label}</h2>
            {influence ? <em className={`snvInformationInfluenceBadge ${influence}`}>{informationInfluencePresentation[influence].badge}</em> : null}
          </span>
        </div>
      </CharacterDetailButton>
      {ability ? <p>{ability}</p> : null}
    </header>
  );
}

export function DayActionRecordHistory({ records }: { records: ConfirmedDayActionRecord[] }) {
  const historyRecords = records.filter((entry) => entry.record.kind !== "juggler");
  if (historyRecords.length === 0) return null;
  return (
    <section className="snvDayActionHistory" aria-label="낮 자유 행동 기록">
      <h3>낮 자유 행동 기록</h3>
      <ol>{historyRecords.map((entry) => (
        <li key={entry.eventId}>
          <span>{dayActionDayLabel(entry.dayId)}</span>
          {entry.record.kind === "artist" ? <><strong>화가</strong>{entry.record.question ? <p>{entry.record.question}</p> : null}<em>답변 · {artistAnswerLabel(entry.record.answer)} · {truthLabel(entry.record.truthful)}</em></> : null}
          {entry.record.kind === "savant" ? <><strong>백치천재</strong><ul>{entry.record.statements.map((statement, index) => <li key={index}>{statement.text || "미입력"} · {truthLabel(statement.truthful)}</li>)}</ul></> : null}
        </li>
      ))}</ol>
    </section>
  );
}

export function dayActionDayLabel(dayId: string): string {
  const match = /^day(\d*)$/.exec(dayId);
  const cycle = match?.[1] ? Number(match[1]) : 1;
  return `${cycle + 1}일차 낮`;
}

function artistAnswerLabel(answer: ArtistAnswer): string {
  if (answer === "yes") return "O";
  if (answer === "no") return "X";
  return "?";
}

type InformationInfluence = "drunk" | "poisoned" | "vortox";

const informationInfluencePresentation: Record<InformationInfluence, { badge: string }> = {
  drunk: { badge: "취함" },
  poisoned: { badge: "중독" },
  vortox: { badge: "보르톡스" },
};

function primaryInformationInfluence(reasons: DeliveryReason[]): InformationInfluence | undefined {
  if (reasons.some((reason) => reason.type === "vortox")) return "vortox";
  if (reasons.some((reason) => reason.type === "poisoned")) return "poisoned";
  return reasons.some((reason) => reason.type === "drunk") ? "drunk" : undefined;
}

function truthLabel(truthful: boolean): string { return truthful ? "진실" : "거짓"; }

function characterLabel(characterId: string): string {
  return sectsAndVioletsCharacters.find((character) => character.id === characterId)?.name ?? characterId;
}

function actionKey(action: AvailableDayAction): string {
  return `${action.dayId}:${action.actorPlayerId}:${action.characterId}`;
}
