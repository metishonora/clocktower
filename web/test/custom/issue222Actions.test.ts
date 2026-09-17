import {expect,it,vi} from 'vitest';
import {nightFixture} from './issue222Support';
import type {FirstNightController} from '../../src/custom/grimoire/firstNightController';
import {informationChoices} from '../../src/custom/grimoire/stepInputModel';
import {actionAdapter} from '../../src/custom/grimoire/actions/registry';
async function choose(c:FirstNightController,ids:string[],extra:Parameters<FirstNightController['updateInput']>[0]={}) {
 await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));if(c.getSnapshot().handoff?.stage==='result')c.finishHandoff();c.beginSelection();for(const id of ids)c.togglePlayer(id);c.updateInput(extra);expect(c.selectionReady).toBe(true);await c.acceptSelection();expect(c.getSnapshot().error).toBeUndefined();
}
it('Mayor decision and Imp succession inputs are consumed through the controller',async()=>{
 const {controller:c}=await nightFixture(['mayor','monk','ravenkeeper','virgin','slayer','spy','imp']);
 await choose(c,['p4']);c.beginSelection();c.togglePlayer('p1');expect(c.selectionReady).toBe(false);
 c.updateInput({mayorDecision:{kind:'bounce',targetPlayerId:'p4'}});expect(c.selectionReady).toBe(true);await c.acceptSelection();
 expect(c.getSnapshot().error).toBeUndefined();expect(c.getSnapshot().replay.players.every(p=>p.alive)).toBe(true);
 await c.undo();await choose(c,['p7'],{successorPlayerId:'p6'});
 expect(c.getSnapshot().replay.players.find(p=>p.id==='p6')?.actualCharacter).toBe('imp');
 expect(c.getSnapshot().handoff?.stage).toBe('result');c.finishHandoff();expect(c.getSnapshot().handoff?.stage).toBe('notification');c.dispose();
});
it('Pit Hag demon creation requires the Core-projected arbitrary death selection',async()=>{
 const {controller:c}=await nightFixture(['soldier','monk','ravenkeeper','virgin','slayer','pitHag','imp'],{},['fangGu']);
 await choose(c,['p1']);expect(c.step?.actionRef?.actionId).toBe('changeCharacter');
 await choose(c,['p4'],{characterIds:['fangGu']});expect(c.getSnapshot().handoff?.stage).toBe('result');c.finishHandoff();expect(c.getSnapshot().handoff?.stage).toBe('notification');
 c.showNotification();c.conceal();expect(c.step?.actionRef?.actionId).toBe('chooseDeaths');
 expect(actionAdapter(c.step!)?.selectionContract).toBe('direct');
 await choose(c,[]);expect(c.step?.actionRef?.actionId).toBe('attackPlayer');c.dispose();
});
it('a late Barber offers only legal counts, a Core-projected chooser and sequential identity notifications',async()=>{
 const {controller:c}=await nightFixture(['soldier','monk','virgin','slayer','ravenkeeper','barber','scarletWoman','imp'],{},[],d=>{
  const i=d.otherNightOrder.findIndex(a=>a.kind==='character'&&a.characterId==='barber');const [barber]=d.otherNightOrder.splice(i,1);d.otherNightOrder.splice(1,0,barber);
 });
 await choose(c,['p1']);await choose(c,['p6']);expect(c.step?.actionRef?.actionId).toBe('swapCharacters');
 c.finishHandoff();c.beginSelection();c.togglePlayer('p1');expect(c.selectionReady).toBe(false);c.togglePlayer('p3');expect(c.selectionReady).toBe(true);
 expect(c.chooserPlayerId).toBe('p8');await c.acceptSelection();expect(c.getSnapshot().error).toBeUndefined();
 expect(c.getSnapshot().replay.players[0].actualCharacter).toBe('virgin');expect(c.getSnapshot().handoff?.notifications).toHaveLength(2);
 c.finishHandoff();c.showNotification();c.conceal();expect(c.getSnapshot().handoff?.notificationIndex).toBe(1);c.showNotification();c.conceal();expect(c.getSnapshot().handoff).toBeUndefined();c.dispose();
});
it('Sage exposes valid information choices and its frozen player reveal',async()=>{
 const {controller:c}=await nightFixture(['soldier','monk','sage','virgin','slayer','scarletWoman','imp']);
 await choose(c,['p1']);await choose(c,['p3']);expect(c.step?.actionRef?.actionId).toBe('learnDemon');
 c.finishHandoff();expect(informationChoices(c.step!,[]).length).toBeGreaterThan(0);c.beginSelection();c.togglePlayer('p1');c.togglePlayer('p7');await c.acceptSelection();await c.prepareCurrent();
 expect(c.getSnapshot().error).toBeUndefined();expect(c.getSnapshot().activeReveal?.payload).toMatchObject({kind:'sageInformation'});c.conceal();await c.confirm();expect(c.getSnapshot().error).toBeUndefined();c.dispose();
});
it('Vigormortis death consequence uses poison candidates from the Core',async()=>{
 const {controller:c}=await nightFixture(['soldier','monk','ravenkeeper','virgin','slayer','witch','vigormortis'],{chooseCursedPlayer:{playerIds:['p1']}});
 await choose(c,['p1']);await choose(c,['p1']);await choose(c,['p6']);expect(c.step?.actionRef?.actionId).toBe('choosePoison');
 const allowed=c.step!.requiredInput.allowedPlayerIds!;expect(allowed.length).toBeGreaterThan(0);
 c.finishHandoff();expect(c.getSnapshot().selecting).toBe(true);expect(c.getSnapshot().handoff?.step.actionRef?.actionId).toBe('choosePoison');
 c.togglePlayer(allowed[0]);await c.acceptSelection();expect(c.getSnapshot().error).toBeUndefined();c.dispose();
});
