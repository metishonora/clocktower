import { useMemo, useState } from "react";
import type { Player, RuleState } from "../../core/types";
import {
  characterLabel,
  findOverlappingSeats,
  seatLayoutPositions,
  updateSeatPosition,
  type SetupDraft,
} from "../../setupDraft";
import { voteStatusForPlayer } from "../../voting";
import type { NominationDraft } from "../voting/useNominationDraft";
import { SeatLayoutControls, startSeatDrag } from "./SeatLayoutControls";

export function Grimoire({
  players,
  draft,
  onDraftChange,
  busy,
  nominationVoting,
  setupInformationSelection,
  phasePlayerSelection,
  ruleState,
  slayerAbility,
}: {
  players: Player[];
  draft: SetupDraft;
  onDraftChange: (draft: SetupDraft) => void;
  busy: boolean;
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
}) {
  const [layoutEditing, setLayoutEditing] = useState(false);
  const seats = players.length > 0 ? players : draft.players;
  const fallbackPositions = useMemo(() => seatLayoutPositions(seats.length || 5, "circle"), [seats.length]);
  const overlapSeats = findOverlappingSeats(draft.seatPositions);

  return (
    <>
      <SeatLayoutControls
        draft={draft}
        layoutEditing={layoutEditing}
        busy={busy}
        onChange={onDraftChange}
        onLayoutEditingChange={setLayoutEditing}
      />
      <div
        className={`seatMap confirmedSeatMap adjustableSeatMap ${layoutEditing ? "layoutEditing" : ""} ${
          seats.length >= 12 ? "compactSeats" : ""
        }`}
        aria-label="조정 가능한 그리모어 좌석 맵"
      >
        <div className="draftLayoutTableMark" aria-hidden="true">
          테이블
        </div>
        <strong className="mapCenter">{players.length > 0 ? "현재 상태" : "입력 중"}</strong>
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
          const votingDisabled = busy || layoutEditing || !playerId || Boolean(voteStatus?.disabled);
          const setupInformationDisabled =
            busy || layoutEditing || !playerId || Boolean(setupInformationSelection?.disabled);
          const phaseSelectionDisabled = busy || layoutEditing || !phaseAllowed || Boolean(phasePlayerSelection?.disabled);
          const currentSlayerAbility = playerId === slayerAbility?.actorPlayerId ? slayerAbility : undefined;

          function toggleVote() {
            if (!playerId || !nominationVoting || votingDisabled) return;
            const voterIds = votingSelected
              ? nominationVoting.draft.voterIds.filter((selectedId) => selectedId !== playerId)
              : [...nominationVoting.draft.voterIds, playerId];
            nominationVoting.onChange({ ...nominationVoting.draft, voterIds });
          }

          function handleSeatClick() {
            if (layoutEditing) return;
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
                  overlapSeats.has(seat.seat) ? "overlap" : ""
                } ${votingSelected ? "selected voteSelected" : ""} ${nominationVoting ? "votingEnabled" : ""} ${
                  voteStatus?.className ?? ""
                } ${setupInformationSelected ? "selected setupInformationSelected" : ""} ${
                  setupInformationSelection ? "setupInformationEnabled" : ""
                } ${phaseSelected ? "selected phasePlayerSelected" : ""} ${phasePlayerSelection ? "phasePlayerEnabled" : ""}`}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                onClick={handleSeatClick}
                onPointerDown={(event) =>
                  startSeatDrag({
                    event,
                    enabled: layoutEditing,
                    busy,
                    initialPosition: position,
                    onMove: (position) => onDraftChange(updateSeatPosition(draft, seat.seat, position)),
                  })
                }
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
                <span className="seatTokenNumber">{seat.seat}</span>
                <strong>{seat.name}</strong>
                <small>{characterLabel(actualCharacter)}</small>
                {voteStatus ? <small className="lifeVoteStatus">{voteStatus.label}</small> : null}
                {showShownCharacter ? (
                  <small className="shownCharacter">보여준 캐릭터: {characterLabel(shownCharacter)}</small>
                ) : null}
                {playerId === ruleState?.activePoison?.playerId ? (
                  <span className="ruleEffectBadge poisonBadge">중독</span>
                ) : null}
                {playerId === ruleState?.activeProtection?.playerId ? (
                  <span className="ruleEffectBadge protectionBadge">보호</span>
                ) : null}
              </button>
              {currentSlayerAbility ? (
                <button
                  type="button"
                  className={`slayerAbilityIcon ${currentSlayerAbility.spent ? "spent" : ""}`}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  aria-label={`${seat.seat}번 ${seat.name} 학살자 능력 사용`}
                  disabled={!currentSlayerAbility.enabled || busy || layoutEditing}
                  onClick={(event) => currentSlayerAbility.onUse(event.currentTarget)}
                >
                  S
                </button>
              ) : null}
              {virginAbility && playerId === virginAbility.actorPlayerId ? (
                <span
                  className={`virginAbilityIcon ${virginAbility.spent ? "spent" : ""}`}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  aria-label={`${seat.seat}번 ${seat.name} 처녀 능력 ${virginAbility.spent ? "소모" : "사용 가능"}`}
                >V</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
