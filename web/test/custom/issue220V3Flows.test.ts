import {expect,it,vi} from 'vitest';
import {CustomGrimoireApplicationController} from '../../src/custom/grimoire/applicationController';
import {realWasmCore} from './realCustomWasmHarness';
import {beforeWasherwoman} from './issue220ScenarioOrderSupport';
import {start} from './issue209Support';

it.each([false,true])('V01: one public operation joins prepared Washerwoman to disclosure, including impairment=%s',async(impaired)=>{
 const {session}=await beforeWasherwoman(impaired?'p1':'p9');
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file:session.snapshot.canonical});const p=app.play!;
 const flow=p.step!.informationFlow!.id;const before=p.getSnapshot().file.game.events.length;
 p.beginSelection();p.togglePlayer('p6');p.togglePlayer('p8');await p.acceptSelection();
 expect(p.getSnapshot().handoff).toBeUndefined();expect(p.getSnapshot().file.game.events).toHaveLength(before);
 p.updateInput({characterIds:['monk'],correct:'p6'});await p.prepareCurrent();
 expect(p.getSnapshot().error).toBeUndefined();expect(p.getSnapshot().public).toBe(true);
 expect(p.getSnapshot().reveal).toMatchObject({kind:'setupInformation',revealedCharacterId:'monk'});
 expect(p.step!.informationFlow).toMatchObject({id:flow,preparationEventId:p.getSnapshot().file.game.events.at(-1)!.id});
 p.conceal();await p.confirm();expect(p.getSnapshot().file.game.events).toHaveLength(before+2);
 await p.undo();expect(p.step?.actionRef?.actionId).toBe('prepareInformation');expect(p.getSnapshot().public).toBe(false);app.dispose();
});

it.each(['clear','violation'] as const)('V05: Mutant %s check persists through autosave/JSON/reload and Undo',async(check)=>{
 const {session}=await start(11);const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file:session.snapshot.canonical});const p=app.play!;
 const optional=p.steps.find(s=>s.actionRef?.actionId==='resolveMadnessExecution')!;expect(optional).toBeDefined();
 const id=JSON.stringify(optional.abilityUse),current=p.step!.id,before=p.getSnapshot().file;
 await p.freeAction(id,{madnessCheck:check});expect(p.getSnapshot().error).toBeUndefined();
 expect(p.step!.id).toBe(current);expect(p.getSnapshot().file.game.events).toHaveLength(before.game.events.length+1);
 expect(p.steps.find(s=>s.playerId===optional.playerId&&s.madness)?.madness?.check).toBe(check);
 await vi.waitFor(()=>expect(p.getSnapshot().saveStatus).toBe('saved'));
 const script=p.getSnapshot().file.game.script;if(script.type!=='custom')throw Error('custom script expected');
 const reload=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await reload.restore(script.definition.id);
 expect(reload.play!.steps.find(s=>s.playerId===optional.playerId&&s.madness)?.madness?.check).toBe(check);reload.dispose();
 const restored=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await restored.resumeImported({file:JSON.parse(JSON.stringify(p.getSnapshot().file))});
 expect(restored.play!.steps.find(s=>s.playerId===optional.playerId&&s.madness)?.madness?.check).toBe(check);expect(restored.play!.getSnapshot().public).toBe(false);
 await restored.play!.undo();expect(restored.play!.getSnapshot().file.game.events).toEqual(before.game.events);app.dispose();restored.dispose();
});

it('V02/V03: direct selection completes without a result pause; Cerenovus retains its recipient notification',async()=>{
 const {newScenario,confirmAction}=await import('./issue220ScenarioOrderSupport');const {session}=await newScenario();
 await confirmAction(session,'minionInfo',null);await confirmAction(session,'demonInfo',{characterIds:['ravenkeeper','undertaker','juggler']});
 const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());await app.resumeImported({file:session.snapshot.canonical});const p=app.play!;
 const before=p.getSnapshot().file.game.events.length;
 p.beginSelection();p.togglePlayer('p9');await p.acceptSelection();
 expect(p.getSnapshot().handoff).toBeUndefined();expect(p.getSnapshot().selecting).toBe(false);expect(p.step?.character).toBe('cerenovus');expect(p.getSnapshot().file.game.events).toHaveLength(before+1);
 expect(p.getSnapshot().public).toBe(false);
 p.beginSelection();p.togglePlayer('p6');p.updateInput({characterIds:['chef']});await p.acceptSelection();
 expect(p.getSnapshot().error).toBeUndefined();expect(p.getSnapshot().handoff?.stage).toBe('notification');expect(p.getSnapshot().public).toBe(false);
 p.showNotification();expect(p.getSnapshot().public).toBe(true);expect(p.getSnapshot().activeReveal?.origin).toBe('notification');expect(p.getSnapshot().reveal).toMatchObject({kind:'madnessAssignment',characterId:'chef'});
 p.conceal();expect(p.getSnapshot().handoff).toBeUndefined();expect(p.getSnapshot().file.game.events).toHaveLength(before+2);expect(p.step?.character).toBe('washerwoman');app.dispose();
});

it('V05: madness judgment cannot be smuggled into an unrelated role confirmation',async()=>{
 const {newScenario,confirmAction}=await import('./issue220ScenarioOrderSupport');const {session}=await newScenario();
 await confirmAction(session,'minionInfo',null);await confirmAction(session,'demonInfo',{characterIds:['ravenkeeper','undertaker','juggler']});
 const before=session.snapshot.canonical;
 const result=await session.propose({type:'confirmStep',payload:{stepId:session.replay!.currentStep!.id,input:{playerIds:['p9'],madnessCheck:'violation'} as never}});
 expect(result.ok).toBe(false);expect(session.snapshot.canonical).toEqual(before);
});
