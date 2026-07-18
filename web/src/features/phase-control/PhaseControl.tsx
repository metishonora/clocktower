import { useEffect, useRef, useState } from "react";
import type {
  CoreResult,
  CoreWarning,
  DayState,
  GameEndState,
  PhaseOverviewItem,
  PhaseStep,
  PhaseStepConfirmation,
  PhaseInputSuggestion,
  PhaseInputSuggestionRequest,
  Player,
  Proposal,
  RuleState,
  RevealPayload,
} from "../../core/types";
import { isSpyGrimoireRevealPayload } from "../../core/revealPayload";
import { RevealPreview } from "../../reveal";
import { characterKind, characterLabel, characters, kindLabels } from "../../setupDraft";
import type { NominationDraft } from "../voting/useNominationDraft";
import {
  currentActionPrompt,
  inputKindLabel,
  phaseLabel,
  phaseStepConfirmation,
  stepInputReady,
  stepStatusLabel,
  stepTitle,
  targetCheckForSelection,
} from "./phaseInput";
import { ExecutionDeathActions, ExecutionDecisionActions, StepInputFields } from "./StepInputs";
import { suggestionRequestFingerprint } from "./randomSuggestion";
import type { PhaseInputDraftController } from "./usePhaseInputDraft";
import { GameEndControls } from "../game-end/GameEndControls";
import { CharacterIcon } from "../../components/CharacterIcon";

type ConfirmedReveal = {
  payload: RevealPayload;
  step: PhaseStep;
  confirmedEventCount: number;
};

export function PhaseControl({
  pendingReveal,
  currentStep,
  phaseOverview,
  players,
  dayState,
  ruleState,
  latestProposal,
  nominationDraft,
  onNominationDraftChange,
  phaseInputDraft,
  replayReady,
  busy,
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
}: {
  pendingReveal?: ConfirmedReveal;
  currentStep?: PhaseStep;
  phaseOverview: PhaseOverviewItem[];
  players: Player[];
  dayState?: DayState;
  ruleState?: RuleState;
  latestProposal?: Proposal;
  nominationDraft: NominationDraft;
  onNominationDraftChange: (draft: NominationDraft) => void;
  phaseInputDraft: PhaseInputDraftController;
  replayReady: boolean;
  busy: boolean;
  onShowReveal: (payload: RevealPayload) => void;
  onContinue: () => void;
  onConfirm: (confirmation: PhaseStepConfirmation) => void;
  onSkip: () => void;
  onSuggest: (request: PhaseInputSuggestionRequest) => Promise<CoreResult<PhaseInputSuggestion>>;
  choiceTokenSource: () => number;
  suggestionContextFingerprint: string;
  warnings: CoreWarning[];
  gameEnd?: GameEndState | null;
  onEndGame: (winningTeam: "good" | "evil") => void;
  onRequestUndoGameEnd: (trigger: HTMLButtonElement) => void;
}) {
  if (pendingReveal) {
    return (
      <ConfirmedRevealFollowup
        pendingReveal={pendingReveal}
        players={players}
        replayReady={replayReady}
        busy={busy}
        onShowReveal={onShowReveal}
        onContinue={onContinue}
      />
    );
  }

  if (gameEnd) {
    return (
      <>
        <div className="sectionHeader compact">
          <div><p className="eyebrow">게임 종료</p><h2>최종 결과</h2></div>
          <span className="phaseBadge">종료됨</span>
        </div>
        <GameEndControls
          warnings={warnings}
          gameEnd={gameEnd}
          busy={busy}
          onEndGame={onEndGame}
          onRequestUndo={onRequestUndoGameEnd}
        />
      </>
    );
  }

  return (
    <CurrentStepPane
      currentStep={currentStep}
      phaseOverview={phaseOverview}
      players={players}
      dayState={dayState}
      nominationDraft={nominationDraft}
      onNominationDraftChange={onNominationDraftChange}
      phaseInputDraft={phaseInputDraft}
      ruleState={ruleState}
      latestProposal={latestProposal}
      busy={busy}
      onConfirm={onConfirm}
      onSkip={onSkip}
      onSuggest={onSuggest}
      choiceTokenSource={choiceTokenSource}
      suggestionContextFingerprint={suggestionContextFingerprint}
      warnings={warnings}
      onEndGame={onEndGame}
      onRequestUndoGameEnd={onRequestUndoGameEnd}
    />
  );
}

function ConfirmedRevealFollowup({
  pendingReveal,
  players,
  replayReady,
  busy,
  onShowReveal,
  onContinue,
}: {
  pendingReveal: ConfirmedReveal;
  players: Player[];
  replayReady: boolean;
  busy: boolean;
  onShowReveal: (payload: RevealPayload) => void;
  onContinue: () => void;
}) {
  const isSpyGrimoire = isSpyGrimoireRevealPayload(pendingReveal.payload);
  const actor = pendingReveal.step.playerId
    ? players.find((player) => player.id === pendingReveal.step.playerId)
    : undefined;
  const actorTitle = actor
    ? `${actor.name}${pendingReveal.step.character ? ` · ${characterLabel(pendingReveal.step.character)}` : ""}`
    : stepTitle(pendingReveal.step);

  return (
    <>
      <div className="sectionHeader compact">
        <div>
          <p className="eyebrow">{phaseLabel(pendingReveal.step.phase)} · 후속 조치</p>
          <h2>확정된 정보 공개</h2>
        </div>
        <span className="phaseBadge confirmedRevealBadge">확정됨</span>
      </div>

      <section className="confirmedRevealFollowupCard" aria-label="확정된 Reveal 후속 조치">
        {!isSpyGrimoire ? (
          <div className="confirmedRevealActor">
            <span>{actor?.seat ?? "•"}</span>
            <div>
              <strong>{actorTitle}</strong>
              <small>
                {replayReady
                  ? "이벤트 확정과 다음 상태 리플레이가 완료되었습니다."
                  : "이벤트 확정 완료 · 다음 상태 재생 중"}
              </small>
            </div>
          </div>
        ) : null}

        {isSpyGrimoire ? (
          <button
            type="button"
            className="primaryButton"
            onClick={() => onShowReveal(pendingReveal.payload)}
            disabled={busy}
          >
            플레이어에게 공개
          </button>
        ) : (
          <RevealPreview
            payload={pendingReveal.payload}
            onShow={() => onShowReveal(pendingReveal.payload)}
            disabled={busy}
          />
        )}

        <div className="confirmedRevealContinue">
          <button
            type="button"
            className="secondaryButton"
            onClick={onContinue}
            disabled={busy || !replayReady}
          >
            다음 단계로 계속
          </button>
          {!isSpyGrimoire ? (
            <p>
              {replayReady
                ? "Reveal을 다시 열 필요가 없을 때만 다음 단계 입력을 표시합니다."
                : "다음 상태 재생 중"}
            </p>
          ) : null}
        </div>
      </section>

      <div className="confirmedRevealNextStepGuard" aria-label="다음 단계 대기">
        <span>다음 단계</span>
        <strong>명시적으로 계속할 때까지 숨김</strong>
      </div>
    </>
  );
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
  let outcome: string;
  if (resolution.outcome.kind === "death") outcome = "사망";
  else if (resolution.outcome.kind === "prevented") outcome = "수도승에 의해 보호됨";
  else if (resolution.outcome.kind === "soldierProtected") outcome = "군인 능력으로 생존";
  else if (resolution.outcome.reason === "alreadyDead") outcome = "이미 사망";
  else outcome = "효과 없음";
  return <p className="nightActionResult" aria-label="밤 행동 결과">{target.seat}번 {target.name} - {outcome}</p>;
}

function NightDeathAnnouncement({ players, playerIds }: { players: Player[]; playerIds: string[] }) {
  const deaths = playerIds.flatMap((id) => {
    const player = players.find((candidate) => candidate.id === id);
    return player ? [player] : [];
  });
  return (
    <section className="nightDeathAnnouncement" aria-label="밤 사망 발표">
      {deaths.map((player) => (
        <div key={player.id}>
          <span role="img" aria-label="사망">†</span>
          <strong>{player.seat}번</strong>
          <span>{player.name}</span>
        </div>
      ))}
    </section>
  );
}

function CurrentStepPane({
  currentStep,
  phaseOverview,
  players,
  dayState,
  nominationDraft,
  onNominationDraftChange,
  phaseInputDraft,
  ruleState,
  latestProposal,
  busy,
  onConfirm,
  onSkip,
  onSuggest,
  choiceTokenSource,
  suggestionContextFingerprint,
  warnings,
  onEndGame,
  onRequestUndoGameEnd,
}: {
  currentStep?: PhaseStep;
  phaseOverview: PhaseOverviewItem[];
  players: Player[];
  dayState?: DayState;
  nominationDraft: NominationDraft;
  onNominationDraftChange: (draft: NominationDraft) => void;
  phaseInputDraft: PhaseInputDraftController;
  ruleState?: RuleState;
  latestProposal?: Proposal;
  busy: boolean;
  onConfirm: (confirmation: PhaseStepConfirmation) => void;
  onSkip: () => void;
  onSuggest: (request: PhaseInputSuggestionRequest) => Promise<CoreResult<PhaseInputSuggestion>>;
  choiceTokenSource: () => number;
  suggestionContextFingerprint: string;
  warnings: CoreWarning[];
  onEndGame: (winningTeam: "good" | "evil") => void;
  onRequestUndoGameEnd: (trigger: HTMLButtonElement) => void;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionUsed, setSuggestionUsed] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string>();
  const activeSuggestionRequestRef = useRef<symbol | undefined>(undefined);
  const phaseOverviewDisclosureRef = useRef<HTMLDetailsElement>(null);
  const currentOverviewItemRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    activeSuggestionRequestRef.current = undefined;
    setSuggesting(false);
    setSuggestionUsed(false);
    setSuggestionError(undefined);
  }, [currentStep?.id, suggestionContextFingerprint]);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mobileViewport = window.matchMedia("(max-width: 900px)");
    const syncDisclosure = () => {
      if (phaseOverviewDisclosureRef.current) {
        phaseOverviewDisclosureRef.current.open = !mobileViewport.matches;
      }
    };
    syncDisclosure();
    mobileViewport.addEventListener("change", syncDisclosure);
    return () => mobileViewport.removeEventListener("change", syncDisclosure);
  }, []);
  useEffect(() => {
    currentOverviewItemRef.current?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [currentStep?.id]);
  const currentPlayer = currentStep?.playerId
    ? players.find((player) => player.id === currentStep.playerId)
    : undefined;
  const currentCharacter = currentStep?.character
    ? characters.find((character) => character.id === currentStep.character)
    : undefined;
  const currentCharacterKind = currentStep?.character
    ? characterKind(currentStep.character)
    : undefined;
  const resultSubject = currentStep?.stepType === "executionDeath" || currentStep?.stepType === "slayerDeath";
  const currentSubjectCharacter = resultSubject && currentPlayer
    ? characters.find((character) => character.id === currentPlayer.actualCharacter)
    : undefined;
  const actionPrompt = currentStep ? currentActionPrompt(currentStep) : undefined;
  const resultEffect = currentStep
    ? resultEffectDescription(currentStep)
    : undefined;
  const registrationSensitive = Boolean(
    currentStep?.informationPrompt &&
      (currentStep.informationPrompt.setupInfoRegistrationOptions.length > 0 ||
        currentStep.informationPrompt.numberChoices.some(
          (choice) => choice.registrationJudgments.length > 0,
        )),
  );
  const baseSelectionValid = currentStep
    ? stepInputReady(
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
      )
    : false;
  const selectionValid = baseSelectionValid;
  const hasTargetChecks = Boolean(currentStep?.informationPrompt?.targetChecks?.length);
  const selectedTargetCheck = currentStep
    ? targetCheckForSelection(currentStep, phaseInputDraft.selectedPlayerIds)
    : undefined;
  const targetChoiceReady =
    !hasTargetChecks ||
    Boolean(
      selectedTargetCheck &&
        (selectedTargetCheck.choices.length === 1 || phaseInputDraft.selectedTargetChoice),
    );
  const currentConfirmation = currentStep
    ? phaseStepConfirmation(currentStep, phaseInputDraft, nominationDraft)
    : {};
  const currentSuggestionFingerprint = suggestionRequestFingerprint(
    suggestionContextFingerprint,
    currentConfirmation,
  );
  const currentSuggestionFingerprintRef = useRef(currentSuggestionFingerprint);
  currentSuggestionFingerprintRef.current = currentSuggestionFingerprint;
  const completedPhaseStepCount = phaseOverview.filter(
    (step) => step.status === "complete" || step.status === "skipped",
  ).length;

  async function suggestCurrentInput() {
    if (!currentStep?.requiredInput.supportsRandomSuggestion || suggesting) return;
    const requestedStepId = currentStep.id;
    const requestedFingerprint = currentSuggestionFingerprint;
    const requestIdentity = Symbol();
    activeSuggestionRequestRef.current = requestIdentity;
    setSuggesting(true);
    setSuggestionError(undefined);
    const currentInput = currentConfirmation.input;
    const result = await onSuggest({
      stepId: requestedStepId,
      ...(currentInput === undefined ? {} : { currentInput }),
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

  return (
    <>
      <div className="sectionHeader compact">
        <div>
          <p className="eyebrow">{currentStep ? phaseLabel(currentStep.phase) : "진행"}</p>
          <h2>{currentStep?.stepType === "slayerDeath" ? "사망 확인" : currentStep ? stepTitle(currentStep, currentPlayer) : "완료"}</h2>
        </div>
        {currentStep ? <span className="phaseBadge">{inputKindLabel(currentStep.requiredInput.kind)}</span> : null}
      </div>

      <details className="phaseOverviewDisclosure" ref={phaseOverviewDisclosureRef}>
        <summary>
          <span>{currentStep ? `${phaseLabel(currentStep.phase)} 순서` : "단계 개요"}</span>
          <small>{completedPhaseStepCount} / {phaseOverview.length} 완료</small>
        </summary>
        <section className="phaseOverview" aria-label="단계 개요">
          <h3>{currentStep ? `${phaseLabel(currentStep.phase)} 순서` : "단계 개요"}</h3>
          <ol>
            {phaseOverview.length === 0 ? <li>표시할 단계 없음</li> : null}
            {phaseOverview.map((step) => (
              <li
                aria-current={step.status === "current" ? "step" : undefined}
                className={step.status}
                key={step.id}
                ref={step.status === "current" ? currentOverviewItemRef : undefined}
              >
                <span>{stepTitle(step, step.playerId ? players.find((player) => player.id === step.playerId) : undefined)}</span>
                <strong>{stepStatusLabel(step.status)}</strong>
              </li>
            ))}
          </ol>
        </section>
      </details>

      <GameEndControls
        warnings={warnings}
        busy={busy}
        onEndGame={onEndGame}
        onRequestUndo={onRequestUndoGameEnd}
      >
      <section className="currentStepCard" aria-label="현재 단계">
        {currentStep ? (
          <>
            {currentStep.stepType === "announcement" ? (
              <NightDeathAnnouncement players={players} playerIds={ruleState?.unannouncedNightDeathPlayerIds ?? []} />
            ) : null}
            {currentPlayer && !resultSubject ? (
              <section className="currentActor" aria-label="현재 행동자">
                <CharacterIcon characterId={currentStep.character} className="currentActorIcon" />
                <div>
                  <small>행동자</small>
                  <h3>{currentCharacter?.label ?? currentStep.character}</h3>
                  <strong>{currentPlayer.seat}번 {currentPlayer.name}</strong>
                  <div className="currentActorTags">
                    {currentCharacterKind ? <em>{kindLabels[currentCharacterKind]}</em> : null}
                    {currentPlayer.actualCharacter === "drunk" ? <em>실제 술꾼</em> : null}
                    {registrationSensitive ? <em>등록 판정</em> : null}
                  </div>
                  {currentCharacter?.abilitySummary ? <p>{currentCharacter.abilitySummary}</p> : null}
                </div>
              </section>
            ) : null}
            {currentPlayer && resultSubject ? (
              <section className="currentSubject" aria-label={currentStep.stepType === "executionDeath" ? "처형 대상" : "학살자 결과 대상"}>
                <div>
                  <strong>{currentPlayer.seat}번 {currentPlayer.name}</strong>
                  <span>{currentSubjectCharacter?.label ?? characterLabel(currentPlayer.actualCharacter)}</span>
                </div>
                {resultEffect ? <p>{resultEffect}</p> : null}
              </section>
            ) : null}
            {actionPrompt ? (
              <section className="currentActionPrompt" aria-label="필요한 입력">
                <small>지금 할 일</small>
                <p>{actionPrompt}</p>
              </section>
            ) : null}
            {currentStep.stepType === "nomination" && dayState ? (
              <ConfirmedExecutionStanding players={players} dayState={dayState} />
            ) : null}
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
              randomSuggestion={
                currentStep.requiredInput.supportsRandomSuggestion
                  ? {
                      label: suggestionUsed ? "다시 추천" : "무작위 추천",
                      disabled: busy || suggesting,
                      onClick: suggestCurrentInput,
                    }
                  : undefined
              }
            />
            {latestProposal?.event.type === "nightActionResolved" ? (
              <ImpActionResult proposal={latestProposal} players={players} />
            ) : null}
            {latestProposal?.event.type === "slayerAbilityUsed" && latestProposal.event.payload.outcome.kind === "noEffect" ? (
              <p className="nightActionResult" aria-label="학살자 능력 결과">아무 일도 일어나지 않음</p>
            ) : null}
            {suggestionError ? <p className="randomSuggestionFailure" role="alert">{suggestionError}</p> : null}
            {currentStep.requiredInput.kind === "executionDecision" ? (
              <ExecutionDecisionActions
                players={players}
                candidate={dayState?.executionCandidate}
                busy={busy}
                onConfirm={onConfirm}
              />
            ) : currentStep.requiredInput.kind === "executionDeathDecision" || currentStep.requiredInput.kind === "slayerDeathDecision" ? (
              <ExecutionDeathActions
                player={currentPlayer}
                busy={busy}
                onConfirm={onConfirm}
              />
            ) : (
              <div className="stepActions">
                <button
                  type="button"
                  className="primaryButton"
                  onClick={() =>
                    onConfirm(currentConfirmation)
                  }
                  disabled={busy || suggesting || !selectionValid || !targetChoiceReady}
                >
                  {currentStep.stepType === "whisper"
                    ? "토론 시작"
                    : currentStep.stepType === "discussion"
                      ? "지명 및 투표 시작"
                      : currentStep.stepType === "announcement" && currentStep.id.includes("announceDeaths")
                        ? "발표 확정"
                        : "확정"}
                </button>
                {currentStep.canSkip ? (
                  <button type="button" className="secondaryButton" onClick={onSkip} disabled={busy}>
                    지명 종료
                  </button>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <p className="emptyStep">진행할 단계 없음</p>
        )}
      </section>
      </GameEndControls>

    </>
  );
}

function resultEffectDescription(step: PhaseStep): string | undefined {
  if (step.stepType === "executionDeath" && step.id.endsWith(":virginDeath")) {
    return "처녀 능력으로 지명자가 즉시 처형됩니다.";
  }
  if (step.stepType === "slayerDeath") return "학살자 능력으로 사망합니다.";
  return undefined;
}

function ConfirmedExecutionStanding({
  players,
  dayState,
}: {
  players: Player[];
  dayState: DayState;
}) {
  const candidate = dayState.executionCandidate
    ? players.find((player) => player.id === dayState.executionCandidate?.nomineeId)
    : undefined;
  const standing = candidate && dayState.executionCandidate
    ? `${candidate.seat}번 ${candidate.name} — ${dayState.executionCandidate.voteCount}표`
    : `후보 없음 — ${dayState.highestVoteCount}표`;
  const aliveCount = players.filter((player) => player.alive).length;

  return (
    <section className="confirmedExecutionStanding" aria-label="현재 처형 후보">
      <small>현재 처형 후보</small>
      <strong>{standing}</strong>
      <span>기준 {dayState.executionVoteThreshold}표 · 생존자 {aliveCount}명</span>
    </section>
  );
}
