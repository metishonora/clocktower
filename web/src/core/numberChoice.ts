import type { NumberChoice, PhaseStep, RegistrationJudgment } from "./types.js";

export function defaultConstrainedNumberChoice(step: PhaseStep): NumberChoice | undefined {
  const prompt = step.informationPrompt;
  const constraint = prompt?.numberConstraint;
  if (!constraint) return undefined;
  const value = Math.max(0, constraint.min);
  return {
    value,
    isComputed: prompt.computedResult?.kind === "number" && prompt.computedResult.value === value,
    registrationJudgments: [],
  };
}

export function numberChoiceIdentity(choice: NumberChoice): string {
  return JSON.stringify([
    choice.value,
    choice.isComputed,
    normalizedRegistrationJudgments(choice.registrationJudgments),
  ]);
}

export function numberChoicesMatch(
  left: NumberChoice,
  right: NumberChoice | undefined,
): boolean {
  return Boolean(right && numberChoiceIdentity(left) === numberChoiceIdentity(right));
}

function normalizedRegistrationJudgments(judgments: RegistrationJudgment[]): string[][] {
  return judgments
    .map((judgment) => [
      judgment.playerId,
      judgment.registeredAs,
      judgment.characterId ?? "",
    ])
    .sort(([leftPlayerId, leftValue, leftCharacterId], [rightPlayerId, rightValue, rightCharacterId]) =>
      leftPlayerId.localeCompare(rightPlayerId)
        || leftValue.localeCompare(rightValue)
        || leftCharacterId.localeCompare(rightCharacterId),
    );
}
