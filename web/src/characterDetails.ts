import { characterAsset } from "./characterAssets.js";
import { characterRulesFor } from "./characterRules.js";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets.js";
import { sectsAndVioletsRulesFor } from "./sectsAndVioletsCharacterRules.js";
import { sectsAndVioletsCharacters } from "./sectsAndVioletsCharacters.js";
import { characterKind, kindLabels } from "./setupDraft.js";
import { troubleBrewingCharacterMatrixFor } from "./troubleBrewingCharacterMatrix.js";

export type CharacterDetailReminder = Readonly<{
  label: string;
  count: number;
  description: string;
}>;

export type CharacterDetail = Readonly<{
  id: string;
  label: string;
  kindLabel?: string;
  iconSrc?: string;
  ability: string;
  rulings: readonly string[];
  howToRun: readonly string[];
  reminders: readonly CharacterDetailReminder[];
  examples: readonly Readonly<{ id: string; text: string }>[];
  sourceUrl: string;
}>;

export function troubleBrewingCharacterDetail(characterId?: string): CharacterDetail | undefined {
  const rules = characterRulesFor(characterId);
  if (!rules) return undefined;
  const matrix = troubleBrewingCharacterMatrixFor(rules.id);
  if (!matrix) return undefined;
  const kind = characterKind(rules.id);
  return {
    id: rules.id,
    label: rules.label,
    kindLabel: kind ? kindLabels[kind] : undefined,
    iconSrc: characterAsset(rules.id)?.src,
    ability: rules.ability,
    rulings: rules.rulings,
    howToRun: rules.howToRun,
    reminders: matrix.reminders.map(({ label, count, description }) => ({ label, count, description })),
    examples: rules.examples.map((text, index) => ({ id: `${rules.id}-example-${index + 1}`, text })),
    sourceUrl: rules.sourceUrl,
  };
}

const sectsAndVioletsKindLabels = {
  townsfolk: "마을 주민",
  outsider: "외부인",
  minion: "하수인",
  demon: "악마",
} as const;

export function sectsAndVioletsCharacterDetail(characterId?: string): CharacterDetail | undefined {
  if (!characterId) return undefined;
  const rules = sectsAndVioletsRulesFor(characterId);
  if (!rules) return undefined;
  const asset = sectsAndVioletsCharacterAsset(rules.id);
  const kind = sectsAndVioletsCharacters.find((character) => character.id === rules.id)?.kind;
  return {
    id: rules.id,
    label: rules.label,
    kindLabel: kind ? sectsAndVioletsKindLabels[kind] : undefined,
    iconSrc: asset?.src,
    ability: rules.ability,
    rulings: rules.rulings,
    howToRun: rules.howToRun,
    reminders: rules.reminders.map(({ label, count, description }) => ({ label, count, description })),
    examples: rules.examples.map(({ id, text }) => ({ id, text })),
    sourceUrl: rules.source.url,
  };
}
