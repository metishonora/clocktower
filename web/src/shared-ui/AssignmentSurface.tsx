import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { GrimoirePresentation, RectangularGrimoireBoard, grimoireHeights, rectangularSeatPositions, type SeatPosition } from './GrimoirePresentation';
import '../badMoonRisingGame.css';
export type AssignmentCharacter = { id: string; name: string; kind: 'townsfolk' | 'outsider' | 'minion' | 'demon'; image?: string };
export type AssignmentDraft = { playerCount: number; selectedIds: string[]; seatAssignments: Record<number,string>; seatNames: Record<number,string>; shownCharacters: Record<number,string>; seatingConfirmed: boolean };
/** BMR Production's board and assignment tray; script rules are passed as data. */
export function AssignmentSurface({ draft, characters, alignmentForId, renderCharacter, shownChoices = {}, seatingIssue, ariaLabel,
  phaseLabel, phaseRuntime, selectedSeat, pendingCharacterId, seatingComplete, busy, onReturn, onRandomize, onReset, onSeat, onCharacter, onName, onShownCharacter, onClose, onConfirm, onGoToProgress, seatPositions, returnLabel = "배치로 돌아가기", deadSeats = [],
}: {
  draft: AssignmentDraft; characters: AssignmentCharacter[]; alignmentForId: (id:string) => 'good' | 'evil';
  renderCharacter: (id:string, size: 'seat' | 'compact') => ReactNode;
  shownChoices?: Record<string,{label:string;options:AssignmentCharacter[]}>; seatingIssue?: string; ariaLabel: string;
  phaseLabel?: string; phaseRuntime?: string; selectedSeat?: number; pendingCharacterId?: string; seatingComplete: boolean; busy: boolean;
  onReturn: () => void; onRandomize: () => void; onReset: () => void; onSeat: (seat:number) => void; onCharacter: (id:string) => void;
  onName: (seat:number,name:string) => void; onShownCharacter: (seat:number,id:string) => void; onClose: () => void; onConfirm: () => void; onGoToProgress: () => void;
  seatPositions?: Record<number,SeatPosition>; returnLabel?: string; deadSeats?: number[];
}) {
  const characterById = (id?:string) => characters.find(c => c.id === id);
  const desktopPositions = useMemo(() => rectangularSeatPositions(draft.playerCount, false), [draft.playerCount]);
  const mobilePositions = useMemo(() => rectangularSeatPositions(draft.playerCount, true), [draft.playerCount]);
  const heights = grimoireHeights(draft.playerCount);
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;
  const selectedCharacterId = selectedSeat ? draft.seatAssignments[selectedSeat] : undefined;
  const selectedCharacter = characterById(selectedCharacterId);

  return <>
  <GrimoirePresentation
    ariaLabel={ariaLabel}
    className={`snvSeatingSurface bmrGrimoireSurface${draft.seatingConfirmed ? " confirmed" : " assignmentStarted"}`}
    workspaceClassName={`snvSeatingWorkspace bmrGrimoireWorkspace${draft.seatingConfirmed ? " confirmed" : ""}`}
    style={sizeStyle}
    toolbar={<div className="snvSeatingToolbar" aria-label="마도서 배치 도구">
      <button type="button" className={`snvToolbarBack${draft.seatingConfirmed ? " destructive" : ""}`} aria-label={returnLabel} onClick={onReturn}><span aria-hidden="true">←</span></button>
      {draft.seatingConfirmed ? null : <>
        <button type="button" disabled={busy} onClick={onRandomize}>무작위 배치</button>
        <button type="button" disabled={busy} onClick={onReset}>배치 초기화</button>
      </>}
    </div>}
    board={<RectangularGrimoireBoard
      ariaLabel={`${draft.playerCount}자리 마도서`}
      className="snvGrimoireDraft bmrGrimoireBoard"
      centerClassName={`snvGrimoireCenter${draft.seatingConfirmed ? " live issue116PhaseClock" : ""}`}
      centerAriaLabel={draft.seatingConfirmed ? "현재 단계" : undefined}
      style={sizeStyle}
      seats={Array.from({ length: draft.playerCount }, (_, index) => {
        const seat = index + 1;
        const characterId = draft.seatAssignments[seat];
        const character = characterById(characterId);
        const name = draft.seatNames[seat]?.trim() || `플레이어 ${seat}`;
        const needsShownCharacter = !!character && !!shownChoices[character.id] && !draft.shownCharacters[seat];
        return {
          id: `seat-${seat}`,
          position: seatPositions?.[seat] ?? desktopPositions[index],
          mobilePosition: mobilePositions[index],
          className: `${character ? `assigned alignment-${alignmentForId(character.id)} kind-${character.kind}` : "unassigned"}${needsShownCharacter ? " needsShownCharacter" : ""}${selectedSeat === seat ? " selected" : ""}${deadSeats.includes(seat) ? " snvDeadSeat" : ""}`,
          ariaLabel: `${seat}번 좌석, ${name}, ${character?.name ?? "미할당"}${needsShownCharacter ? `, ${shownChoices[character!.id]?.label} 선택 필요` : ""}`,
          pressed: selectedSeat === seat,
          disabled: busy,
          onSelect: () => onSeat(seat),
          content: <>
            <span className="snvSeatNumber">{seat}</span>
            {character ? renderCharacter(character.id, 'seat') : <span className="bmrEmptySeat">+</span>}
            <span className="snvSeatPlayerName">{name}</span>
            <small>{needsShownCharacter ? `${shownChoices[character!.id]?.label} 선택 필요` : `${character?.name ?? "미할당"}${deadSeats.includes(seat) ? " · 사망" : ""}`}</small>
          </>,
        };
      })}
      center={<>
        <strong>{draft.seatingConfirmed ? phaseLabel : `${Object.keys(draft.seatAssignments).length}/${draft.playerCount}`}</strong>
        {draft.seatingConfirmed
          ? <span>{phaseRuntime && <time aria-label={`${phaseLabel} 경과 시간 ${phaseRuntime}`}>{phaseRuntime}</time>}</span>
          : <span>{pendingCharacterId ? `${characterById(pendingCharacterId)?.name} 선택` : "배치"}</span>}
        {draft.seatingConfirmed ? <button type="button" aria-label="진행으로 이동" onClick={onGoToProgress}>진행 →</button> : null}
      </>}
    />}
    inspector={draft.seatingConfirmed ? undefined : <>
      {selectedSeat ? <button type="button" className="snvMobileSeatPanelBackdrop" aria-label="좌석 상세 닫기 배경" onClick={onClose} /> : null}
      <aside className={`snvSeatingTray contentHeight bmrSeatingTray${selectedSeat ? " mobileOpen" : " mobileCollapsed"}`} aria-label="배치할 직업">
        {selectedSeat ? <div className="snvSeatInspector fixed compactTwoRow bmrSeatInspector" aria-label="좌석 편집기">
          <div className="snvSeatInspectorHeader" aria-label="좌석 편집기 머리글">
            <span>{selectedSeat}번 좌석</span>
            <strong>{selectedCharacter?.name ?? "미할당"}</strong>
            <span
              className={`snvAlignmentIcon ${selectedCharacter ? `alignment-${alignmentForId(selectedCharacter.id)}` : "unassigned"}`}
              aria-label={selectedCharacter ? `${alignmentForId(selectedCharacter.id) === "evil" ? "악한" : "선한"} 진영` : "진영 미정"}
            >{selectedCharacter ? alignmentForId(selectedCharacter.id) === "evil" ? "악" : "선" : "-"}</span>
          </div>
          <input
            disabled={busy}
            type="text"
            aria-label={`${selectedSeat}번 좌석 이름`}
            placeholder="플레이어 이름"
            value={draft.seatNames[selectedSeat] ?? ""}
            onChange={(event) => onName(selectedSeat, event.target.value)}
          />
          {selectedCharacter && shownChoices[selectedCharacter.id] ? <ShownCharacterField value={draft.shownCharacters[selectedSeat] ?? ''} label={shownChoices[selectedCharacter.id].label} options={shownChoices[selectedCharacter.id].options} busy={busy} onChange={id=>onShownCharacter(selectedSeat,id)}/> : null}
        </div> : null}
        <div className="snvSelectedRosterTray bmrRosterTray">
          {draft.selectedIds.map((characterId) => {
            const character = characterById(characterId)!;
            const assignedSeat = Number(Object.entries(draft.seatAssignments).find(([, id]) => id === characterId)?.[0]);
            const selectedForSeat = Boolean(selectedSeat && draft.seatAssignments[selectedSeat] === characterId);
            return <button
              disabled={busy}
              key={characterId}
              type="button"
              className={`${assignedSeat ? "assigned " : ""}${selectedForSeat ? "selectedForSeat " : ""}compact`}
              aria-label={assignedSeat ? `${character.name} 직업, ${assignedSeat}번 배치됨` : `${character.name} 배치`}
              aria-pressed={selectedForSeat || pendingCharacterId === characterId}
              onClick={() => onCharacter(characterId)}
            >{renderCharacter(characterId, 'compact')}<span>{character.name}</span></button>;
          })}
        </div>
      </aside>
    </>}
    actionsClassName="snvSeatingActions bmrSeatingActions"
    actions={!draft.seatingConfirmed ? <>
      {seatingIssue ? <p className="bmrSeatingValidation" role="status">{seatingIssue}</p> : <span aria-hidden="true" />}
      <button type="button" className="snvConfirmRoster prominent" aria-label="좌석 확정" disabled={!seatingComplete || busy} onClick={onConfirm}>좌석 확정</button>
    </> : undefined}
  />
  </>;
}

export function ShownCharacterField({value,label,options,busy,onChange}:{value:string;label:string;options:{id:string;name:string}[];busy:boolean;onChange:(id:string)=>void}) {return <label className={`bmrLunaticShownField${value?'':' required'}`}><span>{label}{value?'':' · 선택 필요'}</span><select disabled={busy} aria-label={label} aria-invalid={!value} value={value} onChange={event=>onChange(event.target.value)}><option value="">선택하세요</option>{options.map(({id,name})=><option key={id} value={id}>{name}</option>)}</select></label>;}
