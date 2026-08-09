import { useMemo, type CSSProperties } from "react";
import { characterAsset } from "../../characterAssets";
import {
  GrimoirePresentation,
  RectangularGrimoireBoard,
  grimoireHeights,
  rectangularSeatPositions,
} from "../../shared-ui/GrimoirePresentation";
import { characters, type SetupDraft } from "../../setupDraft";

export function TroubleBrewingGrimoireAssignment({
  draft,
  selectedIds,
  pendingCharacterId,
  seatingComplete,
  busy,
  onGoToSetup,
  onRandomize,
  onReset,
  onSeatSelect,
  onCloseInspector,
  onSeatNameChange,
  onCharacterSelect,
  onShownCharacterSelect,
  onConfirm,
}: {
  draft: SetupDraft;
  selectedIds: string[];
  pendingCharacterId?: string;
  seatingComplete: boolean;
  busy: boolean;
  onGoToSetup: () => void;
  onRandomize: () => void;
  onReset: () => void;
  onSeatSelect: (seat: number) => void;
  onCloseInspector: () => void;
  onSeatNameChange: (seat: number, name: string) => void;
  onCharacterSelect: (characterId: string) => void;
  onShownCharacterSelect: (characterId: string) => void;
  onConfirm: () => void;
}) {
  const playerCount = draft.players.length;
  const desktopPositions = useMemo(() => rectangularSeatPositions(playerCount, false), [playerCount]);
  const mobilePositions = useMemo(() => rectangularSeatPositions(playerCount, true), [playerCount]);
  const heights = grimoireHeights(playerCount);
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;
  const assignments = Object.fromEntries(
    draft.players.flatMap((player) => player.actualCharacter ? [[player.seat, player.actualCharacter]] : []),
  ) as Record<number, string>;
  const assignedCount = Object.keys(assignments).length;
  const selectedPlayer = draft.players.find((player) => player.seat === draft.selectedSeat);
  const selectedCharacter = characters.find((candidate) => candidate.id === selectedPlayer?.actualCharacter);

  return (
    <GrimoirePresentation
      ariaLabel="Trouble Brewing 마도서 배치"
      className="snvSeatingSurface snvTabPanel tbGrimoireSurface editing"
      toolbar={<div className="snvSeatingToolbar" aria-label="마도서 배치 도구">
        <button type="button" className="snvToolbarBack" aria-label="직업 선택으로 돌아가기" onClick={onGoToSetup}><span aria-hidden="true">←</span></button>
        <button type="button" disabled={busy} onClick={onRandomize}>무작위 배치</button>
        <button type="button" disabled={busy} onClick={onReset}>배치 초기화</button>
      </div>}
      workspaceClassName="snvSeatingWorkspace stable"
      style={sizeStyle}
      board={<RectangularGrimoireBoard
        ariaLabel={`${playerCount}자리 Trouble Brewing 마도서`}
        className="snvGrimoireDraft rectangular tbGrimoireBoard"
        centerClassName="snvGrimoireCenter"
        style={sizeStyle}
        seats={draft.players.map((player, index) => {
          const assignedCharacter = characters.find((candidate) => candidate.id === player.actualCharacter);
          const shownCharacter = assignedCharacter?.id === "drunk"
            ? characters.find((candidate) => candidate.id === player.shownCharacter)
            : undefined;
          const identityLabel = assignedCharacter
            ? assignedCharacter.id === "drunk"
              ? `실제 주정뱅이, 표시 ${shownCharacter?.label ?? "미선택"}`
              : assignedCharacter.label
            : "미할당";
          return {
            id: `seat-${player.seat}`,
            position: desktopPositions[index],
            mobilePosition: mobilePositions[index],
            className: `fixedSize ${draft.selectedSeat === player.seat ? "selected " : ""}${assignedCharacter ? `assigned alignment-${alignmentFor(assignedCharacter.kind)} kind-${assignedCharacter.kind.toLowerCase()} character-${assignedCharacter.id}` : "unassigned"}`,
            ariaLabel: `${player.seat}번 좌석, ${player.name}, ${identityLabel}`,
            pressed: draft.selectedSeat === player.seat,
            onSelect: () => onSeatSelect(player.seat),
            content: <>
              <span className="snvSeatNumber">{player.seat}</span>
              {assignedCharacter && characterAsset(assignedCharacter.id) ? <img src={characterAsset(assignedCharacter.id)?.src} alt="" /> : null}
              <span className="snvSeatPlayerName">{player.name}</span>
              <small>{assignedCharacter?.label ?? "미할당"}</small>
              {assignedCharacter?.id === "drunk" ? (
                <span
                  className={`tbShownCharacterToken ${shownCharacter ? "assigned" : "missing"}`}
                  role="img"
                  aria-label={shownCharacter ? `보여준 직업 ${shownCharacter.label} 토큰` : "보여준 직업 미선택 토큰"}
                >
                  {shownCharacter && characterAsset(shownCharacter.id)
                    ? <img src={characterAsset(shownCharacter.id)?.src} alt="" />
                    : <span aria-hidden="true">?</span>}
                </span>
              ) : null}
            </>,
          };
        })}
        center={<><strong>{assignedCount}/{playerCount}</strong><span>배치</span></>}
      />}
      inspector={<>
        {selectedPlayer ? <button type="button" className="snvMobileSeatPanelBackdrop" aria-label="좌석 편집 패널 닫기 배경" onClick={onCloseInspector} /> : null}
        <aside className={`snvSeatingTray contentHeight tbSeatInspector ${selectedPlayer ? "mobileOpen" : "mobileCollapsed"}`} aria-label="선택한 좌석 편집">
          {selectedPlayer ? <div className="snvSeatInspector fixed compactTwoRow">
            <div className="snvSeatInspectorHeader">
              <span>{selectedPlayer.seat}번 좌석</span>
              <strong>{selectedCharacter?.label ?? "미할당"}</strong>
              <span
                className={`snvAlignmentIcon ${selectedCharacter ? `alignment-${alignmentFor(selectedCharacter.kind)}` : "unassigned"}`}
                aria-label={selectedCharacter ? `${alignmentFor(selectedCharacter.kind) === "evil" ? "악한" : "선한"} 진영` : "진영 미정"}
              >{selectedCharacter ? alignmentFor(selectedCharacter.kind) === "evil" ? "악" : "선" : "-"}</span>
            </div>
            <input
              type="text"
              aria-label={`${selectedPlayer.seat}번 좌석 이름`}
              placeholder="플레이어 이름"
              value={selectedPlayer.name}
              onChange={(event) => onSeatNameChange(selectedPlayer.seat, event.target.value)}
            />
            {selectedCharacter?.id === "drunk" ? <label className="tbDrunkEditor">
              <span>보여준 직업</span>
              <select aria-label="보여준 직업" value={selectedPlayer.shownCharacter ?? ""} onChange={(event) => onShownCharacterSelect(event.target.value)}>
                <option value="">선택 필요</option>
                {characters.filter((candidate) => candidate.kind === "Townsfolk").map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
                ))}
              </select>
            </label> : null}
          </div> : null}
          <div className="snvSelectedRosterTray">
            {selectedIds.map((id) => {
              const rosterCharacter = characters.find((candidate) => candidate.id === id);
              if (!rosterCharacter) return null;
              const assignedSeat = draft.players.find((player) => player.actualCharacter === id)?.seat;
              const selectedForSeat = selectedPlayer?.actualCharacter === id;
              return <button
                key={id}
                type="button"
                className={`${assignedSeat ? "assigned " : ""}${selectedForSeat ? "selectedForSeat " : ""}compact`}
                aria-label={assignedSeat ? `${rosterCharacter.label}, ${assignedSeat}번 배치됨` : `${rosterCharacter.label} 배치`}
                aria-pressed={selectedForSeat || pendingCharacterId === id}
                onClick={() => onCharacterSelect(id)}
              >
                {characterAsset(id) ? <img className="compactIcon" src={characterAsset(id)?.src} alt="" /> : null}
                <span>{rosterCharacter.label}</span>
              </button>;
            })}
          </div>
        </aside>
      </>}
      actionsClassName="snvSeatingActions"
      actions={<button
        type="button"
        className="snvConfirmRoster snvConfirmSeating prominent floatingAction"
        disabled={!seatingComplete || busy}
        onClick={onConfirm}
      >{busy ? "확정 중" : "배치 확정"}</button>}
    />
  );
}

function alignmentFor(kind: string): "good" | "evil" {
  return kind === "Minion" || kind === "Demon" ? "evil" : "good";
}
