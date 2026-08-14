import { useEffect, useRef, useState } from "react";
import { characterAsset } from "../../characterAssets";
import { CharacterIcon } from "../../components/CharacterIcon";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import { troubleBrewingCharacterDetail } from "../../characterDetails";
import type { DeliveryReason, PhaseStep, Player, Proposal, RevealPayload } from "../../core/types";
import { isSpyGrimoireRevealPayload } from "../../core/revealPayload";
import { PlayPresentation } from "../../shared-ui/PlayPresentation";
import { characterLabel, characters } from "../../setupDraft";
import { GameEndControls } from "../game-end/GameEndControls";
import type { PhaseControlProps } from "../phase-control/PhaseControl";
import { StepInputFields } from "../phase-control/StepInputs";
import {
  AbilityPresentation,
  type CharacterPresentationResolver,
} from "../phase-control/acquiredAbilityPresentation";
import { abilityPresentationForStep } from "../phase-control/actingRoleContext";
import {
  currentActionPrompt,
  phaseOverviewTitle,
  phaseStepConfirmation,
  setupInfoSelectionIsComplete,
  setupInfoSelectionCanComplete,
  setupInfoDeliveryIsImpaired,
  stepInputReady,
  stepStatusLabel,
  stepTitle,
  targetCheckForSelection,
} from "../phase-control/phaseInput";
import { NightResultsAnnouncement } from "../phase-control/NightResultsAnnouncement";
import { PlayerImpairmentBadges } from "../phase-control/ImpairmentBadges";
import { suggestionRequestFingerprint } from "../phase-control/randomSuggestion";
import { TroubleBrewingSetupInformationEditor } from "./TroubleBrewingSetupInformationEditor";
import {
  defaultScalarInformationChoice,
  isTroubleBrewingScalarInformationStep,
  scalarInformationMayUseDefault,
  scalarInformationSelectionReady,
  TroubleBrewingScalarInformationEditor,
} from "./TroubleBrewingScalarInformationEditor";

const troubleBrewingCharacterPresentation: CharacterPresentationResolver = (characterId) => {
  const character = characters.find((candidate) => candidate.id === characterId);
  if (!character) return undefined;
  return {
    label: character.label,
    details: troubleBrewingCharacterDetail(characterId),
    icon: characterAsset(characterId),
    ability: character.abilitySummary,
  };
};

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
  const visibleCurrentStep = control.pendingReveal?.step ?? control.currentStep;
  const visiblePhaseOverview = phaseOverviewWithPendingReveal(control.phaseOverview, control.pendingReveal?.step);

  useEffect(() => {
    currentOverviewItemRef.current?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [visibleCurrentStep?.id]);

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
      currentTask={<TroubleBrewingTask {...control} theme={theme} onGoToGrimoire={onGoToGrimoire} />}
      phaseOrder={<section className="tbProgressOrder" aria-label="단계 개요">
        <ol className="snvPhaseOverview tbPhaseOrder" aria-label={phaseOrderLabel(visibleCurrentStep, phaseLabel)}>
          {visiblePhaseOverview.length === 0 ? <li className="current"><span>현재</span><span className="snvPhaseOverviewAction"><strong>진행할 단계 없음</strong></span></li> : null}
          {visiblePhaseOverview.map((step) => (
            <li
              key={step.id}
              className={overviewClass(step.status)}
              aria-current={step.status === "current" ? "step" : undefined}
              ref={step.status === "current" ? currentOverviewItemRef : undefined}
            >
              <span>{stepStatusLabel(step.status)}</span>
              <span className="snvPhaseOverviewAction">
                <strong>{phaseOverviewTitle(step, control.players, false)}</strong>
                <PlayerImpairmentBadges
                  activeImpairments={control.ruleState?.activeImpairments}
                  playerId={step.playerId}
                  label={`${phaseOverviewTitle(step, control.players, false)} 행동자 상태`}
                />
              </span>
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
  theme,
}: PhaseControlProps & { theme: "day" | "night"; onGoToGrimoire: () => void }) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionUsed, setSuggestionUsed] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string>();
  const activeSuggestionRequestRef = useRef<symbol | undefined>(undefined);
  const currentSuggestionFingerprintRef = useRef("");
  const autoRevealStepRef = useRef<string | undefined>(undefined);

  useEffect(() => () => {
    activeSuggestionRequestRef.current = undefined;
  }, []);
  useEffect(() => {
    activeSuggestionRequestRef.current = undefined;
    setSuggesting(false);
    setSuggestionUsed(false);
    setSuggestionError(undefined);
  }, [currentStep?.id, suggestionContextFingerprint]);
  useEffect(() => {
    if (!pendingReveal || !replayReady || autoRevealStepRef.current !== pendingReveal.step.id) return;
    autoRevealStepRef.current = undefined;
    onShowReveal(pendingReveal.payload);
  }, [pendingReveal, replayReady, onShowReveal]);

  if (pendingReveal) {
    if (isEvilInformationReveal(pendingReveal.payload)) {
      return <div className="tbProgressTaskColumn">
        <TroubleBrewingEvilInformationTask
          step={pendingReveal.step}
          players={players}
          selectedCharacterIds={pendingReveal.payload.kind === "demonInformation"
            ? pendingReveal.payload.bluffCharacterIds
            : []}
          busy={busy}
          suggesting={false}
          revealed={true}
          canContinue={replayReady}
          onReveal={() => onShowReveal(pendingReveal.payload)}
          onContinue={onContinue}
        />
      </div>;
    }
    const directReveal = isSpyGrimoireRevealPayload(pendingReveal.payload);
    if (directReveal) {
      const actor = pendingReveal.step.playerId
        ? players.find((player) => player.id === pendingReveal.step.playerId)
        : undefined;
      return <article className="snvCurrentStep tbCurrentTask" aria-label="확정된 Reveal 후속 조치">
        <p className="snvCurrentStepLabel">공개할 정보</p>
        <h3>{stepTitle(pendingReveal.step, actor)}</h3>
        <div className="tbProgressInputs">
          <button type="button" className="primaryButton" onClick={() => onShowReveal(pendingReveal.payload)} disabled={busy}>플레이어에게 공개</button>
        </div>
        <div className="snvStepActions">
          <button type="button" disabled={busy || !replayReady} onClick={onContinue}>다음 단계로 계속</button>
        </div>
        {!replayReady ? <p className="tbProgressWaiting">다음 단계 준비 중</p> : null}
      </article>;
    }
    return <div className="tbProgressTaskColumn">
      <TroubleBrewingInformationFollowUp
        step={pendingReveal.step}
        payload={pendingReveal.payload}
        players={players}
        ruleState={ruleState}
        theme={theme}
        busy={busy}
        canContinue={replayReady}
        onReveal={() => onShowReveal(pendingReveal.payload)}
        onContinue={onContinue}
      />
    </div>;
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
      showManualEnd={false}
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
  const currentAbilityRelation = currentStep && currentPlayer
    ? abilityPresentationForStep(currentStep, currentPlayer)
    : undefined;
  const resultSubject = currentStep?.stepType === "executionDeath" || currentStep?.stepType === "slayerDeath";
  const isNightDeathAnnouncement = currentStep?.stepType === "announcement" && currentStep.id.endsWith(":announceDeaths");
  const actionPrompt = currentStep ? currentActionPrompt(currentStep) : undefined;
  const scalarInformation = currentStep ? isTroubleBrewingScalarInformationStep(currentStep) : false;
  const zeroOutsiderInformation = Boolean(
    currentStep?.requiredInput.kind === "setupInfo" && phaseInputDraft.zeroOutsiders,
  );
  const setupInfoCandidatePathAvailable = Boolean(
    currentStep?.requiredInput.kind === "setupInfo"
      && setupInfoSelectionCanComplete(currentStep, [], players),
  );
  const autoZeroOutsiderInformation = Boolean(
    zeroOutsiderInformation
      && currentStep
      && !setupInfoDeliveryIsImpaired(currentStep)
      && !setupInfoCandidatePathAvailable,
  );
  const isInformationConfirmation = Boolean(currentStep?.informationPrompt || zeroOutsiderInformation);
  const isInformationStep = Boolean(
    currentStep?.informationPrompt || currentStep?.requiredInput.kind === "setupInfo",
  );
  const selectedTargetCheck = currentStep
    ? targetCheckForSelection(currentStep, phaseInputDraft.selectedPlayerIds)
    : undefined;
  const hasTargetChecks = Boolean(currentStep?.informationPrompt?.targetChecks?.length);
  const targetChoiceReady = !hasTargetChecks || Boolean(
    selectedTargetCheck
      && (selectedTargetCheck.choices.length === 1 || phaseInputDraft.selectedTargetChoice),
  );
  const setupInformationTargetsSelected = Boolean(
    currentStep?.requiredInput.kind === "setupInfo"
      && !zeroOutsiderInformation
      && setupInfoSelectionIsComplete(
        currentStep,
        phaseInputDraft.selectedPlayerIds,
        players,
      ),
  );
  const informationTargetsSelected = Boolean(
    isInformationStep && (setupInformationTargetsSelected || selectedTargetCheck),
  );
  const selectedInformationTargetLabels = informationTargetsSelected
    ? phaseInputDraft.selectedPlayerIds.flatMap((playerId) => {
      const player = players.find((candidate) => candidate.id === playerId);
      return player ? [`${player.seat}번 ${player.name}`] : [];
    })
    : [];
  const selectionValid = currentStep ? scalarInformation
    ? scalarInformationSelectionReady(
        currentStep,
        players,
        phaseInputDraft.selectedNumberChoice,
        phaseInputDraft.registrationJudgments,
      )
    : stepInputReady(
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
        players,
      ) : false;
  const currentConfirmation = currentStep
    ? phaseStepConfirmation(
        currentStep,
        scalarInformation && scalarInformationMayUseDefault(currentStep)
          ? {
              ...phaseInputDraft,
              selectedNumberChoice: phaseInputDraft.selectedNumberChoice
                ?? defaultScalarInformationChoice(currentStep),
            }
          : phaseInputDraft,
        nominationDraft,
      )
    : {};
  const currentSuggestionFingerprint = suggestionRequestFingerprint(suggestionContextFingerprint, currentConfirmation);
  currentSuggestionFingerprintRef.current = currentSuggestionFingerprint;
  const usesGrimoireSelection = currentStep?.requiredInput.kind === "playerIds"
    || (currentStep?.requiredInput.kind === "setupInfo" && !zeroOutsiderInformation)
    || currentStep?.requiredInput.kind === "nomination"
    || currentStep?.requiredInput.kind === "nominationVote";
  const nominationVoteIsVote = Boolean(
    currentStep?.requiredInput.kind === "nominationVote"
      && (currentStep.id.endsWith(":vote") || dayState?.activeNomination),
  );
  const needsProgressConfirmation = Boolean(
    currentStep?.requiredInput.kind === "playerIds"
      && (currentStep.informationPrompt
        || (currentStep.requiredInput.mayorDecision
          && phaseInputDraft.selectedPlayerIds.includes(currentStep.requiredInput.mayorDecision.mayorPlayerId))),
  );
  const supportsInputSuggestion = Boolean(
    currentStep?.requiredInput.supportsRandomSuggestion
      && currentStep.requiredInput.kind !== "setupInfo",
  );

  if (currentStep?.requiredInput.kind === "executionDecision") {
    const candidate = dayState?.executionCandidate;
    const candidatePlayer = candidate
      ? players.find((player) => player.id === candidate.nomineeId)
      : undefined;
    return <div className="tbProgressTaskColumn">
      <GameEndControls
        warnings={warnings}
        busy={busy}
        showManualEnd={false}
        onEndGame={onEndGame}
        onRequestUndo={onRequestUndoGameEnd}
      >
        <article className="snvCurrentStep tbCurrentTask issue116CurrentStep issue116ExecutionStep" role="region" aria-label="현재 단계">
          <div className="issue116ExecutionTarget" aria-label="처형 대상">
            <span>처형 대상</span>
            <strong role="heading" aria-level={3} aria-label={stepTitle(currentStep, candidatePlayer)}>{candidatePlayer ? `${candidatePlayer.seat}번 ${candidatePlayer.name}` : "후보 없음"}</strong>
            <small>{candidatePlayer ? characterLabel(candidatePlayer.actualCharacter) : `최고 득표 ${dayState?.highestVoteCount ?? 0}표`}</small>
          </div>
          <div className="tbExecutionDecisionActions">
            <button
              type="button"
              className="issue116ExecutionConfirm"
              disabled={busy || !candidate}
              onClick={() => onConfirm({ input: { execute: true } })}
            >처형 확정</button>
            <button
              type="button"
              className="issue116ExecutionCancel"
              disabled={busy}
              onClick={() => onConfirm({ input: { execute: false } })}
            >처형 없음</button>
          </div>
        </article>
      </GameEndControls>
    </div>;
  }

  if (currentStep && (
    currentStep.requiredInput.kind === "executionDeathDecision"
    || currentStep.requiredInput.kind === "slayerDeathDecision"
  )) {
    return <div className="tbProgressTaskColumn">
      <GameEndControls
        warnings={warnings}
        busy={busy}
        showManualEnd={false}
        onEndGame={onEndGame}
        onRequestUndo={onRequestUndoGameEnd}
      >
        <article className="snvCurrentStep tbCurrentTask issue116CurrentStep issue116ExecutionStep" role="region" aria-label="현재 단계">
          <div className="issue116ExecutionTarget" aria-label={currentStep.requiredInput.kind === "executionDeathDecision" ? "처형 대상" : "처단자 결과 대상"}>
            <span>{currentStep.requiredInput.kind === "executionDeathDecision" ? "처형 대상" : "처단자 결과 대상"}</span>
            <strong role="heading" aria-level={3} aria-label={stepTitle(currentStep, currentPlayer)}>{currentPlayer ? `${currentPlayer.seat}번 ${currentPlayer.name}` : "대상 없음"}</strong>
            <small>{currentPlayer ? characterLabel(currentPlayer.actualCharacter) : "대상을 확인하세요"}</small>
            {resultEffectDescription(currentStep) ? <p>{resultEffectDescription(currentStep)}</p> : null}
          </div>
          <button
            type="button"
            className="issue116ExecutionConfirm"
            disabled={busy || !currentPlayer}
            onClick={() => onConfirm({ input: { died: true } })}
          >확정</button>
        </article>
      </GameEndControls>
    </div>;
  }

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

  if (currentStep && (currentStep.id.endsWith(":minionInfo") || currentStep.id.endsWith(":demonInfo"))) {
    return <div className="tbProgressTaskColumn">
      <GameEndControls
        warnings={warnings}
        busy={busy}
        showManualEnd={false}
        onEndGame={onEndGame}
        onRequestUndo={onRequestUndoGameEnd}
      >
        <TroubleBrewingEvilInformationTask
          step={currentStep}
          players={players}
          selectedCharacterIds={phaseInputDraft.selectedCharacterIds}
          busy={busy}
          suggesting={suggesting}
          onToggle={(characterId) => {
            const selected = phaseInputDraft.selectedCharacterIds.includes(characterId);
            phaseInputDraft.setSelectedCharacterIds(selected
              ? phaseInputDraft.selectedCharacterIds.filter((id) => id !== characterId)
              : [...phaseInputDraft.selectedCharacterIds, characterId]);
          }}
          onShuffle={currentStep.requiredInput.supportsRandomSuggestion
            ? () => { void suggestCurrentInput(); }
            : undefined}
          onReveal={() => {
            autoRevealStepRef.current = currentStep.id;
            onConfirm(currentConfirmation);
          }}
        />
        {suggestionError ? <p className="randomSuggestionFailure" role="alert">{suggestionError}</p> : null}
      </GameEndControls>
    </div>;
  }

  return <div className="tbProgressTaskColumn">
    <GameEndControls
      warnings={warnings}
      busy={busy}
      showManualEnd={false}
      onEndGame={onEndGame}
      onRequestUndo={onRequestUndoGameEnd}
    >
      <article
        className={`snvCurrentStep tbCurrentTask issue116CurrentStep${currentPlayer && !resultSubject && currentStep?.stepType !== "demonSuccession" ? " issue116DemonStep" : ""}`}
        role="region"
        aria-label="현재 단계"
      >
        {currentStep ? <>
          <p className="snvCurrentStepLabel">현재 할 일</p>
          {isNightDeathAnnouncement ? (
            <NightResultsAnnouncement
              players={players}
              deathPlayerIds={ruleState?.unannouncedNightDeathPlayerIds ?? []}
              resurrectionPlayerIds={ruleState?.unannouncedNightResurrectionPlayerIds ?? []}
            />
          ) : null}
          {currentPlayer && !resultSubject && currentStep.stepType !== "demonSuccession" ? <section className="tbProgressActorBlock issue116ActorIdentity" aria-label="현재 행동자">
            {currentAbilityRelation ? <AbilityPresentation
              actor={currentPlayer}
              relation={currentAbilityRelation}
              characterPresentation={troubleBrewingCharacterPresentation}
              theme={theme === "day" ? "tb-day" : "tb-night"}
              actorRoleNode={<span className="snvInformationRoleLine">
                <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{characterLabel(currentPlayer.actualCharacter)}</span>
                <PlayerImpairmentBadges
                  activeImpairments={ruleState?.activeImpairments}
                  playerId={currentPlayer.id}
                  label="정보 영향"
                />
              </span>}
              actorPlayerNode={<strong className="tbProgressPlayer">{currentPlayer.seat}번 {currentPlayer.name}</strong>}
              actorIdentityClassName="snvCurrentStepIdentity interactive snvInformationIdentity tbProgressActor"
              abilityNameNode={<span className="tbProgressShownName" role="heading" aria-level={4}>{characterLabel(currentAbilityRelation.abilityCharacterId)}</span>}
              abilityClassName="tbProgressShownIdentity interactive"
              abilityRegionClassName="tbProgressShownAbility"
              abilitySummary={currentCharacter?.abilitySummary}
            /> : <>
              <CharacterDetailButton
                details={troubleBrewingCharacterDetail(currentStep.character)}
                className="snvCurrentStepIdentity interactive snvInformationIdentity tbProgressActor"
                theme={theme === "day" ? "tb-day" : "tb-night"}
              >
                <CharacterIcon characterId={currentStep.character} />
                <div>
                  <span className="snvInformationRoleLine">
                    <span
                      className="snvCurrentStepRoleName"
                      role="heading"
                      aria-level={3}
                      aria-label={stepTitle(currentStep, currentPlayer)}
                    >{currentCharacter?.label ?? currentStep.character}</span>
                    <PlayerImpairmentBadges
                      activeImpairments={ruleState?.activeImpairments}
                      playerId={currentPlayer.id}
                      label="정보 영향"
                    />
                  </span>
                  <strong className="tbProgressPlayer">{currentPlayer.seat}번 {currentPlayer.name}</strong>
                </div>
              </CharacterDetailButton>
              {currentCharacter?.abilitySummary ? <p className="tbProgressAbility issue116AbilitySummary">{currentCharacter.abilitySummary}</p> : null}
            </>}
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
          {actionPrompt && !isInformationStep ? <p className="tbProgressPrompt" aria-label="필요한 입력">{actionPrompt}</p> : null}
          {currentStep.stepType === "nomination" && dayState ? (
            <ExecutionStanding players={players} dayState={dayState} />
          ) : null}
          <div className="tbProgressInputs">
            {selectedInformationTargetLabels.length ? <p className="snvInformationTargetSummary tbInformationTargetSummary" aria-label="선택한 대상">
              <span>대상 ·</span><strong>{selectedInformationTargetLabels.join(" · ")}</strong>
            </p> : null}
            {scalarInformation ? <TroubleBrewingScalarInformationEditor
              step={currentStep}
              players={players}
              selectedNumberChoice={phaseInputDraft.selectedNumberChoice}
              registrationJudgments={phaseInputDraft.registrationJudgments}
              busy={busy || suggesting}
              onNumberChoiceChange={phaseInputDraft.setSelectedNumberChoice}
              onRegistrationJudgmentsChange={phaseInputDraft.setRegistrationJudgments}
            /> : currentStep.requiredInput.kind === "setupInfo" ? <>
              {zeroOutsiderInformation ? <dl className="snvInformationValues" role="group" aria-label="정보 결과">
                <div><dt>대상</dt><dd>외지인 없음</dd></div>
              </dl> : null}
              {!autoZeroOutsiderInformation ? <TroubleBrewingSetupInformationEditor
                step={currentStep}
                players={players}
                selectedPlayerIds={phaseInputDraft.selectedPlayerIds}
                selectedCharacterId={phaseInputDraft.selectedCharacterId}
                zeroOutsiders={phaseInputDraft.zeroOutsiders}
                zeroOutsidersAvailable={phaseInputDraft.zeroOutsidersAvailable}
                disabled={busy || suggesting}
                onCharacterChange={phaseInputDraft.setSelectedCharacterId}
                onZeroOutsidersChange={phaseInputDraft.setZeroOutsiders}
              /> : null}
            </> : currentStep.requiredInput.kind === "nomination" || currentStep.requiredInput.kind === "nominationVote" ? null : <StepInputFields
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
              randomSuggestion={supportsInputSuggestion ? {
                label: suggestionUsed ? "다시 추천" : "무작위 추천",
                disabled: busy || suggesting,
                onClick: suggestCurrentInput,
              } : undefined}
              hidePlayerInput={usesGrimoireSelection}
            />}
            {usesGrimoireSelection && supportsInputSuggestion ? <button
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
          <div className={`snvStepActions${currentStep.stepType === "nomination" ? " issue116NominationActions" : ""}`}>
              {usesGrimoireSelection && !informationTargetsSelected ? <button type="button" className="secondary" disabled={busy} onClick={onGoToGrimoire}>
                {currentStep.requiredInput.kind === "nomination" || (currentStep.requiredInput.kind === "nominationVote" && !nominationVoteIsVote) ? "← 지명하기" : currentStep.requiredInput.kind === "nominationVote" ? "← 투표하기" : "대상 선택"}
              </button> : null}
              {!usesGrimoireSelection || currentStep.requiredInput.kind === "setupInfo" || needsProgressConfirmation ? <button
                type="button"
                className={isInformationConfirmation ? `informationReveal prominent${primaryInformationInfluence(currentStep.informationPrompt?.activeReasons ?? []) ? ` ${primaryInformationInfluence(currentStep.informationPrompt?.activeReasons ?? [])}` : ""}` : undefined}
                disabled={busy || suggesting || !selectionValid || !targetChoiceReady}
                onClick={() => {
                  if (isInformationConfirmation) autoRevealStepRef.current = currentStep.id;
                  onConfirm(currentConfirmation);
                }}
              >
                {isInformationConfirmation
                  ? informationRevealActionLabel(currentStep.informationPrompt?.activeReasons ?? [])
                  : confirmationLabel(currentStep, isNightDeathAnnouncement)}
              </button> : null}
              {currentStep.stepType === "nomination" && currentStep.canSkip ? <button type="button" className="secondary" disabled={busy} onClick={onSkip}>
                지명 종료
              </button> : null}
          </div>
        </> : <h3>진행할 단계 없음</h3>}
      </article>
    </GameEndControls>
  </div>;
}

function TroubleBrewingEvilInformationTask({
  step,
  players,
  selectedCharacterIds,
  busy,
  suggesting,
  revealed = false,
  canContinue = false,
  onToggle,
  onShuffle,
  onReveal,
  onContinue,
}: {
  step: PhaseStep;
  players: Player[];
  selectedCharacterIds: string[];
  busy: boolean;
  suggesting: boolean;
  revealed?: boolean;
  canContinue?: boolean;
  onToggle?: (characterId: string) => void;
  onShuffle?: () => void;
  onReveal: () => void;
  onContinue?: () => void;
}) {
  const demonInformation = step.id.endsWith(":demonInfo");
  const wakePlayers = players.filter((player) => {
    const kind = characters.find((character) => character.id === player.actualCharacter)?.kind;
    return kind === (demonInformation ? "Demon" : "Minion");
  });
  const allowedCharacterIds = step.requiredInput.kind === "characterIds"
    ? step.requiredInput.allowedCharacterIds ?? []
    : [];
  const maxSelections = step.requiredInput.kind === "characterIds"
    ? step.requiredInput.maxSelections ?? 3
    : 0;
  const complete = !demonInformation || selectedCharacterIds.length === maxSelections;

  return <article
    className={`snvCurrentStep tbCurrentTask snvEvilInformationTask ${demonInformation ? "snvDemonInformationTask" : "snvMinionInformationTask"}`}
    role="region"
    aria-label="현재 단계"
  >
    <header>
      <div><p className="snvCurrentStepLabel">현재 할 일</p><h3>{demonInformation ? "악마 정보" : "하수인 정보"}</h3></div>
      {demonInformation ? <span className={complete ? "complete" : undefined}>{selectedCharacterIds.length} / {maxSelections}</span> : null}
    </header>
    <p className="snvEvilInformationWakeInstruction"><strong>{wakePlayers.map((player) => `${player.seat}번 ${player.name}`).join(", ")}</strong>를 깨웁니다.</p>
    {demonInformation ? <div className="snvBluffCandidateGrid" aria-label="사용 가능한 속임수">
      {allowedCharacterIds.map((characterId) => {
        const selected = selectedCharacterIds.includes(characterId);
        return <button
          type="button"
          className={selected ? "selected" : undefined}
          aria-pressed={selected}
          aria-label={`${characterLabel(characterId)}${selected ? ", 선택됨" : ""}`}
          disabled={busy || suggesting || revealed || (!selected && complete)}
          onClick={() => onToggle?.(characterId)}
          key={characterId}
        >
          <CharacterIcon characterId={characterId} />
          <strong>{characterLabel(characterId)}</strong>
          {selected ? <small>선택됨</small> : null}
        </button>;
      })}
    </div> : null}
    <div className="snvEvilInformationTaskActions">
      {demonInformation && onShuffle ? <button
        type="button"
        className="snvBluffShuffle"
        aria-label="속임수 무작위 추천"
        title="무작위 추천"
        disabled={busy || suggesting || revealed}
        onClick={onShuffle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h2.3c4.2 0 4.7 10 9.2 10H20" /><path d="m17 14 3 3-3 3" /><path d="M4 17h2.3c1.8 0 2.9-1.8 4-4" /><path d="M15.5 7H20" /><path d="m17 4 3 3-3 3" /></svg>
      </button> : null}
      <button
        type="button"
        className="prominent"
        disabled={busy || suggesting || !complete}
        onClick={onReveal}
      >정보 공개</button>
      {revealed && onContinue ? <button
        type="button"
        className="snvEvilInformationNext"
        disabled={busy || !canContinue}
        onClick={onContinue}
      >다음으로</button> : null}
    </div>
  </article>;
}

function isEvilInformationReveal(payload: RevealPayload): payload is Extract<RevealPayload, {
  kind: "minionInformation" | "demonInformation";
}> {
  return "kind" in payload && (payload.kind === "minionInformation" || payload.kind === "demonInformation");
}

function TroubleBrewingInformationFollowUp({
  step,
  payload,
  players,
  ruleState,
  theme,
  busy,
  canContinue,
  onReveal,
  onContinue,
}: {
  step: PhaseStep;
  payload: RevealPayload;
  players: Player[];
  ruleState: PhaseControlProps["ruleState"];
  theme: "day" | "night";
  busy: boolean;
  canContinue: boolean;
  onReveal: () => void;
  onContinue: () => void;
}) {
  const actor = step.playerId
    ? players.find((player) => player.id === step.playerId)
    : undefined;
  const character = step.character
    ? characters.find((candidate) => candidate.id === step.character)
    : undefined;
  const title = character?.label ?? "정보";
  const influence = primaryInformationInfluence(step.informationPrompt?.activeReasons ?? []);
  const abilityRelation = actor ? abilityPresentationForStep(step, actor) : undefined;
  const setupInformation = "kind" in payload && payload.kind === "setupInformation"
    ? payload
    : undefined;
  const setupInformationPlayerIds = setupInformation?.candidatePlayers.map((candidate) => candidate.playerId) ?? [];
  const setupInformationTargetLabels = setupInformation?.candidatePlayers.map(
    (candidate) => `${candidate.seat}번 ${candidate.name}`,
  ) ?? [];

  return <article
    className="snvCurrentStep tbCurrentTask issue116CurrentStep"
    role="region"
    aria-label={`${title} 정보`}
  >
    <p className="snvCurrentStepLabel">현재 할 일</p>
    {actor && step.character ? <section className="tbProgressActorBlock issue116ActorIdentity" aria-label="현재 행동자">
      {abilityRelation ? <AbilityPresentation
        actor={actor}
        relation={abilityRelation}
        characterPresentation={troubleBrewingCharacterPresentation}
        theme={theme === "day" ? "tb-day" : "tb-night"}
        actorRoleNode={<span className="snvInformationRoleLine">
          <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{characterLabel(actor.actualCharacter)}</span>
          <PlayerImpairmentBadges
            activeImpairments={ruleState?.activeImpairments}
            playerId={actor.id}
            label="정보 영향"
          />
        </span>}
        actorPlayerNode={<strong className="tbProgressPlayer">{actor.seat}번 {actor.name}</strong>}
        actorIdentityClassName="snvCurrentStepIdentity interactive snvInformationIdentity tbProgressActor"
        abilityNameNode={<span className="tbProgressShownName" role="heading" aria-level={4}>{characterLabel(abilityRelation.abilityCharacterId)}</span>}
        abilityClassName="tbProgressShownIdentity interactive"
        abilityRegionClassName="tbProgressShownAbility"
        abilitySummary={character?.abilitySummary}
      /> : <>
        <CharacterDetailButton
          details={troubleBrewingCharacterDetail(step.character)}
          className="snvCurrentStepIdentity interactive snvInformationIdentity tbProgressActor"
          theme={theme === "day" ? "tb-day" : "tb-night"}
        >
          <CharacterIcon characterId={step.character} />
          <div>
            <span className="snvInformationRoleLine">
              <span
                className="snvCurrentStepRoleName"
                role="heading"
                aria-level={3}
                aria-label={stepTitle(step, actor)}
              >{title}</span>
              <PlayerImpairmentBadges
                activeImpairments={ruleState?.activeImpairments}
                playerId={actor.id}
                label="정보 영향"
              />
            </span>
            <strong className="tbProgressPlayer">{actor.seat}번 {actor.name}</strong>
          </div>
        </CharacterDetailButton>
        {character?.abilitySummary ? <p className="tbProgressAbility issue116AbilitySummary">{character.abilitySummary}</p> : null}
      </>}
    </section> : <h3>{title}</h3>}
    {setupInformationTargetLabels.length ? <p className="snvInformationTargetSummary tbInformationTargetSummary" aria-label="선택한 대상">
      <span>대상 ·</span><strong>{setupInformationTargetLabels.join(" · ")}</strong>
    </p> : null}
    {setupInformation?.zeroOutsiders ? <dl className="snvInformationValues" role="group" aria-label="정보 결과">
      <div><dt>대상</dt><dd>외지인 없음</dd></div>
    </dl> : null}
    {setupInformation ? <TroubleBrewingSetupInformationEditor
      step={step}
      players={players}
      selectedPlayerIds={setupInformationPlayerIds}
      selectedCharacterId={"revealedCharacterId" in setupInformation ? setupInformation.revealedCharacterId : ""}
      zeroOutsiders={setupInformation.zeroOutsiders}
      zeroOutsidersAvailable={setupInformation.zeroOutsiders || setupInfoDeliveryIsImpaired(step)}
      disabled
      onCharacterChange={() => undefined}
      onZeroOutsidersChange={() => undefined}
    /> : null}
    <div className="snvStepActions">
      <button
        type="button"
        className={`informationReveal${influence ? ` ${influence}` : ""}`}
        onClick={onReveal}
        disabled={busy}
      >{informationRevealActionLabel(step.informationPrompt?.activeReasons ?? [])}</button>
      <button type="button" className="secondary" disabled={busy || !canContinue} onClick={onContinue}>다음 단계</button>
    </div>
    {!canContinue ? <p className="tbProgressWaiting">다음 단계 준비 중</p> : null}
  </article>;
}

function informationRevealActionLabel(reasons: DeliveryReason[]) {
  const influence = primaryInformationInfluence(reasons);
  if (influence === "poisoned") return "중독 정보 공개";
  if (influence === "drunk") return "취한 정보 공개";
  return "정보 공개";
}

function primaryInformationInfluence(reasons: DeliveryReason[]): "poisoned" | "drunk" | undefined {
  if (reasons.some((reason) => reason.type === "poisoned")) return "poisoned";
  return reasons.some((reason) => reason.type === "drunk") ? "drunk" : undefined;
}

function ExecutionStanding({ players, dayState }: { players: Player[]; dayState: NonNullable<PhaseControlProps["dayState"]> }) {
  const candidate = dayState.executionCandidate
    ? players.find((player) => player.id === dayState.executionCandidate?.nomineeId)
    : undefined;
  return <div className="tbExecutionStanding issue116CandidateSummary" aria-label="현재 최고 득표">
    <strong>{candidate ? `${candidate.seat}번 ${candidate.name}` : "후보 없음"}</strong>
    <span>{dayState.executionCandidate?.voteCount ?? dayState.highestVoteCount}표</span>
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

function phaseOverviewWithPendingReveal(
  phaseOverview: PhaseControlProps["phaseOverview"],
  pendingStep: PhaseStep | undefined,
): PhaseControlProps["phaseOverview"] {
  if (!pendingStep) return phaseOverview;
  return phaseOverview.map((step) => {
    if (step.id === pendingStep.id) return { ...step, status: "current" };
    if (step.status === "current") return { ...step, status: "waiting" };
    return step;
  });
}

function phaseOrderLabel(step: PhaseStep | undefined, label: string) {
  return `${step?.phase === "firstNight" ? "첫날 밤" : label} 순서`;
}
