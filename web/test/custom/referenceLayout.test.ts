import { expect, test } from 'vitest';
import { referenceSetupCounts } from '../../src/custom/reference/referenceLayout';
import { referencePdfInput } from '../../src/custom/reference/referencePdfCache';
import { customScriptCharacters } from '../../src/custom/characterCatalog';
import { realWasmCore } from './realCustomWasmHarness';
import { customFirstNightPlan, customOtherNightPlan } from '../../src/custom/core/wasmClient';

test('font size participates in PDF cache identity while the default stays 9pt', () => {
  const standard = referencePdfInput('직업 일람', ['imp'], []);
  expect(standard.key).toBe(referencePdfInput('직업 일람', ['imp'], [], 9).key);
  expect(standard.key).not.toBe(referencePdfInput('직업 일람', ['imp'], [], 12).key);
  expect(standard.input.fontSize).toBe(9);
});

test('the printed setup chart covers 7–13 players and matches the real domain', async () => {
  expect(referenceSetupCounts.map(row => row[0])).toEqual([7, 8, 9, 10, 11, 12, 13]);
  const core = realWasmCore();
  const draft = {
    id: 'reference-base-counts', name: '기본 구성',
    characterIds: customScriptCharacters.map(c => c.id),
  };
  const [first, other] = await Promise.all([customFirstNightPlan(draft), customOtherNightPlan(draft)]);
  if (!first.ok || !other.ok) throw Error('기본 구성표 검증 시나리오를 만들지 못했습니다.');
  const customDefinition = { ...draft, firstNightOrder: first.value.plan, otherNightOrder: other.value.plan };
  for (const [playerCount, townsfolk, outsider, minion, demon] of referenceSetupCounts) {
    const result = await core.setupDistribution({ customDefinition, playerCount, actualCharacters: [] });
    if (!result.ok) throw Error(result.error.messageKo);
    expect(result.value.adjustment.base).toEqual({ Townsfolk: townsfolk, Outsider: outsider, Minion: minion, Demon: demon });
  }
});
