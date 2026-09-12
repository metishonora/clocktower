import { expect,it,vi } from 'vitest';
import { CustomGrimoireApplicationController } from '../../src/custom/grimoire/applicationController.js';
import type { FirstNightController } from '../../src/custom/grimoire/firstNightController.js';
import type { PhaseStepInput,InformationResult } from '../../src/custom/core/types.js';
import { start,startLegacyWasherwoman,moveBefore,realWasmCore } from './issue209Support.js';
async function open(roster:number,change?:Parameters<typeof start>[1]){const {session}=roster===4?await startLegacyWasherwoman():await start(roster,change);const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file:session.snapshot.canonical});expect(app.getSnapshot().screen).toBe('play');return {app,play:app.play!};}
async function take(play:FirstNightController,action:string,input:PhaseStepInput,deliveredResult?:InformationResult,owner?:string,optional=false){
  if(optional){const step=play.steps.find(s=>s.actionRef?.actionId===action && (!owner || s.playerId===owner));expect(step).toBeDefined();play.selectStep(step!.id);}
  expect(play.step?.actionRef?.actionId).toBe(action);if(owner)expect(play.step?.playerId).toBe(owner);
  const before=play.getSnapshot().file.game.events.length;await play.prepare({input,deliveredResult});expect(play.getSnapshot().error).toBeUndefined();const reveal=play.getSnapshot().reveal;
  if(play.getSnapshot().public){play.conceal();await play.confirm();}expect(play.getSnapshot().error).toBeUndefined();expect(play.getSnapshot().file.game.events).toHaveLength(before+1);await vi.waitFor(()=>expect(play.getSnapshot().saveStatus).toBe('saved'));return {reveal,event:play.getSnapshot().file.game.events.at(-1)!};
}
async function system(play:FirstNightController){await take(play,'minionInfo',null);await take(play,'demonInfo',{characterIds:play.getSnapshot().replay.players.some(p=>['artist','savant','juggler'].includes(p.actualCharacter)) ? ['soldier','mayor','virgin'] : ['artist','savant','juggler']});}
it('C29/R1: original and acquired Fortune Teller remain separate through the application controller',async()=>{
  const {app,play}=await open(1);await system(play);await take(play,'chooseAbility',{characterIds:['fortuneTeller']});await take(play,'assignRedHerring',{playerIds:['p4']},undefined,'p1');await take(play,'assignRedHerring',{playerIds:['p4']},undefined,'p2');
  expect(play.getSnapshot().replay.ruleState.preparations?.filter(p=>p.actionRef.actionId==='assignRedHerring').map(p=>p.abilityUse?.ownerPlayerId).sort()).toEqual(['p1','p2']);
  expect((await take(play,'checkDemon',{playerIds:['p2','p4']},{kind:'boolean',value:true},'p2')).reveal).toMatchObject({hasDemon:true});expect((await take(play,'checkDemon',{playerIds:['p1','p4']},{kind:'boolean',value:true},'p1')).reveal).toMatchObject({hasDemon:true});app.dispose();
});
it.each([false,true])('C29/R2: acquired start information requires preparation, including passed order %s',async(past)=>{
  const {app,play}=await open(2,d=>{if(past)moveBefore(d,'learnTownsfolk','chooseAbility');});await system(play);await take(play,'chooseAbility',{characterIds:['washerwoman']});expect(play.step?.actionRef?.actionId).toBe('prepareInformation');
  await take(play,'prepareInformation',{playerIds:['p1','p3'],characterId:'monk',correctPlayerId:'p3'});const delivered=await take(play,'learnTownsfolk',null);expect(delivered.reveal).toMatchObject({kind:'setupInformation',revealedCharacterId:'monk',zeroOutsiders:false});await play.undo();expect(play.step?.actionRef?.actionId).toBe('chooseAbility');app.dispose();
});
it('C30/R4: repaired preparation does not rewrite the historic Spy reveal',async()=>{
  const {app,play}=await open(4,d=>moveBefore(d,'inspectGrimoire','chooseAbility'));await system(play);const spy=await take(play,'inspectGrimoire',null);
  expect(spy.reveal).toMatchObject({kind:'spyGrimoire',players:expect.arrayContaining([expect.objectContaining({playerId:'p7',automaticReminders:expect.arrayContaining([expect.objectContaining({tokenId:'townsfolk'})])})])});
  await take(play,'choosePoisonTarget',{playerIds:['p8']});await take(play,'choosePlayer',{playerIds:['p2']});await take(play,'prepareInformation',{playerIds:['p1','p4'],characterId:'mathematician',correctPlayerId:'p4'});await take(play,'learnTownsfolk',null);await play.history(spy.event.id);expect(play.getSnapshot().reveal).toEqual(spy.reveal);expect(JSON.stringify(play.getSnapshot().reveal)).not.toContain('sourceEventId');app.dispose();
});
it('C30/R5: twin reassignment and notification preserve the original disclosure',async()=>{
  const {app,play}=await open(5,d=>moveBefore(d,'learnTwin','choosePlayer'));await system(play);await take(play,'assignTwin',{playerIds:['p1']});const first=await take(play,'learnTwin',null);await take(play,'choosePlayer',{playerIds:['p7']});expect(play.step?.actionRef?.actionId).toBe('assignTwin');await take(play,'assignTwin',{playerIds:['p2']});await take(play,'learnTwin',null);await play.history(first.event.id);expect(play.getSnapshot().reveal).toMatchObject({kind:'evilTwinPair',players:expect.arrayContaining([expect.objectContaining({playerId:'p1'})])});expect(play.getSnapshot().reveal).not.toMatchObject({players:expect.arrayContaining([expect.objectContaining({playerId:'p2'})])});app.dispose();
});
it('C31/R11: optional execution ends the game and Undo restores pending actions',async()=>{
  const {app,play}=await open(11);await system(play);await take(play,'assignTwin',{playerIds:['p2']});const before=play.getSnapshot().replay;await take(play,'resolveMadnessExecution',{execute:true},undefined,'p2',true);expect(play.getSnapshot().replay.gameEnd).toMatchObject({winningAlignment:'evil',reason:'goodTwinExecuted'});expect(play.step).toBeUndefined();expect(play.steps).toEqual([]);await play.undo();expect(play.getSnapshot().replay).toEqual(before);app.dispose();
});
