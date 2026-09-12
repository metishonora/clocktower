import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useScenarioEditor } from '../../src/custom/authoring/useScenarioEditor.js';
import { createCustomGameFile } from '../../src/custom/storage/sessionStorage.js';
import type { CustomScriptDefinition } from '../../src/custom/core/types.js';

const definition: CustomScriptDefinition = {
  id: 'http-review', name: 'HTTP 검토', characterIds: ['imp'], firstNightOrder: [
    { kind: 'system', actionId: 'dusk' }, { kind: 'system', actionId: 'minionInfo' },
    { kind: 'system', actionId: 'demonInfo' }, { kind: 'system', actionId: 'dawn' },
  ],
};
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function useHttpCrypto() {
  // HTTP network origins expose getRandomValues, but not the secure-context randomUUID method.
  const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  vi.stubGlobal('crypto', { getRandomValues });
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('opens the scenario editor on an HTTP network origin without randomUUID', () => {
  useHttpCrypto();
  const { result } = renderHook(() => useScenarioEditor());
  expect(result.current.state.draft.id).toMatch(uuidV4);
  expect(result.current.state.step).toBe('scenario');
});

it('creates distinct game identities on that same origin without a caller-supplied ID', () => {
  useHttpCrypto();
  const first = createCustomGameFile(definition);
  const second = createCustomGameFile(definition);
  expect(first.game.id).toMatch(uuidV4);
  expect(second.game.id).toMatch(uuidV4);
  expect(first.game.id).not.toBe(second.game.id);
  expect(first.game.script.definition).toEqual(definition);
});
