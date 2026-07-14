import { useEffect, useState } from "react";
import type {
  DayState,
  PhaseOverviewItem,
  PhaseStep,
  PhaseStepInput,
  Player,
  RevealPayload,
} from "../../core/types";
import { RevealPreview } from "../../reveal";
import { characterLabel } from "../../setupDraft";
import type { NominationDraft } from "../voting/useNominationDraft";
import {
  inputKindLabel,
  inputShapeLabel,
  phaseLabel,
  stepInputPayload,
  stepInputReady,
  stepStatusLabel,
  stepTitle,
  stepTypeLabel,
} from "./phaseInput";
import { ExecutionDecisionActions, StepInputFields } from "./StepInputs";

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
  nominationDraft,
  onNominationDraftChange,
  replayReady,
  busy,
  onShowReveal,
  onContinue,
  onConfirm,
  onSkip,
}: {
  pendingReveal?: ConfirmedReveal;
  currentStep?: PhaseStep;
  phaseOverview: PhaseOverviewItem[];
  players: Player[];
  dayState?: DayState;
  nominationDraft: NominationDraft;
  onNominationDraftChange: (draft: NominationDraft) => void;
  replayReady: boolean;
  busy: boolean;
  onShowReveal: (payload: RevealPayload) => void;
  onContinue: () => void;
  onConfirm: (input?: PhaseStepInput) => void;
  onSkip: () => void;
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

  return (
    <CurrentStepPane
      currentStep={currentStep}
      phaseOverview={phaseOverview}
      players={players}
      dayState={dayState}
      nominationDraft={nominationDraft}
      onNominationDraftChange={onNominationDraftChange}
      busy={busy}
      onConfirm={onConfirm}
      onSkip={onSkip}
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
        <div className="confirmedRevealActor">
          <span>{actor?.seat ?? "•"}</span>
          <div>
            <strong>{actorTitle}</strong>
            <small>{replayReady ? "이벤트 확정과 다음 상태 리플레이가 완료되었습니다." : "이벤트 확정 완료 · 다음 상태 재생 중"}</small>
          </div>
        </div>

        <RevealPreview payload={pendingReveal.payload} onShow={() => onShowReveal(pendingReveal.payload)} disabled={busy} />

        <div className="confirmedRevealContinue">
          <button type="button" className="secondaryButton" onClick={onContinue} disabled={busy || !replayReady}>
            다음 단계로 계속
          </button>
          <p>{replayReady ? "Reveal을 다시 열 필요가 없을 때만 다음 단계 입력을 표시합니다." : "다음 상태 재생 중"}</p>
        </div>
      </section>

      <div className="confirmedRevealNextStepGuard" aria-label="다음 단계 대기">
        <span>다음 단계</span>
        <strong>명시적으로 계속할 때까지 숨김</strong>
      </div>
    </>
  );
}

function CurrentStepPane({
  currentStep,
  phaseOverview,
  players,
  dayState,
  nominationDraft,
  onNominationDraftChange,
  busy,
  onConfirm,
  onSkip,
}: {
  currentStep?: PhaseStep;
  phaseOverview: PhaseOverviewItem[];
  players: Player[];
  dayState?: DayState;
  nominationDraft: NominationDraft;
  onNominationDraftChange: (draft: NominationDraft) => void;
  busy: boolean;
  onConfirm: (input?: PhaseStepInput) => void;
  onSkip: () => void;
}) {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [zeroOutsiders, setZeroOutsiders] = useState(false);
  const [numberValue, setNumberValue] = useState("");
  const [numberReason, setNumberReason] = useState("");
  const currentPlayer = currentStep?.playerId
    ? players.find((player) => player.id === currentStep.playerId)
    : undefined;
  const selectionValid = currentStep
    ? stepInputReady(
        currentStep,
        selectedPlayerIds.length,
        selectedCharacterIds.length,
        selectedCharacterId,
        nominationDraft,
        zeroOutsiders,
        numberValue,
        numberReason,
      )
    : false;

  useEffect(() => {
    setSelectedPlayerIds([]);
    setSelectedCharacterId("");
    setSelectedCharacterIds([]);
    setZeroOutsiders(false);
    setNumberValue("");
    setNumberReason("");
  }, [currentStep?.id]);

  return (
    <>
      <div className="sectionHeader compact">
        <div>
          <p className="eyebrow">{currentStep ? phaseLabel(currentStep.phase) : "진행"}</p>
          <h2>{currentStep ? stepTitle(currentStep, currentPlayer) : "완료"}</h2>
        </div>
        {currentStep ? <span className="phaseBadge">{inputKindLabel(currentStep.requiredInput.kind)}</span> : null}
      </div>

      <section className="currentStepCard" aria-label="현재 단계">
        {currentStep ? (
          <>
            <dl>
              <div>
                <dt>단계</dt>
                <dd>{stepTypeLabel(currentStep.stepType)}</dd>
              </div>
              <div>
                <dt>입력</dt>
                <dd>{inputShapeLabel(currentStep.requiredInput)}</dd>
              </div>
              {currentPlayer ? (
                <div>
                  <dt>대상</dt>
                  <dd>
                    {currentPlayer.seat}번 {currentPlayer.name}
                  </dd>
                </div>
              ) : null}
            </dl>
            <StepInputFields
              step={currentStep}
              players={players}
              dayState={dayState}
              nominationDraft={nominationDraft}
              onNominationDraftChange={onNominationDraftChange}
              selectedPlayerIds={selectedPlayerIds}
              selectedCharacterId={selectedCharacterId}
              selectedCharacterIds={selectedCharacterIds}
              zeroOutsiders={zeroOutsiders}
              numberValue={numberValue}
              numberReason={numberReason}
              busy={busy}
              onSelectedPlayerIdsChange={setSelectedPlayerIds}
              onCharacterChange={setSelectedCharacterId}
              onCharactersChange={setSelectedCharacterIds}
              onZeroOutsidersChange={(checked) => {
                setZeroOutsiders(checked);
                if (checked) {
                  setSelectedPlayerIds([]);
                  setSelectedCharacterId("");
                }
              }}
              onNumberChange={setNumberValue}
              onNumberReasonChange={setNumberReason}
            />
            {currentStep.requiredInput.kind === "executionDecision" ? (
              <ExecutionDecisionActions
                players={players}
                candidate={dayState?.executionCandidate}
                busy={busy}
                onConfirm={onConfirm}
              />
            ) : (
              <div className="stepActions">
                <button
                  type="button"
                  className="primaryButton"
                  onClick={() =>
                    onConfirm(
                      stepInputPayload(
                        currentStep,
                        selectedPlayerIds,
                        selectedCharacterId,
                        selectedCharacterIds,
                        nominationDraft,
                        zeroOutsiders,
                        numberValue,
                        numberReason,
                      ),
                    )
                  }
                  disabled={busy || !selectionValid}
                >
                  확정
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

      <section className="phaseOverview" aria-label="단계 개요">
        <h3>{currentStep ? `${phaseLabel(currentStep.phase)} 순서` : "단계 개요"}</h3>
        <ol>
          {phaseOverview.length === 0 ? <li>표시할 단계 없음</li> : null}
          {phaseOverview.map((step) => (
            <li className={step.status} key={step.id}>
              <span>{stepTitle(step, step.playerId ? players.find((player) => player.id === step.playerId) : undefined)}</span>
              <strong>{stepStatusLabel(step.status)}</strong>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
