import { expect,it } from 'vitest';
import { beforeWasherwoman,confirmAction,newScenario,scenario } from './issue220ScenarioOrderSupport';
import { realWasmCore,replayOrThrow } from './realCustomWasmHarness';
import { parseGameFileJson,exportGameFileJson } from '../../src/custom/storage/gameFile';
import { CustomCanonicalSession } from '../../src/custom/session';
it('A01/A04: user scenario reaches system information before linked preparation and projects legal correct markers',async()=>{
 const {session}=await newScenario();expect(session.replay?.currentStep?.actionRef).toEqual({kind:'system',actionId:'minionInfo'});
 expect(session.replay?.currentStep?.requiredInput.setupInformationChoices).toBeUndefined();
 const {session:s}=await beforeWasherwoman();
 const candidates=s.replay!.currentStep!.requiredInput.setupInformationChoices!;
 expect(candidates.some(c=>c.preparation.correctPlayerId==='p6'&&c.preparation.information.kind==='setupInfo'&&c.preparation.information.characterId==='monk'&&c.preparation.information.playerIds.join(',')==='p6,p8'&&!c.registrationJudgments.length)).toBe(true);
 const prepared=await confirmAction(s,'prepareInformation',{playerIds:['p6','p8'],characterId:'monk',correctPlayerId:'p6'});
 expect(prepared.proposal.revealPayload).toBeFalsy();
 const delivery=await confirmAction(s,'learnTownsfolk',null);
 expect(delivery.proposal.revealPayload).toMatchObject({kind:'setupInformation',revealedCharacterId:'monk',zeroOutsiders:false});
 expect(s.replay?.ruleState.automaticReminders).toEqual(expect.arrayContaining([expect.objectContaining({playerId:'p6',tokenId:'townsfolk'})]));
});
it('A02: changing a valid definition changes actual first action, not only overview labels',async()=>{
 const modified=structuredClone(scenario);const poison=modified.firstNightOrder.splice(modified.firstNightOrder.findIndex(a=>a.actionId==='choosePoisonTarget'),1)[0];modified.firstNightOrder.splice(1,0,poison);
 const minion=modified.firstNightOrder.findIndex(a=>a.actionId==='minionInfo'),demon=modified.firstNightOrder.findIndex(a=>a.actionId==='demonInfo');[modified.firstNightOrder[minion],modified.firstNightOrder[demon]]=[modified.firstNightOrder[demon],modified.firstNightOrder[minion]];
 const {session}=await newScenario(modified);expect(session.replay?.currentStep?.actionRef?.actionId).toBe('choosePoisonTarget');await confirmAction(session,'choosePoisonTarget',{playerIds:['p9']});expect(session.replay?.currentStep?.actionRef?.actionId).toBe('demonInfo');await confirmAction(session,'demonInfo',{characterIds:['ravenkeeper','undertaker','juggler']});expect(session.replay?.currentStep?.actionRef?.actionId).toBe('minionInfo');
});
it('A05: valid old early preparation is replay-only, roundtrips intact and rejects a forged owner',async()=>{
 const {session}=await beforeWasherwoman();const prepared=await confirmAction(session,'prepareInformation',{playerIds:['p6','p8'],characterId:'monk',correctPlayerId:'p6'});
 // The old scheduler accepted this un-impaired Setup preparation before minion information.
 // Its source is Setup and neither target nor actor changed in the intervening events.
 const old=structuredClone(session.snapshot.canonical);old.game.events=[old.game.events[0],prepared.proposal.event];
 const parsed=parseGameFileJson(exportGameFileJson(old,new Date('2026-09-11T00:00:00Z')));expect(parsed.game.events).toEqual(old.game.events);
 const replay=await replayOrThrow(parsed);expect(replay.currentStep?.actionRef?.actionId).toBe('minionInfo');expect(replay.ruleState.preparations?.[0].sourceEventId).toBe(prepared.proposal.event.id);
 const fresh=structuredClone(old);fresh.game.events=fresh.game.events.slice(0,1);
 expect((await realWasmCore().propose(fresh,{type:'confirmStep',payload:{stepId:prepared.proposal.event.type==='customActionConfirmed'?prepared.proposal.event.payload.stepId:'',input:{playerIds:['p6','p8'],characterId:'monk',correctPlayerId:'p6'}}})).ok).toBe(false);
 const forged=structuredClone(old);const event=forged.game.events[1];if(event.type!=='customActionConfirmed')throw Error('event');event.payload.abilityUse!.ownerPlayerId='p2';expect((await realWasmCore().replay(forged)).ok).toBe(false);
});
it('A05: new prefix storage/reload/Undo preserves canonical and preparation source',async()=>{
 const {session,storage}=await beforeWasherwoman();const before=session.snapshot.canonical;
 const prepared=await confirmAction(session,'prepareInformation',{playerIds:['p6','p8'],characterId:'monk',correctPlayerId:'p6'});
 const loaded=await CustomCanonicalSession.load({core:realWasmCore(),storage});expect(loaded.status).toBe('loaded');if(loaded.status!=='loaded')return;
 expect(loaded.session.snapshot.canonical).toEqual(session.snapshot.canonical);
 const undo=await loaded.session.undo(prepared.proposal.event.id);expect(undo.ok).toBe(true);expect(loaded.session.snapshot.canonical.game.events).toEqual(before.game.events);
});

it('A04 ambiguity: arbitrary impaired information proceeds without inventing a correct marker',async()=>{
 const {CustomGrimoireApplicationController}=await import('../../src/custom/grimoire/applicationController');
 const {session}=await beforeWasherwoman('p1');const app=new CustomGrimoireApplicationController(realWasmCore(),()=>{});await app.resumeImported({file:session.snapshot.canonical});
 try{const p=app.play!,before=p.getSnapshot().file.game.events.length;
 p.beginSelection();p.togglePlayer('p6');p.togglePlayer('p8');p.updateInput({characterIds:['washerwoman']});
 expect(p.getSnapshot().inputDraft.correct).toBe('');await p.acceptSelection();await p.prepareCurrent();
 expect(p.getSnapshot().public).toBe(true);expect(p.getSnapshot().file.game.events).toHaveLength(before+1);
 expect(p.getSnapshot().replay.ruleState.automaticReminders!.filter(r=>r.characterId==='washerwoman')).toEqual([]);
 }finally{app.dispose();}
});
