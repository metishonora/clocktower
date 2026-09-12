import {unmodifiedDistribution} from './setupDistributionFixture';
import { describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { GrimoireSetupController, rosterComplete, type GrimoireSetupDraft, type GrimoirePresentationState } from '../../src/custom/grimoire/setupController.js';
import { customFirstNightPlan, loadCustomDefinitionValidator } from '../../src/custom/core/wasmClient.js';
import { validateScenarioCandidate } from '../../src/custom/core/definitionValidator.js';
import { IndexedDbCustomWebSessionStorageDriver, type CustomWebSessionStorageDriver } from '../../src/custom/storage/sessionStorage.js';
import { realWasmCore } from './realCustomWasmHarness.js';
import type { CoreAdapter } from '../../src/custom/core/coreAdapter.js';
import type { CoreResult, SetupDistributionResult } from '../../src/custom/core/types.js';

async function scenario() {
  realWasmCore();
  const draft = { id: 'issue-220-test', name: '혼합 게임', characterIds: ['soldier', 'mayor', 'clockmaker', 'poisoner', 'imp', 'virgin', 'baron', 'drunk', 'recluse', 'slayer', 'butler', 'fangGu'] };
  const plan = await customFirstNightPlan(draft);
  if (!plan.ok) throw new Error(plan.error.messageKo);
  return validateScenarioCandidate({ ...draft, firstNightOrder: plan.value.plan }, loadCustomDefinitionValidator);
}
function storage() { return new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft, GrimoirePresentationState>('issue-220-test', new IDBFactory()); }
async function arranged(driver: CustomWebSessionStorageDriver<GrimoireSetupDraft, GrimoirePresentationState> = storage(), core = realWasmCore()) {
  const subject = new GrimoireSetupController(await scenario(), { core, storage: driver, gameId: 'game-220' });
  await subject.initialize();
  subject.setPlayerCount(5);
  await choose(subject, ['soldier', 'mayor', 'clockmaker', 'poisoner', 'imp']);
  await vi.waitFor(() => expect(rosterComplete(subject.getSnapshot())).toBe(true));
  subject.confirmRoster();
  subject.assignRemaining();
  return subject;
}

describe('custom grimoire setup handoff with production WASM', () => {
  it('starts with an empty roster and never exposes candidates outside the immutable scenario', async () => {
    const validated = await scenario();
    const mutable = structuredClone(validated);
    const subject = new GrimoireSetupController(mutable, { core: realWasmCore(), storage: storage() });
    mutable.definition.name = 'changed outside';
    subject.toggleCharacter('dreamer');
    expect(subject.getSnapshot().definition).toEqual(validated.definition);
    expect(subject.getSnapshot().draft.selectedIds).toEqual([]);
    expect(subject.getSnapshot().draft.players.every(player => player.actualCharacter === '')).toBe(true);
  });
  it('commits the selected roster with the definition order and persists the real replay before entering play', async () => {
    const driver = storage();
    const subject = await arranged(driver);
    subject.setPlayerName(1, '다은');
    await subject.confirm();
    const state = subject.getSnapshot();
    expect(state.error).toBeUndefined();
    expect(state.tab).toBe('play');
    expect(state.replay?.phase).toBe('firstNight');
    expect(state.replay?.players[0].name).toBe('다은');
    const saved = await driver.loadSession();
    expect(saved.status).toBe('loaded');
    if (saved.status !== 'loaded') throw new Error('Expected saved game');
    expect(saved.snapshot.canonical.game.script.definition).toEqual(state.definition);
    expect(saved.snapshot.canonical.game.events).toHaveLength(1);
    expect(saved.snapshot.canonical.game.events[0].payload).not.toHaveProperty('firstNightOrderPlan');
    expect(saved.snapshot.canonical.game.events[0].payload).not.toHaveProperty('setupChoiceId');
    const reloaded = await realWasmCore().replay(saved.snapshot.canonical);
    expect(reloaded.ok && reloaded.value.currentStep).toEqual(state.replay?.currentStep);
    subject.assignCharacter(1, 'clockmaker');
    expect(subject.getSnapshot().draft.players[0].actualCharacter).toBe('soldier');
  });
  it('does not publish play or duplicate Setup when a write fails and is retried', async () => {
    const driver = storage();
    let rejectFirst = true;
    let release: (() => void) | undefined;
    const delayed: CustomWebSessionStorageDriver<GrimoireSetupDraft, GrimoirePresentationState> = {
      loadSession: () => driver.loadSession(), replaceUnreadableSession: value => driver.replaceUnreadableSession(value),
      saveSession: async value => {
        if (rejectFirst) { rejectFirst = false; await new Promise<void>(resolve => { release = resolve; }); throw new Error('disk failure'); }
        return driver.saveSession(value);
      },
    };
    const core = { ...realWasmCore(), propose: vi.fn(realWasmCore().propose) };
    const subject = await arranged(delayed, core);
    const pending = subject.confirm();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(subject.getSnapshot().tab).toBe('seating');
    expect(subject.getSnapshot().replay).toBeUndefined();
    await subject.confirm(); // double click while saving is ignored
    release!(); await pending;
    expect(subject.getSnapshot().saveFailed).toBe(true);
    subject.setPlayerName(1, 'must not mutate accepted setup');
    expect(subject.getSnapshot().draft.players[0].name).toBe('플레이어 1');
    await subject.retrySave();
    expect(subject.getSnapshot().tab).toBe('play');
    expect(subject.getSnapshot().saveFailed).toBe(false);
    expect(core.propose).toHaveBeenCalledTimes(1);
    const saved = await driver.loadSession();
    expect(saved.status === 'loaded' && saved.snapshot.canonical.game.events.length).toBe(1);
  });
  it('S1-a/b/d: preserves the slot during setup editing and replaces it on valid confirmation', async () => {
    const driver = storage();
    const first = await arranged(driver); await first.confirm();
    const before = await driver.loadSession();
    const second = await arranged(driver); second.setPlayerName(1, 'replacement');
    expect(await driver.loadSession()).toEqual(before);
    await second.confirm();
    expect(second.getSnapshot().tab).toBe('play');
    expect(second.getSnapshot().error).toBeUndefined();
    const after = await driver.loadSession();
    expect(after.status === 'loaded' && after.snapshot.canonical.game.events[0].payload).toMatchObject({ players: [expect.objectContaining({ name: 'replacement' }), ...Array(4).fill(expect.anything())] });
  });
  it('lets the engine own mixed-script distribution modifiers and rejects invalid shown identities', async () => {
    const driver = storage();
    const subject = new GrimoireSetupController(await scenario(), { core: realWasmCore(), storage: driver });
    subject.setPlayerCount(5);
    await choose(subject, ['baron', 'soldier', 'drunk', 'recluse', 'imp']);
    await vi.waitFor(() => expect(subject.getSnapshot().distribution).toEqual({ Townsfolk: 1, Outsider: 2, Minion: 1, Demon: 1 }));
    expect(rosterComplete(subject.getSnapshot())).toBe(true);
    subject.confirmRoster();
    ['soldier', 'drunk', 'recluse', 'baron', 'imp'].forEach((id,i) => subject.assignCharacter(i+1,id));
    subject.setShownCharacter(2, 'imp');
    await subject.confirm();
    expect(subject.getSnapshot().error).toBeTruthy();
    expect(subject.getSnapshot().replay).toBeUndefined();
    expect((await driver.loadSession()).status).toBe('missing');
    subject.setShownCharacter(2, 'mayor');
    await subject.confirm();
    expect(subject.getSnapshot().error).toBeUndefined();
    expect(subject.getSnapshot().tab).toBe('play');
  });
  it('ignores obsolete distribution replies after the roster changes', async () => {
    const pending: Array<(value: CoreResult<SetupDistributionResult>) => void> = [];
    const core: CoreAdapter = { ...realWasmCore(), setupDistribution: () => new Promise(resolve => { pending.push(resolve); }) };
    const subject = new GrimoireSetupController(await scenario(), { core, storage: storage() });
    const first = subject.initialize();
    subject.setPlayerCount(5);
    pending[1]({ ok: true, value: unmodifiedDistribution({ Townsfolk: 3, Outsider: 0, Minion: 1, Demon: 1 }) });
    await Promise.resolve();
    pending[0]({ ok: true, value: unmodifiedDistribution({ Townsfolk: 5, Outsider: 0, Minion: 1, Demon: 1 }) });
    await first;
    expect(subject.getSnapshot().distribution?.Townsfolk).toBe(3);
  });
});

async function choose(subject: GrimoireSetupController, ids: string[]) {
  await vi.waitFor(() => expect(subject.getSnapshot().distributionPending).toBe(false));
  for (const id of ids) { subject.toggleCharacter(id); await vi.waitFor(() => expect(subject.getSnapshot().distributionPending).toBe(false)); }
}
it('rejects selections above category capacity, including rapid pending requests, and trims after count reduction', async () => {
  const subject = new GrimoireSetupController(await scenario(), {core:realWasmCore(),storage:storage()});
  await subject.initialize(); subject.setPlayerCount(5);
  await choose(subject,['soldier','mayor','clockmaker']);
  expect(subject.canSelectCharacter('virgin')).toBe(false); subject.toggleCharacter('virgin');
  expect(subject.getSnapshot().draft.selectedIds).toEqual(['soldier','mayor','clockmaker']);
  subject.toggleCharacter('poisoner'); subject.toggleCharacter('baron');
  await vi.waitFor(() => expect(subject.getSnapshot().distributionPending).toBe(false));
  expect(subject.getSnapshot().draft.selectedIds).not.toContain('baron');
  subject.setPlayerCount(7); await choose(subject,['virgin','slayer']); subject.setPlayerCount(5);
  await vi.waitFor(() => expect(subject.getSnapshot().distributionPending).toBe(false));
  expect(subject.getSnapshot().draft.selectedIds).toEqual(['soldier','mayor','clockmaker','poisoner']);
});
it('moves a role between seats without duplicating it and randomizes each selected role once', async () => {
  const subject = await arranged(); subject.assignCharacter(2,'soldier');
  expect(subject.getSnapshot().draft.players[0].actualCharacter).toBe('');
  expect(subject.getSnapshot().draft.players[1].actualCharacter).toBe('soldier');
  subject.randomizeAssignments();
  expect(subject.getSnapshot().draft.players.map(p=>p.actualCharacter).sort()).toEqual([...subject.getSnapshot().draft.selectedIds].sort());
});

it('changes the demon through its selector without exceeding one demon and uses the resulting Core distribution', async () => {
  const subject = new GrimoireSetupController(await scenario(), {core:realWasmCore(),storage:storage()});
  await subject.initialize(); subject.selectDemon('imp');
  await vi.waitFor(() => expect(subject.getSnapshot().distributionPending).toBe(false));
  subject.selectDemon('fangGu');
  await vi.waitFor(() => expect(subject.getSnapshot().distributionPending).toBe(false));
  expect(subject.getSnapshot().draft.selectedIds).toEqual(['fangGu']);
  expect(subject.getSnapshot().distribution).toEqual({Townsfolk:4,Outsider:1,Minion:1,Demon:1});
});
