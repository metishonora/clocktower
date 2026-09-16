import {expect,it,vi} from 'vitest';
import {CustomGrimoireApplicationController} from '../src/custom/grimoire/applicationController';
import {IndexedDbCustomWebSessionStorageDriver} from '../src/custom/storage/sessionStorage';
import {realWasmCore} from './custom/realCustomWasmHarness';
import {actionCases,actionFixture} from './custom/issue220T13Support';
import {preparedRole,setupCases} from './custom/issue220T10TestSupport';
for(const c of setupCases)it(`T13 P2 ${c.role}: failed preparation autosave pauses the same execution before disclosure`,async()=>{
 const {app}=await preparedRole(c);const p=app.play!;
 try{
  const original=IndexedDbCustomWebSessionStorageDriver.prototype.writeOwnedSession;
  const write=vi.spyOn(IndexedDbCustomWebSessionStorageDriver.prototype,'writeOwnedSession').mockRejectedValue(Error('quota'));
  const before=p.getSnapshot().file.game.events.length;
  p.beginSelection();c.targets.forEach(id=>p.togglePlayer(id));await p.acceptSelection();p.updateInput({characterIds:[c.shown]});await p.prepareCurrent();
  await vi.waitFor(()=>expect(p.getSnapshot().saveStatus).toBe('failed'));
  expect.soft(p.getSnapshot().public).toBe(false);expect.soft(p.getSnapshot().proposal).toBeUndefined();
  expect(p.getSnapshot().file.game.events).toHaveLength(before+1);
  write.mockImplementation(original);p.retrySave();await vi.waitFor(()=>expect(p.getSnapshot().saveStatus).toBe('saved'));
  expect(p.getSnapshot().file.game.events).toHaveLength(before+1);
  expect(p.step?.actionRef?.actionId).toBe(c.action);
 }finally{app.dispose();}
});
it('T13 P2: a failed dependent twin proposal retains the assigned prefix and retries without repeating assignment',async()=>{
 const f=await actionFixture(actionCases.find(c=>c[0]==='R14')!);const core=realWasmCore();let fail=true;
 const app=new CustomGrimoireApplicationController({...core,propose:async(file,command)=>{
  if(fail&&command.type==='confirmStep'&&command.payload.stepId.includes('learnTwin'))throw Error('continuation unavailable');
  return core.propose(file,command);
 }},vi.fn());
 await app.resumeImported({file:f.session.snapshot.canonical});const p=app.play!;
 try{
  const before=p.getSnapshot().file.game.events.length;
  p.beginSelection();p.togglePlayer('p2');await p.acceptSelection();
  expect.soft(p.getSnapshot().error).toContain('continuation unavailable');expect(p.getSnapshot().file.game.events).toHaveLength(before+1);
  expect(p.getSnapshot().public).toBe(false);fail=false;await p.prepareCurrent();
  expect(p.getSnapshot().error).toBeUndefined();expect(p.getSnapshot().file.game.events).toHaveLength(before+2);
  expect(p.getSnapshot().handoff?.notifications[0]).toMatchObject({kind:'evilTwinPair'});
  await p.undo();expect(p.getSnapshot().file.game.events).toHaveLength(before);
 }finally{app.dispose();}
});

it('T13 P2: failed twin notification save preserves a private prompt for retry without another event',async()=>{
 const f=await actionFixture(actionCases.find(c=>c[0]==='R14')!),app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());
 await app.resumeImported({file:f.session.snapshot.canonical});const p=app.play!;
 const original=IndexedDbCustomWebSessionStorageDriver.prototype.writeOwnedSession;
 const write=vi.spyOn(IndexedDbCustomWebSessionStorageDriver.prototype,'writeOwnedSession').mockImplementation(function(this: IndexedDbCustomWebSessionStorageDriver,snapshot,expected){
  const event=snapshot.canonical.game.events.at(-1);
  if(event?.type==='customActionConfirmed'&&event.payload.actionRef.actionId==='learnTwin')return Promise.reject(Error('quota'));
  return original.call(this,snapshot,expected);
 });
 try{
  p.beginSelection();p.togglePlayer('p2');await p.acceptSelection();expect(p.getSnapshot().saveStatus).toBe('failed');
  expect(p.getSnapshot().public).toBe(false);expect(p.getSnapshot().handoff).toBeUndefined();
  const events=structuredClone(p.getSnapshot().file.game.events);write.mockImplementation(original);p.retrySave();
  await vi.waitFor(()=>expect(p.getSnapshot().handoff?.stage).toBe('notification'));
  expect(p.getSnapshot().file.game.events).toEqual(events);expect(p.getSnapshot().public).toBe(false);
  p.showNotification();expect(p.getSnapshot().public).toBe(true);
 }finally{write.mockRestore();app.dispose();}
});
