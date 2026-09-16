import {expect,it,vi} from 'vitest';
import {CustomGrimoireApplicationController} from '../src/custom/grimoire/applicationController';
import {realWasmCore} from './custom/realCustomWasmHarness';
import {preparedRole,setupCases,resume} from './custom/issue220T10TestSupport';

// Independent persistence guard: a failure to display the first owner's reveal must
// not prevent these save/Undo assertions from running. Visible owner continuity is
// separately required by issue220T10SetupContract, not by raw scheduler position.
for(const c of setupCases)it(`T10-6 ${c.role}: a duplicate owner's preparation survives autosave/JSON and remains one Undo unit`,async()=>{
 const {app}=await preparedRole(c,'duplicate');
 const saved=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());
 let imported:Awaited<ReturnType<typeof resume>>|undefined;
 try{
  const p=app.play!,before=structuredClone(p.getSnapshot().file.game.events);
  p.beginSelection();for(const id of c.targets)p.togglePlayer(id);await p.acceptSelection();
  p.updateInput({characterIds:[c.shown]});await p.prepareCurrent();
  expect(p.getSnapshot().error).toBeUndefined();
  expect(p.getSnapshot().file.game.events).toHaveLength(before.length+1);
  await vi.waitFor(()=>expect(p.getSnapshot().saveStatus).toBe('saved'));
  const file=structuredClone(p.getSnapshot().file);
  await saved.restore(file.game.script.definition.id);
  expect(saved.play!.getSnapshot().file.game.events).toEqual(file.game.events);
  expect(saved.play!.getSnapshot().public).toBe(false);
  imported=await resume(JSON.parse(JSON.stringify(file)));
  expect(imported.play!.getSnapshot().file.game.events).toEqual(file.game.events);
  expect(imported.play!.getSnapshot().replay.ruleState.preparations).toEqual(p.getSnapshot().replay.ruleState.preparations);
  expect(imported.play!.getSnapshot().public).toBe(false);
  await imported.play!.undo();
  expect(imported.play!.getSnapshot().file.game.events).toEqual(before);
  expect(imported.play!.getSnapshot().public).toBe(false);
  await vi.waitFor(()=>expect(imported!.play!.getSnapshot().saveStatus).toBe('saved'));
  await saved.restore(file.game.script.definition.id);
  expect(saved.play!.getSnapshot().file.game.events).toEqual(before);
 }finally{app.dispose();saved.dispose();imported?.dispose();}
});
