import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { CoreResult, Player, PlayerAnnotationsInput, Proposal, RuleState } from "../../core/types";
import {
  characterLabel,
  seatLayoutPositions,
  type SetupDraft,
} from "../../setupDraft";
import { voteStatusForPlayer } from "../../voting";
import type { NominationDraft } from "../voting/useNominationDraft";
import { CharacterIcon } from "../../components/CharacterIcon";
import { CharacterRulesButton } from "../../components/CharacterRulesCard";
import { PlayerAnnotationsDialog } from "./PlayerAnnotationsDialog";
import { playerAnnotationBadges } from "./playerAnnotations";

export function Grimoire({
  players,
  draft,
  busy,
  centerStatus,
  nominationVoting,
  setupInformationSelection,
  phasePlayerSelection,
  ruleState,
  slayerAbility,
  onUpdatePlayerAnnotations,
}: {
  players: Player[];
  draft: SetupDraft;
  busy: boolean;
  centerStatus?:
    | { kind: "active"; phaseLabel: string; runtime: string }
    | { kind: "ended" };
  nominationVoting?: {
    draft: NominationDraft;
    onChange: (draft: NominationDraft) => void;
  };
  setupInformationSelection?: {
    selectedPlayerIds: string[];
    disabled: boolean;
    onTogglePlayer: (playerId: string) => void;
  };
  phasePlayerSelection?: {
    selectedPlayerIds: string[];
    allowedPlayerIds?: string[];
    disabled: boolean;
    onTogglePlayer: (playerId: string) => void;
  };
  ruleState?: RuleState;
  slayerAbility?: {
    actorPlayerId: string;
    enabled: boolean;
    spent: boolean;
    onUse: (button: HTMLButtonElement) => void;
  };
  onUpdatePlayerAnnotations?: (
    playerId: string,
    annotations: PlayerAnnotationsInput,
  ) => Promise<CoreResult<Proposal> | undefined>;
}) {
  const [editingPlayerId, setEditingPlayerId] = useState<string>();
  const annotationLongPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const annotationLongPressActivated = useRef(false);
  const seats = players.length > 0 ? players : draft.players;
  const fallbackPositions = useMemo(() => seatLayoutPositions(seats.length || 5, "circle"), [seats.length]);
  const editingPlayer = players.find((player) => player.id === editingPlayerId);

  useEffect(() => () => window.clearTimeout(annotationLongPressTimer.current), []);

  function startAnnotationLongPress(event: PointerEvent<HTMLButtonElement>, player?: Player) {
    if (!player || !onUpdatePlayerAnnotations || busy) return;
    annotationLongPressActivated.current = false;
    window.clearTimeout(annotationLongPressTimer.current);
    annotationLongPressTimer.current = window.setTimeout(() => {
      annotationLongPressActivated.current = true;
      setEditingPlayerId(player.id);
    }, 500);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function cancelAnnotationLongPress() {
    window.clearTimeout(annotationLongPressTimer.current);
  }

  return (
    <>
      <div
        className={`seatMap confirmedSeatMap adjustableSeatMap ${
          seats.length >= 12 ? "compactSeats" : ""
        }`}
        aria-label="라이브 마도서 좌석 맵"
      >
        <div
          className={`draftLayoutTableMark ${centerStatus?.kind === "active" ? "hasPhaseRuntime" : ""}`}
          aria-hidden={centerStatus?.kind === "active" ? undefined : true}
        >
          {centerStatus?.kind === "active" ? (
            <strong
              className="phaseRuntimeCenter phaseRuntimeTable"
              aria-label={`${centerStatus.phaseLabel} 경과 시간 ${centerStatus.runtime}`}
            >
              <span>{centerStatus.phaseLabel}</span>
              <b>{centerStatus.runtime}</b>
            </strong>
          ) : "테이블"}
        </div>
        {centerStatus?.kind === "active" ? null : (
          <strong className="mapCenter">
            {centerStatus?.kind === "ended" ? "게임 종료" : "입력 중"}
          </strong>
        )}
        {seats.map((seat) => {
          const virginAbility = ruleState?.virginAbility;
          const confirmedPlayer = "id" in seat ? (seat as Player) : undefined;
          const actualCharacter = "actualCharacter" in seat ? seat.actualCharacter : undefined;
          const shownCharacter = "shownCharacter" in seat ? seat.shownCharacter : undefined;
          const alignment = "alignment" in seat ? seat.alignment : "good";
          const showShownCharacter =
            actualCharacter === "drunk" || Boolean(shownCharacter && actualCharacter !== shownCharacter);
          const position = draft.seatPositions[seat.seat] ?? fallbackPositions[seat.seat];
          const playerId = confirmedPlayer?.id;
          const votingSelected = Boolean(playerId && nominationVoting?.draft.voterIds.includes(playerId));
          const setupInformationSelected = Boolean(
            playerId && setupInformationSelection?.selectedPlayerIds.includes(playerId),
          );
          const phaseSelected = Boolean(playerId && phasePlayerSelection?.selectedPlayerIds.includes(playerId));
          const phaseAllowed = Boolean(
            playerId && (!phasePlayerSelection?.allowedPlayerIds || phasePlayerSelection.allowedPlayerIds.includes(playerId)),
          );
          const voteStatus = confirmedPlayer ? voteStatusForPlayer(confirmedPlayer, votingSelected) : undefined;
          const votingDisabled = busy || !playerId || Boolean(voteStatus?.disabled);
          const setupInformationDisabled =
            busy || !playerId || Boolean(setupInformationSelection?.disabled);
          const phaseSelectionDisabled = busy || !phaseAllowed || Boolean(phasePlayerSelection?.disabled);
          const currentSlayerAbility = playerId === slayerAbility?.actorPlayerId ? slayerAbility : undefined;
          const automaticEdge = position.x < 50 ? "edgeLeft" : "edgeRight";
          const manualBadges = playerAnnotationBadges(confirmedPlayer);

          function toggleVote() {
            if (!playerId || !nominationVoting || votingDisabled) return;
            const voterIds = votingSelected
              ? nominationVoting.draft.voterIds.filter((selectedId) => selectedId !== playerId)
              : [...nominationVoting.draft.voterIds, playerId];
            nominationVoting.onChange({ ...nominationVoting.draft, voterIds });
          }

          function handleSeatClick() {
            if (annotationLongPressActivated.current) {
              annotationLongPressActivated.current = false;
              return;
            }
            if (nominationVoting) {
              toggleVote();
              return;
            }
            if (playerId && setupInformationSelection && !setupInformationDisabled) {
              setupInformationSelection.onTogglePlayer(playerId);
              return;
            }
            if (playerId && phasePlayerSelection && !phaseSelectionDisabled) {
              phasePlayerSelection.onTogglePlayer(playerId);
            }
          }

          return (
            <div className="seatTokenSlot" key={seat.seat}>
              <button
                type="button"
                className={`seatToken confirmedSeatToken adjustableSeatToken ${alignment} ${
                  votingSelected ? "selected voteSelected" : ""
                } ${nominationVoting ? "votingEnabled" : ""} ${
                  voteStatus?.className ?? ""
                } ${setupInformationSelected ? "selected setupInformationSelected" : ""} ${
                  setupInformationSelection ? "setupInformationEnabled" : ""
                } ${phaseSelected ? "selected phasePlayerSelected" : ""} ${phasePlayerSelection ? "phasePlayerEnabled" : ""} ${
                  confirmedPlayer?.notes ? "hasAnnotationNotes" : ""
                }`}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                onClick={handleSeatClick}
                onPointerDown={(event) => startAnnotationLongPress(event, confirmedPlayer)}
                onPointerUp={cancelAnnotationLongPress}
                onPointerCancel={cancelAnnotationLongPress}
                onPointerLeave={cancelAnnotationLongPress}
                aria-label={`${seat.seat}번 ${seat.name} ${nominationVoting ? "투표 선택" : "좌석 선택"}${
                  voteStatus ? ` · ${voteStatus.label}` : ""
                }`}
                aria-disabled={
                  nominationVoting
                    ? votingDisabled
                    : setupInformationSelection
                      ? setupInformationDisabled
                      : phasePlayerSelection
                        ? phaseSelectionDisabled
                        : true
                }
                aria-pressed={
                  nominationVoting
                    ? votingSelected
                    : setupInformationSelection
                      ? setupInformationSelected
                      : phasePlayerSelection
                        ? phaseSelected
                        : undefined
                }
              >
                <CharacterIcon characterId={actualCharacter} className="seatCharacterIcon" />
                <span className="seatTokenNumber">{seat.seat}</span>
                <strong>{seat.name}</strong>
                <small>{characterLabel(actualCharacter)}</small>
                {voteStatus ? <small className="lifeVoteStatus">{voteStatus.label}</small> : null}
                {showShownCharacter ? (
                  <small className="shownCharacter">보여준 캐릭터: {characterLabel(shownCharacter)}</small>
                ) : null}
                {confirmedPlayer?.notes ? (
                  <span className="playerAnnotationNotesPreview" aria-label="Notes 미리보기">{confirmedPlayer.notes}</span>
                ) : null}
                <span className={`playerAutomaticTokens ${automaticEdge}`}>
                  {playerId === ruleState?.activePoison?.playerId ? (
                    <span className="ruleEffectBadge poisonBadge">중독</span>
                  ) : null}
                  {playerId === ruleState?.activeProtection?.playerId ? (
                    <span className="ruleEffectBadge protectionBadge">보호</span>
                  ) : null}
                </span>
              </button>
              {actualCharacter ? (
                <CharacterRulesButton
                  characterId={actualCharacter}
                  className="characterRulesSeatInfo"
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  ariaLabel={`${seat.seat}번 ${characterLabel(actualCharacter)} 세부 규칙 보기`}
                />
              ) : null}
              {confirmedPlayer && manualBadges.length > 0 ? (
                <div
                  className="playerManualTokens"
                  style={manualTokenStyle(position)}
                  aria-label={`${confirmedPlayer.seat}번 ${confirmedPlayer.name} 수동 토큰`}
                >
                  {manualBadges.slice(0, 2).map((badge) => (
                    <span aria-label={badge.accessibleLabel} key={badge.key}>{badge.label}</span>
                  ))}
                  {manualBadges.length > 2 ? <span>+{manualBadges.length - 2}</span> : null}
                </div>
              ) : null}
              {currentSlayerAbility ? (
                <button
                  type="button"
                  className={`slayerAbilityIcon ${currentSlayerAbility.spent ? "spent" : ""}`}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  aria-label={`${seat.seat}번 ${seat.name} 처단자 능력 사용`}
                  disabled={!currentSlayerAbility.enabled || busy}
                  onClick={(event) => currentSlayerAbility.onUse(event.currentTarget)}
                >
                  S
                </button>
              ) : null}
              {virginAbility && playerId === virginAbility.actorPlayerId ? (
                <span
                  className={`virginAbilityIcon ${virginAbility.spent ? "spent" : ""}`}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  aria-label={`${seat.seat}번 ${seat.name} 성결자 능력 ${virginAbility.spent ? "소모" : "사용 가능"}`}
                >V</span>
              ) : null}
            </div>
          );
        })}
      </div>
      {editingPlayer && onUpdatePlayerAnnotations ? (
        <PlayerAnnotationsDialog
          player={editingPlayer}
          busy={busy}
          onCancel={() => setEditingPlayerId(undefined)}
          onConfirm={onUpdatePlayerAnnotations}
        />
      ) : null}
    </>
  );
}

function manualTokenStyle(position: { x: number; y: number }): CSSProperties {
  const towardCenterX = 50 - position.x;
  const towardCenterY = 50 - position.y;
  const length = Math.hypot(towardCenterX, towardCenterY) || 1;
  return {
    left: `${position.x}%`,
    top: `${position.y}%`,
    "--manual-token-x": `${(towardCenterX / length) * 96}px`,
    "--manual-token-y": `${(towardCenterY / length) * 82}px`,
  } as CSSProperties;
}
