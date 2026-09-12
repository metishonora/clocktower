import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {actionCases,actionFixture,confirmFixture,executionState,executionStep,key} from './issue220T13Support';
import {realWasmCore,replayOrThrow} from './realCustomWasmHarness';
import {parseReplayState} from '../../src/custom/core/validation';
import {exportGameFileJson,parseGameFileJson} from '../../src/custom/storage/gameFile';
import {start,system,take,moveBefore,startLegacyWasherwoman} from './issue209Support';
import {confirmAction} from './issue220ScenarioOrderSupport';
import type {GameFile} from '../../src/custom/core/types';

for(const c of actionCases)it(`T13 P1 ${c[0]} ${c[1]}.${c[2]}: actual Core supplies a traceable execution`,async()=>{
 const f=await actionFixture(c),before=f.session.replay!,file=f.session.snapshot.canonical;
 const state=executionState(before);
 if(c[2]==='dusk'){expect(state.latestUndoUnit).toBeNull();expect(before.currentStep?.actionRef?.actionId).toBe('minionInfo');return;}
 const step=executionStep(f.step);
 expect(step.id).toBeTruthy();if(c[2]!=='resolveMadnessExecution')expect(state.actionExecutions.find(e=>e.id===step.id)?.stepIds).toContain(f.step.id);
 const e=await confirmFixture(f),after=executionState(f.session.replay!);
 expect(after.latestUndoUnit).toMatchObject({id:e.id,executionId:step.id});
 expect(after.latestUndoUnit!.eventIds).toContain(e.id);
 expect(after.latestUndoUnit!.eventIds).not.toContain(file.game.events[0]!.id);
 const unit=after.actionExecutions.find(x=>x.id===step.id)!;
 expect(unit.eventIds).toEqual(after.latestUndoUnit!.eventIds);
 expect(file.game.events.some(x=>x.id===e.id)).toBe(false);
});

for(const id of ['R15','R16','R17','R22','R27'])it(`T13 P1 ${id}: dependency connects real parent event and survives all saved prefixes`,async()=>{
 const c=actionCases.find(c=>c[0]===id)!,f=await actionFixture(c),file=f.session.snapshot.canonical;
 const parent=file.game.events.at(-1)!;
 const relation=executionStep(f.step);expect(relation).toMatchObject({relation:'continuation',predecessorEventId:parent.id});
 const e=await confirmFixture(f),s=executionState(f.session.replay!);
 expect(s.latestUndoUnit!.eventIds).toEqual([parent.id,e.id]);
 for(const length of [file.game.events.length,file.game.events.length+1]){
  const saved=structuredClone(f.session.snapshot.canonical);saved.game.events=saved.game.events.slice(0,length);
  const imported=parseGameFileJson(exportGameFileJson(saved));expect(imported).toEqual(saved);
  expect(JSON.stringify(imported)).not.toMatch(/actionExecutions|latestUndoUnit|executionId/);
  const a=executionState(await replayOrThrow(saved)),b=executionState(await replayOrThrow(imported));
  expect(a.actionExecutions).toEqual(b.actionExecutions);expect(a.latestUndoUnit).toEqual(b.latestUndoUnit);
 }
});

it('T13 P1 A11: old interleaved preparations retain their original file and cannot merge across the other owner',async()=>{
 const f=JSON.parse(readFileSync('../fixtures/acceptance/custom-first-night/issue220/legacy-duplicate-preparations.json','utf8')) as GameFile;
 const before=structuredClone(f),s=executionState(await replayOrThrow(f));
 expect(f).toEqual(before);expect(s.latestUndoUnit!.eventIds).toEqual([f.game.events.at(-1)!.id]);
 const current=executionStep(s.currentStep!);expect(current.relation).toBe('reference');
});
it('T13 P1 A05/A11: old setup preparation followed by system information is a reference, not one old Undo group',async()=>{
 const {session}=await startLegacyWasherwoman();const prep=session.snapshot.canonical.game.events.at(-1)!.id;
 await system(session);await take(session,'inspectGrimoire',null);
 const state=executionState(session.replay!);expect(state.latestUndoUnit!.eventIds).not.toContain(prep);
});
for(const past of [false,true])it(`T13 P1 A10: immediate Clockmaker acquisition before/past order (${past})`,async()=>{
 const {session}=await start(2,d=>{if(past)moveBefore(d,'learnSteps','chooseAbility');});await system(session);
 const choice=await take(session,'chooseAbility',{characterIds:['clockmaker']});
 const delivery=await take(session,'learnSteps',null);
 const s=executionState(session.replay!);
 expect(s.latestUndoUnit!.eventIds).toEqual([choice.proposal.event.id,delivery.proposal.event.id]);
});
it('T13 P1 A10: acquired Drunk multi-level references do not imply immediate execution',async()=>{
 const {session}=await start(2);await system(session);const prefix=session.snapshot.canonical.game.events.length;
 await take(session,'chooseAbility',{characterIds:['drunk']});await take(session,'assignShownCharacter',{characterIds:['philosopher']});
 await take(session,'chooseAbility',{characterIds:['chef']});
 // This prefix stops at the simulated Philosopher choice. A future immediate Chef joins that choice, not the older Drunk grant.
 const s=executionState(session.replay!);const ids=session.snapshot.canonical.game.events.slice(prefix).map(e=>e.id);
 expect(s.latestUndoUnit!.eventIds).toEqual([ids.at(-1)]);
 expect(s.ruleState.abilityGrants?.map(g=>g.characterId)).toEqual(['drunk']);
});
it('T13 P1 A08: an old response without execution DTO is rejected instead of silently reverting Undo semantics',async()=>{
 const f=await actionFixture(actionCases[1]);const response=structuredClone(f.session.replay!);
 Reflect.deleteProperty(response,'actionExecutions');Reflect.deleteProperty(response,'latestUndoUnit');
 expect(()=>parseReplayState(response)).toThrow();
});
it('T13 P1 A12: user order begins at minion/demon, not role setup',async()=>{
 const f=await actionFixture(actionCases[1]);expect(key(f.step.actionRef)).toBe('system.minionInfo');
 await confirmAction(f.session,'minionInfo',null);expect(key(f.session.replay!.currentStep!.actionRef)).toBe('system.demonInfo');
 expect((await realWasmCore().replay(f.session.snapshot.canonical)).ok).toBe(true);
});

it('T13 P1 A10: TB immediate acquisition declares the preparation parent as well as delivery',async()=>{
 const {session}=await start(2);await system(session);
 const choice=await take(session,'chooseAbility',{characterIds:['washerwoman']});
 expect(executionStep(session.replay!.currentStep!).predecessorEventId).toBe(choice.proposal.event.id);
 const prep=await take(session,'prepareInformation',{playerIds:['p1','p3'],characterId:'monk',correctPlayerId:'p3'});
 const delivery=await take(session,'learnTownsfolk',null);
 expect(executionState(session.replay!).latestUndoUnit!.eventIds).toEqual([choice.proposal.event.id,prep.proposal.event.id,delivery.proposal.event.id]);
});
it('T13 P1 A10: nested simulated immediate Chef joins its actual choice, not the older Drunk grant',async()=>{
 const {session}=await start(2);await system(session);
 await take(session,'chooseAbility',{characterIds:['drunk']});await take(session,'assignShownCharacter',{characterIds:['philosopher']});
 const choice=await take(session,'chooseAbility',{characterIds:['chef']});
 const chef=await take(session,'learnEvilPairs',null,{kind:'number',value:0});
 expect(executionState(session.replay!).latestUndoUnit!.eventIds).toEqual([choice.proposal.event.id,chef.proposal.event.id]);
});
