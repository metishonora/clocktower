import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ConfirmedDayActionRecord, DayState, PhaseOverviewItem, PhaseStep, Player, ReplayState } from "./core/types";
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
import { DayActionRecordHistory } from "./features/day-actions/DayActionDock";
import {
  acquiredAbilityCharacterForStep,
  AcquiredAbilityPresentation,
} from "./features/phase-control/acquiredAbilityPresentation";
import {
  PitHagArbitraryDeathsPanel,
  PitHagSelectionPanel,
  type PitHagDemonIntent,
} from "./features/pitHag/PitHagSelectionPanel";
import { NightResultsAnnouncement } from "./features/phase-control/NightResultsAnnouncement";
import { PlayerImpairmentBadges } from "./features/phase-control/ImpairmentBadges";

export type LiveHandoffKind = "nomination" | "vote" | "demon" | "vigormortisPoison" | "snakeCharmer" | "pitHag" | "pitHagDeaths" | "cerenovus" | "evilTwin" | "witch" | "dreamer" | "seamstress" | "sweetheart" | "barber" | "klutz";
export type LiveHandoff = {
  kind: LiveHandoffKind;
  complete: boolean;
  actorPlayerId?: string;
  selectionStage?: "attack" | "poison" | "chooser" | "reveal" | "swap";
  sourceEventId?: string;
};

export type LivePlayer = Player & {
  seatCharacterId?: string;
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
  priorityPanel,
  priorityPanelPlayerSafe = false,
  onGoToGrimoire,
  onStartNomination,
  onEndNominations,
  onConfirmExecution,
  onStartDemonAttack,
  onStartSnakeCharmer,
  onStartPitHag = () => undefined,
  onStartPitHagDeaths = () => undefined,
  onStartCerenovus,
  onStartEvilTwin = () => undefined,
  onStartWitch = () => undefined,
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
  priorityPanel?: ReactNode;
  priorityPanelPlayerSafe?: boolean;
  onGoToGrimoire: () => void;
  onStartNomination: () => void;
  onEndNominations: () => void;
  onConfirmExecution: () => void;
  onStartDemonAttack: () => void;
  onStartSnakeCharmer: () => void;
  onStartPitHag?: () => void;
  onStartPitHagDeaths?: () => void;
  onStartCerenovus: () => void;
  onStartEvilTwin?: () => void;
  onStartWitch?: () => void;
  onAdvance: () => void;
  onResolveManual: (outcome: "handled" | "notApplicable") => void;
}) {
  const step = replayState.currentStep;
  const dayState = replayState.dayState;
  const pendingMadnessExecution = replayState.pendingMadnessExecution;
  const candidate = playerById(
    replayState.players,
    pendingMadnessExecution?.targetPlayerId ?? dayState?.executionCandidate?.nomineeId,
  );
  const actor = playerById(replayState.players, step?.playerId);
  const acquiredAbilityCharacterId = acquiredAbilityCharacterForStep(step, actor);
  const isDay = replayState.phase === "day";
  const actorStatus = <PlayerImpairmentBadges
    activeImpairments={replayState.ruleState.activeImpairments}
    playerId={actor?.id}
  />;

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
        {priorityPanel ?? (step?.requiredInput.kind === "nomination" ? (
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
          <article className="snvCurrentStep issue116CurrentStep issue116ExecutionStep" role="group" aria-label={pendingMadnessExecution ? "집착 위반 처형 사망 확인" : "처형 결정"}>
            <div className="issue116ExecutionTarget">
              <span>{pendingMadnessExecution ? "집착 위반 처형" : "처형 대상"}</span>
              <strong>{candidate ? pendingMadnessExecution ? `${candidate.seat}번 ${candidate.name}` : candidate.name : "없음"}</strong>
            </div>
            <button
              type="button"
              className={`issue116ExecutionConfirm${pendingMadnessExecution ? " issue116NightTransitionAction" : ""}`}
              disabled={operationBusy}
              onClick={onConfirmExecution}
            >{pendingMadnessExecution ? "처형 후 밤으로" : "확정"}</button>
          </article>
        ) : (step?.character === "evilTwin" || step?.character === "witch") && step.requiredInput.kind === "playerIds" && actor ? (
          <article className="snvCurrentStep issue116CurrentStep issue116DemonStep" role="group" aria-label={step.character === "evilTwin" ? "쌍둥이 지정" : "마녀 저주 지정"}>
            {acquiredAbilityCharacterId ? <AcquiredAbilityPresentation
              actor={actor}
              abilityCharacterId={acquiredAbilityCharacterId}
              abilityOrigin={step.abilityOrigin!}
              abilityStatusNode={actorStatus}
              actorIdentityClassName="snvCurrentStepIdentity interactive snvInformationIdentity"
              theme="snv-night"
            /> : <CharacterDetailButton
              details={sectsAndVioletsCharacterDetail(step.character)}
              className="snvCurrentStepIdentity interactive snvInformationIdentity"
              theme="snv-night"
            >
              {sectsAndVioletsCharacterAsset(step.character) ? <img src={sectsAndVioletsCharacterAsset(step.character)!.src} alt="" /> : null}
              <div><span className="snvInformationRoleLine"><span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{step.character === "evilTwin" ? "사악한 쌍둥이" : "마녀"}</span>{actorStatus}</span><strong>{actor.name}</strong></div>
            </CharacterDetailButton>}
            {!acquiredAbilityCharacterId ? <p className="snvInformationAbility">{actorSummary}</p> : null}
            <div className="snvStepActions"><button type="button" disabled={operationBusy} onClick={step.character === "evilTwin" ? onStartEvilTwin : onStartWitch}>대상 선택</button></div>
          </article>
        ) : step?.character === "cerenovus" && step.requiredInput.kind === "madnessAssignment" && actor ? (
          <article className="snvCurrentStep issue116CurrentStep issue116DemonStep" role="group" aria-label="세레노버스 집착 지정">
            {acquiredAbilityCharacterId ? <AcquiredAbilityPresentation
              actor={actor}
              abilityCharacterId={acquiredAbilityCharacterId}
              abilityOrigin={step.abilityOrigin!}
              abilityStatusNode={actorStatus}
              actorIdentityClassName="snvCurrentStepIdentity interactive snvInformationIdentity"
              theme="snv-night"
            /> : <CharacterDetailButton
              details={sectsAndVioletsCharacterDetail("cerenovus")}
              className="snvCurrentStepIdentity interactive snvInformationIdentity"
              theme="snv-night"
            >
              {sectsAndVioletsCharacterAsset("cerenovus") ? <img src={sectsAndVioletsCharacterAsset("cerenovus")!.src} alt="세레노버스 공식 캐릭터 아이콘" /> : null}
              <div><span className="snvInformationRoleLine"><span className="snvCurrentStepRoleName" role="heading" aria-level={3}>세레노버스</span>{actorStatus}</span><strong>{actor.name}</strong></div>
            </CharacterDetailButton>}
            {!acquiredAbilityCharacterId ? <p className="snvInformationAbility">{actorSummary}</p> : null}
            <div className="snvStepActions"><button type="button" disabled={operationBusy} onClick={onStartCerenovus}>집착 지정</button></div>
          </article>
        ) : step?.character === "pitHag" && step.requiredInput.kind === "characterTransformation" && actor ? (
          <article className="snvCurrentStep issue116CurrentStep issue116DemonStep" role="group" aria-label="마귀할멈 직업 변경">
            {acquiredAbilityCharacterId ? <AcquiredAbilityPresentation
              actor={actor}
              abilityCharacterId={acquiredAbilityCharacterId}
              abilityOrigin={step.abilityOrigin!}
              abilityStatusNode={actorStatus}
              actorIdentityClassName="snvCurrentStepIdentity interactive snvInformationIdentity"
              theme="snv-night"
            /> : <CharacterDetailButton
              details={sectsAndVioletsCharacterDetail("pitHag")}
              className="snvCurrentStepIdentity interactive snvInformationIdentity"
              theme="snv-night"
            >
              {sectsAndVioletsCharacterAsset("pitHag") ? <img src={sectsAndVioletsCharacterAsset("pitHag")!.src} alt="마귀할멈 공식 캐릭터 아이콘" /> : null}
              <div><span className="snvInformationRoleLine"><span className="snvCurrentStepRoleName" role="heading" aria-level={3}>마귀할멈</span>{actorStatus}</span><strong>{actor.name}</strong></div>
            </CharacterDetailButton>}
            {!acquiredAbilityCharacterId ? <p className="snvInformationAbility">{actorSummary}</p> : null}
            <div className="snvStepActions"><button type="button" disabled={operationBusy} onClick={onStartPitHag}>← 선택</button></div>
          </article>
        ) : step?.stepType === "pitHagArbitraryDeaths" ? (
          <article className="snvCurrentStep issue116CurrentStep issue116DemonStep" role="group" aria-label="예측불허의 죽음">
            <h3>예측불허의 죽음</h3>
            <div className="snvStepActions"><button type="button" disabled={operationBusy} onClick={onStartPitHagDeaths}>사망자 선택</button></div>
          </article>
        ) : step?.character === "snakeCharmer" && step.requiredInput.kind === "playerIds" && actor ? (
          <article className="snvCurrentStep issue116CurrentStep issue116DemonStep" role="group" aria-label="뱀 조련사 대상 선택">
            {acquiredAbilityCharacterId ? <AcquiredAbilityPresentation
              actor={actor}
              abilityCharacterId={acquiredAbilityCharacterId}
              abilityOrigin={step.abilityOrigin!}
              abilityStatusNode={actorStatus}
              actorIdentityClassName="snvCurrentStepIdentity interactive snvInformationIdentity"
              theme="snv-night"
            /> : <CharacterDetailButton
              details={sectsAndVioletsCharacterDetail("snakeCharmer")}
              className="snvCurrentStepIdentity interactive snvInformationIdentity"
              theme="snv-night"
            >
              {sectsAndVioletsCharacterAsset("snakeCharmer") ? <img src={sectsAndVioletsCharacterAsset("snakeCharmer")!.src} alt="뱀 조련사 공식 캐릭터 아이콘" /> : null}
              <div>
                <span className="snvInformationRoleLine"><span className="snvCurrentStepRoleName" role="heading" aria-level={3}>뱀 조련사</span>{actorStatus}</span>
                <strong>{actor.name}</strong>
              </div>
            </CharacterDetailButton>}
            {!acquiredAbilityCharacterId ? <p className="snvInformationAbility">{actorSummary}</p> : null}
            <div className="snvStepActions"><button type="button" disabled={operationBusy} onClick={onStartSnakeCharmer}>대상 선택</button></div>
          </article>
        ) : step && isDemonCharacter(step.character) && actor ? (
          <article className="snvCurrentStep issue116CurrentStep issue116DemonStep" role="group" aria-label="악마 공격">
            {acquiredAbilityCharacterId ? <AcquiredAbilityPresentation
              actor={actor}
              abilityCharacterId={acquiredAbilityCharacterId}
              abilityOrigin={step.abilityOrigin!}
              abilityStatusNode={actorStatus}
              actorRoleName={actorRoleName}
              actorRoleNode={<h3>{actorRoleName}</h3>}
              actorIdentityClassName="issue116ActorRoleButton"
              theme="snv-night"
            /> : <div className="issue116ActorIdentity">
              <CharacterDetailButton
                details={sectsAndVioletsCharacterDetail(actorCharacterId ?? actor.actualCharacter)}
                className="issue116ActorRoleButton"
                theme="snv-night"
              >
                {sectsAndVioletsCharacterAsset(actor.actualCharacter) ? <img src={sectsAndVioletsCharacterAsset(actor.actualCharacter)!.src} alt={`${actorRoleName} 공식 캐릭터 아이콘`} /> : null}
                <h3>{actorRoleName}</h3>
              </CharacterDetailButton>
              {actorStatus}
              <strong>{actor.name}</strong>
            </div>}
            {!acquiredAbilityCharacterId ? <p className="issue116AbilitySummary">{actorSummary}</p> : null}
            <div className="snvStepActions"><button type="button" disabled={operationBusy} onClick={onStartDemonAttack}>← 공격</button></div>
          </article>
        ) : step?.stepType === "announcement" && step.id.endsWith(":announceDeaths") ? (
          <article className="snvCurrentStep issue116CurrentStep snvDayStep" role="group" aria-label="밤 결과 확인">
            <h3>밤 결과 확인</h3>
            <NightResultsAnnouncement
              players={replayState.players}
              deathPlayerIds={replayState.ruleState.unannouncedNightDeathPlayerIds}
              resurrectionPlayerIds={replayState.ruleState.unannouncedNightResurrectionPlayerIds ?? []}
            />
            <div className="snvStepActions"><button type="button" disabled={operationBusy} onClick={onAdvance}>발표 완료</button></div>
          </article>
        ) : step ? (
          <article className={`snvCurrentStep issue116CurrentStep${isDay ? " snvDayStep" : ""}`}>
            {actor && step.character ? (
              acquiredAbilityCharacterId ? <AcquiredAbilityPresentation
                actor={actor}
                abilityCharacterId={acquiredAbilityCharacterId}
                abilityOrigin={step.abilityOrigin!}
                abilityStatusNode={actorStatus}
                actorRoleName={actorRoleName}
                actorIdentityClassName="snvCurrentStepIdentity interactive"
                theme={isDay ? "snv-day" : "snv-night"}
              /> : <CharacterDetailButton
                details={sectsAndVioletsCharacterDetail(actorCharacterId ?? actor.actualCharacter)}
                className="snvCurrentStepIdentity interactive"
                theme={isDay ? "snv-day" : "snv-night"}
              >
                {sectsAndVioletsCharacterAsset(step.character) ? <img src={sectsAndVioletsCharacterAsset(step.character)!.src} alt={`${actorRoleName} 공식 캐릭터 아이콘`} /> : null}
                <span className="snvInformationRoleLine"><span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{actorRoleName}</span>{actorStatus}</span>
              </CharacterDetailButton>
            ) : <h3>{stepLabel(step, actor ? [actor] : undefined)}</h3>}
            {actor && !acquiredAbilityCharacterId ? <p>{actor.name}</p> : null}
            <div className="snvStepActions">
              {step.support === "manual" ? (
                <>
                  <button type="button" disabled={operationBusy} onClick={() => onResolveManual("handled")}>처리 완료</button>
                  <button type="button" className="secondary" disabled={operationBusy} onClick={() => onResolveManual("notApplicable")}>해당 없음</button>
                </>
              ) : <button type="button" disabled={operationBusy} onClick={onAdvance}>{advanceLabel(step)}</button>}
            </div>
          </article>
        ) : null)}
      </div>
      {priorityPanelPlayerSafe ? null : <PhaseOverview replayState={replayState} />}
    </section>
  );
}

export function SectsAndVioletsLiveGrimoire({
  players,
  currentActor,
  phaseLabel,
  phaseRuntime = "00:00",
  currentStep,
  dayState,
  handoff,
  nominatorId,
  nomineeId,
  voterIds,
  targetId,
  secondaryTargetId,
  referenceTargetId,
  selectablePlayerIds,
  targetIds = [],
  chooserId,
  characterId,
  pitHagDemonIntents = [],
  centerPrompt,
  handoffSupplement,
  handoffSupplementReady = true,
  operationBusy,
  tokensByPlayerId = {},
  dayActionRecords = [],
  onSeatClick,
  onCharacterChange = () => undefined,
  onConfirm,
  onDecline = () => undefined,
  onReturn,
  onCancelDayHandoff,
  onResetDaySelection,
  onResetAttackSelection = () => undefined,
  onGoToProgress,
  onReturnToSetup,
  readOnly = false,
  theme,
}: {
  players: LivePlayer[];
  currentActor?: Player;
  phaseLabel: string;
  phaseRuntime?: string;
  currentStep: PhaseStep | null;
  dayState?: DayState;
  handoff?: LiveHandoff;
  nominatorId?: string;
  nomineeId?: string;
  voterIds: string[];
  targetId?: string;
  secondaryTargetId?: string;
  referenceTargetId?: string;
  selectablePlayerIds?: string[];
  targetIds?: string[];
  chooserId?: string;
  characterId?: string;
  pitHagDemonIntents?: PitHagDemonIntent[];
  centerPrompt?: ReactNode;
  handoffSupplement?: ReactNode;
  handoffSupplementReady?: boolean;
  operationBusy: boolean;
  tokensByPlayerId?: PlayerTokensByPlayerId;
  dayActionRecords?: ConfirmedDayActionRecord[];
  onSeatClick: (playerId: string) => void;
  onCharacterChange?: (characterId: string) => void;
  onConfirm: () => void;
  onDecline?: () => void;
  onReturn: () => void;
  onCancelDayHandoff: () => void;
  onResetDaySelection: () => void;
  onResetAttackSelection?: () => void;
  onGoToProgress: () => void;
  onReturnToSetup: () => void;
  readOnly?: boolean;
  theme?: "day" | "night";
}) {
  const [detailsPlayerId, setDetailsPlayerId] = useState<string>();
  const phaseTheme = theme ?? (currentStep?.phase === "day" ? "day" : "night");
  const seatRefs = useRef(new Map<string, HTMLButtonElement>());
  const desktopPositions = useMemo(() => rectangularSeatPositions(players.length, false), [players.length]);
  const mobilePositions = useMemo(() => rectangularSeatPositions(players.length, true), [players.length]);
  const heights = grimoireHeights(players.length);
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;
  const actorId = handoff?.kind === "barber"
    ? handoff.actorPlayerId
    : handoff?.actorPlayerId ?? currentStep?.playerId;
  const acquiredHandoffAbilityCharacterId = actorId === currentActor?.id
    ? acquiredAbilityCharacterForStep(currentStep, currentActor)
    : undefined;
  const acquiredHandoffAbility = sectsAndVioletsCharacters.find(
    (character) => character.id === acquiredHandoffAbilityCharacterId,
  );
  const acquiredHandoffAbilityAsset = sectsAndVioletsCharacterAsset(acquiredHandoffAbilityCharacterId);
  const targetVotes = Math.max(dayState?.executionVoteThreshold ?? 1, (dayState?.highestVoteCount ?? 0) + (dayState?.nominations.length ? 1 : 0));
  const isFirstVote = (dayState?.nominations.length ?? 0) === 0;
  const modeClass = handoff?.kind === "nomination"
    ? " issue116NominationMode"
    : handoff?.kind === "vote" ? " issue116VoteMode" : handoff?.kind === "demon" || handoff?.kind === "vigormortisPoison" || handoff?.kind === "snakeCharmer" || handoff?.kind === "pitHag" || handoff?.kind === "pitHagDeaths" || handoff?.kind === "cerenovus" || handoff?.kind === "evilTwin" || handoff?.kind === "witch" || handoff?.kind === "dreamer" || handoff?.kind === "seamstress" || isDeathConsequenceHandoff(handoff) ? " issue116AttackMode" : "";
  const nominator = playerById(players, nominatorId);
  const nominee = playerById(players, nomineeId);
  const target = playerById(players, targetId);
  const secondaryTarget = playerById(players, secondaryTargetId);
  const referenceTarget = playerById(players, referenceTargetId);
  const detailsPlayer = playerById(players, detailsPlayerId);
  const detailsCharacter = sectsAndVioletsCharacters.find(
    (character) => character.id === (detailsPlayer?.seatCharacterId ?? detailsPlayer?.actualCharacter),
  );
  const detailsAsset = sectsAndVioletsCharacterAsset(detailsPlayer?.seatCharacterId ?? detailsPlayer?.actualCharacter);
  const detailsDayActionRecords = detailsPlayer
    ? dayActionRecords.filter((record) => record.actorPlayerId === detailsPlayer.id)
    : [];
  const informationTargetCount = handoff?.kind === "dreamer" ? 1 : handoff?.kind === "seamstress" ? 2 : 0;
  const barberTargetCount = handoff?.kind === "barber" && handoff.selectionStage === "swap" ? 2 : 0;
  const multipleTargetCount = informationTargetCount || barberTargetCount;
  const choosingVigormortisPoison = handoff?.kind === "vigormortisPoison"
    || (handoff?.kind === "demon" && handoff.selectionStage === "poison");
  const ready = handoff?.kind === "nomination" ? Boolean(nominatorId && nomineeId)
    : handoff?.kind === "vigormortisPoison" ? Boolean(targetId)
      : handoff?.kind === "sweetheart" || handoff?.kind === "klutz" ? Boolean(targetId)
      : handoff?.kind === "barber" ? handoff.selectionStage === "swap" ? targetIds.length === 2 : Boolean(chooserId)
      : handoff?.kind === "demon" ? Boolean(targetId && (handoff.selectionStage !== "poison" || secondaryTargetId))
      : handoff?.kind === "snakeCharmer" ? Boolean(targetId)
      : handoff?.kind === "pitHag" ? Boolean(targetId && characterId)
        : handoff?.kind === "pitHagDeaths" ? true
          : handoff?.kind === "cerenovus" ? Boolean(targetId) && handoffSupplementReady
            : handoff?.kind === "evilTwin" || handoff?.kind === "witch" ? Boolean(targetId)
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
    <section className={`snvSeatingSurface snvTabPanel issue116GrimoireSurface${modeClass}`} aria-label={readOnly ? "종료된 게임의 읽기 전용 마도서" : currentStep?.phase === "day" ? "낮 마도서" : "밤 마도서"}>
      {handoff ? (
        <div className="snvSeatingToolbar" aria-label="마도서 도구">
          <span className="issue116PhaseChip">{phaseLabel}</span>
          {actorId ? <div className="snvCurrentActorLegend" aria-label="현재 행동자 안내"><span aria-hidden="true" />현재 행동자</div> : null}
          {!handoff.complete && (handoff.kind === "nomination" || handoff.kind === "vote") ? (
            <button type="button" disabled={operationBusy} onClick={onCancelDayHandoff}>{handoff.kind === "nomination" ? "돌아가기 →" : "투표 취소 →"}</button>
          ) : !handoff.complete && (handoff.kind === "pitHag" || handoff.kind === "evilTwin" || handoff.kind === "witch" || isDeathConsequenceHandoff(handoff)) ? (
            <button type="button" disabled={operationBusy} onClick={onReturn}>선택 취소 →</button>
          ) : null}
        </div>
      ) : readOnly ? (
        <div className="snvSeatingToolbar" aria-label="마도서 도구"><span className="issue116PhaseChip">읽기 전용</span></div>
      ) : (
        <div className="snvSeatingToolbar" aria-label="마도서 도구">
          <button type="button" className="snvToolbarBack destructive" aria-label="배치로 돌아가기" onClick={onReturnToSetup}><span aria-hidden="true">←</span></button>
        </div>
      )}
      <div className={`snvSeatingWorkspace stable${handoff ? "" : " issue116ReferenceWorkspace"}`} style={sizeStyle}>
        <div className="snvGrimoireDraft rectangular" aria-label={`${players.length}자리 그리모어`} style={sizeStyle}>
          {players.map((player, index) => {
            const playerTokens = tokensByPlayerId[player.id] ?? [];
            const playerTokenCount = playerTokens.reduce(
              (total, token) => total + (token.count === undefined ? 1 : Math.max(1, token.count)),
              0,
            );
            const attackTarget = handoff?.kind === "demon" && handoff.selectionStage === "poison" && player.id === targetId;
            const poisonTarget = choosingVigormortisPoison && player.id === (handoff?.kind === "demon" ? secondaryTargetId : targetId);
            const selected = handoff?.kind === "nomination"
              ? player.id === nominatorId || player.id === nomineeId
              : handoff?.kind === "vote" ? voterIds.includes(player.id)
                : handoff?.kind === "barber" && handoff.selectionStage === "chooser" ? player.id === chooserId
                : handoff?.kind === "pitHagDeaths" || multipleTargetCount > 0 ? targetIds.includes(player.id)
                  : attackTarget || poisonTarget || player.id === targetId;
            const selfNominee = handoff?.kind === "nomination"
              && player.id === nominatorId && player.id === nomineeId;
            const selectionRole = handoff?.kind === "nomination"
              ? selfNominee ? "지명자 · 피지명자" : player.id === nominatorId ? "지명자" : player.id === nomineeId ? "피지명자" : undefined
              : handoff?.kind === "vote" && selected ? "투표"
                : poisonTarget ? "중독 대상"
                  : handoff?.kind === "sweetheart" && selected ? "취함 대상"
                  : handoff?.kind === "barber" && handoff.selectionStage === "chooser" && selected ? "행동자"
                  : handoff?.kind === "barber" && selected ? "교환 대상"
                  : handoff?.kind === "klutz" && selected ? "선택 대상"
                  : handoff?.kind === "demon" && (selected || attackTarget) ? "공격 대상"
                  : handoff?.kind === "pitHagDeaths" && selected ? "임의 사망"
                    : (handoff?.kind === "snakeCharmer" || handoff?.kind === "pitHag" || handoff?.kind === "cerenovus" || handoff?.kind === "evilTwin" || handoff?.kind === "witch" || informationTargetCount > 0) && selected ? "선택 대상" : undefined;
            const selectionClass = selfNominee ? " issue116NominatorSeat issue116NomineeSeat issue116SelfNominationSeat"
              : selectionRole === "지명자" ? " issue116NominatorSeat"
              : selectionRole === "피지명자" ? " issue116NomineeSeat"
                : selectionRole === "투표" ? " issue116VoterSeat"
                  : selectionRole === "중독 대상" ? " snvSeatStateTarget snvSeatStatePoisonTarget"
                    : selectionRole === "취함 대상" ? " snvSeatStateTarget snvSeatStateDrunkTarget"
                    : selectionRole === "공격 대상" || selectionRole === "선택 대상" || selectionRole === "교환 대상" || selectionRole === "임의 사망" ? " snvSeatStateTarget" : "";
            const nominationSelectingNominator = handoff?.kind === "nomination" && !nominatorId;
            const ineligible = nominationSelectingNominator
              ? !dayState?.eligibleNominatorIds.includes(player.id)
              : handoff?.kind === "nomination" ? !dayState?.eligibleNomineeIds.includes(player.id)
                : choosingVigormortisPoison ? !attackTarget && !selectablePlayerIds?.includes(player.id)
                  : isDeathConsequenceHandoff(handoff) ? !selectablePlayerIds?.includes(player.id)
                  : handoff?.kind === "snakeCharmer" || handoff?.kind === "pitHag" || handoff?.kind === "pitHagDeaths" || handoff?.kind === "cerenovus" || handoff?.kind === "evilTwin" || handoff?.kind === "witch" || informationTargetCount > 0 ? !currentStep?.requiredInput.allowedPlayerIds?.includes(player.id)
                  : false;
            const spentGhostCannotVote = handoff?.kind === "vote" && !player.alive && player.ghostVoteUsed;
            const selectionLocked = Boolean(attackTarget);
            const showDeadVoteState = handoff?.kind === "nomination" || handoff?.kind === "vote";
            const deadState = showDeadVoteState && !player.alive ? player.ghostVoteUsed ? "spent" : "available" : undefined;
            const deadActionLabel = deadState
              ? handoff?.kind === "vote"
                ? spentGhostCannotVote ? "투표 불가" : "투표 가능"
                : nominationSelectingNominator ? "지명 불가"
                  : ineligible ? "피지명 불가" : "피지명 가능"
              : undefined;
            const asset = sectsAndVioletsCharacterAsset(player.seatCharacterId ?? player.actualCharacter);
            const tokenCountLabel = playerTokenCount > 0 ? `토큰 ${playerTokenCount}개` : "토큰 없음";
            const actor = actorId === player.id;
            const targetSeat = selectionRole === "공격 대상" || selectionRole === "중독 대상" || selectionRole === "선택 대상" || selectionRole === "취함 대상" || selectionRole === "교환 대상" || selectionRole === "임의 사망";
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
                  className={`fixedSize assigned alignment-${player.alignment} kind-${player.characterKind}${player.alive ? "" : " snvDeadSeat"}${showGhostVoteIndicator ? " snvGhostVoteAvailable" : ""}${showSpentGhostVoteState ? " snvGhostVoteSpent" : ""}${actor ? " snvCurrentActorSeat snvSeatStateActor" : ""}${genericSelected ? " issue116SelectedSeat snvSeatStateSelected" : ""}${strongSelection ? " snvSeatStateStrong" : ""}${selectionClass}${ineligible ? " issue116IneligibleSeat" : ""}${settledOther ? " snvSettledOtherSeat" : ""}`}
                  aria-label={`${player.seat}번 좌석, ${player.name}, ${player.characterName}, ${seatStateLabels}`}
                  aria-pressed={handoff ? selected : undefined}
                  disabled={Boolean(handoff && (handoff.complete || ineligible || selectionLocked || spentGhostCannotVote || operationBusy))}
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
                    count={playerTokenCount}
                    position={desktopPositions[index]}
                    mobilePosition={mobilePositions[index]}
                    theme={phaseTheme}
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
          ) : !handoff || handoff.kind === "demon" || handoff.kind === "vigormortisPoison" || handoff.kind === "snakeCharmer" || handoff.kind === "pitHag" || handoff.kind === "pitHagDeaths" || handoff.kind === "cerenovus" || handoff.kind === "evilTwin" || handoff.kind === "witch" || isDeathConsequenceHandoff(handoff) || informationTargetCount > 0 ? (
            <div className="snvGrimoireCenter live issue116PhaseClock" role="group" aria-label="현재 단계">
              <strong>{phaseLabel}</strong>
              <time aria-label={`${phaseLabel} 경과 시간 ${phaseRuntime}`}>{phaseRuntime}</time>
              {!handoff ? <button type="button" onClick={onGoToProgress}>진행 →</button> : null}
            </div>
          ) : null}
        </div>
        {handoff && !centerPrompt && handoff.kind === "pitHag" ? (
          <PitHagSelectionPanel
            players={players}
            targetPlayerId={targetId}
            characterId={characterId}
            allowedCharacterIds={currentStep?.requiredInput.allowedCharacterIds ?? []}
            operationBusy={operationBusy}
            onCharacterChange={onCharacterChange}
            onConfirm={onConfirm}
          />
        ) : handoff && !centerPrompt && handoff.kind === "pitHagDeaths" ? (
          <PitHagArbitraryDeathsPanel
            players={players}
            selectedPlayerIds={targetIds}
            demonIntents={pitHagDemonIntents}
            operationBusy={operationBusy}
            onConfirm={onConfirm}
          />
        ) : handoff && !centerPrompt ? (
          <aside className={`issue116SelectionPanel${handoff.complete ? " snvSelectionCompletePanel" : ""}`} aria-label="현재 마도서 작업">
            <header className="issue116SelectionHeader">
              {informationTargetCount === 0 ? (
                <h2
                  className={acquiredHandoffAbilityCharacterId ? "issue107HandoffActionTitle" : undefined}
                  aria-label={acquiredHandoffAbilityCharacterId
                    ? `${acquiredHandoffAbility?.name ?? acquiredHandoffAbilityCharacterId} 능력 ${acquiredAbilityHandoffTitle(handoff, handoff.complete)}`
                    : undefined}
                >
                  {acquiredHandoffAbilityAsset ? <img src={acquiredHandoffAbilityAsset.src} alt="" /> : null}
                  {acquiredHandoffAbilityCharacterId
                    ? acquiredAbilityHandoffTitle(handoff, handoff.complete)
                    : handoffPanelTitle(handoff, handoff.complete)}
                </h2>
              ) : null}
              {!handoff.complete && (handoff.kind === "nomination" || handoff.kind === "vote") ? (
                <button type="button" disabled={operationBusy} onClick={onResetDaySelection}>{handoff.kind === "nomination" ? "지명 초기화 X" : "투표 초기화 X"}</button>
              ) : !handoff.complete && handoff.kind === "demon" && handoff.selectionStage === "poison" ? (
                <button type="button" disabled={operationBusy} onClick={onResetAttackSelection}>공격 대상 다시 선택</button>
              ) : !handoff.complete && multipleTargetCount > 0 ? <button type="button" disabled={operationBusy || targetIds.length === 0} onClick={onResetDaySelection}>초기화</button> : null}
            </header>
            {informationTargetCount > 0 ? (
              <h2
                className={acquiredHandoffAbilityCharacterId ? "issue107HandoffActionTitle" : undefined}
                aria-label={acquiredHandoffAbilityCharacterId
                  ? `${acquiredHandoffAbility?.name ?? acquiredHandoffAbilityCharacterId} 능력 ${handoff.complete ? "선택 결과" : informationTargetCount === 1 ? "한 명을 선택" : "두 명 선택"}`
                  : undefined}
              >
                {acquiredHandoffAbilityAsset ? <img src={acquiredHandoffAbilityAsset.src} alt="" /> : null}
                {handoff.complete ? "선택 결과" : informationTargetCount === 1 ? "한 명을 선택" : "두 명 선택"}
              </h2>
            ) : null}
            {handoff.kind === "nomination" ? (
              <dl><div><dt>지명자</dt><dd>{playerLabel(nominator)}</dd></div><div><dt>피지명자</dt><dd>{playerLabel(nominee)}</dd></div></dl>
            ) : handoff.kind === "vote" ? (
              <dl className="issue116VoteSummary">
                <div><dt>지명</dt><dd>{playerLabel(nominator)} → {playerLabel(nominee)}</dd></div>
                <div><dt>현재</dt><dd className={voterIds.length >= targetVotes ? "thresholdMet" : ""}>{voterIds.length}표</dd><span aria-hidden="true">/</span><dd>{isFirstVote ? `처형 기준 ${targetVotes}표` : `후보 기준 ${targetVotes}표`}</dd></div>
              </dl>
            ) : handoff.kind === "barber" ? (
              <dl>
                <div><dt>행동자</dt><dd>{playerLabel(playerById(players, actorId))}</dd></div>
                {targetIds.map((id, index) => <div key={id}><dt>{index + 1}번째 교환 대상</dt><dd>{playerLabel(playerById(players, id))}</dd></div>)}
              </dl>
            ) : informationTargetCount > 0 ? (
              <dl>{targetIds.map((id, index) => <div key={id}><dt>{index + 1}번째</dt><dd>{playerLabel(playerById(players, id))}</dd></div>)}</dl>
            ) : handoff.kind === "demon" && handoff.selectionStage === "poison" ? (
              <dl><div><dt>공격 대상</dt><dd>{playerStateLabel(target)}</dd></div><div><dt>중독 대상</dt><dd>{playerStateLabel(secondaryTarget)}</dd></div></dl>
            ) : handoff.kind === "vigormortisPoison" ? (
              <dl><div><dt>기존 대상</dt><dd>{playerStateLabel(referenceTarget)}</dd></div><div><dt>새 중독 대상</dt><dd>{playerStateLabel(target)}</dd></div></dl>
            ) : isDeathConsequenceHandoff(handoff) ? (
              <dl><div><dt>행동자</dt><dd>{playerLabel(playerById(players, actorId))}</dd></div><div><dt>선택 대상</dt><dd>{playerLabel(target)}</dd></div></dl>
            ) : (
              <dl><div><dt>행동자</dt><dd>{playerStateLabel(playerById(players, actorId))}</dd></div><div><dt>{handoff.kind === "demon" ? "공격 대상" : "선택 대상"}</dt><dd>{playerStateLabel(target)}</dd></div></dl>
            )}
            {handoffSupplement}
            {handoff.complete ? (
              <button type="button" className={`issue116PrimaryAction${handoff.kind === "vote" ? " issue116VoteCompleteAction" : " issue116NextAction"}`} onClick={onReturn}>{handoff.kind === "vote" ? "투표 완료 →" : "다음 →"}</button>
            ) : handoff.kind === "barber" && handoff.selectionStage === "swap" ? (
              <div className="snvStepActions">
                <button type="button" className="secondary" disabled={operationBusy || !chooserId} onClick={onDecline}>교환하지 않음</button>
                <button type="button" className="issue116PrimaryAction" disabled={!ready || operationBusy} onClick={onConfirm}>직업 교환</button>
              </div>
            ) : (
              <button type="button" className="issue116PrimaryAction" disabled={!ready || operationBusy} onClick={onConfirm}>{confirmLabel(handoff, nominator, nominee, voterIds.length, target, secondaryTarget)}</button>
            )}
          </aside>
        ) : null}
      </div>
      {!handoff && detailsPlayer && detailsCharacter ? (
        <PlayerTokenDetailDialog
          player={{
            characterId: detailsPlayer.seatCharacterId ?? detailsPlayer.actualCharacter,
            seat: detailsPlayer.seat,
            name: detailsPlayer.name,
            characterLabel: detailsPlayer.characterName,
            characterKindLabel: characterKindLabel(detailsPlayer.characterKind),
            characterIconSrc: detailsAsset?.src,
            characterAbility: detailsCharacter.ability,
            alignment: detailsPlayer.alignment,
          }}
          tokens={tokensByPlayerId[detailsPlayer.id] ?? []}
          details={<DayActionRecordHistory records={detailsDayActionRecords} />}
          theme={phaseTheme}
          onClose={closePlayerDetails}
        />
      ) : null}
    </section>
  );
}

function PhaseOverview({ replayState }: { replayState: ReplayState }) {
  const overview = collapseNominationVotingSteps(replayState.phaseOverview);
  return (
    <ol className="snvPhaseOverview" aria-label={replayState.phase === "day" ? "낮 순서" : "이후 밤 순서"}>
      {overview.map((step) => (
        <li key={step.id} className={step.status === "current" ? "current" : step.status === "interrupted" ? "interrupted" : ["complete", "manualComplete", "skipped", "notApplicable"].includes(step.status) ? "complete" : ""}>
          <span>{step.status === "current" ? "현재" : step.status === "interrupted" ? "중단" : ["complete", "manualComplete"].includes(step.status) ? "완료" : step.status === "notApplicable" ? "해당 없음" : step.status === "skipped" ? "종료" : "대기"}</span>
          <span className="snvPhaseOverviewAction">
            <strong>{stepLabel(step, replayState.players)}</strong>
            <PlayerImpairmentBadges
              activeImpairments={replayState.ruleState.activeImpairments}
              playerId={step.playerId}
              label={`${stepLabel(step, replayState.players)} 행동자 상태`}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}

function collapseNominationVotingSteps(steps: PhaseOverviewItem[]): PhaseOverviewItem[] {
  const nominationVotingSteps = steps.filter(isNominationVotingStep);
  if (nominationVotingSteps.length < 2) return steps;
  const current = nominationVotingSteps.find((step) => step.status === "current");
  const combinedStatus = current?.status ?? nominationVotingSteps.at(-1)!.status;
  let inserted = false;
  return steps.flatMap((step) => {
    if (!isNominationVotingStep(step)) return [step];
    if (inserted) return [];
    inserted = true;
    return [{ ...step, status: combinedStatus }];
  });
}

function isNominationVotingStep(step: PhaseStep) {
  return step.requiredInput.kind === "nomination" || step.requiredInput.kind === "nominationVote";
}

function stepLabel(
  step: PhaseStep,
  players: Player[] = [],
) {
  const suffix = step.id.split(":").at(-1);
  if (step.requiredInput.kind === "nomination" || step.requiredInput.kind === "nominationVote") return "지명 및 투표";
  if (step.id.includes(":madnessExecution:")) return "집착 위반 처형 · 사망 확인";
  if (step.stepType === "execution" || step.stepType === "executionDeath") return "처형";
  if (step.stepType === "pitHagArbitraryDeaths") return "예측불허의 죽음";
  if (suffix === "announceDeaths") return "아침 사망 발표";
  if (suffix === "whisper") return "밀담";
  if (suffix === "discussion") return "낮 진행";
  if (suffix === "toNight") return "밤으로";
  if (suffix === "toDay") return "낮으로";
  const actor = step.playerId ? players.find((player) => player.id === step.playerId) : undefined;
  const acquiredAbilityCharacterId = acquiredAbilityCharacterForStep(step, actor);
  if (acquiredAbilityCharacterId) {
    const actorName = sectsAndVioletsCharacters.find((character) => character.id === actor?.actualCharacter)?.name
      ?? actor?.actualCharacter;
    const abilityName = sectsAndVioletsCharacters.find((character) => character.id === acquiredAbilityCharacterId)?.name
      ?? acquiredAbilityCharacterId;
    return `${actorName} · ${abilityName}`;
  }
  return sectsAndVioletsCharacters.find((character) => character.id === step.character)?.name
    ?? step.character ?? suffix ?? step.id;
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

function handoffPanelTitle(handoff: LiveHandoff, complete: boolean) {
  const { kind } = handoff;
  if (!complete && kind === "vigormortisPoison") return "비고르모르티스가 부여한 중독 이동";
  if (!complete && kind === "demon" && handoff.selectionStage === "poison") return "중독 대상";
  const task = kind === "nomination" ? "지명"
    : kind === "vote" ? "투표"
      : kind === "snakeCharmer" ? "뱀 조련사"
        : kind === "evilTwin" ? "쌍둥이 지정"
        : kind === "witch" ? "저주 대상 선택"
        : kind === "cerenovus" ? "세레노버스 집착 지정"
        : kind === "sweetheart" ? "사랑꾼 취함 지정"
        : kind === "barber" ? handoff.selectionStage === "chooser" ? "행동할 악마 선택" : "이발사 직업 교환"
        : kind === "klutz" ? "얼뜨기 선택"
        : kind === "dreamer" ? "꿈꾸는 자"
          : kind === "seamstress" ? "재봉사" : "악마 공격";
  return complete ? `${task} 결과` : task;
}

function acquiredAbilityHandoffTitle(handoff: LiveHandoff, complete: boolean) {
  if (complete) {
    if (handoff.kind === "barber") return "교환 결과";
    if (handoff.kind === "sweetheart") return "취함 결과";
    return "선택 결과";
  }
  if (handoff.kind === "snakeCharmer") return "대상 선택";
  if (handoff.kind === "sweetheart") return "취함 대상";
  if (handoff.kind === "barber") return handoff.selectionStage === "chooser" ? "행동할 악마 선택" : "직업 교환";
  if (handoff.kind === "klutz") return "선택 대상";
  return handoffPanelTitle(handoff, false);
}

function characterKindLabel(kind: LivePlayer["characterKind"]) {
  if (kind === "townsfolk") return "주민";
  if (kind === "outsider") return "외지인";
  if (kind === "minion") return "하수인";
  return "악마";
}

function confirmLabel(handoff: LiveHandoff, nominator?: Player, nominee?: Player, votes = 0, target?: Player, secondaryTarget?: Player) {
  const { kind } = handoff;
  if (kind === "nomination") {
    if (!nominator) return "지명자를 선택하세요";
    if (!nominee) return "피지명자를 선택하세요";
    return `${nominator.seat}번 → ${nominee.seat}번 지명 확정`;
  }
  if (kind === "vote") return `${votes}표로 투표 확정`;
  if (kind === "dreamer" || kind === "seamstress") return "선택 확정";
  if (kind === "sweetheart") return target ? `${playerLabel(target)} 취함 적용` : "취함 대상을 선택하세요";
  if (kind === "barber") return "행동할 악마를 선택하세요";
  if (kind === "klutz") return target ? `${playerLabel(target)} 선택 확정` : "생존한 플레이어를 선택하세요";
  if (kind === "snakeCharmer") return target ? `${playerLabel(target)} 선택 확정` : "대상을 선택하세요";
  if (kind === "evilTwin") return target ? `${playerLabel(target)} 쌍둥이 지정` : "쌍둥이 대상을 선택하세요";
  if (kind === "witch") return target ? `${playerLabel(target)} 저주 확정` : "저주 대상을 선택하세요";
  if (kind === "cerenovus") return target ? `${playerLabel(target)} 집착 지정` : "집착 대상을 선택하세요";
  if (kind === "vigormortisPoison") return target ? `${playerLabel(target)}로 중독 이동` : "중독 대상을 선택하세요";
  if (kind === "demon" && handoff.selectionStage === "poison") return secondaryTarget ? `${playerLabel(secondaryTarget)} 중독 확정` : "중독 대상을 선택하세요";
  return target ? `${playerLabel(target)} 공격 확정` : "공격 대상을 선택하세요";
}

function isDemonCharacter(character?: string) {
  return character === "fangGu" || character === "vigormortis" || character === "noDashii" || character === "vortox";
}

function isDeathConsequenceHandoff(handoff?: LiveHandoff) {
  return handoff?.kind === "sweetheart" || handoff?.kind === "barber" || handoff?.kind === "klutz";
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
