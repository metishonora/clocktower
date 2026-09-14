import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { CustomCanonicalSession } from '../../src/custom/session.js';
import { IndexedDbCustomWebSessionStorageDriver } from '../../src/custom/storage/sessionStorage.js';
import { parseGameFileJson, exportGameFileJson } from '../../src/custom/storage/gameFile.js';
import { sameCustomScriptDefinition } from '../../src/custom/core/scriptIdentity.js';
import { realWasmCore, replayOrThrow } from './realCustomWasmHarness.js';
import type { Command, PhaseStepInput, InformationResult } from '../../src/custom/core/types.js';
it('real WASM carries night triggers through files, IndexedDB, causal Undo and the third night', async () => {
    const file = parseGameFileJson(readFileSync('../fixtures/acceptance/custom-first-night/compatibility/day.game.json', 'utf8'));
    const storage = new IndexedDbCustomWebSessionStorageDriver(file.game.script.definition.id, new IDBFactory());
    const loaded = await CustomCanonicalSession.fromFile(file, { storage, core: realWasmCore(), setupDraft: {}, presentation: {} });
    if (!loaded.ok)
        throw Error(loaded.error.code);
    let session = loaded.value;
    async function run(command: Command) { const result = await session.execute(command); if (!result.ok)
        throw Error(result.error.code); expect(await result.value.autosave).toBe(true); return result.value.proposal.event; }
    async function day(input: Extract<Command, {
        type: 'confirmDay';
    }>['payload']['input']) { await run({ type: 'confirmDay', payload: { stepId: session.replay!.day!.stepId, expectedEventCount: session.snapshot.canonical.game.events.length, input } }); }
    async function night() { for (let i = 0; i < 3; i++)
        await day({ kind: 'advance' }); await day({ kind: 'closeNominations' }); await day({ kind: 'confirmExecution' }); await day({ kind: 'beginNight' }); }
    async function step(actionId: string, input: PhaseStepInput, deliveredResult?: InformationResult) { const step = session.replay!.currentStep!; expect(step.actionRef?.actionId).toBe(actionId); return run({ type: 'confirmStep', payload: { stepId: step.id, input, ...(deliveredResult ? { deliveredResult } : {}) } }); }
    await night();
    const night2 = session.replay!.currentStep!;
    await step('protectPlayer', { playerIds: ['p1'] });
    const beforeAttack = session.snapshot.canonical;
    const attack = await step('attackPlayer', { playerIds: ['p3'] });
    expect(session.replay!.players.find(p => p.id === 'p3')!.alive).toBe(false);
    const serialized = parseGameFileJson(exportGameFileJson(session.snapshot.canonical));
    expect(await replayOrThrow(serialized)).toEqual(await replayOrThrow(session.snapshot.canonical));
    const restored = await CustomCanonicalSession.load({ storage, core: realWasmCore() });
    if (restored.status !== 'loaded')
        throw Error(restored.status);
    session = restored.session;
    const delivery = await step('learnCharacter', { playerIds: ['p1'] }, { kind: 'character', characterId: 'undertaker' });
    expect(session.replay!.latestUndoUnit!.eventIds).toEqual([attack.id, delivery.id]);
    const reveal = await realWasmCore().confirmedEventReveal!(session.snapshot.canonical, delivery.id);
    expect(reveal).toMatchObject({ ok: true, value: { kind: 'characterInformation', revealedCharacterId: 'undertaker' } });
    const undo = await session.undo(delivery.id);
    if (!undo.ok)
        throw Error(undo.error.code);
    expect(await undo.value.autosave).toBe(true);
    expect(session.snapshot.canonical.game.events).toEqual(beforeAttack.game.events);
    await step('attackPlayer', { playerIds: ['p1'] });
    await step('dawn', null);
    await night();
    expect(session.replay!.currentStep!.abilityUse).toEqual(night2.abilityUse);
    expect(session.replay!.currentStep!.id).not.toBe(night2.id);
    const before = session.snapshot.canonical;
    const stale = await session.execute({ type: 'confirmStep', payload: { stepId: night2.id, input: { playerIds: ['p1'] } } });
    expect(stale.ok).toBe(false);
    expect(session.snapshot.canonical).toEqual(before);
    const corrupt = structuredClone(session.snapshot);
    delete (corrupt.canonical.game.script.definition as Partial<typeof file.game.script.definition>).otherNightOrder;
    await expect(storage.saveSession(corrupt)).rejects.toThrow();
    const saved = await storage.loadSession();
    expect(saved.status).toBe('loaded');
    if (saved.status === 'loaded')
        expect(saved.snapshot.canonical).toEqual(before);
});
it('other-night order participates in definition identity and old/missing orders never default on import', () => {
    const file = parseGameFileJson(readFileSync('../fixtures/acceptance/custom-first-night/compatibility/day.game.json', 'utf8'));
    const changed = structuredClone(file.game.script.definition);
    [changed.otherNightOrder[1], changed.otherNightOrder[2]] = [changed.otherNightOrder[2], changed.otherNightOrder[1]];
    expect(sameCustomScriptDefinition(file.game.script.definition, changed)).toBe(false);
    const old = { ...file, schemaVersion: 4 };
    expect(() => parseGameFileJson(JSON.stringify(old))).toThrow();
    const missing = structuredClone(file);
    delete (missing.game.script.definition as Partial<typeof changed>).otherNightOrder;
    expect(() => parseGameFileJson(JSON.stringify(missing))).toThrow();
    expect(parseGameFileJson(exportGameFileJson(file))).toEqual(file);
});
