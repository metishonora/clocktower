import type { CustomScriptDefinition } from "./core/types.js";
import catalog from "./generated/characterCatalog.json" with {type: "json"};
export type CharacterKind = "Townsfolk" | "Outsider" | "Minion" | "Demon";
export type CustomScriptCharacter = {
  readonly id: string;
  readonly kind: CharacterKind;
};
export const customScriptCharacters: readonly CustomScriptCharacter[] = Object.freeze(catalog.map(entry => {
  if (entry.kind !== "Townsfolk" && entry.kind !== "Outsider" && entry.kind !== "Minion" && entry.kind !== "Demon") {
    throw new Error("생성된 커스텀 캐릭터 종류가 올바르지 않습니다.");
  }
  return Object.freeze({ id: entry.id, kind: entry.kind });
}));


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
