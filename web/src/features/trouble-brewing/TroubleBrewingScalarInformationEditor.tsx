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
import { numberChoicesMatch } from "../../core/numberChoice";

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
  const delivered = selectedNumberChoice?.value ?? Math.max(0, constraint?.min ?? 0);
  if (constraint) {
    return <dl className="snvInformationValues tbScalarInformationResult" role="group" aria-label="정보 결과">
      <div><dt>진실</dt><dd>{scalarInformationValueLabel(characterId, truth)}</dd></div>
      <div>
        <dt>전달</dt>
        <dd>
          <input
            type="number"
            min={constraint.min}
            max={constraint.max}
            step="1"
            inputMode="numeric"
            aria-label="전달할 숫자"
            value={delivered}
            disabled={busy}
            onChange={(event) => {
              const value = Number(event.target.value);
              const valid = event.target.value !== ""
                && Number.isSafeInteger(value)
                && value >= constraint.min
                && value <= constraint.max
                && !constraint.excludedValues.includes(value);
              onNumberChoiceChange(valid ? {
                value,
                isComputed: value === truth,
                registrationJudgments: [],
              } : undefined);
            }}
          />
          <span>{scalarInformationUnit(characterId)}</span>
        </dd>
      </div>
    </dl>;
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

  return <div className="tbScalarInformationEditor">
    {candidates.length ? <div className="tbScalarTreatmentControls">
      {candidates.map((player) => {
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
        return <fieldset className="tbScalarTreatment" key={player.id}>
          <legend>{legend}</legend>
          {TEAM_TREATMENT_OPTIONS.map(({ registeredAs, label, accessibleLabel }) => (
            <button
              type="button"
              className={`alignment-${registeredAs}${selected === registeredAs ? " selected" : ""}`}
              aria-label={accessibleLabel}
              aria-pressed={selected === registeredAs}
              disabled={busy}
              onClick={() => chooseTreatment(player, registeredAs)}
              key={registeredAs}
            >{label}</button>
          ))}
        </fieldset>;
      })}
    </div> : null}
    <dl className="snvInformationValues tbScalarInformationResult" role="group" aria-label="정보 결과">
      <div>
        <dt>결과</dt>
        <dd>{displayedChoice
          ? scalarInformationValueLabel(characterId, displayedChoice.value)
          : "선택 필요"}</dd>
      </div>
    </dl>
  </div>;
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
  return Boolean(prompt && (prompt.numberConstraint || prompt.registrationCandidatePlayerIds.length === 0));
}

export function defaultScalarInformationChoice(step: PhaseStep): NumberChoice | undefined {
  const prompt = step.informationPrompt;
  if (!prompt) return undefined;
  if (prompt.numberConstraint) {
    const value = Math.max(0, prompt.numberConstraint.min);
    return {
      value,
      isComputed: prompt.computedResult?.kind === "number" && prompt.computedResult.value === value,
      registrationJudgments: [],
    };
  }
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
  if (prompt.numberConstraint) return true;
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

const TEAM_TREATMENT_OPTIONS = [
  { registeredAs: "good", label: "선", accessibleLabel: "선한 팀으로 취급" },
  { registeredAs: "evil", label: "악", accessibleLabel: "악한 팀으로 취급" },
] as const;
