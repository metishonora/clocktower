import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { characterAsset } from "../../characterAssets";
import type { CoreResult, PhaseStep, Player, PlayerAnnotationsInput, Proposal, RuleState } from "../../core/types";
import {
  GrimoirePresentation,
  RectangularGrimoireBoard,
  grimoireHeights,
  rectangularSeatPositions,
} from "../../shared-ui/GrimoirePresentation";
import { characterLabel, characters, kindLabels } from "../../setupDraft";
import { nextVoterIdsAfterToggle, voteStatusForPlayer } from "../../voting";
import { PlayerAnnotationsDialog } from "../grimoire/PlayerAnnotationsDialog";
import { playerAnnotationBadges } from "../grimoire/playerAnnotations";
import { PlayerTokenCountBadge } from "../grimoire/playerTokenPresentation";
import type { NominationDraft } from "../voting/useNominationDraft";

export function TroubleBrewingLiveGrimoire({
  players,
  currentStep,
  phaseLabel,
  phaseRuntime,
  theme,
  busy,
  gameEnded,
  nominationVoting,
  setupInformationSelection,
  phasePlayerSelection,
  ruleState,
  slayerAbility,
  onUpdatePlayerAnnotations,
  onReturnToAssignment,
  onGoToProgress,
  revealMode,
}: {
  players: Player[];
  currentStep?: PhaseStep;
  phaseLabel: string;
  phaseRuntime: string;
  theme: "day" | "night";
  busy: boolean;
  gameEnded: boolean;
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
  onReturnToAssignment?: () => void;
  onGoToProgress?: () => void;
  revealMode?: {
    onClose: () => void;
  };
}) {
  const [detailsPlayerId, setDetailsPlayerId] = useState<string>();
  const [editingPlayerId, setEditingPlayerId] = useState<string>();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressActivated = useRef(false);
  const playerCount = players.length;
  const desktopPositions = useMemo(() => rectangularSeatPositions(playerCount, false), [playerCount]);
  const mobilePositions = useMemo(() => rectangularSeatPositions(playerCount, true), [playerCount]);
  const heights = grimoireHeights(playerCount);
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;
  const actorPlayerId = revealMode ? undefined : currentStep?.playerId;
  const detailsPlayer = players.find((player) => player.id === detailsPlayerId);
  const editingPlayer = players.find((player) => player.id === editingPlayerId);
  const detailsCharacter = characters.find((candidate) => candidate.id === detailsPlayer?.actualCharacter);
  const detailsShownCharacter = detailsPlayer?.actualCharacter === "drunk"
    ? characters.find((candidate) => candidate.id === detailsPlayer.shownCharacter)
    : undefined;
  const selectionActive = !revealMode && Boolean(nominationVoting || setupInformationSelection || phasePlayerSelection);

  useEffect(() => () => window.clearTimeout(longPressTimer.current), []);
  useEffect(() => {
    if (selectionActive) setDetailsPlayerId(undefined);
  }, [selectionActive]);

  function startLongPress(event: PointerEvent<HTMLButtonElement>, player: Player) {
    if (!onUpdatePlayerAnnotations || busy) return;
    longPressActivated.current = false;
    window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressActivated.current = true;
      setDetailsPlayerId(undefined);
      setEditingPlayerId(player.id);
    }, 500);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function cancelLongPress() {
    window.clearTimeout(longPressTimer.current);
  }

  function selectPlayer(player: Player, disabled: boolean) {
    if (longPressActivated.current) {
      longPressActivated.current = false;
      return;
    }
    if (disabled) return;
    if (nominationVoting) {
      nominationVoting.onChange({
        ...nominationVoting.draft,
        voterIds: nextVoterIdsAfterToggle(
          nominationVoting.draft.voterIds,
          player.id,
          ruleState?.butlerVote,
        ),
      });
      return;
    }
    if (setupInformationSelection) {
      setupInformationSelection.onTogglePlayer(player.id);
      return;
    }
    if (phasePlayerSelection) {
      phasePlayerSelection.onTogglePlayer(player.id);
      return;
    }
    setDetailsPlayerId(player.id);
  }

  return <>
    <GrimoirePresentation
      ariaLabel={revealMode ? "Trouble Brewing 첩자 마도서" : "Trouble Brewing 마도서 검토"}
      className="snvSeatingSurface snvTabPanel tbConfirmedGrimoire confirmed"
      toolbar={revealMode ? <div className="snvSeatingToolbar tbSpyRevealToolbar" aria-label="첩자 공개 안내">
        <div><p>SPY · ACTUAL GRIMOIRE</p><h1>Trouble Brewing</h1></div>
      </div> : <div className="snvSeatingToolbar" aria-label="확정된 마도서 도구">
        <button type="button" className="snvToolbarBack destructive" disabled={busy} aria-label="배치로 돌아가기" onClick={onReturnToAssignment}><span aria-hidden="true">←</span></button>
        {actorPlayerId ? <div className="snvCurrentActorLegend" aria-label="현재 행동자 안내"><span aria-hidden="true" />현재 행동자</div> : null}
      </div>}
      workspaceClassName={`snvSeatingWorkspace stable${revealMode ? " tbRevealWorkspace" : ""}`}
      style={sizeStyle}
      board={<RectangularGrimoireBoard
        ariaLabel={revealMode ? "첩자 공개 마도서 좌석 맵" : "라이브 마도서 좌석 맵"}
        className="snvGrimoireDraft rectangular tbGrimoireBoard"
        centerClassName="snvGrimoireCenter live tbPhaseClock"
        style={sizeStyle}
        seats={players.map((player, index) => {
          const position = desktopPositions[index];
          const mobilePosition = mobilePositions[index];
          const shownCharacter = player.actualCharacter === "drunk"
            ? characters.find((candidate) => candidate.id === player.shownCharacter)
            : undefined;
          const asset = characterAsset(player.actualCharacter);
          const selected = nominationVoting
            ? nominationVoting.draft.voterIds.includes(player.id)
            : setupInformationSelection
              ? setupInformationSelection.selectedPlayerIds.includes(player.id)
              : phasePlayerSelection
                ? phasePlayerSelection.selectedPlayerIds.includes(player.id)
                : detailsPlayerId === player.id;
          const allowed = !phasePlayerSelection?.allowedPlayerIds
            || phasePlayerSelection.allowedPlayerIds.includes(player.id);
          const voteStatus = nominationVoting
            ? voteStatusForPlayer(player, selected, nominationVoting.draft.voterIds, ruleState?.butlerVote)
            : undefined;
          const disabled = busy
            || Boolean(nominationVoting && voteStatus?.disabled)
            || Boolean(setupInformationSelection?.disabled)
            || Boolean(phasePlayerSelection && (!allowed || phasePlayerSelection.disabled));
          const actor = actorPlayerId === player.id;
          const manualTokenCount = playerAnnotationBadges(player).length;
          const automaticTokenCount = Number(ruleState?.activePoison?.playerId === player.id)
            + Number(ruleState?.activeProtection?.playerId === player.id);
          const tokenCount = manualTokenCount + automaticTokenCount;
          const lifeVoteLabel = player.alive
            ? "생존"
            : player.ghostVoteUsed
              ? "사망 · 유령표 사용됨"
              : "사망 · 유령표 남음";
          const automaticTokenLabels = [
            ruleState?.activePoison?.playerId === player.id ? "중독" : undefined,
            ruleState?.activeProtection?.playerId === player.id ? "보호" : undefined,
          ].filter((label): label is string => Boolean(label));
          const identityLabel = player.actualCharacter === "drunk"
            ? `실제 주정뱅이, 표시 ${shownCharacter?.label ?? "미선택"}`
            : characterLabel(player.actualCharacter);
          return {
            id: player.id,
            position,
            mobilePosition,
            interactive: !revealMode,
            className: `fixedSize assigned alignment-${player.alignment} kind-${characterKindClass(player.actualCharacter)} character-${player.actualCharacter}${player.alive ? "" : " snvDeadSeat"}${actor ? " snvCurrentActorSeat snvSeatStateActor" : ""}${selected ? " selected snvSeatStateSelected" : ""}${disabled && selectionActive ? " tbIneligibleSeat" : ""}`,
            ariaLabel: `${player.seat}번 좌석, ${player.name}, ${identityLabel}, ${voteStatus?.label ?? lifeVoteLabel}${actor ? ", 현재 행동자" : ""}${selected ? ", 선택됨" : ""}${automaticTokenLabels.length ? `, ${automaticTokenLabels.join(", ")}` : ""}, ${player.seat}번 ${player.name} 좌석 선택`,
            pressed: revealMode ? undefined : selectionActive ? selected : detailsPlayerId === player.id,
            disabled: gameEnded || (selectionActive ? disabled : false),
            onSelect: () => selectPlayer(player, disabled),
            onPointerDown: (event) => startLongPress(event, player),
            onPointerUp: cancelLongPress,
            onPointerCancel: cancelLongPress,
            onPointerLeave: cancelLongPress,
            content: <>
              <span className="snvSeatNumber">{player.seat}</span>
              {asset ? <img src={asset.src} alt="" /> : null}
              <span className="snvSeatPlayerName">{player.name}</span>
              <small>{characterLabel(player.actualCharacter)}</small>
              {player.actualCharacter === "drunk" ? <span
                className={`tbShownCharacterToken ${shownCharacter ? "assigned" : "missing"}`}
                role="img"
                aria-label={shownCharacter ? `보여준 직업 ${shownCharacter.label} 토큰` : "보여준 직업 미선택 토큰"}
              >
                {shownCharacter && characterAsset(shownCharacter.id)
                  ? <img src={characterAsset(shownCharacter.id)?.src} alt="" />
                  : <span aria-hidden="true">?</span>}
              </span> : null}
              {revealMode && automaticTokenLabels.length ? <span className="tbRevealTokenList" aria-label="적용 토큰">
                {automaticTokenLabels.map((label) => <span key={label}>{label}</span>)}
              </span> : null}
            </>,
            afterSeat: <>
              <PlayerTokenCountBadge count={tokenCount} position={position} mobilePosition={mobilePosition} theme={theme} />
              {player.id === slayerAbility?.actorPlayerId ? <button
                type="button"
                className={`tbSeatAbilityAction slayer ${slayerAbility.spent ? "spent" : ""}`}
                style={abilityActionStyle(position, mobilePosition)}
                aria-label={`${player.seat}번 ${player.name} 처단자 능력 사용`}
                disabled={!slayerAbility.enabled || busy}
                onClick={(event) => slayerAbility.onUse(event.currentTarget)}
              >S</button> : null}
              {player.id === ruleState?.virginAbility?.actorPlayerId ? <span
                className={`tbSeatAbilityAction virgin ${ruleState.virginAbility.spent ? "spent" : ""}`}
                style={abilityActionStyle(position, mobilePosition)}
                aria-label={`${player.seat}번 ${player.name} 성결자 능력 ${ruleState.virginAbility.spent ? "소모" : "사용 가능"}`}
              >V</span> : null}
            </>,
          };
        })}
        center={<div role="group" aria-label={revealMode ? "첩자 공개" : "현재 단계"}>
          <strong>{revealMode ? "첩자 공개" : gameEnded ? "게임 종료" : phaseLabel}</strong>
          {!revealMode && !gameEnded ? <time aria-label={`${phaseLabel} 경과 시간 ${phaseRuntime}`}>{phaseRuntime}</time> : null}
          {revealMode ? <button type="button" onClick={revealMode.onClose}>확인했으면 눈을 감으세요</button> : !gameEnded ? <button type="button" onClick={onGoToProgress}>진행 →</button> : null}
        </div>}
      />}
      inspector={revealMode ? undefined : <>
        {detailsPlayer ? <button type="button" className="snvMobileSeatPanelBackdrop" aria-label="플레이어 상세 닫기 배경" onClick={() => setDetailsPlayerId(undefined)} /> : null}
        <aside className={`snvLiveSeatDetails tbPlayerDetails transitionIn ${detailsPlayer ? "mobileOpen" : "mobileCollapsed"}`} aria-label="좌석 상세 정보">
          {detailsPlayer && detailsCharacter ? <>
            <header className="tbPlayerDetailsHeader">
              <div className="tbPlayerHeaderRole">
                {characterAsset(detailsCharacter.id) ? <img src={characterAsset(detailsCharacter.id)?.src} alt="" /> : null}
                <strong>{detailsCharacter.label}</strong>
              </div>
              <div><span>{detailsPlayer.seat}번 좌석 · {kindLabels[detailsCharacter.kind]}</span><h2>{detailsPlayer.name}</h2></div>
              <span className={`snvAlignmentIcon alignment-${detailsPlayer.alignment} tbPlayerAlignment`} role="img" aria-label={`현재 진영 · ${detailsPlayer.alignment === "evil" ? "악" : "선"}`}>{detailsPlayer.alignment === "evil" ? "악" : "선"}</span>
              <button type="button" className="tbPlayerDetailsClose" aria-label="플레이어 상세 닫기" onClick={() => setDetailsPlayerId(undefined)}>×</button>
            </header>
            <div className="tbPlayerDetailsBody">
              {detailsCharacter.id === "drunk" && detailsShownCharacter ? <section className="tbDrunkIdentities" aria-label="주정뱅이 아이덴티티">
                <article><span>실제 직업</span><div>{characterAsset("drunk") ? <img src={characterAsset("drunk")?.src} alt="" /> : null}<strong>주정뱅이</strong></div></article>
                <article className="shown"><span>보여준 직업</span><div>{characterAsset(detailsShownCharacter.id) ? <img src={characterAsset(detailsShownCharacter.id)?.src} alt="" /> : null}<strong>{detailsShownCharacter.label}</strong></div></article>
              </section> : null}
              <section className="tbCharacterAbility" aria-label="캐릭터 정보"><span>캐릭터 능력</span><p>{detailsCharacter.abilitySummary}</p></section>
            </div>
          </> : <span>좌석을 선택하세요</span>}
        </aside>
      </>}
    />
    {editingPlayer && onUpdatePlayerAnnotations ? <PlayerAnnotationsDialog
      player={editingPlayer}
      busy={busy}
      onCancel={() => setEditingPlayerId(undefined)}
      onConfirm={onUpdatePlayerAnnotations}
    /> : null}
  </>;
}

function characterKindClass(characterId: string) {
  return characters.find((candidate) => candidate.id === characterId)?.kind.toLowerCase() ?? "unknown";
}

function abilityActionStyle(position: { x: number; y: number }, mobilePosition: { x: number; y: number }) {
  return {
    "--ability-seat-x": `${position.x}%`,
    "--ability-seat-y": `${position.y}%`,
    "--ability-mobile-seat-x": `${mobilePosition.x}%`,
    "--ability-mobile-seat-y": `${mobilePosition.y}%`,
  } as CSSProperties;
}
