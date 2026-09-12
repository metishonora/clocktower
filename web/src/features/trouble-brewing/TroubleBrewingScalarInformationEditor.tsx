import {ScalarInformationEditorView,ScalarInformationConstraintView} from '../../shared-ui/InformationResultView';
import { InformationNumberInput, InformationTreatmentInput } from '../../shared-ui/InformationInputPresentation';
import {
  isScalarInformationCharacterId,
  scalarInformationUnit,
  scalarInformationValueLabel,
} from "../../core/informationPresentation";
import type {
  NumberChoice,
  PhaseStep,
  Player,
  RegistrationJudgment,
} from "../../core/types";
import { characterLabel } from "../../setupDraft";
import { defaultConstrainedNumberChoice, numberChoicesMatch } from "../../core/numberChoice";
import { TEAM_TREATMENT_OPTIONS } from "./teamTreatmentPresentation";

export function TroubleBrewingScalarInformationEditor({
  step,
  players,
  selectedNumberChoice,
  registrationJudgments,
  busy,
  onNumberChoiceChange,
  onRegistrationJudgmentsChange,
}: {
  step: PhaseStep;
  players: Player[];
  selectedNumberChoice?: NumberChoice;
  registrationJudgments: RegistrationJudgment[];
  busy: boolean;
  onNumberChoiceChange: (choice: NumberChoice | undefined) => void;
  onRegistrationJudgmentsChange: (judgments: RegistrationJudgment[]) => void;
}) {
  if (!step.character || !isScalarInformationCharacterId(step.character)) return null;
  const characterId = step.character;
  const prompt = step.informationPrompt;
  if (!prompt || prompt.computedResult?.kind !== "number") return null;
  const truth = prompt.computedResult.value;
  const constraint = prompt.numberConstraint;
  if (constraint) {
    return <ScalarInformationConstraintView truth={scalarInformationValueLabel(characterId, truth)} unit={scalarInformationUnit(characterId)} input={<InformationNumberInput key={step.id} value={selectedNumberChoice?.value} min={constraint.min} max={constraint.max} excludedValues={constraint.excludedValues} disabled={busy} onChange={value=>onNumberChoiceChange(value===undefined?undefined:{value,isComputed:value===truth,registrationJudgments:[]})}/>}/>;
  }

  const candidates = scalarRegistrationCandidates(step, players);
  const displayedChoice = candidates.length > 0
    ? selectedNumberChoice
    : prompt.numberChoices.find((choice) => choice.isComputed);
  const numberChoices = prompt.numberChoices;

  function chooseTreatment(player: Player, registeredAs: "good" | "evil") {
    const nextJudgments = candidates.flatMap((candidate) => {
      if (candidate.id === player.id) return [{ playerId: candidate.id, registeredAs }];
      const existing = registrationJudgments.find((judgment) => judgment.playerId === candidate.id);
      return existing && (existing.registeredAs === "good" || existing.registeredAs === "evil")
        ? [{ playerId: candidate.id, registeredAs: existing.registeredAs }]
        : [];
    });
    onRegistrationJudgmentsChange(nextJudgments);
    onNumberChoiceChange(numberChoiceForRegistrationTreatments(
      numberChoices,
      candidates,
      nextJudgments,
    ));
  }

  return <ScalarInformationEditorView treatments={candidates.length ? candidates.map((player) => {
        const sameCharacterCount = candidates.filter(
          (candidate) => candidate.actualCharacter === player.actualCharacter,
        ).length;
        const legend = [
          `이번 판정의 ${characterLabel(player.actualCharacter)} 취급`,
          sameCharacterCount > 1 ? `${player.seat}번 ${player.name}` : undefined,
        ].filter(Boolean).join(" · ");
        const selected = registrationJudgments.find(
          (judgment) => judgment.playerId === player.id,
        )?.registeredAs;
        return <InformationTreatmentInput key={player.id} label={legend} value={selected} disabled={busy}
          options={TEAM_TREATMENT_OPTIONS.map(option=>({...option,id:option.team}))}
          onChange={team=>chooseTreatment(player,team as 'good'|'evil')}/>;
      }) : undefined}>{displayedChoice
          ? scalarInformationValueLabel(characterId, displayedChoice.value)
          : "선택 필요"}</ScalarInformationEditorView>;
}

export function isTroubleBrewingScalarInformationStep(step: PhaseStep): boolean {
  return Boolean(
    step.character
      && isScalarInformationCharacterId(step.character)
      && step.informationPrompt?.computedResult?.kind === "number",
  );
}

export function scalarInformationMayUseDefault(step: PhaseStep): boolean {
  const prompt = step.informationPrompt;
  return Boolean(prompt && !prompt.numberConstraint && prompt.registrationCandidatePlayerIds.length === 0);
}

export function defaultScalarInformationChoice(step: PhaseStep): NumberChoice | undefined {
  const prompt = step.informationPrompt;
  if (!prompt) return undefined;
  const constrained = defaultConstrainedNumberChoice(step);
  if (constrained) return constrained;
  return prompt.numberChoices.find((choice) => choice.isComputed);
}

export function scalarInformationSelectionReady(
  step: PhaseStep,
  players: Player[],
  selectedNumberChoice: NumberChoice | undefined,
  registrationJudgments: RegistrationJudgment[],
): boolean {
  const prompt = step.informationPrompt;
  if (!prompt) return false;
  if (prompt.numberConstraint) {
    const value = selectedNumberChoice?.value;
    return Boolean(
      value !== undefined
        && Number.isSafeInteger(value)
        && value >= prompt.numberConstraint.min
        && value <= prompt.numberConstraint.max
        && !prompt.numberConstraint.excludedValues.includes(value),
    );
  }
  if (prompt.registrationCandidatePlayerIds.length === 0) {
    return prompt.numberChoices.some((choice) => choice.isComputed);
  }
  const candidates = scalarRegistrationCandidates(step, players);
  if (candidates.length !== prompt.registrationCandidatePlayerIds.length) return false;
  if (!candidates.every((candidate) =>
    registrationJudgments.some((judgment) => judgment.playerId === candidate.id),
  )) return false;
  return Boolean(
    selectedNumberChoice
      && prompt.numberChoices.some((choice) => numberChoicesMatch(choice, selectedNumberChoice)),
  );
}

function scalarRegistrationCandidates(step: PhaseStep, players: Player[]): Player[] {
  const ids = step.informationPrompt?.registrationCandidatePlayerIds ?? [];
  return ids.flatMap((playerId) => {
    const player = players.find((candidate) => candidate.id === playerId);
    return player ? [player] : [];
  });
}

function numberChoiceForRegistrationTreatments(
  choices: NumberChoice[],
  candidates: Player[],
  judgments: RegistrationJudgment[],
): NumberChoice | undefined {
  if (judgments.length !== candidates.length) return undefined;
  const explicitTreatment = choices.find((choice) =>
    !choice.isComputed && registrationJudgmentsMatch(choice.registrationJudgments, judgments),
  );
  if (explicitTreatment) return explicitTreatment;
  const allDefault = candidates.every((candidate) =>
    judgments.some((judgment) =>
      judgment.playerId === candidate.id && judgment.registeredAs === candidate.alignment,
    ),
  );
  if (allDefault) return choices.find((choice) => choice.isComputed);
  return undefined;
}

function registrationJudgmentsMatch(
  left: RegistrationJudgment[],
  right: RegistrationJudgment[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((judgment) => right.some((candidate) =>
    candidate.playerId === judgment.playerId
      && candidate.registeredAs === judgment.registeredAs
      && candidate.characterId === judgment.characterId,
  ));
}
