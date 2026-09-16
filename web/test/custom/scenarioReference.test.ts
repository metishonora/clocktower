import { beforeAll, expect, test } from 'vitest';
import { realWasmCore } from './realCustomWasmHarness';
import { scenarioJinxes } from '../../src/custom/core/wasmClient';
import { parseScenarioJinxes } from '../../src/custom/core/scenarioJinxes';
import { customScriptCharacters } from '../../src/custom/characterCatalog';
beforeAll(() => { realWasmCore(); });
test('WASM uses the full public pool, has all translations, and distinguishes empty from failure', async () => {
  const all = await scenarioJinxes(customScriptCharacters.map(c => c.id));
  expect(all.ok).toBe(true);
  if (!all.ok) throw Error(all.error.messageKo);
  expect(all.value).toHaveLength(3);
  expect(all.value.every(j => j.reasonKo && j.characterIds.includes(j.sourceCharacterId))).toBe(true);
  expect(await scenarioJinxes(['drunk'])).toEqual({ ok: true, value: [] });
  const pair = await scenarioJinxes(['drunk', 'mathematician']);
  expect(pair.ok && pair.value.map(j => j.id)).toEqual(['drunk--mathematician']);
  expect((await scenarioJinxes(['not-a-character'])).ok).toBe(false);
  expect((await scenarioJinxes(['drunk','drunk'])).ok).toBe(false);
  expect(await scenarioJinxes(['drunk'])).toEqual({ ok: true, value: [] });
});
test('malformed and duplicate metadata cannot silently become a partial list', () => {
  for (const value of [null, {}, [{id:'x'}], [{id:'x',characterIds:['drunk','drunk'],reasonKo:'문구',sourceCharacterId:'drunk',sourceRevision:'r'}]]) {
    expect(() => parseScenarioJinxes(value)).toThrow();
  }
});
