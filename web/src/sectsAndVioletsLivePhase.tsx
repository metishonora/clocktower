import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { DayState, PhaseStep, Player, ReplayState } from "./core/types";
import {
  PlayerTokenCountBadge,
  PlayerTokenDetailDialog,
  type PlayerTokensByPlayerId,
} from "./features/grimoire/playerTokenPresentation";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacterDetail } from "./characterDetails";
import { CharacterDetailButton } from "./components/CharacterRulesCard";
import { sectsAndVioletsCharacters } from "./sectsAndVioletsCharacters";
import { centeredArrowPoints, grimoireHeights, inwardSelfNominationPath, rectangularSeatPositions } from "./sectsAndVioletsGrimoireLayout";
import "./features/phase-control/sectsAndVioletsInformationTask.css";
import "./issue116PhaseHandoffPrototype.css";
import "./features/grimoire/sectsAndVioletsSeatStates.css";

export type LiveHandoffKind = "nomination" | "vote" | "demon" | "snakeCharmer" | "dreamer" | "seamstress";
export type LiveHandoff = {
  kind: LiveHandoffKind;
  complete: boolean;
  actorPlayerId?: string;
};

export type LivePlayer = Player & {
  characterName: string;
  characterKind: "townsfolk" | "outsider" | "minion" | "demon";
};

export function SectsAndVioletsLiveProgress({
  replayState,
  phaseLabel,
  phaseRuntime,
  operationBusy,
  actorRoleName,
  actorCharacterId,
  actorSummary,
  onGoToGrimoire,
  onStartNomination,
  onEndNominations,
  onConfirmExecution,
  onStartDemonAttack,
  onStartSnakeCharmer,
  onAdvance,
  onResolveManual,
}: {
  replayState: ReplayState;
  phaseLabel: string;
  phaseRuntime: string;
  operationBusy: boolean;
  actorRoleName?: string;
  actorCharacterId?: string;
  actorSummary?: string;
  onGoToGrimoire: () => void;
  onStartNomination: () => void;
  onEndNominations: () => void;
  onConfirmExecution: () => void;
  onStartDemonAttack: () => void;
  onStartSnakeCharmer: () => void;
  onAdvance: () => void;
  onResolveManual: (outcome: "handled" | "notApplicable") => void;
}) {
  const step = replayState.currentStep;
  const dayState = replayState.dayState;
  const candidate = playerById(replayState.players, dayState?.executionCandidate?.nomineeId);
  const actor = playerById(replayState.players, step?.playerId);
  const isDay = replayState.phase === "day";

  return (
    <section className={`snvManualSurface snvTabPanel ${isDay ? "snvDaySurface" : "snvNightSurface"}`} aria-label={isDay ? "낮 진행" : "이후 밤 진행"}>
      <header className="snvFirstNightHeader">
        <button type="button" aria-label="마도서로 이동" onClick={onGoToGrimoire}>← 마도서</button>
        <div className="snvProgressPhaseHeader">
          <h2>{phaseLabel}</h2>
          <time
            className="snvProgressRuntime"
            aria-label={`${phaseLabel} 경과 시간 ${phaseRuntime}`}
          >
            {phaseRuntime}
          </time>
        </div>
      </header>
      <div className="snvFirstNightPrimary">
        {step?.requiredInput.kind === "nomination" ? (
          <article className="snvCurrentStep issue116CurrentStep">
            <h3>지명 및 투표</h3>
            <div className="issue116CandidateSummary" aria-label="현재 최고 득표">
              <strong>{candidate?.name ?? "후보 없음"}</strong>
              <span>{dayState?.highestVoteCount ?? 0}표</span>
            </div>
            <div className="snvStepActions issue116NominationActions">
              <button type="button" disabled={operationBusy} onClick={onStartNomination}>← 지명하기</button>
              <button type="button" className="secondary" disabled={operationBusy} onClick={onEndNominations}>지명 종료</button>
            </div>
          </article>
        ) : step?.stepType === "execution" || step?.stepType === "executionDeath" ? (
          <article className="snvCurrentStep issue116CurrentStep issue116ExecutionStep" role="group" aria-label="처형 결정">
            <div className="issue116ExecutionTarget">
              <span>처형 대상</span>
              <strong>{candidate?.name ?? "없음"}</strong>
            </div>
            <button type="button" className="issue116ExecutionConfirm" disabled={operationBusy} onClick={onConfirmExecution}>확정</button>
          </article>
        ) : step?.character === "snakeCharmer" && step.requiredInput.kind === "playerIds" && actor ? (
          <article className="snvCurrentStep issue116CurrentStep issue116DemonStep" role="group" aria-label="뱀 조련사 대상 선택">
            <CharacterDetailButton
              details={sectsAndVioletsCharacterDetail("snakeCharmer")}
              className="snvCurrentStepIdentity interactive snvInformationIdentity"
              theme="snv-night"
            >
              {sectsAndVioletsCharacterAsset("snakeCharmer") ? <img src={sectsAndVioletsCharacterAsset("snakeCharmer")!.src} alt="뱀 조련사 공식 캐릭터 아이콘" /> : null}
              <div>
                <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>뱀 조련사</span>
                <strong>{actor.name}</strong>
              </div>
            </CharacterDetailButton>
            <p className="snvInformationAbility">{actorSummary}</p>
            <div className="snvStepActions"><button type="button" disabled={operationBusy} onClick={onStartSnakeCharmer}>대상 선택</button></div>
          </article>
        ) : step && isDemonCharacter(step.character) && actor ? (
          <article className="snvCurrentStep issue116CurrentStep issue116DemonStep" role="group" aria-label="악마 공격">
            <div className="issue116ActorIdentity">
              <CharacterDetailButton
                details={sectsAndVioletsCharacterDetail(actorCharacterId ?? actor.actualCharacter)}
                className="issue116ActorRoleButton"
                theme="snv-night"
              >
                {sectsAndVioletsCharacterAsset(actor.actualCharacter) ? <img src={sectsAndVioletsCharacterAsset(actor.actualCharacter)!.src} alt={`${actorRoleName} 공식 캐릭터 아이콘`} /> : null}
                <h3>{actorRoleName}</h3>
              </CharacterDetailButton>
              <strong>{actor.name}</strong>
            </div>
            <p className="issue116AbilitySummary">{actorSummary}</p>
            <div className="snvStepActions"><button type="button" disabled={operationBusy} onClick={onStartDemonAttack}>← 공격</button></div>
          </article>
        ) : step ? (
          <article className={`snvCurrentStep issue116CurrentStep${isDay ? " snvDayStep" : ""}`}>
            {actor && step.character ? (
              <CharacterDetailButton
                details={sectsAndVioletsCharacterDetail(actorCharacterId ?? actor.actualCharacter)}
                className="snvCurrentStepIdentity interactive"
                theme={isDay ? "snv-day" : "snv-night"}
              >
                {sectsAndVioletsCharacterAsset(step.character) ? <img src={sectsAndVioletsCharacterAsset(step.character)!.src} alt={`${actorRoleName} 공식 캐릭터 아이콘`} /> : null}
                <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{actorRoleName}</span>
              </CharacterDetailButton>
            ) : <h3>{stepLabel(step)}</h3>}
            {actor ? <p>{actor.name}</p> : null}
            <div className="snvStepActions">
              {step.support === "manual" ? (
                <>
                  <button type="button" disabled={operationBusy} onClick={() => onResolveManual("handled")}>처리 완료</button>
                  <button type="button" className="secondary" disabled={operationBusy} onClick={() => onResolveManual("notApplicable")}>해당 없음</button>
                </>
              ) : <button type="button" disabled={operationBusy} onClick={onAdvance}>{advanceLabel(step)}</button>}
            </div>
          </article>
        ) : null}
      </div>
      <PhaseOverview replayState={replayState} />
    </section>
  );
}

export function SectsAndVioletsLiveGrimoire({
  players,
  phaseLabel,
  phaseRuntime = "00:00",
  currentStep,
  dayState,
  handoff,
  nominatorId,
  nomineeId,
  voterIds,
  targetId,
  targetIds = [],
  centerPrompt,
  operationBusy,
  tokensByPlayerId = {},
  onSeatClick,
  onConfirm,
  onReturn,
  onCancelDayHandoff,
  onResetDaySelection,
  onGoToProgress,
  onReturnToSetup,
}: {
  players: LivePlayer[];
  phaseLabel: string;
  phaseRuntime?: string;
  currentStep: PhaseStep | null;
  dayState?: DayState;
  handoff?: LiveHandoff;
  nominatorId?: string;
  nomineeId?: string;
  voterIds: string[];
  targetId?: string;
  targetIds?: string[];
  centerPrompt?: ReactNode;
  operationBusy: boolean;
  tokensByPlayerId?: PlayerTokensByPlayerId;
  onSeatClick: (playerId: string) => void;
  onConfirm: () => void;
  onReturn: () => void;
  onCancelDayHandoff: () => void;
  onResetDaySelection: () => void;
  onGoToProgress: () => void;
  onReturnToSetup: () => void;
}) {
  const [detailsPlayerId, setDetailsPlayerId] = useState<string>();
  const seatRefs = useRef(new Map<string, HTMLButtonElement>());
  const desktopPositions = useMemo(() => rectangularSeatPositions(players.length, false), [players.length]);
  const mobilePositions = useMemo(() => rectangularSeatPositions(players.length, true), [players.length]);
  const heights = grimoireHeights(players.length);
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;
  const actorId = handoff?.actorPlayerId ?? currentStep?.playerId;
  const targetVotes = Math.max(dayState?.executionVoteThreshold ?? 1, (dayState?.highestVoteCount ?? 0) + (dayState?.nominations.length ? 1 : 0));
  const isFirstVote = (dayState?.nominations.length ?? 0) === 0;
  const modeClass = handoff?.kind === "nomination"
    ? " issue116NominationMode"
    : handoff?.kind === "vote" ? " issue116VoteMode" : handoff?.kind === "demon" || handoff?.kind === "snakeCharmer" || handoff?.kind === "dreamer" || handoff?.kind === "seamstress" ? " issue116AttackMode" : "";
  const nominator = playerById(players, nominatorId);
  const nominee = playerById(players, nomineeId);
  const target = playerById(players, targetId);
  const detailsPlayer = playerById(players, detailsPlayerId);
  const detailsCharacter = sectsAndVioletsCharacters.find(
    (character) => character.id === detailsPlayer?.actualCharacter,
  );
  const detailsAsset = sectsAndVioletsCharacterAsset(detailsPlayer?.actualCharacter);
  const informationTargetCount = handoff?.kind === "dreamer" ? 1 : handoff?.kind === "seamstress" ? 2 : 0;
  const ready = handoff?.kind === "nomination" ? Boolean(nominatorId && nomineeId)
    : handoff?.kind === "demon" || handoff?.kind === "snakeCharmer" ? Boolean(targetId)
      : informationTargetCount > 0 ? targetIds.length === informationTargetCount : true;

  const closePlayerDetails = useCallback(() => {
    const returningPlayerId = detailsPlayerId;
    setDetailsPlayerId(undefined);
    requestAnimationFrame(() => returningPlayerId && seatRefs.current.get(returningPlayerId)?.focus());
  }, [detailsPlayerId]);

  useEffect(() => {
    if (handoff) setDetailsPlayerId(undefined);
  }, [handoff]);

  return (
    <section className={`snvSeatingSurface snvTabPanel issue116GrimoireSurface${modeClass}`} aria-label={currentStep?.phase === "day" ? "낮 마도서" : "밤 마도서"}>
      {handoff ? (
        <div className="snvSeatingToolbar" aria-label="마도서 도구">
          <span className="issue116PhaseChip">{phaseLabel}</span>
          {actorId ? <div className="snvCurrentActorLegend" aria-label="현재 행동자 안내"><span aria-hidden="true" />현재 행동자</div> : null}
          {!handoff.complete && (handoff.kind === "nomination" || handoff.kind === "vote") ? (
            <button type="button" disabled={operationBusy} onClick={onCancelDayHandoff}>{handoff.kind === "nomination" ? "돌아가기 →" : "투표 취소 →"}</button>
          ) : null}
        </div>
      ) : (
        <div className="snvSeatingToolbar" aria-label="마도서 도구">
          <button type="button" className="snvToolbarBack destructive" aria-label="배치로 돌아가기" onClick={onReturnToSetup}><span aria-hidden="true">←</span></button>
        </div>
      )}
      <div className={`snvSeatingWorkspace stable${handoff ? "" : " issue116ReferenceWorkspace"}`} style={sizeStyle}>
        <div className="snvGrimoireDraft rectangular" aria-label={`${players.length}자리 그리모어`} style={sizeStyle}>
          {players.map((player, index) => {
            const playerTokens = tokensByPlayerId[player.id] ?? [];
            const selected = handoff?.kind === "nomination"
              ? player.id === nominatorId || player.id === nomineeId
              : handoff?.kind === "vote" ? voterIds.includes(player.id)
                : informationTargetCount > 0 ? targetIds.includes(player.id) : player.id === targetId;
            const selfNominee = handoff?.kind === "nomination"
              && player.id === nominatorId && player.id === nomineeId;
            const selectionRole = handoff?.kind === "nomination"
              ? selfNominee ? "지명자 · 피지명자" : player.id === nominatorId ? "지명자" : player.id === nomineeId ? "피지명자" : undefined
              : handoff?.kind === "vote" && selected ? "투표"
                : handoff?.kind === "demon" && selected ? "공격 대상"
                  : (handoff?.kind === "snakeCharmer" || informationTargetCount > 0) && selected ? "선택 대상" : undefined;
            const selectionClass = selfNominee ? " issue116NominatorSeat issue116NomineeSeat issue116SelfNominationSeat"
              : selectionRole === "지명자" ? " issue116NominatorSeat"
              : selectionRole === "피지명자" ? " issue116NomineeSeat"
                : selectionRole === "투표" ? " issue116VoterSeat"
                  : selectionRole === "공격 대상" || selectionRole === "선택 대상" ? " snvSeatStateTarget" : "";
            const nominationSelectingNominator = handoff?.kind === "nomination" && !nominatorId;
            const ineligible = nominationSelectingNominator
              ? !dayState?.eligibleNominatorIds.includes(player.id)
              : handoff?.kind === "nomination" ? !dayState?.eligibleNomineeIds.includes(player.id)
                : handoff?.kind === "snakeCharmer" || informationTargetCount > 0 ? !currentStep?.requiredInput.allowedPlayerIds?.includes(player.id)
                  : false;
            const spentGhostCannotVote = handoff?.kind === "vote" && !player.alive && player.ghostVoteUsed;
            const showDeadVoteState = handoff?.kind === "nomination" || handoff?.kind === "vote";
            const deadState = showDeadVoteState && !player.alive ? player.ghostVoteUsed ? "spent" : "available" : undefined;
            const deadActionLabel = deadState
              ? handoff?.kind === "vote"
                ? spentGhostCannotVote ? "투표 불가" : "투표 가능"
                : nominationSelectingNominator ? "지명 불가"
                  : ineligible ? "피지명 불가" : "피지명 가능"
              : undefined;
            const asset = sectsAndVioletsCharacterAsset(player.actualCharacter);
            const tokenCountLabel = playerTokens.length > 0 ? `토큰 ${playerTokens.length}개` : "토큰 없음";
            const actor = actorId === player.id;
            const targetSeat = selectionRole === "공격 대상" || selectionRole === "선택 대상";
            const settledOther = Boolean(handoff?.complete && !actor && !targetSeat);
            const genericSelected = selected && !targetSeat;
            const strongSelection = !player.alive && genericSelected
              && (selectionRole === "피지명자" || selectionRole === "투표");
            const showGhostVoteIndicator = handoff?.kind === "vote" && deadState === "available";
            const showSpentGhostVoteState = handoff?.kind === "vote" && deadState === "spent";
            const seatStateLabels = [
              handoff ? undefined : tokenCountLabel,
              player.alive ? "생존" : "사망",
              actor ? "현재 행동자" : undefined,
              selectionRole,
              deadActionLabel ?? (ineligible ? "선택 불가" : undefined),
            ].filter(Boolean).join(", ");
            return (
              <Fragment key={player.id}>
                <button
                  ref={(node) => {
                    if (node) seatRefs.current.set(player.id, node);
                    else seatRefs.current.delete(player.id);
                  }}
                  type="button"
                  className={`fixedSize assigned alignment-${player.alignment} kind-${player.characterKind}${player.alive ? "" : " snvDeadSeat"}${showSpentGhostVoteState ? " snvGhostVoteSpent" : ""}${actor ? " snvCurrentActorSeat snvSeatStateActor" : ""}${genericSelected ? " issue116SelectedSeat snvSeatStateSelected" : ""}${strongSelection ? " snvSeatStateStrong" : ""}${selectionClass}${ineligible ? " issue116IneligibleSeat" : ""}${settledOther ? " snvSettledOtherSeat" : ""}`}
                  aria-label={`${player.seat}번 좌석, ${player.name}, ${player.characterName}, ${seatStateLabels}`}
                  aria-pressed={handoff ? selected : undefined}
                  disabled={Boolean(handoff && (handoff.complete || ineligible || spentGhostCannotVote || operationBusy))}
                  style={{
                    "--seat-x": `${desktopPositions[index].x}%`,
                    "--seat-y": `${desktopPositions[index].y}%`,
                    "--mobile-seat-x": `${mobilePositions[index].x}%`,
                    "--mobile-seat-y": `${mobilePositions[index].y}%`,
                    filter: showSpentGhostVoteState ? "grayscale(1)" : undefined,
                  } as CSSProperties}
                  onClick={() => handoff ? onSeatClick(player.id) : setDetailsPlayerId(player.id)}
                >
                  <span className="snvSeatNumber">{player.seat}</span>
                  {showGhostVoteIndicator ? <GhostVoteIcon /> : asset ? (
                    <img
                      src={asset.src}
                      alt=""
                      style={showSpentGhostVoteState ? { filter: "grayscale(1) blur(.45px)", opacity: .42 } : undefined}
                    />
                  ) : null}
                  {!player.alive ? <FuneralIcon /> : null}
                  <span className="snvSeatPlayerName">{player.name}</span>
                  <small>{selectionRole ?? player.characterName}</small>
                </button>
                {!centerPrompt && (!handoff || handoff.complete) ? (
                  <PlayerTokenCountBadge
                    count={playerTokens.length}
                    position={desktopPositions[index]}
                    mobilePosition={mobilePositions[index]}
                    theme={currentStep?.phase === "day" ? "day" : "night"}
                  />
                ) : null}
              </Fragment>
            );
          })}
          {handoff?.kind === "nomination" && nominator && nominee ? (
            <NominationArrow
              nominatorIndex={players.indexOf(nominator)}
              nomineeIndex={players.indexOf(nominee)}
              label={`${nominator.name} → ${nominee.name} 지명`}
              desktopPositions={desktopPositions}
              mobilePositions={mobilePositions}
            />
          ) : null}
          {centerPrompt ? (
            <div className="snvGrimoireCenter live issue116PhaseClock snakeCharmerPromptCenter">
              {centerPrompt}
            </div>
          ) : !handoff || handoff.kind === "demon" || handoff.kind === "snakeCharmer" || informationTargetCount > 0 ? (
            <div className="snvGrimoireCenter live issue116PhaseClock" role="group" aria-label="현재 단계">
              <strong>{phaseLabel}</strong>
              <time aria-label={`${phaseLabel} 경과 시간 ${phaseRuntime}`}>{phaseRuntime}</time>
              {!handoff ? <button type="button" onClick={onGoToProgress}>진행 →</button> : null}
            </div>
          ) : null}
        </div>
        {handoff && !centerPrompt ? (
          <aside className={`issue116SelectionPanel${handoff.complete ? " snvSelectionCompletePanel" : ""}`} aria-label="현재 마도서 작업">
            <header className="issue116SelectionHeader">
              {informationTargetCount === 0 ? <h2>{handoffPanelTitle(handoff.kind, handoff.complete)}</h2> : null}
              {!handoff.complete && (handoff.kind === "nomination" || handoff.kind === "vote") ? (
                <button type="button" disabled={operationBusy} onClick={onResetDaySelection}>{handoff.kind === "nomination" ? "지명 초기화 X" : "투표 초기화 X"}</button>
              ) : !handoff.complete && informationTargetCount > 0 ? <button type="button" disabled={operationBusy || targetIds.length === 0} onClick={onResetDaySelection}>초기화</button> : null}
            </header>
            {informationTargetCount > 0 ? <h2>{informationTargetCount === 1 ? "한 명을 선택" : "두 명 선택"}</h2> : null}
            {handoff.kind === "nomination" ? (
              <dl><div><dt>지명자</dt><dd>{playerLabel(nominator)}</dd></div><div><dt>피지명자</dt><dd>{playerLabel(nominee)}</dd></div></dl>
            ) : handoff.kind === "vote" ? (
              <dl className="issue116VoteSummary">
                <div><dt>지명</dt><dd>{playerLabel(nominator)} → {playerLabel(nominee)}</dd></div>
                <div><dt>현재</dt><dd className={voterIds.length >= targetVotes ? "thresholdMet" : ""}>{voterIds.length}표</dd><span aria-hidden="true">/</span><dd>{isFirstVote ? `처형 기준 ${targetVotes}표` : `후보 기준 ${targetVotes}표`}</dd></div>
              </dl>
            ) : informationTargetCount > 0 ? (
              <dl>{targetIds.map((id, index) => <div key={id}><dt>{index + 1}번째</dt><dd>{playerLabel(playerById(players, id))}</dd></div>)}</dl>
            ) : (
              <dl><div><dt>행동자</dt><dd>{playerStateLabel(playerById(players, actorId))}</dd></div><div><dt>{handoff.kind === "snakeCharmer" ? "선택 대상" : "공격 대상"}</dt><dd>{playerStateLabel(target)}</dd></div></dl>
            )}
            {handoff.complete ? (
              <button type="button" className={`issue116PrimaryAction${handoff.kind === "vote" ? " issue116VoteCompleteAction" : " issue116NextAction"}`} onClick={onReturn}>{handoff.kind === "vote" ? "투표 완료 →" : "다음 →"}</button>
            ) : (
              <button type="button" className="issue116PrimaryAction" disabled={!ready || operationBusy} onClick={onConfirm}>{confirmLabel(handoff.kind, nominator, nominee, voterIds.length, target)}</button>
            )}
          </aside>
        ) : null}
      </div>
      {!handoff && detailsPlayer && detailsCharacter ? (
        <PlayerTokenDetailDialog
          player={{
            characterId: detailsPlayer.actualCharacter,
            seat: detailsPlayer.seat,
            name: detailsPlayer.name,
            characterLabel: detailsPlayer.characterName,
            characterKindLabel: characterKindLabel(detailsPlayer.characterKind),
            characterIconSrc: detailsAsset?.src,
            characterAbility: detailsCharacter.ability,
            alignment: detailsPlayer.alignment,
          }}
          tokens={tokensByPlayerId[detailsPlayer.id] ?? []}
          theme={currentStep?.phase === "day" ? "day" : "night"}
          onClose={closePlayerDetails}
        />
      ) : null}
    </section>
  );
}

function PhaseOverview({ replayState }: { replayState: ReplayState }) {
  return (
    <ol className="snvPhaseOverview" aria-label={replayState.phase === "day" ? "낮 순서" : "이후 밤 순서"}>
      {replayState.phaseOverview.map((step) => (
        <li key={step.id} className={step.status === "current" ? "current" : ["complete", "manualComplete", "skipped", "notApplicable"].includes(step.status) ? "complete" : ""}>
          <span>{step.status === "current" ? "현재" : ["complete", "manualComplete"].includes(step.status) ? "완료" : step.status === "notApplicable" ? "해당 없음" : step.status === "skipped" ? "종료" : "대기"}</span>
          <strong>{stepLabel(step)}</strong>
        </li>
      ))}
    </ol>
  );
}

function stepLabel(step: PhaseStep) {
  const suffix = step.id.split(":").at(-1);
  if (step.requiredInput.kind === "nomination" || step.requiredInput.kind === "nominationVote") return "지명 및 투표";
  if (step.stepType === "execution" || step.stepType === "executionDeath") return "처형";
  if (suffix === "announceDeaths") return "아침 사망 발표";
  if (suffix === "whisper") return "밀담";
  if (suffix === "discussion") return "낮 진행";
  if (suffix === "toNight") return "밤으로";
  if (suffix === "toDay") return "낮으로";
  return step.character ?? suffix ?? step.id;
}

function advanceLabel(step: PhaseStep) {
  if (step.id.endsWith(":announceDeaths")) return "발표 완료";
  if (step.id.endsWith(":whisper")) return "밀담 종료";
  if (step.id.endsWith(":discussion")) return "지명 시작";
  return "다음 →";
}

function playerById<T extends Player>(players: T[], id?: string) {
  return id ? players.find((player) => player.id === id) : undefined;
}

function playerLabel(player?: Player) {
  return player ? `${player.seat}번 ${player.name}` : "미선택";
}

function playerStateLabel(player?: Player) {
  return player ? `${playerLabel(player)} · ${player.alive ? "생존" : "사망"}` : "미선택";
}

function handoffPanelTitle(kind: LiveHandoffKind, complete: boolean) {
  const task = kind === "nomination" ? "지명"
    : kind === "vote" ? "투표"
      : kind === "snakeCharmer" ? "뱀 조련사"
        : kind === "dreamer" ? "꿈꾸는 자"
          : kind === "seamstress" ? "재봉사" : "악마 공격";
  return complete ? `${task} 결과` : task;
}

function characterKindLabel(kind: LivePlayer["characterKind"]) {
  if (kind === "townsfolk") return "주민";
  if (kind === "outsider") return "외지인";
  if (kind === "minion") return "하수인";
  return "악마";
}

function confirmLabel(kind: LiveHandoffKind, nominator?: Player, nominee?: Player, votes = 0, target?: Player) {
  if (kind === "nomination") {
    if (!nominator) return "지명자를 선택하세요";
    if (!nominee) return "피지명자를 선택하세요";
    return `${nominator.seat}번 → ${nominee.seat}번 지명 확정`;
  }
  if (kind === "vote") return `${votes}표로 투표 확정`;
  if (kind === "dreamer" || kind === "seamstress") return "선택 확정";
  if (kind === "snakeCharmer") return target ? `${playerLabel(target)} 선택 확정` : "대상을 선택하세요";
  return target ? `${playerLabel(target)} 공격 확정` : "공격 대상을 선택하세요";
}

function isDemonCharacter(character?: string) {
  return character === "fangGu" || character === "vigormortis" || character === "noDashii" || character === "vortox";
}

function NominationArrow({ nominatorIndex, nomineeIndex, label, desktopPositions, mobilePositions }: {
  nominatorIndex: number;
  nomineeIndex: number;
  label: string;
  desktopPositions: { x: number; y: number }[];
  mobilePositions: { x: number; y: number }[];
}) {
  return <><ArrowGraphic className="desktop" label={label} start={desktopPositions[nominatorIndex]} end={desktopPositions[nomineeIndex]} /><ArrowGraphic className="mobile" start={mobilePositions[nominatorIndex]} end={mobilePositions[nomineeIndex]} /></>;
}

function ArrowGraphic({ className, label, start, end }: { className: string; label?: string; start: { x: number; y: number }; end: { x: number; y: number } }) {
  const selfNomination = start.x === end.x && start.y === end.y;
  return (
    <svg className={`issue116NominationArrow ${className}${selfNomination ? " issue116SelfNominationArrow" : ""}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={label} aria-hidden={label ? undefined : true}>
      <defs><marker id={`snvLiveArrow-${className}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
      {selfNomination ? <path d={inwardSelfNominationPath(start)} markerEnd={`url(#snvLiveArrow-${className})`} /> : <polyline points={centeredArrowPoints(start, end)} markerEnd={`url(#snvLiveArrow-${className})`} />}
    </svg>
  );
}

function FuneralIcon() {
  return <span className="snvFuneralIcon" aria-hidden="true"><svg viewBox="0 0 40 52"><path d="M4 2h32v46L20 39 4 48Z" /><path className="snvFuneralMark" d="M20 12v19M13 20h14" /></svg></span>;
}

function GhostVoteIcon() {
  return (
    <svg className="snvGhostVoteIcon" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 50V30C14 18 21 10 32 10s18 8 18 20v20l-6-5-6 5-6-5-6 5-6-5-6 5Z" />
    </svg>
  );
}
