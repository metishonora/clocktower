import type { CSSProperties, Ref } from "react";
import { sectsAndVioletsCharacterDetail } from "../../characterDetails";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import type { Player } from "../../core/types";
import {
  GrimoirePresentation,
  RectangularGrimoireBoard,
  grimoireHeights,
  rectangularSeatPositions,
} from "../../shared-ui/GrimoirePresentation";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";
import {
  PlayerTokenCountBadge,
  type PlayerTokensByPlayerId,
} from "./playerTokenPresentation";

type Alignment = "good" | "evil";

export function SectsAndVioletsAssignment({
  seatingConfirmed,
  playerCount,
  selectedSeat,
  pendingCharacterId,
  seatAssignments,
  seatAlignments,
  seatNames,
  selectedIds,
  assignedCount,
  seatingComplete,
  operationBusy,
  phaseLabel,
  phaseTheme,
  canonicalPlayers,
  tokensByPlayerId,
  currentActorSeat,
  currentActorCharacterId,
  characterIdForSeat,
  returnButtonRef,
  onReturnToSetup,
  onGoToRoles,
  onRandomize,
  onReset,
  onSeatSelect,
  onCloseSeatPanel,
  onSeatNameChange,
  onSeatNameBlur,
  onCharacterSelect,
  onGoToProgress,
  onConfirm,
}: {
  seatingConfirmed: boolean;
  playerCount: number;
  selectedSeat?: number;
  pendingCharacterId?: string;
  seatAssignments: Record<number, string>;
  seatAlignments: Record<number, Alignment>;
  seatNames: Record<number, string>;
  selectedIds: string[];
  assignedCount: number;
  seatingComplete: boolean;
  operationBusy: boolean;
  phaseLabel: string;
  phaseTheme: "day" | "night";
  canonicalPlayers: Player[];
  tokensByPlayerId: PlayerTokensByPlayerId;
  currentActorSeat?: number;
  currentActorCharacterId?: string;
  characterIdForSeat: (seat: number) => string | undefined;
  returnButtonRef?: Ref<HTMLButtonElement>;
  onReturnToSetup: () => void;
  onGoToRoles: () => void;
  onRandomize: () => void;
  onReset: () => void;
  onSeatSelect: (seat: number) => void;
  onCloseSeatPanel: () => void;
  onSeatNameChange: (seat: number, name: string) => void;
  onSeatNameBlur: () => void;
  onCharacterSelect: (characterId: string) => void;
  onGoToProgress: () => void;
  onConfirm: () => void;
}) {
  const desktopSeatPositions = rectangularSeatPositions(playerCount, false);
  const mobileSeatPositions = rectangularSeatPositions(playerCount, true);
  const heights = grimoireHeights(playerCount);
  const grimoireSizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;
  const selectedCharacterId = selectedSeat ? characterIdForSeat(selectedSeat) : undefined;
  const selectedCharacter = sectsAndVioletsCharacters.find(
    (character) => character.id === selectedCharacterId,
  );
  const selectedCharacterAsset = sectsAndVioletsCharacterAsset(selectedCharacterId);
  const selectedCanonicalPlayer = canonicalPlayers.find((player) => player.seat === selectedSeat);
  const selectedSeatTokens = selectedCanonicalPlayer
    ? tokensByPlayerId[selectedCanonicalPlayer.id] ?? []
    : [];

  return (
    <GrimoirePresentation
      className={`snvSeatingSurface snvTabPanel ${!seatingConfirmed ? "assignmentStarted" : ""}`}
      ariaLabel="그리모어 배치 단계"
      toolbar={<div className="snvSeatingToolbar" aria-label="마도서 배치 도구">
        {seatingConfirmed ? (
          <>
            <button
              ref={returnButtonRef}
              type="button"
              className="snvToolbarBack destructive"
              aria-label="배치로 돌아가기"
              onClick={onReturnToSetup}
            ><span aria-hidden="true">←</span></button>
            {currentActorCharacterId ? (
              <div className="snvCurrentActorLegend" aria-label="현재 행동자 안내">
                <span aria-hidden="true" />현재 행동자
              </div>
            ) : null}
          </>
        ) : (
          <>
            <button type="button" className="snvToolbarBack" aria-label="직업 선택으로 돌아가기" onClick={onGoToRoles}>
              <span aria-hidden="true">←</span>
            </button>
            <button type="button" onClick={onRandomize}>무작위 배치</button>
            <button type="button" onClick={onReset}>배치 초기화</button>
          </>
        )}
      </div>}
      workspaceClassName="snvSeatingWorkspace stable"
      style={grimoireSizeStyle}
      board={<RectangularGrimoireBoard
        className="snvGrimoireDraft rectangular"
        centerClassName={`snvGrimoireCenter ${seatingConfirmed ? "live" : ""}`}
        ariaLabel={`${playerCount}자리 그리모어`}
        style={grimoireSizeStyle}
        seats={Array.from({ length: playerCount }, (_, index) => {
          const seat = index + 1;
          const characterId = seatingConfirmed ? characterIdForSeat(seat) : seatAssignments[seat];
          const character = sectsAndVioletsCharacters.find((candidate) => candidate.id === characterId);
          const asset = sectsAndVioletsCharacterAsset(characterId);
          const playerName = seatNames[seat]?.trim() || `플레이어 ${seat}`;
          const desktopPosition = desktopSeatPositions[index];
          const mobilePosition = mobileSeatPositions[index];
          const canonicalPlayer = canonicalPlayers.find((player) => player.seat === seat);
          const tokenCount = canonicalPlayer ? tokensByPlayerId[canonicalPlayer.id]?.length ?? 0 : 0;
          const isCurrentActor = Boolean(
            seatingConfirmed && characterId && (
              currentActorSeat ? currentActorSeat === seat : currentActorCharacterId === characterId
            ),
          );
          return {
            id: `seat-${seat}`,
            position: desktopPosition,
            mobilePosition,
            className: `fixedSize ${selectedSeat === seat ? "selected " : ""}${isCurrentActor ? "snvCurrentActorSeat " : ""}${character ? `assigned alignment-${seatAlignments[seat] ?? defaultAlignment(character.id)} kind-${character.kind}` : "unassigned"}`,
            ariaLabel: `${seat}번 좌석, ${playerName}, ${character?.name ?? "미할당"}${isCurrentActor ? ", 현재 행동자" : ""}`,
            pressed: selectedSeat === seat,
            onSelect: () => onSeatSelect(seat),
            content: <>
              <span className="snvSeatNumber">{seat}</span>
              {asset ? <img src={asset.src} alt="" /> : null}
              <span className="snvSeatPlayerName">{playerName}</span>
              <small>{character?.name ?? "미할당"}</small>
            </>,
            afterSeat: seatingConfirmed && tokenCount > 0
              ? <PlayerTokenCountBadge
                  count={tokenCount}
                  position={desktopPosition}
                  mobilePosition={mobilePosition}
                  theme={phaseTheme}
                />
              : null,
          };
        })}
        center={<>
          <strong>{seatingConfirmed ? phaseLabel : `${assignedCount}/${playerCount}`}</strong>
          <span>{seatingConfirmed ? "00:00" : "배치"}</span>
          {seatingConfirmed ? <button type="button" aria-label="진행으로 이동" onClick={onGoToProgress}>진행 →</button> : null}
        </>}
      />}
      inspector={<>
        {selectedSeat ? (
          <button
            type="button"
            className="snvMobileSeatPanelBackdrop"
            aria-label="좌석 설정 패널 닫기 배경"
            onClick={onCloseSeatPanel}
          />
        ) : null}
        {seatingConfirmed ? (
          <aside className={`snvLiveSeatDetails transitionIn ${selectedSeat ? "mobileOpen" : "mobileCollapsed"}`} aria-label="좌석 상세 정보">
            {selectedSeat && selectedCharacter ? (
              <>
                <header>
                  <span>{selectedSeat}번 좌석</span>
                  <h2>{seatNames[selectedSeat]?.trim() || `플레이어 ${selectedSeat}`}</h2>
                </header>
                <CharacterDetailButton
                  details={sectsAndVioletsCharacterDetail(selectedCharacter.id)}
                  className="snvLiveIdentity"
                  theme={phaseTheme === "day" ? "snv-day" : "snv-night"}
                >
                  {selectedCharacterAsset ? (
                    <img src={selectedCharacterAsset.src} alt={`${selectedCharacter.name} 공식 캐릭터 아이콘`} />
                  ) : null}
                  <div>
                    <span
                      className={`snvAlignmentIcon alignment-${seatAlignments[selectedSeat] ?? defaultAlignment(selectedCharacter.id)}`}
                      aria-label={`${(seatAlignments[selectedSeat] ?? defaultAlignment(selectedCharacter.id)) === "evil" ? "악한" : "선한"} 진영`}
                    >{(seatAlignments[selectedSeat] ?? defaultAlignment(selectedCharacter.id)) === "evil" ? "악" : "선"}</span>
                    <strong>{selectedCharacter.name}</strong>
                  </div>
                </CharacterDetailButton>
                <div className="snvLiveStatuses" aria-label="현재 상태">
                  <span>생존</span>
                  {selectedSeatTokens.map((token) => <span key={token.instanceId}>{token.label}</span>)}
                </div>
              </>
            ) : <span>좌석을 선택하세요</span>}
          </aside>
        ) : (
          <aside className={`snvSeatingTray contentHeight ${selectedSeat ? "mobileOpen" : "mobileCollapsed"}`} aria-label="선택한 직업">
            {selectedSeat ? (
              <div className="snvSeatInspector fixed compactTwoRow" aria-label="좌석 편집기">
                <div className="snvSeatInspectorHeader" aria-label="좌석 편집기 머리글">
                  <span>{selectedSeat}번 좌석</span>
                  <strong>{sectsAndVioletsCharacters.find((character) => character.id === seatAssignments[selectedSeat])?.name ?? "미할당"}</strong>
                  <span
                    className={`snvAlignmentIcon ${seatAssignments[selectedSeat] ? `alignment-${seatAlignments[selectedSeat] ?? defaultAlignment(seatAssignments[selectedSeat])}` : "unassigned"}`}
                    aria-label={seatAssignments[selectedSeat]
                      ? `${(seatAlignments[selectedSeat] ?? defaultAlignment(seatAssignments[selectedSeat])) === "evil" ? "악한" : "선한"} 진영`
                      : "진영 미정"}
                  >{seatAssignments[selectedSeat]
                    ? (seatAlignments[selectedSeat] ?? defaultAlignment(seatAssignments[selectedSeat])) === "evil" ? "악" : "선"
                    : "-"}</span>
                </div>
                <input
                  type="text"
                  aria-label={`${selectedSeat}번 좌석 이름`}
                  placeholder="플레이어 이름"
                  value={seatNames[selectedSeat] ?? ""}
                  onChange={(event) => onSeatNameChange(selectedSeat, event.target.value)}
                  onBlur={onSeatNameBlur}
                />
              </div>
            ) : null}
            <div className="snvSelectedRosterTray">
              {selectedIds.map((id) => {
                const character = sectsAndVioletsCharacters.find((candidate) => candidate.id === id)!;
                const asset = sectsAndVioletsCharacterAsset(id);
                const assignedSeat = Object.entries(seatAssignments).find(([, characterId]) => characterId === id)?.[0];
                const selectedForSeat = Boolean(selectedSeat && seatAssignments[selectedSeat] === id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`${assignedSeat ? "assigned " : ""}${selectedForSeat ? "selectedForSeat " : ""}compact`}
                    aria-label={assignedSeat ? `${character.name}, ${assignedSeat}번 배치됨` : `${character.name} 배치`}
                    aria-pressed={selectedForSeat || pendingCharacterId === id}
                    onClick={() => onCharacterSelect(id)}
                  >
                    {asset ? <img className="compactIcon" src={asset.src} alt="" /> : null}
                    <span>{character.name}</span>
                  </button>
                );
              })}
            </div>
          </aside>
        )}
      </>}
      actionsClassName={`snvSeatingActions ${seatingConfirmed ? "placeholder" : ""}`}
      actions={!seatingConfirmed ? (
        <button
          type="button"
          className="snvConfirmRoster snvConfirmSeating prominent floatingAction"
          disabled={!seatingComplete || operationBusy}
          onClick={onConfirm}
        >{operationBusy ? "확정 중" : "배치 확정"}</button>
      ) : null}
    />
  );
}

function defaultAlignment(characterId: string): Alignment {
  const kind = sectsAndVioletsCharacters.find((character) => character.id === characterId)?.kind;
  return kind === "minion" || kind === "demon" ? "evil" : "good";
}
