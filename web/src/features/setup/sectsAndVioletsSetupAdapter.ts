import {
  sectsAndVioletsCharacters,
  type SectsAndVioletsCharacter,
  type SectsAndVioletsCharacterKind,
} from "../../sectsAndVioletsCharacters";

export type SectsAndVioletsDemonChoice = "fangGu" | "vigormortis" | "noDashii" | "vortox";

export const sectsAndVioletsKindLabels: Record<SectsAndVioletsCharacterKind, string> = {
  townsfolk: "마을 주민",
  outsider: "외부인",
  minion: "하수인",
  demon: "악마",
};

export const sectsAndVioletsKindOrder: SectsAndVioletsCharacterKind[] = [
  "townsfolk",
  "outsider",
  "minion",
  "demon",
];

export const sectsAndVioletsDemonChoices = sectsAndVioletsCharacters.filter(
  (character) => character.kind === "demon",
) as Array<SectsAndVioletsCharacter & { id: SectsAndVioletsDemonChoice }>;

export const sectsAndVioletsBaseDistribution: Record<number, [number, number, number, number]> = {
  7: [5, 0, 1, 1],
  8: [5, 1, 1, 1],
  9: [5, 2, 1, 1],
  10: [7, 0, 2, 1],
  11: [7, 1, 2, 1],
  12: [7, 2, 2, 1],
  13: [9, 0, 3, 1],
  14: [9, 1, 3, 1],
  15: [9, 2, 3, 1],
};
