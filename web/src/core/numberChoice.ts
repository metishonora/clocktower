import type { NumberChoice, RegistrationJudgment } from "./types.js";

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
