import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {parseGameFileJson,exportGameFileJson} from '../../src/custom/storage/gameFile';
import {CustomCanonicalSession} from '../../src/custom/session';
import {FirstNightController} from '../../src/custom/grimoire/firstNightController';
import {eventPresentation} from '../../src/custom/grimoire/eventPresentation';
import {IndexedDbCustomWebSessionStorageDriver} from '../../src/custom/storage/sessionStorage';
import type {GrimoireSetupDraft,GrimoirePresentationState} from '../../src/custom/grimoire/setupController';
import {realWasmCore,replayOrThrow} from './realCustomWasmHarness';

// Real reported game, with participant names and free-form summaries anonymized.
const original=parseGameFileJson(readFileSync('../fixtures/acceptance/vortox-pit-hag/reported-game.json','utf8'));
function prefix(count:number){const f=structuredClone(original);f.game.events=f.game.events.slice(0,count);return f;}
async function controller(file=original){
 const storage=new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft,GrimoirePresentationState>(file.game.script.definition.id,new IDBFactory());
 const session=await CustomCanonicalSession.fromFile(file,{storage,core:realWasmCore(),setupDraft:{playerCount:13,selectedIds:[],players:[]},presentation:{activeTab:'play'} as GrimoirePresentationState});
 if(!session.ok)throw Error(session.error.code);
 return new FirstNightController(session.value,realWasmCore());
}

it('ends Snake Charmer poison and identifies the first incompatible historical event',async()=>{
 for(let count=1;count<=28;count++)await replayOrThrow(prefix(count));
 const changed=await replayOrThrow(prefix(25));
 expect(changed.players.find(p=>p.id==='player-1')).toMatchObject({actualCharacter:'vortox',alignment:'good',alive:true});
 expect((changed.ruleState.activeImpairments??[]).some(e=>e.playerId==='player-1' && e.sourceCharacterId==='snakeCharmer')).toBe(false);
 expect((changed.ruleState.automaticReminders??[]).some(e=>e.playerId==='player-1' && e.characterId==='snakeCharmer' && e.tokenId==='poisoned')).toBe(false);
 const result=await realWasmCore().replay(prefix(29));
 expect(result).toMatchObject({ok:false,error:{code:'INVALID_DELIVERED_INFORMATION'}});
 expect(original.game.events).toHaveLength(92);
 const saved=structuredClone(original);
 const storage=new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft,GrimoirePresentationState>(original.game.script.definition.id,new IDBFactory());
 const session=await CustomCanonicalSession.fromFile(original,{storage,core:realWasmCore(),setupDraft:{playerCount:13,selectedIds:[],players:[]},presentation:{activeTab:'play'} as GrimoirePresentationState});
 expect(session.ok).toBe(false);
 expect(original).toEqual(saved);
});

it.each([27])('kills the healthy Vortox by arbitrary death at saved boundary %i, with restore and Undo',async(count)=>{
 const c=await controller(prefix(count));
 try{
  c.finishHandoff();expect(c.step?.actionRef?.actionId).toBe('resolveNightDeaths');
  c.beginSelection();expect(c.canSelectPlayer('player-1')).toBe(true);c.togglePlayer('player-1');expect(c.selectionReady).toBe(true);
  await c.acceptSelection();expect(c.getSnapshot().error).toBeUndefined();
  expect(c.getSnapshot().handoff?.result).toMatchObject({kind:'nightDeathsResolved',playerIds:['player-1']});
  expect(c.getSnapshot().replay.players.find(p=>p.id==='player-1')?.alive).toBe(false);
  const restored=await controller(parseGameFileJson(exportGameFileJson(c.getSnapshot().file)));
  try{
   expect(restored.getSnapshot().replay.players.find(p=>p.id==='player-1')?.alive).toBe(false);
   expect(restored.getSnapshot().handoff?.result).toMatchObject({kind:'nightDeathsResolved',playerIds:['player-1']});
   await restored.undo();await vi.waitFor(()=>expect(restored.getSnapshot().saveStatus).toBe('saved'));
   expect(restored.getSnapshot().replay.players.find(p=>p.id==='player-1')?.alive).toBe(true);
  }finally{restored.dispose();}
 }finally{c.dispose();}
});

it('forces false Town Crier information after continuing from the last compatible boundary',async()=>{
 const file=prefix(28);
 const state=await replayOrThrow(file);
 const dream=await realWasmCore().propose(file,{type:'confirmStep',payload:{stepId:state.currentStep!.id,input:{playerIds:['player-2']},deliveredResult:{kind:'characterPair',characterIds:['mathematician','cerenovus']}}});
 if(!dream.ok)throw Error(dream.error.code);
 file.game.events.push(dream.value.event);
 const c=await controller(file);
 try{
  expect(c.step?.actionRef).toMatchObject({characterId:'townCrier',actionId:'learnMinionNominated'});
  await c.prepareCurrent();expect(c.getSnapshot().error).toBeUndefined();
  expect(c.getSnapshot().activeReveal?.payload).toMatchObject({kind:'booleanInformation',characterId:'townCrier',value:true});
 }finally{c.dispose();}
});

it('preserves the failed Pit-Hag result in the historical event log',async()=>{
 const file=prefix(40),event=file.game.events.at(-1)!;
 expect(eventPresentation(file,event)).toContain('변경 없음');
 expect(eventPresentation(file,file.game.events[24])).not.toContain('변경 없음');
 // Presentation can inspect the original record independently of replay validity.
 expect(event.type).toBe('customActionConfirmed');
 if(event.type==='customActionConfirmed')expect(event.payload.result).toMatchObject({kind:'pitHagChange',changed:false,characterId:'cerenovus'});
});
