import { expect,it,vi } from 'vitest';
import { IndexedDbCustomWebSessionStorageDriver } from '../../src/custom/storage/sessionStorage.js';
import { started,stored } from './issue220Support.js';
import type { PhaseStepConfirmation } from '../../src/custom/core/types.js';
import type { FirstNightController } from '../../src/custom/grimoire/firstNightController.js';
import { realWasmCore } from './realCustomWasmHarness.js';
async function take(play:FirstNightController,id:string,confirmation:PhaseStepConfirmation) {
  expect(play.step?.actionRef?.actionId).toBe(id);const before=play.getSnapshot().file.game.events.length;
  await play.prepare(confirmation);expect(play.getSnapshot().error).toBeUndefined();
  if(play.getSnapshot().public){expect(play.getSnapshot().file.game.events).toHaveLength(before);await play.confirm();expect(play.getSnapshot().file.game.events).toHaveLength(before);play.conceal();await play.confirm();}
  expect(play.getSnapshot().file.game.events).toHaveLength(before+1);await vi.waitFor(()=>expect(play.getSnapshot().saveStatus).toBe('saved'));
}
it('C15/C16/C27/C28/C38: real first night, immutable public reveal, historic payload, Undo and Day stop',async()=>{
  const {app}=await started();const play=app.play!;
  await take(play,'minionInfo',{input:null});
  const before=play.getSnapshot().file;await play.prepare({input:{characterIds:['soldier','mayor']}});expect(play.getSnapshot().error).toBeTruthy();expect(play.getSnapshot().file).toEqual(before);
  await take(play,'demonInfo',{input:{characterIds:['soldier','mayor','virgin']}});
  await take(play,'choosePoisonTarget',{input:{playerIds:['player-4']}});
  await play.prepare({input:null,deliveredResult:{kind:'number',value:1}});expect(play.getSnapshot().error).toBeUndefined();expect(play.getSnapshot().reveal).toMatchObject({kind:'numericInformation',value:1});
  const revealed=play.getSnapshot().reveal;play.conceal();play.show();expect(play.getSnapshot().reveal).toEqual(revealed);play.conceal();await play.confirm();
  await vi.waitFor(()=>expect(play.getSnapshot().saveStatus).toBe('saved'));const chefId=play.getSnapshot().file.game.events.at(-1)!.id;
  await take(play,'learnEvilNeighbors',{input:null,deliveredResult:{kind:'number',value:0}});await take(play,'learnSteps',{input:null,deliveredResult:{kind:'number',value:1}});
  await take(play,'dawn',{input:null});expect(play.getSnapshot().replay.phase).toBe('day');expect(play.step).toBeUndefined();
  const day=play.getSnapshot().file;await play.prepare({input:null});expect(play.getSnapshot().file).toEqual(day);
  await play.history(chefId);expect(play.getSnapshot().reveal).toMatchObject({kind:'numericInformation',value:1});expect(play.getSnapshot().public).toBe(true);play.conceal();await play.undo();expect(play.step?.actionRef?.actionId).toBe('dawn');expect(play.getSnapshot().replay.phase).toBe('firstNight');app.dispose();
});
it('C26: failed autosave keeps accepted progress and retry does not re-execute the action',async()=>{
  const {app}=await started();const play=app.play!;const before=await stored();
  const original=IndexedDbCustomWebSessionStorageDriver.prototype.writeOwnedSession;const write=vi.spyOn(IndexedDbCustomWebSessionStorageDriver.prototype,'writeOwnedSession').mockRejectedValueOnce(Error('quota'));
  await play.prepare({input:null});play.conceal();await play.confirm();await vi.waitFor(()=>expect(play.getSnapshot().saveStatus).toBe('failed'));
  expect(play.getSnapshot().file.game.events).toHaveLength(2);expect(play.getSnapshot().lastSavedEventCount).toBe(1);expect(await stored()).toEqual(before);
  write.mockImplementation(original);play.retrySave();await vi.waitFor(()=>expect(play.getSnapshot().saveStatus).toBe('saved'));expect((await stored()).canonical.game.events).toHaveLength(2);app.dispose();
});
it('C32/C33: stale prepared event cannot be applied after another command, and history lookup rejects invalid suffix',async()=>{
  const {app}=await started();const session=app.play!.session;const file=session.snapshot.canonical;
  const proposal=await session.propose({type:'confirmStep',payload:{stepId:session.replay!.currentStep!.id,input:null,expectedEventCount:1}});if(!proposal.ok)throw Error(proposal.error.code);
  const advanced=await session.execute({type:'confirmStep',payload:{stepId:session.replay!.currentStep!.id,input:null}});expect(advanced.ok).toBe(true);const current=session.snapshot;
  expect((await session.applyProposal(proposal.value,file)).ok).toBe(false);expect(session.snapshot).toEqual(current);
  const corrupted=structuredClone(current.canonical);corrupted.game.events.push({...corrupted.game.events[0],id:'invalid-second-setup'});
  const history=await realWasmCore().confirmedEventReveal!(corrupted,proposal.value.event.id);expect(history.ok).toBe(false);app.dispose();
});
