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
import { troubleBrewingSeatPresentation } from "./troubleBrewingSeatPresentation";
import "../grimoire/sectsAndVioletsSeatStates.css";

export type TroubleBrewingLiveHandoff = "target" | "nomination" | "vote";

export type TroubleBrewingCompletedSelection = {
  title: string;
  actionLabel?: string;
  summary?: Array<{ label: string; value: string }>;
  onContinue: () => void;
};

export type TroubleBrewingSelectionChoices = {
  label: string;
  selectedId?: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
};

export type TroubleBrewingSeatMarker = {
  playerId: string;
  label: string;
  className: string;
};

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
  selectionChoices,
  seatMarkers = [],
  completedSelection,
  revealMode,
  interactionLocked = false,
  progressActionLabel = "진행 →",
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
  selectionChoices?: TroubleBrewingSelectionChoices;
  seatMarkers?: TroubleBrewingSeatMarker[];
  completedSelection?: TroubleBrewingCompletedSelection;
  revealMode?: {
    onClose: () => void;
  };
  /** Locks mutation affordances while retaining interactive read-only seat details. */
  interactionLocked?: boolean;
  progressActionLabel?: string;
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
  const detailsPresentation = detailsPlayer
    ? troubleBrewingSeatPresentation(detailsPlayer.actualCharacter, detailsPlayer.shownCharacter)
    : undefined;
  const detailsCharacter = characters.find((candidate) => candidate.id === detailsPresentation?.displayedCharacterId);
  const selectionActive = !revealMode && Boolean(handoff);
  const selectionComplete = Boolean(completedSelection);
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
    if (!onUpdatePlayerAnnotations || interactionLocked || busy || gameEnded) return;
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
          {!selectionComplete ? <button type="button" disabled={busy} onClick={onCancelSelection}>{handoff === "vote" ? "투표 취소 →" : handoff === "target" ? "선택 취소 →" : "돌아가기 →"}</button> : null}
        </GrimoireToolbar>
      ) : (
        <GrimoireToolbar ariaLabel="확정된 마도서 도구">
          <button type="button" className="snvToolbarBack destructive" disabled={busy || interactionLocked} aria-label="배치로 돌아가기" onClick={onReturnToAssignment}><span aria-hidden="true">←</span></button>
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
          const presentation = troubleBrewingSeatPresentation(player.actualCharacter, player.shownCharacter);
          const displayedCharacter = characters.find((candidate) => candidate.id === presentation.displayedCharacterId);
          const asset = characterAsset(presentation.displayedCharacterId);
          const selfNominee = handoff === "nomination"
            && player.id === nominatorId
            && player.id === nomineeId;
          const seatMarker = seatMarkers.find((marker) => marker.playerId === player.id);
          const targetRole = targetSelectionSeatLabel(currentStep);
          const selectionRole = handoff === "nomination"
            ? selfNominee ? "지명자 · 피지명자" : player.id === nominatorId ? "지명자" : player.id === nomineeId ? "피지명자" : undefined
            : handoff === "vote" && nominationVoting?.draft.voterIds.includes(player.id) ? "투표"
              : handoff === "target" && (setupInformationSelection?.selectedPlayerIds.includes(player.id) || phasePlayerSelection?.selectedPlayerIds.includes(player.id)) ? targetRole : seatMarker?.label;
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
          const additionalAutomaticTokenLabels = automaticTokenLabels.filter((label) => label !== selectionRole);
          const actualCharacterLabel = characterLabel(player.actualCharacter);
          const identityLabel = presentation.hasHiddenActualIdentity
            ? `실제 ${actualCharacterLabel}, 표시 ${displayedCharacter?.label ?? characterLabel(presentation.displayedCharacterId)}`
            : actualCharacterLabel;
          const deadVoteState = (handoff === "nomination" || handoff === "vote") && !player.alive
            ? player.ghostVoteUsed ? "spent" : "available"
            : undefined;
          const showGhostVoteIndicator = handoff === "vote" && deadVoteState === "available";
          const showSpentGhostVoteState = handoff === "vote" && deadVoteState === "spent";
          const targetSelected = selected && handoff === "target";
          const genericSelected = selected && !targetSelected;
          const voteSelected = selected && handoff === "vote";
          const settledOther = selectionComplete && !actor && !targetSelected && !seatMarker;
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
            className: `fixedSize assigned alignment-${player.alignment} kind-${characterKindClass(presentation.displayedCharacterId)} character-${presentation.displayedCharacterId}${player.alive ? "" : " snvDeadSeat"}${showGhostVoteIndicator ? " snvGhostVoteAvailable issue116GhostVoteSeat" : ""}${showSpentGhostVoteState ? " snvGhostVoteSpent issue116GhostVoteSpentSeat" : ""}${actor ? " snvCurrentActorSeat snvSeatStateActor" : ""}${genericSelected ? " selected issue116SelectedSeat snvSeatStateSelected" : ""}${nominationClass}${voteSelected ? ` issue116VoterSeat${player.alive ? "" : " snvSeatStateStrong"}` : ""}${targetSelected ? ` snvSeatStateTarget ${targetSelectionStateClass(currentStep)}` : ""}${seatMarker ? ` ${seatMarker.className}` : ""}${settledOther ? " snvSettledOtherSeat" : ""}${disabled && selectionActive && !seatMarker ? " issue116IneligibleSeat" : ""}`,
            ariaLabel: `${player.seat}번 좌석, ${player.name}, ${identityLabel}, ${voteStatus?.label ?? lifeVoteLabel}${actor ? ", 현재 행동자" : ""}${selectionRole ? `, ${selectionRole}` : selected ? ", 선택됨" : ""}${selectionActive ? "" : `, ${tokenCount ? `토큰 ${tokenCount}개` : "토큰 없음"}`}${additionalAutomaticTokenLabels.length ? `, ${additionalAutomaticTokenLabels.join(", ")}` : ""}, ${player.seat}번 ${player.name} 좌석 선택`,
            pressed: revealMode ? undefined : selectionActive ? selected : detailsPlayerId === player.id,
            disabled: gameEnded || selectionComplete || (selectionActive ? disabled : false),
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
              <small>{selectionRole ?? displayedCharacter?.label ?? characterLabel(presentation.displayedCharacterId)}</small>
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
          {revealMode ? <button type="button" onClick={revealMode.onClose}>확인했으면 눈을 감으세요</button> : !gameEnded && !handoff ? <button type="button" onClick={onGoToProgress}>{progressActionLabel}</button> : null}
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
        selectionChoices={selectionChoices}
        completedSelection={completedSelection}
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
  selectionChoices,
  completedSelection,
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
  selectionChoices?: TroubleBrewingSelectionChoices;
  completedSelection?: TroubleBrewingCompletedSelection;
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
  const targetLabel = target
    ? `${target.seat}번 ${target.name}${completedSelection ? ` · ${target.alive ? "생존" : "사망"}` : ""}`
    : "선택 전";
  const title = completedSelection?.title ?? (handoff === "nomination"
    ? "지명 선택"
    : handoff === "vote"
      ? "투표 집계"
      : targetSelectionTitle(currentStep));
  const confirmLabel = handoff === "nomination"
    ? nominator && nominee ? `${nominator.seat}번 → ${nominee.seat}번 지명 확정` : "지명자와 피지명자를 선택하세요"
    : handoff === "vote" ? `${voterIds.length}표로 투표 확정`
      : target ? "선택 확정" : "대상을 선택하세요";

  return <aside className={`issue116SelectionPanel${completedSelection ? " snvSelectionCompletePanel" : ""}`} aria-label="현재 마도서 작업">
    <header className="issue116SelectionHeader">
      <h2>{title}</h2>
      {!completedSelection ? <button type="button" disabled={busy || (setupInformationTargetCount > 0 && targets.length === 0)} onClick={onReset}>
        {handoff === "nomination" ? "지명 초기화 X" : handoff === "vote" ? "투표 초기화 X" : setupInformationTargetCount > 0 ? "초기화" : "선택 초기화 X"}
      </button> : null}
    </header>
    {completedSelection?.summary ? <dl>
      {completedSelection.summary.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
    </dl> : handoff === "nomination" ? <dl>
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
      <div><dt>{targetSelectionFieldLabel(currentStep)}</dt><dd>{targetLabel}</dd></div>
    </dl>}
    {selectionChoices ? <fieldset className="tbSelectionChoices">
      <legend>{selectionChoices.label}</legend>
      {selectionChoices.options.map((option) => <button
        type="button"
        className={selectionChoices.selectedId === option.id ? "selected" : ""}
        aria-pressed={selectionChoices.selectedId === option.id}
        disabled={busy}
        onClick={() => selectionChoices.onChange(option.id)}
        key={option.id}
      >{option.label}</button>)}
    </fieldset> : null}
    {completedSelection ? (
      <button type="button" className="issue116PrimaryAction issue116NextAction" disabled={busy} onClick={completedSelection.onContinue}>{completedSelection.actionLabel ?? "다음 →"}</button>
    ) : (
      <button type="button" className="issue116PrimaryAction" disabled={!ready || busy} onClick={onConfirm}>{confirmLabel}</button>
    )}
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
  if (step.id.endsWith(":fortuneTellerDecoy")) return "착각 대상 지정";
  if (step.id.endsWith(":fortuneTellerRedHerring")) return "오답 대상 지정";
  if (step.id.endsWith(":mayorBounce")) return "시장 능력";
  if (step.character === "washerwoman") return "세탁부 능력";
  if (step.character === "librarian") return "사서 능력";
  if (step.character === "investigator") return "수사관 능력";
  if (step.character === "fortuneTeller") return "점쟁이 능력";
  if (step.character === "poisoner") return "독살범 능력";
  if (step.character === "monk") return "수도사 능력";
  if (step.character === "imp") return "임프 능력";
  if (step.character === "ravenkeeper") return "까마귀지기 능력";
  if (step.character === "butler") return "집사 능력";
  return currentActionPrompt(step) ?? "대상 선택";
}

function targetSelectionFieldLabel(step?: PhaseStep) {
  if (!step) return "선택 대상";
  if (step.id.endsWith(":fortuneTellerDecoy")) return "착각 대상";
  if (step.id.endsWith(":fortuneTellerRedHerring")) return "오답 대상";
  if (step.id.endsWith(":mayorBounce")) return "대신 사망 대상";
  if (step.character === "poisoner") return "중독 대상";
  if (step.character === "monk") return "보호 대상";
  if (step.character === "imp") return "공격 대상";
  if (step.character === "ravenkeeper") return "확인 대상";
  if (step.character === "butler") return "주인";
  return "선택 대상";
}

function targetSelectionSeatLabel(step?: PhaseStep) {
  if (!step) return "선택";
  if (step.id.endsWith(":fortuneTellerDecoy")) return "착각 대상";
  if (step.id.endsWith(":fortuneTellerRedHerring")) return "오답 대상";
  if (step.id.endsWith(":mayorBounce")) return "대신 사망";
  if (step.character === "poisoner") return "중독";
  if (step.character === "monk") return "보호";
  if (step.character === "imp") return "공격";
  if (step.character === "butler") return "주인";
  return "선택";
}

function targetSelectionStateClass(step?: PhaseStep) {
  if (step?.id.endsWith(":fortuneTellerDecoy")) return "tbSeatStateDecoy";
  if (step?.id.endsWith(":mayorBounce")) return "tbSeatStateMayorBounce";
  if (step?.character === "poisoner") return "tbSeatStatePoison";
  if (step?.character === "imp") return "tbSeatStateAttack";
  return "tbSeatStateSelection";
}

function characterKindClass(characterId: string) {
  return characters.find((candidate) => candidate.id === characterId)?.kind.toLowerCase() ?? "unknown";
}
