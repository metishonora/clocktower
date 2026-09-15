import {expect, it, vi} from 'vitest';
import {nightFixture} from './issue222Support';
import {FirstNightController} from '../../src/custom/grimoire/firstNightController';
import {CustomCanonicalSession} from '../../src/custom/session';
import {realWasmCore, replayOrThrow} from './realCustomWasmHarness';
import {exportGameFileJson, parseGameFileJson} from '../../src/custom/storage/gameFile';
import {informationChoices} from '../../src/custom/grimoire/stepInputModel';

async function attack(c: FirstNightController, target: string) {
  await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));
  c.beginSelection(); c.togglePlayer(target); await c.acceptSelection();
  expect(c.getSnapshot().error).toBeUndefined();
  await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));
}
it('the Sage controller carries a chosen Recluse registration into reveal, save, import and causal Undo',async()=>{
  const {controller:c,session,storage}=await nightFixture(['sage','recluse','soldier','virgin','slayer','scarletWoman','imp','mayor'],{},['ravenkeeper']);
  try {
    const before=session.snapshot.canonical;
    await attack(c,'p1'); c.finishHandoff();
    expect(c.step?.character).toBe('sage');
    const choices=informationChoices(c.step!,[]);
    const index=choices.findIndex(choice=>choice.result.kind==='playerPair'&&choice.result.playerIds.join(',')==='p2,p3'&&choice.registrationJudgments.length===1);
    expect(index).toBeGreaterThanOrEqual(0);
    c.beginSelection();c.togglePlayer('p3');c.togglePlayer('p2');await c.acceptSelection();
    expect(c.getSnapshot().inputDraft.judgments).toEqual(choices[index].registrationJudgments);
    expect(c.getSnapshot().inputDraft.choiceIndex).not.toBe('');
    c.beginSelection();c.togglePlayer('p2');
    expect(c.canSelectPlayer('p4')).toBe(false);
    expect(c.selectionReady).toBe(false);
    c.togglePlayer('p7');await c.acceptSelection();
    expect(c.getSnapshot().inputDraft.judgments).toEqual([]);
    expect(c.getSnapshot().inputDraft.choiceIndex).not.toBe('');
    c.beginSelection();c.cancelSelection();
    expect(c.getSnapshot().inputDraft.playerIds).toEqual([]);
    expect(c.getSnapshot().inputDraft.choiceIndex).toBe('');
    c.beginSelection();c.togglePlayer('p2');c.togglePlayer('p3');await c.acceptSelection();
    expect(c.getSnapshot().inputDraft.judgments).toEqual(choices[index].registrationJudgments);
    await c.prepareCurrent();
    expect(c.getSnapshot().error).toBeUndefined();
    expect(c.getSnapshot().activeReveal?.payload).toMatchObject({kind:'sageInformation',candidatePlayers:[{playerId:'p2'},{playerId:'p3'}]});
    c.conceal(); await c.confirm();
    await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));
    const event=session.snapshot.canonical.game.events.at(-1)!;
    expect(event.payload).toMatchObject({registrationJudgments:[{playerId:'p2',registeredAs:'demon'}]});
    const imported=parseGameFileJson(exportGameFileJson(session.snapshot.canonical));
    expect(await replayOrThrow(imported)).toEqual(await replayOrThrow(session.snapshot.canonical));
    const restored=await CustomCanonicalSession.load({storage,core:realWasmCore()});
    expect(restored.status).toBe('loaded');
    if(restored.status!=='loaded')throw Error(restored.status);
    expect(restored.session.replay).toEqual(session.replay);
    expect(await realWasmCore().confirmedEventReveal!(restored.session.snapshot.canonical,event.id)).toEqual(await realWasmCore().confirmedEventReveal!(session.snapshot.canonical,event.id));
    const corrupt=structuredClone(imported);
    (corrupt.game.events.at(-1)!.payload as {registrationJudgments:unknown[]}).registrationJudgments=[];
    expect((await realWasmCore().replay(corrupt)).ok).toBe(false);
    const undo=await restored.session.undo(event.id);
    expect(undo.ok).toBe(true);
    if(undo.ok)await undo.value.autosave;
    expect(restored.session.snapshot.canonical.game.events).toEqual(before.game.events);
  } finally {c.dispose();}
});
it('Fang Gu keeps Scarlet Woman unchanged in real WASM and IndexedDB without a phantom notification',async()=>{
  const {controller:c,session,storage}=await nightFixture(['saint','soldier','virgin','slayer','mayor','scarletWoman','fangGu'],{},['ravenkeeper','recluse']);
  try {
    const before=session.snapshot.canonical;
    await attack(c,'p1');
    expect(c.getSnapshot().replay.players[5].actualCharacter).toBe('scarletWoman');
    expect(c.getSnapshot().replay.pendingIdentityReveals?.some(r=>r.payload.kind==='characterChange'&&r.payload.playerId==='p6')).toBe(false);
    expect(c.getSnapshot().replay.players[0].actualCharacter).toBe('fangGu');
    const restored=await CustomCanonicalSession.load({storage,core:realWasmCore()});
    expect(restored.status).toBe('loaded');
    if(restored.status!=='loaded')throw Error(restored.status);
    expect(restored.session.replay).toEqual(session.replay);
    expect(await replayOrThrow(parseGameFileJson(exportGameFileJson(session.snapshot.canonical)))).toEqual(await replayOrThrow(session.snapshot.canonical));
    const undo=await restored.session.undo(session.snapshot.canonical.game.events.at(-1)!.id);
    expect(undo.ok).toBe(true); if(undo.ok)await undo.value.autosave;
    expect(restored.session.snapshot.canonical.game.events).toEqual(before.game.events);
  } finally {c.dispose();}
});
it('a pool-only Recluse never offers a Sage misregistration',async()=>{
  const {controller:c}=await nightFixture(['sage','soldier','virgin','slayer','mayor','scarletWoman','imp'],{},['recluse']);
  try {await attack(c,'p1');c.finishHandoff();expect(informationChoices(c.step!,[]).every(choice=>choice.registrationJudgments.length===0)).toBe(true);}
  finally {c.dispose();}
});
it('Drunk information audit retains its real ability source through WASM storage and Undo',async()=>{
  const {controller:c,session,storage}=await nightFixture(
    ['drunk','mathematician','soldier','virgin','slayer','poisoner','imp','mayor'],
    {choosePoisonTarget:{playerIds:['p4']}},['empath','ravenkeeper'],undefined,{drunk:'empath'},undefined,
    {learnEvilNeighbors:{kind:'number',value:0},learnCount:{kind:'number',value:0}},
  );
  try {
    await attack(c,'p4'); if(c.getSnapshot().handoff)c.finishHandoff();
    await attack(c,'p5'); c.finishHandoff();
    expect(c.step?.character).toBe('empath');
    expect(c.step?.simulationSource?.sourceAbilityUse.characterId).toBe('drunk');
    const before=session.snapshot.canonical;
    const choices=informationChoices(c.step!,[]);
    const choiceIndex=choices.findIndex(choice=>choice.result.kind==='number'&&choice.result.value===1);
    expect(choiceIndex).toBeGreaterThanOrEqual(0);
    c.updateInput({choiceIndex:String(choiceIndex)});await c.prepareCurrent();c.conceal();await c.confirm();
    await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));
    expect(c.getSnapshot().error).toBeUndefined();
    expect(c.step?.character).toBe('mathematician');
    expect(c.step?.informationPrompt?.computedResult).toEqual({kind:'number',value:1});
    expect(c.step?.informationPrompt?.mathematicianAudit?.records).toHaveLength(1);
    const restored=await CustomCanonicalSession.load({storage,core:realWasmCore()});
    if(restored.status!=='loaded')throw Error(restored.status);
    expect(restored.session.replay).toEqual(session.replay);
    const file=parseGameFileJson(exportGameFileJson(session.snapshot.canonical));
    expect(await replayOrThrow(file)).toEqual(await replayOrThrow(session.snapshot.canonical));
    const undo=await restored.session.undo(file.game.events.at(-1)!.id);
    expect(undo.ok).toBe(true);if(undo.ok)await undo.value.autosave;
    expect(restored.session.snapshot.canonical.game.events).toEqual(before.game.events);
  } finally {c.dispose();}
});
