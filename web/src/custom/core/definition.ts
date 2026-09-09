import type { CustomScriptDefinition } from './types.js';
import { parseFirstNightOrderPlan } from './validation.js';
import { resolveCustomScriptDefinition } from '../characterCatalog.js';

export type DefinitionSection = 'name' | 'characters' | 'order';
export class DefinitionInputError extends Error {
  constructor(readonly section: DefinitionSection, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DefinitionInputError';
  }
}

// Shared by stored definitions and authoring; do not duplicate these checks in file codecs.
export function parseCustomScriptDefinition(value: unknown): CustomScriptDefinition {
  if (!isRecord(value) || !hasExactKeys(value, ['id', 'name', 'characterIds', 'firstNightOrder'])
    || typeof value.id !== 'string' || value.id.trim().length === 0) {
    throw new DefinitionInputError('characters', '커스텀 시나리오 정의가 올바르지 않습니다.');
  }
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    throw new DefinitionInputError('name', '커스텀 시나리오 정의가 올바르지 않습니다.');
  }
  if (!Array.isArray(value.characterIds)
    || !value.characterIds.every((id) => typeof id === 'string' && id.trim().length > 0)) {
    throw new DefinitionInputError('characters', '커스텀 시나리오 정의가 올바르지 않습니다.');
  }
  if (new Set(value.characterIds).size !== value.characterIds.length) {
    throw new DefinitionInputError('characters', '커스텀 시나리오에 중복된 캐릭터가 있습니다.');
  }
  let definition: CustomScriptDefinition;
  try {
    definition = resolveCustomScriptDefinition({ id: value.id, name: value.name,
      characterIds: [...value.characterIds], firstNightOrder: [] });
  } catch (cause) {
    throw new DefinitionInputError('characters', '커스텀 시나리오에서 지원하지 않는 캐릭터입니다.', { cause });
  }
  try {
    return { ...definition, firstNightOrder: structuredClone(parseFirstNightOrderPlan(value.firstNightOrder)) };
  } catch (cause) {
    throw new DefinitionInputError('order', '밤 행동 순서가 올바르지 않습니다.', { cause });
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
