import { parseCustomScriptDefinition } from './definition.js';
import type { CustomScriptDefinition } from "./types.js";

/** Prepared synchronous validation keeps WASM initialization outside IndexedDB transactions. */
export type CustomDefinitionValidator = (definition: CustomScriptDefinition) => void;
export type LoadCustomDefinitionValidator = () => Promise<CustomDefinitionValidator>;

export class CustomDefinitionValidationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'CustomDefinitionValidationError';
  }
}

export type ValidatedScenario = { readonly definition: CustomScriptDefinition };

export function freezeSnapshot<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeSnapshot(child);
    Object.freeze(value);
  }
  return value;
}
export async function validateScenarioCandidate(
  candidate: unknown,
  loadValidator: LoadCustomDefinitionValidator,
): Promise<ValidatedScenario> {
  const definition = parseCustomScriptDefinition(candidate);
  const validate = await loadValidator();
  validate(definition);
  return freezeSnapshot({ definition });
}
