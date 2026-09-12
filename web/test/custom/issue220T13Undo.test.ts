import {expect,it} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {IndexedDbCustomWebSessionStorageDriver} from '../../src/custom/storage/sessionStorage';
import {CustomCanonicalSession} from '../../src/custom/session';
import {CanonicalSessionController} from '../../src/custom/core/canonicalSessionController';
import {actionCases,actionFixture,confirmFixture,latest} from './issue220T13Support';
import {realWasmCore} from './realCustomWasmHarness';
import {preparedRole,setupCases} from './issue220T10TestSupport';
import type {PhaseStepInput} from '../../src/custom/core/types';
async function confirm<D,P>(s:CustomCanonicalSession<D,P>,action:string,input:PhaseStepInput){expect(s.replay?.currentStep?.actionRef?.actionId).toBe(action);const r=await s.execute({type:'confirmStep',payload:{stepId:s.replay!.currentStep!.id,input}});expect(r.ok,JSON.stringify(r)).toBe(true);if(r.ok)expect(await r.value.autosave).toBe(true);}
import {start,system,take,moveBefore} from './issue209Support';

for(const id of ['R15','R16','R17','R22','R27'])for(const complete of [false,true])it(`T13 P2 ${id} ${complete?'complete':'partial'}: one Undo removes the confirmed dependency prefix only`,async()=>{
 const f=await actionFixture(actionCases.find(c=>c[0]===id)!);
 const rootPrefix=structuredClone(f.session.snapshot.canonical.game.events.slice(0,-1));
 if(complete)await confirmFixture(f);
 const result=await f.session.undo(latest(f.session.snapshot.canonical).id);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error.messageKo);
 expect(await result.value.autosave).toBe(true);
 expect(f.session.snapshot.canonical.game.events).toEqual(rootPrefix);
 expect(f.session.replay!.currentStep!.actionRef?.actionId).toBe(id==='R22'?'assignRedHerring':id==='R27'?'assignTwin':'prepareInformation');
});
for(const c of setupCases)for(const condition of ['healthy','poisoned','drunk','duplicate'] as const)it(`T13 P2 ${c.role}/${condition}: completed information Undo preserves preceding owner/actions after save reload`,async()=>{
 const {app,session}=await preparedRole(c,condition);
 try{
  const s=app.play!.session,before=structuredClone(s.snapshot.canonical.game.events);
  await confirm(s,'prepareInformation',{playerIds:[...c.targets],characterId:c.shown,...(condition==='healthy'||condition==='duplicate'?{correctPlayerId:c.targets[0]}:{})});
  await confirm(s,c.action,null);
  const stored=structuredClone(s.snapshot.canonical);
  const replayed=await CustomCanonicalSession.fromFile(JSON.parse(JSON.stringify(stored)),{core:realWasmCore(),storage:new IndexedDbCustomWebSessionStorageDriver(stored.game.script.definition.id,new IDBFactory()),setupDraft:{},presentation:{}});
  expect(replayed.ok).toBe(true);if(!replayed.ok)throw Error(replayed.error.messageKo);
  const undo=await replayed.value.undo(latest(stored).id);expect(undo.ok).toBe(true);
  expect(replayed.value.snapshot.canonical.game.events).toEqual(before);
  expect(session.snapshot.canonical.game.events).toEqual(before);
 }finally{app.dispose();}
});
it('T13 P2: old partial-unit confirmation cannot remove a later completed unit',async()=>{
 const f=await actionFixture(actionCases.find(c=>c[0]==='R27')!);const partial=latest(f.session.snapshot.canonical).id;
 await confirmFixture(f);const before=structuredClone(f.session.snapshot);
 expect((await f.session.undo(partial)).ok).toBe(false);expect(f.session.snapshot).toEqual(before);
});
it('T13 P2: failed continuation leaves the preparation available for retry and single Undo',async()=>{
 const f=await actionFixture(actionCases.find(c=>c[0]==='R15')!);const before=structuredClone(f.session.snapshot.canonical);
 const bad=await f.session.execute({type:'confirmStep',payload:{stepId:f.step.id,input:{playerIds:['absent']}}});
 expect(bad.ok).toBe(false);expect(f.session.snapshot.canonical).toEqual(before);
 await confirmFixture(f);const r=await f.session.undo(latest(f.session.snapshot.canonical).id);expect(r.ok).toBe(true);
 expect(f.session.snapshot.canonical.game.events).toEqual(before.game.events.slice(0,-1));
});
it('T13 P2 A10: a deferred acquired Empath is a separate Undo unit',async()=>{
 const {session}=await start(2);await system(session);const acquired=await take(session,'chooseAbility',{characterIds:['empath']});
 const before=structuredClone(session.snapshot.canonical.game.events);const information=await take(session,'learnEvilNeighbors',null);
 const result=await session.undo(information.proposal.event.id);expect(result.ok).toBe(true);
 expect(session.snapshot.canonical.game.events).toEqual(before);expect(before.at(-1)!.id).toBe(acquired.proposal.event.id);
});
it('T13 P2 A10: immediately acquired information is undone through its acquisition root',async()=>{
 const {session}=await start(2,d=>moveBefore(d,'learnSteps','chooseAbility'));await system(session);const before=structuredClone(session.snapshot.canonical.game.events);
 await take(session,'chooseAbility',{characterIds:['clockmaker']});
 const r=await take(session,'learnSteps',null);expect((await session.undo(r.proposal.event.id)).ok).toBe(true);
 expect(session.snapshot.canonical.game.events).toEqual(before);
});
it('T13 P2: session rejects an Undo using a replay from another prefix',async()=>{
 const f=await actionFixture(actionCases.find(c=>c[0]==='R27')!);const ctl=new CanonicalSessionController(f.session.snapshot.canonical.game.script,realWasmCore());
 const old=await ctl.replay(f.session.snapshot.canonical);expect(old.ok).toBe(true);if(!old.ok)return;
 await confirmFixture(f);const result=ctl.prepareUndo(f.session.snapshot.canonical,old.value,latest(f.session.snapshot.canonical).id);expect(result.ok).toBe(false);
});
it('T13 P2 A05: intervening free action separates preparation from later information Undo',async()=>{
 const {newScenario}=await import('./issue220ScenarioOrderSupport');const {t11Definition}=await import('./issue220T11Support');
 const d=structuredClone((await t11Definition()).definition);const ww=d.firstNightOrder.find(x=>x.actionId==='learnTownsfolk')!;
 d.firstNightOrder=[{kind:'system',actionId:'dusk'},{kind:'system',actionId:'minionInfo'},{kind:'system',actionId:'demonInfo'},ww,...d.firstNightOrder.filter(x=>x.kind==='character'&&x!==ww),{kind:'system',actionId:'dawn'}];
 const {session}=await newScenario(d,['washerwoman','mayor','monk','virgin','slayer','mutant','poisoner','imp']);
 await confirm(session,'minionInfo',null);await confirm(session,'demonInfo',{characterIds:['librarian','chef','empath']});
 await confirm(session,'prepareInformation',{playerIds:['p2','p3'],characterId:'monk',correctPlayerId:'p3'});
 const step=session.replay!.availableActions!.find(x=>x.actionRef?.actionId==='resolveMadnessExecution')!;
 const free=await session.execute({type:'confirmStep',payload:{stepId:step.id,input:{execute:false}}});expect(free.ok).toBe(true);
 const before=structuredClone(session.snapshot.canonical.game.events);await confirm(session,'learnTownsfolk',null);
 expect((await session.undo(latest(session.snapshot.canonical).id)).ok).toBe(true);expect(session.snapshot.canonical.game.events).toEqual(before);
 expect((await session.undo(latest(session.snapshot.canonical).id)).ok).toBe(true);expect(session.snapshot.canonical.game.events).toEqual(before.slice(0,-1));
});

it('T13 P2: same IDs with edited event contents cannot reuse the old Undo replay',async()=>{
 const f=await actionFixture(actionCases.find(c=>c[0]==='R27')!);await confirmFixture(f);
 const old=f.session.replay!,file=structuredClone(f.session.snapshot.canonical);
 file.game.events.at(-1)!.summary='changed with same id';
 const controller=new CanonicalSessionController(file.game.script,realWasmCore());
 const result=controller.prepareUndo(file,old,latest(file).id);
 expect(result.ok).toBe(false);if(!result.ok)expect(result.error.code).toBe('STALE_REPLAY');
});
