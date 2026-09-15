import {expect,it,vi} from 'vitest';
import {nightFixture} from './issue222Support';
import {FirstNightController} from '../../src/custom/grimoire/firstNightController';
import {realWasmCore} from './realCustomWasmHarness';
import {actionResultRows} from '../../src/custom/grimoire/actionResult';
async function choose(c:FirstNightController,ids:string[],extra:Parameters<FirstNightController['updateInput']>[0]={}){
 c.beginSelection();for(const id of ids)c.togglePlayer(id);c.updateInput(extra);expect(c.selectionReady).toBe(true);await c.acceptSelection();expect(c.getSnapshot().error).toBeUndefined();
}
it.each(['imp','fangGu','noDashii','vortox','vigormortis'])('%s preserves a saved attack result before the next action',async(demon)=>{
 const {controller:c}=await nightFixture(['soldier','monk','virgin',demon==='fangGu'?'saint':'slayer','ravenkeeper','scarletWoman',demon],{},[],undefined,{},demon==='vortox'?'p4':undefined);
 try{await choose(c,['p1']);await choose(c,['p3']);const state=c.getSnapshot(),count=state.file.game.events.length;
 expect(state.handoff).toMatchObject({stage:'result',result:{kind:'nightAttack',targetPlayerId:'p3',killedPlayerId:'p3',died:true}});expect(state.public).toBe(false);
 c.beginSelection();await c.prepareCurrent();expect(c.getSnapshot().selecting).toBe(false);expect(c.getSnapshot().file.game.events).toHaveLength(count);
 c.finishHandoff();expect(c.getSnapshot().handoff).toBeUndefined();expect(c.getSnapshot().file.game.events).toHaveLength(count);
 }finally{c.dispose();}
});
it('attack result survives save failure, retry, restoration and Undo; Ravenkeeper enters progress',async()=>{
 const {controller:c,storage,session}=await nightFixture(['soldier','monk','ravenkeeper','virgin','slayer','scarletWoman','imp']);
 try{await choose(c,['p1']);vi.spyOn(storage,'saveSession').mockRejectedValueOnce(Error('disk'));await choose(c,['p3']);
 expect(c.getSnapshot().saveStatus).toBe('failed');expect(c.getSnapshot().handoff).toBeUndefined();c.retrySave();await vi.waitFor(()=>expect(c.getSnapshot().handoff?.stage).toBe('result'));
 const restored=new FirstNightController(session,realWasmCore());expect(restored.getSnapshot().handoff?.result).toMatchObject({kind:'nightAttack',killedPlayerId:'p3'});restored.dispose();
 c.finishHandoff();expect(c.step?.actionRef?.actionId).toBe('learnCharacter');expect(c.getSnapshot().selecting).toBe(false);expect(c.getSnapshot().handoff).toBeUndefined();
 await choose(c,['p1']);await c.prepareCurrent();expect(c.getSnapshot().public).toBe(true);c.conceal();await c.confirm();
 await c.undo();await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));expect(c.step?.actionRef?.actionId).toBe('attackPlayer');expect(c.getSnapshot().replay.players[2].alive).toBe(true);
 }finally{c.dispose();}
});
it('blocked and Mayor-bounced attacks display the confirmed victim, then succession reveals follow the result',async()=>{
 const {controller:c}=await nightFixture(['mayor','monk','ravenkeeper','virgin','slayer','scarletWoman','imp']);
 try{await choose(c,['p4']);await choose(c,['p4']);expect(c.getSnapshot().handoff?.result).toMatchObject({kind:'nightAttack',died:false});
 expect(actionResultRows(c.getSnapshot().handoff!.result!,id=>id,id=>id)).toContainEqual({label:'결과',value:'사망 없음'});
 await c.undo();await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));await choose(c,['p1'],{mayorDecision:{kind:'bounce',targetPlayerId:'p5'}});expect(c.getSnapshot().handoff?.result).toMatchObject({targetPlayerId:'p1',killedPlayerId:'p5'});
 await c.undo();await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));await choose(c,['p7']);expect(c.getSnapshot().handoff?.stage).toBe('result');c.finishHandoff();expect(c.getSnapshot().handoff?.stage).toBe('notification');c.showNotification();expect(c.getSnapshot().public).toBe(true);c.conceal();expect(c.getSnapshot().handoff).toBeUndefined();
 }finally{c.dispose();}
});
it('Witch and unchanged Snake Charmer retain results while direct Monk protection does not',async()=>{
 const {controller:c}=await nightFixture(['soldier','monk','snakeCharmer','virgin','slayer','witch','imp'],{chooseCursedPlayer:{playerIds:['p1']},choosePlayer:{playerIds:['p1']}});
 try{for(let i=0;i<3;i++){const action=c.step!.actionRef!.actionId;await choose(c,['p1']);if(action==='protectPlayer')expect(c.getSnapshot().handoff).toBeUndefined();else {expect(c.getSnapshot().handoff?.stage).toBe('result');c.finishHandoff();}}}finally{c.dispose();}
});
it('the final Demon death keeps the attack result before night ends, including restoration',async()=>{
 const {controller:c,session}=await nightFixture(['soldier','monk','virgin','slayer','ravenkeeper','scarletWoman','imp'],{},[],undefined,{},'p6');
 try{await choose(c,['p1']);await choose(c,['p7']);expect(c.getSnapshot().replay.players.filter(p=>p.actualCharacter==='imp').every(p=>!p.alive)).toBe(true);expect(c.getSnapshot().handoff?.stage).toBe('result');
 const restored=new FirstNightController(session,realWasmCore());expect(restored.getSnapshot().handoff?.stage).toBe('result');restored.finishHandoff();expect(restored.getSnapshot().handoff).toBeUndefined();expect(restored.step?.actionRef?.actionId).toBe('dawn');restored.dispose();
 }finally{c.dispose();}
});
it('Mayor board selection keeps the original attack and supports reset, cancel and Mayor death',async()=>{
 const {controller:c}=await nightFixture(['mayor','monk','ravenkeeper','virgin','slayer','scarletWoman','imp']);
 try{await choose(c,['p4']);c.beginSelection();c.togglePlayer('p1');c.chooseMayorOutcome('bounce');
 expect(c.selectionReady).toBe(false);expect(c.canSelectPlayer('p1')).toBe(false);c.togglePlayer('p3');expect(c.boardSelectedPlayerIds).toEqual(['p3']);expect(c.selectedPlayerIds).toEqual(['p1']);
 c.resetSelection();expect(c.selectingMayorBounce).toBe(true);expect(c.selectionReady).toBe(false);expect(c.selectedPlayerIds).toEqual(['p1']);
 c.togglePlayer('p5');c.cancelSelection();expect(c.getSnapshot().selecting).toBe(true);expect(c.selectingMayorBounce).toBe(false);expect(c.getSnapshot().inputDraft.mayorDecision).toBeUndefined();
 c.chooseMayorOutcome('mayorDies');expect(c.selectionReady).toBe(true);await c.acceptSelection();expect(c.getSnapshot().handoff?.result).toMatchObject({kind:'nightAttack',targetPlayerId:'p1',killedPlayerId:'p1'});
 await c.undo();await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));c.beginSelection();c.togglePlayer('p1');expect(c.getSnapshot().inputDraft.mayorDecision).toBeUndefined();
 c.chooseMayorOutcome('bounce');c.togglePlayer('p3');c.cancelSelection();c.togglePlayer('p1');c.togglePlayer('p5');expect(c.mayorPrompt).toBeUndefined();expect(c.selectingMayorBounce).toBe(false);
 }finally{c.dispose();}
});
