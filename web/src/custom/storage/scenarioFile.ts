import type { CustomScriptDefinition, FirstNightActionRef } from '../core/types.js';
import { hasExactKeys, isRecord } from '../core/definition.js';
import type { ValidatedScenario } from '../core/definitionValidator.js';

export type ScenarioContent = Omit<CustomScriptDefinition, 'id'>;
export type CustomScenarioFileV1 = {
  type: 'clocktower-custom-scenario'; version: 1;
  scenario: { name: string; characterIds: string[]; firstNightOrder: FirstNightActionRef[] };
};
export class ScenarioFileError extends Error {
  constructor(readonly code: 'json' | 'kind' | 'version' | 'structure', message: string) {
    super(message); this.name = 'ScenarioFileError';
  }
}
export function parseScenarioFileJson(json: string): ScenarioContent {
  let value: unknown;
  try { value = JSON.parse(json); }
  catch { throw new ScenarioFileError('json', 'JSON 파일을 읽지 못했습니다.'); }
  if (!isRecord(value) || value.type !== 'clocktower-custom-scenario') {
    throw new ScenarioFileError('kind', 'Clocktower 시나리오 JSON을 선택해 주세요.');
  }
  if (value.version !== 1) throw new ScenarioFileError('version', '지원하지 않는 시나리오 파일 버전입니다.');
  if (!hasExactKeys(value, ['type', 'version', 'scenario']) || !isRecord(value.scenario)
    || !hasExactKeys(value.scenario, ['name', 'characterIds', 'firstNightOrder'])
    || typeof value.scenario.name !== 'string' || !Array.isArray(value.scenario.characterIds)
    || !value.scenario.characterIds.every((id) => typeof id === 'string')
    || !Array.isArray(value.scenario.firstNightOrder)) {
    throw new ScenarioFileError('structure', '시나리오 파일 형식이 올바르지 않습니다.');
  }
  // The shared definition parser validates action shapes and the domain validates their meaning.
  return structuredClone(value.scenario) as ScenarioContent;
}
export function serializeScenarioFile(snapshot: ValidatedScenario): string {
  const { name, characterIds, firstNightOrder } = snapshot.definition;
  return JSON.stringify({ type: 'clocktower-custom-scenario', version: 1,
    scenario: { name, characterIds, firstNightOrder } } satisfies CustomScenarioFileV1, null, 2);
}
export function scenarioDownloadName(name: string): string {
  const safe = name.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').trim().replace(/[. ]+$/g, '');
  return `clocktower-scenario-${safe || 'scenario'}.json`;
}
