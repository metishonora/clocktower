import type { CoreAdapter } from '../core/coreAdapter.js';
import { validateScenarioCandidate, type LoadCustomDefinitionValidator, type ValidatedScenario } from '../core/definitionValidator.js';
import type { GameFileV4 } from '../core/types.js';
import { parseGameFileJson } from '../storage/gameFile.js';
import { parseScenarioFileJson } from '../storage/scenarioFile.js';
export type ImportedGame = { file: GameFileV4 };
export async function importScenarioSource(json: string, createId: () => string, loadValidator: LoadCustomDefinitionValidator, core: Pick<CoreAdapter, 'replay'>): Promise<{ validated: ValidatedScenario; game?: ImportedGame }> {
  let discriminator: unknown;
  try { discriminator = JSON.parse(json); } catch { throw new Error('JSON 파일 형식이 올바르지 않습니다.'); }
  if (typeof discriminator === 'object' && discriminator !== null && 'schemaVersion' in discriminator) {
    const file = parseGameFileJson(json);
    const validated = await validateScenarioCandidate(file.game.script.definition, loadValidator);
    const replay = await core.replay(file);
    if (!replay.ok) throw new Error(replay.error.messageKo);
    if (!file.game.events.length) throw new Error('진행 기록이 없는 게임입니다. 시나리오 JSON을 선택하세요.');
    return { validated, game: { file } };
  }
  return { validated: await validateScenarioCandidate({ id: createId(), ...parseScenarioFileJson(json) }, loadValidator) };
}
