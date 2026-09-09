import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ScenarioEditorController, type ScenarioEditorDependencies } from '../../src/custom/authoring/scenarioEditorController.js';
import { actionKey } from '../../src/custom/authoring/reconcileFirstNightOrder.js';
import { customFirstNightPlan, loadCustomDefinitionValidator } from '../../src/custom/core/wasmClient.js';
import type { CustomDefinitionValidator } from '../../src/custom/core/definitionValidator.js';
import { IndexedDbCustomScriptRepository } from '../../src/custom/storage/definitionRepository.js';
import { parseGameFileJson } from '../../src/custom/storage/gameFile.js';
import { realWasmCore } from './realCustomWasmHarness.js';

// Independently specified accepted order, intentionally different from the default.
const order = [
  { kind: 'system', actionId: 'dusk' },
  { kind: 'character', characterId: 'poisoner', actionId: 'choosePoisonTarget' },
  { kind: 'system', actionId: 'minionInfo' },
  { kind: 'character', characterId: 'philosopher', actionId: 'chooseAbility' },
  { kind: 'system', actionId: 'demonInfo' },
  { kind: 'system', actionId: 'dawn' },
] as const;
const content = { name: '재사용 / 시나리오', characterIds: ['philosopher', 'poisoner', 'imp'], firstNightOrder: order };
const envelope = (scenario: unknown = content) => ({ type: 'clocktower-custom-scenario', version: 1, scenario });
const file = (value: unknown = envelope()) => ({ name: 'scenario.json', text: async () => JSON.stringify(value) });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function editor(overrides: Partial<ScenarioEditorDependencies> = {}) {
  let id = 0;
  const download = vi.fn();
  const loadValidator = vi.fn(loadCustomDefinitionValidator);
  const controller = new ScenarioEditorController({ createId: () => `local-${++id}`, loadValidator,
    proposeOrder: customFirstNightPlan, download, ...overrides });
  return { controller, download, loadValidator };
}
async function settled(controller: ScenarioEditorController) {
  await vi.waitFor(() => {
    expect(controller.getSnapshot().orderPending).toBe(false);
    expect(controller.getSnapshot().validation).not.toBe('pending');
  });
}
beforeAll(() => { realWasmCore(); });

describe('scenario files through the production authoring controller and shared WASM validator', () => {
  it('round-trips exact names, pool order and custom action order into a fresh editor; save reuses validation', async () => {
    const { controller, download, loadValidator } = editor();
    await controller.importFile(file());
    expect(controller.getSnapshot().validation).toBe('valid');
    const before = loadValidator.mock.calls.length;
    controller.save();
    expect(loadValidator).toHaveBeenCalledTimes(before);
    const [json, filename] = download.mock.calls[0];
    expect(JSON.parse(json)).toEqual(envelope());
    expect(filename).toBe('clocktower-scenario-재사용 _ 시나리오.json');
    expect(controller.getSnapshot().downloadStatus).toBe('requested');
    const fresh = editor().controller;
    await fresh.importFile({ name: filename, text: async () => json });
    expect(fresh.getSnapshot().validated?.definition).toMatchObject(content);
    const firstId = fresh.getSnapshot().draft.id;
    await fresh.importFile(file());
    expect(fresh.getSnapshot().draft.id).not.toBe(firstId);
  });

  it('repeated imports and saves never replace repository records, and exported scenarios are not GameFiles', async () => {
    const { controller, download } = editor();
    await controller.importFile(file());
    const repository = new IndexedDbCustomScriptRepository();
    await repository.save({ version: 1, definition: controller.getSnapshot().validated!.definition,
      metadata: { author: '원본 작성자', source: 'manual' } });
    const before = await repository.list();
    await controller.importFile(file());
    controller.setName('파일만 수정');
    await settled(controller);
    controller.save();
    expect(await repository.list()).toEqual(before);
    expect(() => parseGameFileJson(download.mock.calls[0][0])).toThrow();
  });

  it('re-exports loaded edits and preserves surviving action order when the pool changes', async () => {
    const { controller, download } = editor();
    await controller.importFile(file());
    controller.setName('수정된 이름');
    await settled(controller);
    controller.toggleCharacter('philosopher');
    await settled(controller);
    expect(controller.getSnapshot().draft.firstNightOrder).toEqual(order.filter(a => !('characterId' in a) || a.characterId !== 'philosopher'));
    const survivors = controller.getSnapshot().draft.firstNightOrder!;
    controller.toggleCharacter('washerwoman');
    await settled(controller);
    expect(controller.getSnapshot().draft.firstNightOrder!.filter(a => survivors.some(s => actionKey(s) === actionKey(a)))).toEqual(survivors);
    controller.moveAction(actionKey({ kind: 'system', actionId: 'minionInfo' }), -1);
    await settled(controller);
    controller.save();
    const exported = JSON.parse(download.mock.calls[0][0]);
    expect(exported.scenario.name).toBe('수정된 이름');
    expect(exported.scenario.characterIds).toEqual(['poisoner', 'imp', 'washerwoman']);
    expect(exported.scenario.firstNightOrder.slice(0, 3)).toEqual([order[0], order[2], order[1]]);
    const next = editor().controller;
    await next.importFile(file(exported));
    expect(next.getSnapshot().validation).toBe('valid');
  });

  it.each([
    ['official script', ['imp', { id: '_meta', name: 'official' }]],
    ['GameFile', { formatVersion: 1, gameId: 'game', events: [] }],
    ['version', { ...envelope(), version: 2 }],
    ['unknown envelope field', { ...envelope(), author: 'ignored?' }],
    ['other-night', envelope({ ...content, otherNightOrder: [] })],
    ['unknown scenario field', envelope({ ...content, id: 'external-id' })],
    ['missing actions', envelope({ ...content, firstNightOrder: [order[0], order[5]] })],
    ['duplicate character', envelope({ ...content, characterIds: ['imp', 'imp'] })],
    ['unsupported character', envelope({ ...content, characterIds: ['po'] })],
  ])('rejects %s atomically, preserving the last valid draft', async (_label, candidate) => {
    const { controller, download } = editor();
    await controller.importFile(file());
    const old = controller.getSnapshot().draft;
    await controller.importFile(file(candidate));
    expect(controller.getSnapshot().importStatus).toBe('error');
    expect(controller.getSnapshot().draft).toBe(old);
    controller.save();
    expect(JSON.parse(download.mock.calls[0][0])).toEqual(envelope());
  });

  it('rejects malformed JSON and read failures, allows retry and cancel without changing content', async () => {
    const { controller } = editor();
    await controller.importFile(file());
    const old = controller.getSnapshot().draft;
    await controller.importFile({ name: 'broken', text: async () => '{' });
    expect(controller.getSnapshot().importStatus).toBe('error');
    await controller.importFile({ name: 'unreadable', text: async () => { throw Error('I/O'); } });
    expect(controller.getSnapshot().importError).toContain('읽지 못했습니다');
    controller.beginFileSelection(); // canceled picker never delivers another File.
    expect(controller.getSnapshot().draft).toBe(old);
    await controller.importFile(file());
    expect(controller.getSnapshot().importStatus).toBe('ready');
  });

  it('invalidates save immediately on edits and rejects stale successful validation', async () => {
    const pending = deferred<CustomDefinitionValidator>();
    const load = vi.fn(loadCustomDefinitionValidator);
    const { controller, download } = editor({ loadValidator: load });
    await controller.importFile(file());
    load.mockImplementationOnce(() => pending.promise);
    controller.setName('old asynchronous candidate');
    controller.save();
    expect(download).not.toHaveBeenCalled();
    controller.setName('');
    await settled(controller);
    pending.resolve(await loadCustomDefinitionValidator());
    await Promise.resolve(); await Promise.resolve();
    expect(controller.getSnapshot().validation).toBe('invalid');
    expect(controller.getSnapshot().draft.name).toBe('');
    controller.save();
    expect(download).not.toHaveBeenCalled();
  });

  it('late import cannot replace a newer import, edited draft, or canceled selection', async () => {
    const { controller } = editor();
    for (const invalidate of [async () => controller.importFile(file(envelope({ ...content, name: 'newer' }))),
      async () => { controller.setName('newer'); }, async () => { controller.beginFileSelection(); }]) {
      const delayed = deferred<string>();
      const pending = controller.importFile({ name: 'old', text: () => delayed.promise });
      await invalidate();
      const expected = controller.getSnapshot().draft;
      delayed.resolve(JSON.stringify(envelope()));
      await pending;
      expect(controller.getSnapshot().draft).toBe(expected);
    }
  });

  it('late default-order response cannot replace a successfully imported explicit order', async () => {
    const pending = deferred<Awaited<ReturnType<typeof customFirstNightPlan>>>();
    const { controller } = editor({ proposeOrder: () => pending.promise });
    controller.startNew();
    await controller.importFile(file());
    pending.resolve(await customFirstNightPlan({ id: 'old', name: 'old', characterIds: [] }));
    await Promise.resolve(); await Promise.resolve();
    expect(controller.getSnapshot().validated?.definition).toMatchObject(content);
  });

  it('an import already waiting for the validator cannot overwrite a subsequently edited draft', async () => {
    const pending = deferred<CustomDefinitionValidator>();
    const load = vi.fn(loadCustomDefinitionValidator);
    const { controller } = editor({ loadValidator: load });
    await controller.importFile(file());
    load.mockImplementationOnce(() => pending.promise);
    const importing = controller.importFile(file(envelope({ ...content, name: 'stale file' })));
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    controller.setName('current edit');
    await settled(controller);
    pending.resolve(await loadCustomDefinitionValidator());
    await importing;
    expect(controller.getSnapshot().validated?.definition.name).toBe('current edit');
  });

  it('a failed default proposal retries the pending pool without losing edits, then rejects an older pool response', async () => {
    const pending = deferred<Awaited<ReturnType<typeof customFirstNightPlan>>>();
    const propose = vi.fn(customFirstNightPlan).mockRejectedValueOnce(Error('initialization failed'));
    const { controller } = editor({ proposeOrder: propose });
    controller.startNew();
    await settled(controller);
    expect(controller.getSnapshot().error?.section).toBe('operation');
    controller.setName('새 작성');
    controller.retry();
    await settled(controller);
    expect(controller.getSnapshot().validation).toBe('valid');
    propose.mockImplementationOnce(() => pending.promise);
    controller.toggleCharacter('philosopher');
    controller.toggleCharacter('poisoner');
    await settled(controller);
    const current = controller.getSnapshot().validated;
    pending.resolve(await customFirstNightPlan({ id: 'old', name: 'old', characterIds: ['philosopher'] }));
    await Promise.resolve(); await Promise.resolve();
    expect(controller.getSnapshot().validated).toBe(current);
    expect(current?.definition.characterIds).toEqual(['philosopher', 'poisoner']);
  });

  it('initialization and download errors remain retryable without success feedback or lost content', async () => {
    const load = vi.fn(loadCustomDefinitionValidator).mockRejectedValueOnce(Error('WASM failed'));
    const { controller, download } = editor({ loadValidator: load });
    await controller.importFile(file());
    expect(controller.getSnapshot().importStatus).toBe('error');
    expect(controller.getSnapshot().validated).toBeUndefined();
    await controller.importFile(file());
    load.mockRejectedValueOnce(Error('WASM failed again'));
    controller.setName('retry me');
    await settled(controller);
    expect(controller.getSnapshot().error?.section).toBe('operation');
    controller.retry(); await settled(controller);
    expect(controller.getSnapshot().validation).toBe('valid');
    download.mockImplementationOnce(() => { throw Error('blocked'); });
    controller.save();
    expect(controller.getSnapshot().downloadStatus).toBe('error');
    controller.save();
    expect(controller.getSnapshot().downloadStatus).toBe('requested');
    expect(JSON.parse(download.mock.calls[1][0]).scenario.name).toBe('retry me');
  });
});
