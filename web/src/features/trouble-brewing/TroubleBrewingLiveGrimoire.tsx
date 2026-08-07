import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { characterAsset } from "../../characterAssets";
import { troubleBrewingCharacterDetail } from "../../characterDetails";
import type { CoreResult, DayState, PhaseStep, Player, PlayerAnnotationsInput, Proposal, RuleState } from "../../core/types";
import {
  GrimoirePresentation,
  RectangularGrimoireBoard,
  grimoireHeights,
  rectangularSeatPositions,
} from "../../shared-ui/GrimoirePresentation";
import { GrimoireToolbar } from "../../shared-ui/GrimoireToolbar";
import { characterLabel, characters, kindLabels } from "../../setupDraft";
import { NominationArrow } from "../../shared-ui/NominationArrow";
import { nextVoterIdsAfterToggle, voteStatusForPlayer } from "../../voting";
import { FuneralIcon, GhostVoteIcon } from "../grimoire/SeatStateIcons";
import { PlayerAnnotationsDialog } from "../grimoire/PlayerAnnotationsDialog";
import { PlayerTokenCountBadge, PlayerTokenDetailDialog } from "../grimoire/playerTokenPresentation";
import { currentActionPrompt } from "../phase-control/phaseInput";
import type { NominationDraft } from "../voting/useNominationDraft";
import { troubleBrewingPlayerTokens } from "./troubleBrewingPlayerTokenPresentation";
import "../grimoire/sectsAndVioletsSeatStates.css";

export type TroubleBrewingLiveHandoff = "target" | "nomination" | "vote";

export function TroubleBrewingLiveGrimoire({
  players,
  currentStep,
  phaseLabel,
  phaseRuntime,
  theme,
  busy,
  gameEnded,
  handoff,
  dayState,
  nominationVoting,
  setupInformationSelection,
  phasePlayerSelection,
  ruleState,
  onUpdatePlayerAnnotations,
  onReturnToAssignment,
  onGoToProgress,
  onConfirmSelection,
  onResetSelection,
  onCancelSelection,
  selectionReady,
  revealMode,
}: {
  players: Player[];
  currentStep?: PhaseStep;
  phaseLabel: string;
  phaseRuntime: string;
  theme: "day" | "night";
  busy: boolean;
  gameEnded: boolean;
  handoff?: TroubleBrewingLiveHandoff;
  dayState?: DayState;
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
  onUpdatePlayerAnnotations?: (
    playerId: string,
    annotations: PlayerAnnotationsInput,
  ) => Promise<CoreResult<Proposal> | undefined>;
  onReturnToAssignment?: () => void;
  onGoToProgress?: () => void;
  onConfirmSelection?: () => void;
  onResetSelection?: () => void;
  onCancelSelection?: () => void;
  selectionReady?: boolean;
  revealMode?: {
    onClose: () => void;
  };
}) {
  const [detailsPlayerId, setDetailsPlayerId] = useState<string>();
  const [editingPlayerId, setEditingPlayerId] = useState<string>();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressActivated = useRef(false);
  const seatRefs = useRef(new Map<string, HTMLButtonElement>());
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
  const selectionActive = !revealMode && Boolean(handoff);
  const nominatorId = nominationVoting?.draft.nominatorId || dayState?.activeNomination?.nominatorId;
  const nomineeId = nominationVoting?.draft.nomineeId || dayState?.activeNomination?.nomineeId;
  const nominator = players.find((player) => player.id === nominatorId);
  const nominee = players.find((player) => player.id === nomineeId);
  const tokensByPlayerId = useMemo(() => Object.fromEntries(
    players.map((player) => [player.id, troubleBrewingPlayerTokens(player, players, ruleState)]),
  ), [players, ruleState]);

  const restoreSeatFocus = useCallback((playerId?: string) => {
    if (!playerId) return;
    window.requestAnimationFrame(() => seatRefs.current.get(playerId)?.focus());
  }, []);

  const closePlayerDetails = useCallback(() => {
    const playerId = detailsPlayerId;
    setDetailsPlayerId(undefined);
    restoreSeatFocus(playerId);
  }, [detailsPlayerId, restoreSeatFocus]);

  const closeAnnotationEditor = useCallback(() => {
    const playerId = editingPlayerId;
    setEditingPlayerId(undefined);
    restoreSeatFocus(playerId);
  }, [editingPlayerId, restoreSeatFocus]);

  useEffect(() => () => window.clearTimeout(longPressTimer.current), []);
  useEffect(() => {
    if (selectionActive) setDetailsPlayerId(undefined);
  }, [selectionActive]);

  function startLongPress(event: PointerEvent<HTMLButtonElement>, player: Player) {
    if (!onUpdatePlayerAnnotations || busy || gameEnded) return;
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
    if (handoff === "nomination" && nominationVoting) {
      if (!nominationVoting.draft.nominatorId) {
        nominationVoting.onChange({ ...nominationVoting.draft, nominatorId: player.id, nomineeId: "" });
      } else {
        nominationVoting.onChange({ ...nominationVoting.draft, nomineeId: player.id });
      }
      return;
    }
    if (handoff === "vote" && nominationVoting) {
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
    if (handoff === "target" && setupInformationSelection) {
      setupInformationSelection.onTogglePlayer(player.id);
      return;
    }
    if (handoff === "target" && phasePlayerSelection) {
      phasePlayerSelection.onTogglePlayer(player.id);
      return;
    }
    setDetailsPlayerId(player.id);
  }

  return <>
    <GrimoirePresentation
      ariaLabel={revealMode ? "Trouble Brewing 첩자 마도서" : "Trouble Brewing 마도서 검토"}
      className={`snvSeatingSurface snvTabPanel tbConfirmedGrimoire confirmed issue116GrimoireSurface${handoff === "nomination" ? " issue116NominationMode" : handoff === "vote" ? " issue116VoteMode" : handoff === "target" ? " issue116AttackMode" : ""}${theme === "day" ? " snvDayMode" : " snvNightMode"}`}
      toolbar={revealMode ? <div className="snvSeatingToolbar tbSpyRevealToolbar" aria-label="첩자 공개 안내">
        <div><p>SPY · ACTUAL GRIMOIRE</p><h1>Trouble Brewing</h1></div>
      </div> : handoff ? (
        <GrimoireToolbar phaseLabel={phaseLabel} showCurrentActor={Boolean(actorPlayerId)}>
          <button type="button" disabled={busy} onClick={onCancelSelection}>{handoff === "vote" ? "투표 취소 →" : handoff === "target" ? "선택 취소 →" : "돌아가기 →"}</button>
        </GrimoireToolbar>
      ) : (
        <GrimoireToolbar ariaLabel="확정된 마도서 도구">
          <button type="button" className="snvToolbarBack destructive" disabled={busy} aria-label="배치로 돌아가기" onClick={onReturnToAssignment}><span aria-hidden="true">←</span></button>
        </GrimoireToolbar>
      )}
      workspaceClassName={`snvSeatingWorkspace stable${handoff ? "" : " issue116ReferenceWorkspace"}${revealMode ? " tbRevealWorkspace" : ""}`}
      style={sizeStyle}
      board={<RectangularGrimoireBoard
        ariaLabel={revealMode ? "첩자 공개 마도서 좌석 맵" : "라이브 마도서 좌석 맵"}
        className="snvGrimoireDraft rectangular tbGrimoireBoard"
        centerClassName="snvGrimoireCenter live issue116PhaseClock"
        centerAriaLabel={revealMode ? "첩자 공개" : "현재 단계"}
        style={sizeStyle}
        seats={players.map((player, index) => {
          const position = desktopPositions[index];
          const mobilePosition = mobilePositions[index];
          const shownCharacter = player.actualCharacter === "drunk"
            ? characters.find((candidate) => candidate.id === player.shownCharacter)
            : undefined;
          const asset = characterAsset(player.actualCharacter);
          const selfNominee = handoff === "nomination"
            && player.id === nominatorId
            && player.id === nomineeId;
          const selectionRole = handoff === "nomination"
            ? selfNominee ? "지명자 · 피지명자" : player.id === nominatorId ? "지명자" : player.id === nomineeId ? "피지명자" : undefined
            : handoff === "vote" && nominationVoting?.draft.voterIds.includes(player.id) ? "투표"
              : handoff === "target" && (setupInformationSelection?.selectedPlayerIds.includes(player.id) || phasePlayerSelection?.selectedPlayerIds.includes(player.id)) ? "선택 대상" : undefined;
          const selected = handoff === "nomination"
            ? player.id === nominatorId || player.id === nomineeId
            : handoff === "vote"
              ? Boolean(nominationVoting?.draft.voterIds.includes(player.id))
              : setupInformationSelection
              ? setupInformationSelection.selectedPlayerIds.includes(player.id)
              : phasePlayerSelection
                ? phasePlayerSelection.selectedPlayerIds.includes(player.id)
                : detailsPlayerId === player.id;
          const allowed = !phasePlayerSelection?.allowedPlayerIds
            || phasePlayerSelection.allowedPlayerIds.includes(player.id);
          const voteStatus = handoff === "vote" && nominationVoting
            ? voteStatusForPlayer(player, selected, nominationVoting.draft.voterIds, ruleState?.butlerVote)
            : undefined;
          const selectingNominator = handoff === "nomination" && !nominatorId;
          const nominationIneligible = handoff === "nomination" && (
            selectingNominator
              ? !dayState?.eligibleNominatorIds.includes(player.id)
              : !dayState?.eligibleNomineeIds.includes(player.id)
          );
          const disabled = busy
            || nominationIneligible
            || Boolean(handoff === "vote" && voteStatus?.disabled)
            || Boolean(setupInformationSelection?.disabled)
            || Boolean(phasePlayerSelection && (!allowed || phasePlayerSelection.disabled));
          const actor = actorPlayerId === player.id;
          const playerTokens = tokensByPlayerId[player.id] ?? [];
          const tokenCount = playerTokens.reduce((total, token) => total + (token.count ?? 1), 0);
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
          const deadVoteState = (handoff === "nomination" || handoff === "vote") && !player.alive
            ? player.ghostVoteUsed ? "spent" : "available"
            : undefined;
          const showGhostVoteIndicator = handoff === "vote" && deadVoteState === "available";
          const showSpentGhostVoteState = handoff === "vote" && deadVoteState === "spent";
          const targetSelected = selected && handoff === "target";
          const genericSelected = selected && !targetSelected;
          const voteSelected = selected && handoff === "vote";
          const nominationClass = selfNominee
            ? " issue116NominatorSeat issue116NomineeSeat issue116SelfNominationSeat"
            : selectionRole === "지명자" ? " issue116NominatorSeat"
              : selectionRole === "피지명자" ? " issue116NomineeSeat" : "";
          return {
            id: player.id,
            position,
            mobilePosition,
            interactive: !revealMode,
            buttonRef: (node) => {
              if (node) seatRefs.current.set(player.id, node);
              else seatRefs.current.delete(player.id);
            },
            className: `fixedSize assigned alignment-${player.alignment} kind-${characterKindClass(player.actualCharacter)} character-${player.actualCharacter}${player.alive ? "" : " snvDeadSeat"}${showGhostVoteIndicator ? " snvGhostVoteAvailable issue116GhostVoteSeat" : ""}${showSpentGhostVoteState ? " snvGhostVoteSpent issue116GhostVoteSpentSeat" : ""}${actor ? " snvCurrentActorSeat snvSeatStateActor" : ""}${genericSelected ? " selected issue116SelectedSeat snvSeatStateSelected" : ""}${nominationClass}${voteSelected ? ` issue116VoterSeat${player.alive ? "" : " snvSeatStateStrong"}` : ""}${targetSelected ? " snvSeatStateTarget" : ""}${disabled && selectionActive ? " issue116IneligibleSeat" : ""}`,
            ariaLabel: `${player.seat}번 좌석, ${player.name}, ${identityLabel}, ${voteStatus?.label ?? lifeVoteLabel}${actor ? ", 현재 행동자" : ""}${selectionRole ? `, ${selectionRole}` : selected ? ", 선택됨" : ""}${selectionActive ? "" : `, ${tokenCount ? `토큰 ${tokenCount}개` : "토큰 없음"}`}${automaticTokenLabels.length ? `, ${automaticTokenLabels.join(", ")}` : ""}, ${player.seat}번 ${player.name} 좌석 선택`,
            pressed: revealMode ? undefined : selectionActive ? selected : detailsPlayerId === player.id,
            disabled: gameEnded || (selectionActive ? disabled : false),
            onSelect: () => selectPlayer(player, disabled),
            onPointerDown: (event) => startLongPress(event, player),
            onPointerUp: cancelLongPress,
            onPointerCancel: cancelLongPress,
            onPointerLeave: cancelLongPress,
            content: <>
              <span className="snvSeatNumber">{player.seat}</span>
              {showGhostVoteIndicator ? <GhostVoteIcon /> : asset ? <img
                src={asset.src}
                alt=""
                style={showSpentGhostVoteState ? { filter: "grayscale(1) blur(.45px)", opacity: .42 } : undefined}
              /> : null}
              {!player.alive ? <FuneralIcon /> : null}
              <span className="snvSeatPlayerName">{player.name}</span>
              <small>{selectionRole ?? characterLabel(player.actualCharacter)}</small>
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
            </>,
          };
        })}
        overlay={handoff === "nomination" && nominator && nominee ? <NominationArrow
          nominatorIndex={players.indexOf(nominator)}
          nomineeIndex={players.indexOf(nominee)}
          label={`${nominator.name} → ${nominee.name} 지명`}
          desktopPositions={desktopPositions}
          mobilePositions={mobilePositions}
          markerPrefix="tbLiveNominationArrow"
        /> : undefined}
        center={handoff === "nomination" || handoff === "vote" ? undefined : <>
          <strong>{revealMode ? "첩자 공개" : gameEnded ? "게임 종료" : phaseLabel}</strong>
          {!revealMode && !gameEnded ? <time aria-label={`${phaseLabel} 경과 시간 ${phaseRuntime}`}>{phaseRuntime}</time> : null}
          {revealMode ? <button type="button" onClick={revealMode.onClose}>확인했으면 눈을 감으세요</button> : !gameEnded && !handoff ? <button type="button" onClick={onGoToProgress}>진행 →</button> : null}
        </>}
      />}
      inspector={handoff ? <TroubleBrewingSelectionPanel
        handoff={handoff}
        currentStep={currentStep}
        players={players}
        nominator={nominator}
        nominee={nominee}
        voterIds={nominationVoting?.draft.voterIds ?? []}
        selectedPlayerIds={setupInformationSelection?.selectedPlayerIds ?? phasePlayerSelection?.selectedPlayerIds ?? []}
        executionVoteThreshold={dayState?.executionVoteThreshold ?? 0}
        busy={busy}
        ready={Boolean(selectionReady)}
        onReset={onResetSelection}
        onConfirm={onConfirmSelection}
      /> : undefined}
    />
    {!revealMode && detailsPlayer && detailsCharacter ? <PlayerTokenDetailDialog
      appearance="tb"
      characterDetails={troubleBrewingCharacterDetail(detailsCharacter.id)}
      player={{
        characterId: detailsCharacter.id,
        seat: detailsPlayer.seat,
        name: detailsPlayer.name,
        characterLabel: detailsCharacter.label,
        characterKindLabel: kindLabels[detailsCharacter.kind],
        characterIconSrc: characterAsset(detailsCharacter.id)?.src,
        characterAbility: detailsCharacter.abilitySummary,
        alignment: detailsPlayer.alignment,
      }}
      tokens={tokensByPlayerId[detailsPlayer.id] ?? []}
      identityDetails={detailsCharacter.id === "drunk" && detailsShownCharacter ? <section className="tbDrunkIdentities" aria-label="주정뱅이 아이덴티티">
        <article><span>실제 직업</span><div>{characterAsset("drunk") ? <img src={characterAsset("drunk")?.src} alt="" /> : null}<strong>주정뱅이</strong></div></article>
        <article className="shown"><span>보여준 직업</span><div>{characterAsset(detailsShownCharacter.id) ? <img src={characterAsset(detailsShownCharacter.id)?.src} alt="" /> : null}<strong>{detailsShownCharacter.label}</strong></div></article>
      </section> : null}
      details={<>
        {detailsPlayer.notes ? <section className="tbPlayerNotes" aria-label="Notes"><span>Notes</span><p>{detailsPlayer.notes}</p></section> : null}
      </>}
      theme={theme}
      onClose={closePlayerDetails}
    /> : null}
    {editingPlayer && onUpdatePlayerAnnotations ? <PlayerAnnotationsDialog
      player={editingPlayer}
      busy={busy}
      onCancel={closeAnnotationEditor}
      onConfirm={onUpdatePlayerAnnotations}
    /> : null}
  </>;
}

function TroubleBrewingSelectionPanel({
  handoff,
  currentStep,
  players,
  nominator,
  nominee,
  voterIds,
  selectedPlayerIds,
  executionVoteThreshold,
  busy,
  ready,
  onReset,
  onConfirm,
}: {
  handoff: TroubleBrewingLiveHandoff;
  currentStep?: PhaseStep;
  players: Player[];
  nominator?: Player;
  nominee?: Player;
  voterIds: string[];
  selectedPlayerIds: string[];
  executionVoteThreshold: number;
  busy: boolean;
  ready: boolean;
  onReset?: () => void;
  onConfirm?: () => void;
}) {
  const targets = selectedPlayerIds.flatMap((id) => {
    const player = players.find((candidate) => candidate.id === id);
    return player ? [player] : [];
  });
  const setupInformationTargetCount = currentStep?.requiredInput.kind === "setupInfo"
    ? currentStep.requiredInput.maxSelections ?? 0
    : 0;
  const playerTargetCount = currentStep?.requiredInput.kind === "playerIds"
    ? currentStep.requiredInput.maxSelections ?? 0
    : 0;
  const numberedTargetCount = setupInformationTargetCount || (playerTargetCount > 1 ? playerTargetCount : 0);
  const target = targets[0];
  const targetLabel = target ? `${target.seat}번 ${target.name}` : "선택 전";
  const title = handoff === "nomination"
    ? "지명 선택"
    : handoff === "vote"
      ? "투표 집계"
      : targetSelectionTitle(currentStep);
  const confirmLabel = handoff === "nomination"
    ? nominator && nominee ? `${nominator.seat}번 → ${nominee.seat}번 지명 확정` : "지명자와 피지명자를 선택하세요"
    : handoff === "vote" ? `${voterIds.length}표로 투표 확정`
      : target ? "선택 확정" : "대상을 선택하세요";

  return <aside className="issue116SelectionPanel" aria-label="현재 마도서 작업">
    <header className="issue116SelectionHeader">
      {setupInformationTargetCount === 0 ? <h2>{title}</h2> : null}
      <button type="button" disabled={busy || (setupInformationTargetCount > 0 && targets.length === 0)} onClick={onReset}>
        {handoff === "nomination" ? "지명 초기화 X" : handoff === "vote" ? "투표 초기화 X" : setupInformationTargetCount > 0 ? "초기화" : "선택 초기화 X"}
      </button>
    </header>
    {setupInformationTargetCount > 0 ? <h2>{setupInformationTargetCount === 1 ? "한 명을 선택" : "두 명 선택"}</h2> : null}
    {handoff === "nomination" ? <dl>
      <div><dt>지명자</dt><dd>{playerLabel(nominator)}</dd></div>
      <div><dt>피지명자</dt><dd>{playerLabel(nominee)}</dd></div>
    </dl> : handoff === "vote" ? <dl className="issue116VoteSummary">
      <div><dt>지명</dt><dd>{playerLabel(nominator)} → {playerLabel(nominee)}</dd></div>
      <div><dt>현재</dt><dd className={voterIds.length >= executionVoteThreshold ? "thresholdMet" : ""}>{voterIds.length}표</dd><span aria-hidden="true">/</span><dd>처형 기준 {executionVoteThreshold}표</dd></div>
    </dl> : numberedTargetCount > 0 ? <dl>
      {targets.map((selectedTarget, index) => <div key={selectedTarget.id}>
        <dt>{targetOrdinal(index)}</dt><dd>{playerLabel(selectedTarget)}</dd>
      </div>)}
    </dl> : <dl>
      <div><dt>선택 대상</dt><dd>{targetLabel}</dd></div>
    </dl>}
    <button type="button" className="issue116PrimaryAction" disabled={!ready || busy} onClick={onConfirm}>{confirmLabel}</button>
  </aside>;
}

function playerLabel(player?: Player) {
  return player ? `${player.seat}번 ${player.name}` : "선택 전";
}

function targetOrdinal(index: number) {
  if (index === 0) return "첫 번째";
  if (index === 1) return "두 번째";
  return `${index + 1}번째`;
}

function targetSelectionTitle(step?: PhaseStep) {
  if (!step) return "대상 선택";
  if (step.id.endsWith(":fortuneTellerRedHerring")) return "선한 미끼 선택";
  if (step.character === "fortuneTeller") return "악마 확인";
  if (step.character === "poisoner") return "중독 대상";
  if (step.character === "monk") return "보호 대상";
  if (step.character === "imp") return "공격 대상";
  if (step.character === "ravenkeeper") return "캐릭터 확인";
  if (step.character === "butler") return "주인 선택";
  return currentActionPrompt(step) ?? "대상 선택";
}

function characterKindClass(characterId: string) {
  return characters.find((candidate) => candidate.id === characterId)?.kind.toLowerCase() ?? "unknown";
}
