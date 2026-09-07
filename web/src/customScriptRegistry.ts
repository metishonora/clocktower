import type { CustomScriptDefinition } from "./core/types.js";
import { sectsAndVioletsCharacters } from "./sectsAndVioletsCharacters.js";
import { characters, type CharacterKind } from "./setupDraft.js";

export type CustomScriptCharacter = {
  readonly id: string;
  readonly kind: CharacterKind;
};

const canonicalKinds = {
  townsfolk: "Townsfolk",
  outsider: "Outsider",
  minion: "Minion",
  demon: "Demon",
} as const satisfies Record<string, CharacterKind>;

export const customScriptCharacters: readonly CustomScriptCharacter[] = Object.freeze([
  ...characters.map(({ id, kind }) => ({ id, kind })),
  ...sectsAndVioletsCharacters.map(({ id, kind }) => ({
    id,
    kind: canonicalKinds[kind],
  })),
]);

const customKindsById = new Map(
  customScriptCharacters.map(({ id, kind }) => [id, kind] as const),
);

export function isCustomScriptCharacter(characterId: string): boolean {
  return customKindsById.has(characterId);
}

export function customScriptCharacterKind(characterId: string): CharacterKind | undefined {
  return customKindsById.get(characterId);
}

export function resolveCustomScriptDefinition(
  definition: CustomScriptDefinition,
): CustomScriptDefinition {
  if (definition.characterIds.some((characterId) => !isCustomScriptCharacter(characterId))) {
    throw new Error("커스텀 시나리오에서 지원하지 않는 캐릭터입니다.");
  }
  return {
    ...definition,
    characterIds: [...definition.characterIds],
    firstNightOrder: structuredClone(definition.firstNightOrder),
  };
}
