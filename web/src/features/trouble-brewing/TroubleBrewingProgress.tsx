import { useEffect, useRef, useState } from "react";
import { CharacterIcon } from "../../components/CharacterIcon";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import { troubleBrewingCharacterDetail } from "../../characterDetails";
import type { PhaseStep, Player, Proposal } from "../../core/types";
import { isSpyGrimoireRevealPayload } from "../../core/revealPayload";
import { RevealPreview } from "../../reveal";
import { PlayPresentation } from "../../shared-ui/PlayPresentation";
import { characterLabel, characters } from "../../setupDraft";
import { GameEndControls } from "../game-end/GameEndControls";
import type { PhaseControlProps } from "../phase-control/PhaseControl";
import { ExecutionDeathActions, ExecutionDecisionActions, StepInputFields } from "../phase-control/StepInputs";
import {
  currentActionPrompt,
  phaseOverviewTitle,
  phaseStepConfirmation,
  stepInputReady,
  stepStatusLabel,
  stepTitle,
  targetCheckForSelection,
} from "../phase-control/phaseInput";
import { NightResultsAnnouncement } from "../phase-control/NightResultsAnnouncement";
import { suggestionRequestFingerprint } from "../phase-control/randomSuggestion";

export function TroubleBrewingProgress({
  phaseLabel,
  phaseRuntime,
  theme,
  onGoToGrimoire,
  ...control
}: PhaseControlProps & {
  phaseLabel: string;
  phaseRuntime: string;
  theme: "day" | "night";
  onGoToGrimoire: () => void;
}) {
  const currentOverviewItemRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    currentOverviewItemRef.current?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [control.currentStep?.id]);

  return (
    <PlayPresentation
      ariaLabel="Trouble Brewing 진행"
      className={`snvManualSurface snvTabPanel tbPlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
      headerClassName="snvFirstNightHeader tbPlayHeader"
      primaryClassName="snvFirstNightPrimary tbPlayPrimary"
      phaseHeader={<>
        <button type="button" aria-label="마도서로 이동" onClick={onGoToGrimoire}>← 마도서</button>
        <div className="snvProgressPhaseHeader">
          <h2>{phaseLabel}</h2>
          <time className="snvProgressRuntime" aria-label={`${phaseLabel} 경과 시간 ${phaseRuntime}`}>{phaseRuntime}</time>
        </div>
      </>}
      currentTask={<TroubleBrewingTask {...control} onGoToGrimoire={onGoToGrimoire} />}
      phaseOrder={<section className="tbProgressOrder" aria-label="단계 개요">
        <ol className="snvPhaseOverview tbPhaseOrder" aria-label={phaseOrderLabel(control.currentStep, phaseLabel)}>
          {control.phaseOverview.length === 0 ? <li className="current"><span>현재</span><strong>진행할 단계 없음</strong></li> : null}
          {control.phaseOverview.map((step) => (
            <li
              key={step.id}
              className={overviewClass(step.status)}
              aria-current={step.status === "current" ? "step" : undefined}
              ref={step.status === "current" ? currentOverviewItemRef : undefined}
            >
              <span>{stepStatusLabel(step.status)}</span>
              <strong>{phaseOverviewTitle(step, control.players)}</strong>
            </li>
          ))}
        </ol>
      </section>}
    />
  );
}

function TroubleBrewingTask({
  pendingReveal,
  currentStep,
  players,
  dayState,
  ruleState,
  latestProposal,
  nominationDraft,
  onNominationDraftChange,
  phaseInputDraft,
  replayReady,
  busy,
  preActionRevealPending,
  onShowPreActionReveal,
  onShowReveal,
  onContinue,
  onConfirm,
  onSkip,
  onSuggest,
  choiceTokenSource,
  suggestionContextFingerprint,
  warnings,
  gameEnd,
  onEndGame,
  onRequestUndoGameEnd,
  onGoToGrimoire,
}: PhaseControlProps & { onGoToGrimoire: () => void }) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionUsed, setSuggestionUsed] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string>();
  const activeSuggestionRequestRef = useRef<symbol | undefined>(undefined);
  const currentSuggestionFingerprintRef = useRef("");

  useEffect(() => () => {
    activeSuggestionRequestRef.current = undefined;
  }, []);
  useEffect(() => {
    activeSuggestionRequestRef.current = undefined;
    setSuggesting(false);
    setSuggestionUsed(false);
    setSuggestionError(undefined);
  }, [currentStep?.id, suggestionContextFingerprint]);

  if (pendingReveal) {
    const actor = pendingReveal.step.playerId
      ? players.find((player) => player.id === pendingReveal.step.playerId)
      : undefined;
    const directReveal = isSpyGrimoireRevealPayload(pendingReveal.payload)
      || ("kind" in pendingReveal.payload
        && (pendingReveal.payload.kind === "minionInformation" || pendingReveal.payload.kind === "demonInformation"));
    return <article className="snvCurrentStep tbCurrentTask" aria-label="확정된 Reveal 후속 조치">
      <p className="snvCurrentStepLabel">Reveal 후속 조치</p>
      <h3>{stepTitle(pendingReveal.step, actor)}</h3>
      <div className="tbProgressInputs">
        {directReveal ? <button type="button" className="primaryButton" onClick={() => onShowReveal(pendingReveal.payload)} disabled={busy}>플레이어에게 공개</button> : (
          <RevealPreview payload={pendingReveal.payload} onShow={() => onShowReveal(pendingReveal.payload)} disabled={busy} />
        )}
      </div>
      <div className="snvStepActions">
        <button type="button" disabled={busy || !replayReady} onClick={onContinue}>다음 단계로 계속</button>
      </div>
      {!replayReady ? <p className="tbProgressWaiting">다음 단계 준비 중</p> : null}
    </article>;
  }

  if (currentStep?.preActionReveal && preActionRevealPending) {
    const player = players.find((candidate) => candidate.id === currentStep.preActionReveal?.playerId);
    return <article className="snvCurrentStep tbCurrentTask" aria-label="직업 변경 안내">
      <p className="snvCurrentStepLabel">먼저 안내할 플레이어</p>
      <h3>새 임프 직업 변경 안내</h3>
      <strong className="tbProgressPlayer tbProgressPlayerStandalone">{player ? `${player.seat}번 ${player.name}` : "새 임프"} · 임프</strong>
      <div className="snvStepActions">
        <button type="button" disabled={busy} onClick={onShowPreActionReveal}>플레이어에게 공개</button>
      </div>
    </article>;
  }

  if (gameEnd) {
    return <div className="tbProgressTaskColumn"><GameEndControls
      warnings={warnings}
      gameEnd={gameEnd}
      busy={busy}
      onEndGame={onEndGame}
      onRequestUndo={onRequestUndoGameEnd}
    /></div>;
  }

  const currentPlayer = currentStep?.playerId
    ? players.find((player) => player.id === currentStep.playerId)
    : undefined;
  const currentCharacter = currentStep?.character
    ? characters.find((character) => character.id === currentStep.character)
    : undefined;
  const resultSubject = currentStep?.stepType === "executionDeath" || currentStep?.stepType === "slayerDeath";
  const isNightDeathAnnouncement = currentStep?.stepType === "announcement" && currentStep.id.endsWith(":announceDeaths");
  const actionPrompt = currentStep ? currentActionPrompt(currentStep) : undefined;
  const selectedTargetCheck = currentStep
    ? targetCheckForSelection(currentStep, phaseInputDraft.selectedPlayerIds)
    : undefined;
  const hasTargetChecks = Boolean(currentStep?.informationPrompt?.targetChecks?.length);
  const targetChoiceReady = !hasTargetChecks || Boolean(
    selectedTargetCheck
      && (selectedTargetCheck.choices.length === 1 || phaseInputDraft.selectedTargetChoice),
  );
  const selectionValid = currentStep ? stepInputReady(
    currentStep,
    phaseInputDraft.selectedPlayerIds.length,
    phaseInputDraft.selectedCharacterIds.length,
    phaseInputDraft.selectedCharacterId,
    nominationDraft,
    phaseInputDraft.zeroOutsiders,
    phaseInputDraft.selectedNumberChoice,
    phaseInputDraft.zeroOutsidersAvailable,
    phaseInputDraft.mayorDecision,
    phaseInputDraft.selectedPlayerIds,
  ) : false;
  const currentConfirmation = currentStep
    ? phaseStepConfirmation(currentStep, phaseInputDraft, nominationDraft)
    : {};
  const currentSuggestionFingerprint = suggestionRequestFingerprint(suggestionContextFingerprint, currentConfirmation);
  currentSuggestionFingerprintRef.current = currentSuggestionFingerprint;
  const usesGrimoireSelection = currentStep?.requiredInput.kind === "playerIds"
    || currentStep?.requiredInput.kind === "setupInfo";
  const registrationSensitive = Boolean(
    currentStep?.informationPrompt
      && (currentStep.informationPrompt.setupInfoRegistrationOptions.length > 0
        || currentStep.informationPrompt.numberChoices.some(
          (choice) => choice.registrationJudgments.length > 0,
        )),
  );

  async function suggestCurrentInput() {
    if (!currentStep?.requiredInput.supportsRandomSuggestion || suggesting) return;
    const requestedStepId = currentStep.id;
    const requestedFingerprint = currentSuggestionFingerprint;
    const requestIdentity = Symbol();
    activeSuggestionRequestRef.current = requestIdentity;
    setSuggesting(true);
    setSuggestionError(undefined);
    const result = await onSuggest({
      stepId: requestedStepId,
      ...(currentConfirmation.input === undefined ? {} : { currentInput: currentConfirmation.input }),
      choiceToken: choiceTokenSource(),
    });
    if (activeSuggestionRequestRef.current !== requestIdentity) return;
    activeSuggestionRequestRef.current = undefined;
    setSuggesting(false);
    if (currentSuggestionFingerprintRef.current !== requestedFingerprint) return;
    if (!result.ok) {
      setSuggestionError(result.error.messageKo);
      return;
    }
    if (result.value.stepId !== requestedStepId) return;
    phaseInputDraft.applySuggestion(result.value.input);
    setSuggestionUsed(true);
  }

  return <div className="tbProgressTaskColumn">
    <GameEndControls
      warnings={warnings}
      busy={busy}
      onEndGame={onEndGame}
      onRequestUndo={onRequestUndoGameEnd}
    >
      <article className="snvCurrentStep tbCurrentTask" role="region" aria-label="현재 단계">
        {currentStep ? <>
          <p className="snvCurrentStepLabel">현재 할 일</p>
          {isNightDeathAnnouncement ? (
            <NightResultsAnnouncement
              players={players}
              deathPlayerIds={ruleState?.unannouncedNightDeathPlayerIds ?? []}
              resurrectionPlayerIds={ruleState?.unannouncedNightResurrectionPlayerIds ?? []}
            />
          ) : null}
          {currentPlayer && !resultSubject && currentStep.stepType !== "demonSuccession" ? <section className="tbProgressActorBlock" aria-label="현재 행동자">
            <CharacterDetailButton
              details={troubleBrewingCharacterDetail(currentStep.character)}
              className="snvCurrentStepIdentity interactive tbProgressActor"
            >
              <CharacterIcon characterId={currentStep.character} />
              <span
                className="snvCurrentStepRoleName"
                role="heading"
                aria-level={3}
                aria-label={stepTitle(currentStep, currentPlayer)}
              >{currentCharacter?.label ?? currentStep.character}</span>
            </CharacterDetailButton>
            <strong className="tbProgressPlayer">{currentPlayer.seat}번 {currentPlayer.name}</strong>
            {currentPlayer.actualCharacter === "drunk" || registrationSensitive ? <div className="tbProgressActorTags">
              {currentPlayer.actualCharacter === "drunk" ? <em>실제 주정뱅이</em> : null}
              {registrationSensitive ? <em>등록 판정</em> : null}
            </div> : null}
            {currentCharacter?.abilitySummary ? <p className="tbProgressAbility">{currentCharacter.abilitySummary}</p> : null}
          </section> : (
            <h3>{currentStep.stepType === "slayerDeath" ? "사망 확인" : stepTitle(currentStep, currentPlayer)}</h3>
          )}
          {currentPlayer && resultSubject ? (
            <div className="tbProgressSubject" aria-label={currentStep.stepType === "executionDeath" ? "처형 대상" : "처단자 결과 대상"}>
              <strong>{currentPlayer.seat}번 {currentPlayer.name}</strong>
              <span>{characterLabel(currentPlayer.actualCharacter)}</span>
              {resultEffectDescription(currentStep) ? <p>{resultEffectDescription(currentStep)}</p> : null}
            </div>
          ) : null}
          {actionPrompt ? <p className="tbProgressPrompt" aria-label="필요한 입력">{actionPrompt}</p> : null}
          {currentStep.stepType === "nomination" && dayState ? (
            <ExecutionStanding players={players} dayState={dayState} />
          ) : null}
          <div className="tbProgressInputs">
            <StepInputFields
              step={currentStep}
              players={players}
              dayState={dayState}
              nominationDraft={nominationDraft}
              onNominationDraftChange={onNominationDraftChange}
              selectedPlayerIds={phaseInputDraft.selectedPlayerIds}
              selectedCharacterId={phaseInputDraft.selectedCharacterId}
              selectedCharacterIds={phaseInputDraft.selectedCharacterIds}
              zeroOutsiders={phaseInputDraft.zeroOutsiders}
              zeroOutsidersAvailable={phaseInputDraft.zeroOutsidersAvailable}
              selectedNumberChoice={phaseInputDraft.selectedNumberChoice}
              selectedTargetChoice={phaseInputDraft.selectedTargetChoice}
              mayorDecision={phaseInputDraft.mayorDecision}
              registrationJudgments={phaseInputDraft.registrationJudgments}
              busy={busy || suggesting}
              onSelectedPlayerIdsChange={phaseInputDraft.setSelectedPlayerIds}
              onCharacterChange={phaseInputDraft.setSelectedCharacterId}
              onCharactersChange={phaseInputDraft.setSelectedCharacterIds}
              onZeroOutsidersChange={phaseInputDraft.setZeroOutsiders}
              onNumberChoiceChange={phaseInputDraft.setSelectedNumberChoice}
              onTargetChoiceChange={phaseInputDraft.setSelectedTargetChoice}
              onMayorDecisionChange={phaseInputDraft.setMayorDecision}
              onRegistrationJudgmentsChange={phaseInputDraft.setRegistrationJudgments}
              randomSuggestion={currentStep.requiredInput.supportsRandomSuggestion ? {
                label: suggestionUsed ? "다시 추천" : "무작위 추천",
                disabled: busy || suggesting,
                onClick: suggestCurrentInput,
              } : undefined}
              hidePlayerInput={usesGrimoireSelection}
            />
            {usesGrimoireSelection && currentStep.requiredInput.supportsRandomSuggestion ? <button
              type="button"
              className="randomSuggestionButton"
              disabled={busy || suggesting}
              onClick={suggestCurrentInput}
            >{suggestionUsed ? "다시 추천" : "무작위 추천"}</button> : null}
            {latestProposal?.event.type === "nightActionResolved" ? <ImpActionResult proposal={latestProposal} players={players} /> : null}
            {latestProposal?.event.type === "slayerAbilityUsed" && latestProposal.event.payload.outcome.kind === "noEffect" ? (
              <p className="nightActionResult" aria-label="처단자 능력 결과">아무 일도 일어나지 않음</p>
            ) : null}
            {suggestionError ? <p className="randomSuggestionFailure" role="alert">{suggestionError}</p> : null}
          </div>
          {currentStep.requiredInput.kind === "executionDecision" ? (
            <ExecutionDecisionActions players={players} candidate={dayState?.executionCandidate} busy={busy} onConfirm={onConfirm} />
          ) : currentStep.requiredInput.kind === "executionDeathDecision" || currentStep.requiredInput.kind === "slayerDeathDecision" ? (
            <ExecutionDeathActions player={currentPlayer} busy={busy} onConfirm={onConfirm} />
          ) : (
            <div className="snvStepActions">
              {usesGrimoireSelection ? <button type="button" className="secondary" disabled={busy} onClick={onGoToGrimoire}>← 대상 선택</button> : null}
              <button type="button" disabled={busy || suggesting || !selectionValid || !targetChoiceReady} onClick={() => onConfirm(currentConfirmation)}>
                {confirmationLabel(currentStep, isNightDeathAnnouncement)}
              </button>
              {currentStep.canSkip ? <button type="button" className="secondary" disabled={busy} onClick={onSkip}>지목 종료</button> : null}
            </div>
          )}
        </> : <h3>진행할 단계 없음</h3>}
      </article>
    </GameEndControls>
  </div>;
}

function ExecutionStanding({ players, dayState }: { players: Player[]; dayState: NonNullable<PhaseControlProps["dayState"]> }) {
  const candidate = dayState.executionCandidate
    ? players.find((player) => player.id === dayState.executionCandidate?.nomineeId)
    : undefined;
  const standing = candidate && dayState.executionCandidate
    ? `${candidate.seat}번 ${candidate.name} — ${dayState.executionCandidate.voteCount}표`
    : `후보 없음 — ${dayState.highestVoteCount}표`;
  return <div className="tbExecutionStanding" aria-label="현재 처형 후보">
    <span>현재 처형 후보</span><strong>{standing}</strong>
    <small>기준 {dayState.executionVoteThreshold}표 · 생존자 {players.filter((player) => player.alive).length}명</small>
  </div>;
}

function ImpActionResult({ proposal, players }: { proposal: Proposal; players: Player[] }) {
  if (proposal.event.type !== "nightActionResolved" || proposal.event.payload.resolution.kind !== "impAttack") return null;
  const resolution = proposal.event.payload.resolution;
  const mayorContext = resolution.mayorContext ?? { kind: "notApplicable" as const };
  const finalTargetId = resolution.outcome.kind === "death" || resolution.outcome.kind === "soldierProtected"
    ? resolution.outcome.playerId
    : mayorContext.kind === "bounced"
      ? mayorContext.bounceTargetPlayerId
      : resolution.targetPlayerId;
  const target = players.find((player) => player.id === finalTargetId);
  if (!target) return null;
  const outcome = resolution.outcome.kind === "death"
    ? "사망"
    : resolution.outcome.kind === "prevented"
      ? "수도승에 의해 보호됨"
      : resolution.outcome.kind === "soldierProtected"
        ? "군인 능력으로 생존"
        : resolution.outcome.reason === "alreadyDead" ? "이미 사망" : "효과 없음";
  return <p className="nightActionResult" aria-label="밤 행동 결과">{target.seat}번 {target.name} - {outcome}</p>;
}

function confirmationLabel(step: PhaseStep, nightDeathAnnouncement: boolean) {
  if (step.stepType === "demonSuccession") return "승계 확정";
  if (step.stepType === "whisper") return "토론 시작";
  if (step.stepType === "discussion") return "지목 및 투표 시작";
  if (nightDeathAnnouncement) return "확인하고 낮 시작";
  return "확정";
}

function resultEffectDescription(step: PhaseStep) {
  if (step.stepType === "executionDeath" && step.id.endsWith(":virginDeath")) return "성결자 능력으로 지목자가 즉시 처형됩니다.";
  if (step.stepType === "slayerDeath") return "처단자 능력으로 사망합니다.";
  return undefined;
}

function overviewClass(status: PhaseControlProps["phaseOverview"][number]["status"]) {
  if (status === "complete" || status === "skipped" || status === "manualComplete" || status === "notApplicable") return "complete";
  if (status === "current" || status === "needsFollowUp" || status === "interrupted") return "current";
  return "";
}

function phaseOrderLabel(step: PhaseStep | undefined, label: string) {
  return `${step?.phase === "firstNight" ? "첫날 밤" : label} 순서`;
}
