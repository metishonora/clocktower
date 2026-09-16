import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {CustomGrimoireApplicationController} from '../src/custom/grimoire/applicationController';
import {startT11,mutantRoster} from './custom/issue220T11Support';
import {resume} from './custom/issue220T10TestSupport';
import {realWasmCore} from './custom/realCustomWasmHarness';
const apps:CustomGrimoireApplicationController[]=[];
// jsdom has no scrolling; real scrolling/layout remains a production-browser review.
beforeEach(()=>{vi.spyOn(window,'scrollTo').mockImplementation(()=>{});});
afterEach(()=>{cleanup();apps.splice(0).forEach(a=>a.dispose());});
function renderPlay(app:CustomGrimoireApplicationController){render(<CustomGrimoirePlay controller={app.play!} onNewGame={()=>{}} onImport={()=>{}} onRestart={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'마도서'}));expect(screen.getByRole('button',{name:'배치로 돌아가기'})).toBeDefined();}
function inspect(){fireEvent.click(screen.getByRole('button',{name:/^6번.*변종/}));return screen.getByRole('dialog',{name:/6번.*플레이어 상세/});}
// These are state/restore regressions through actual Core execution, not a string-only
// Red. Funeral state and event preservation must hold when removing the duplicate chip.
for(const mode of ['live','json','autosave'] as const)it(`T11 D01/D03 ${mode}: Mutant execution keeps death and history but no redundant status chip`,async()=>{
 let app=await startT11(mutantRoster);apps.push(app);
 const p=app.play!,step=p.steps.find(s=>s.actionRef?.actionId==='resolveMadnessExecution')!;
 expect(step).toBeDefined();const id=JSON.stringify(step.abilityUse),before=structuredClone(p.getSnapshot().file.game.events);
 await p.freeAction(id,{madnessCheck:'violation'});await p.freeAction(id,{execute:true});
 expect(p.getSnapshot().error).toBeUndefined();expect(p.getSnapshot().replay.players[5].alive).toBe(false);
 await vi.waitFor(()=>expect(p.getSnapshot().saveStatus).toBe('saved'));
 const file=structuredClone(p.getSnapshot().file);
 if(mode==='json'){app=await resume(JSON.parse(JSON.stringify(file)));apps.push(app);}
 if(mode==='autosave'){app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());apps.push(app);await app.restore(file.game.script.definition.id);}
 renderPlay(app);const seat=screen.getByRole('button',{name:/^6번.*변종/});expect(seat.querySelector('.snvFuneralIcon')).not.toBeNull();
 const detail=inspect();expect.soft(within(detail).queryByText('사망',{exact:true})).toBeNull();expect.soft(within(detail).queryByLabelText('현재 상태')).toBeNull();
 expect(app.play!.getSnapshot().file.game.events).toEqual(file.game.events);
 fireEvent.click(within(detail).getByRole('button',{name:'플레이어 상세 닫기'}));
 await act(async()=>{await app.play!.undo();});
 expect(app.play!.getSnapshot().replay.players[5].alive).toBe(true);expect(seat.querySelector('.snvFuneralIcon')).toBeNull();
 expect(app.play!.getSnapshot().file.game.events.length).toBeGreaterThanOrEqual(before.length);
 const living=inspect();expect(within(living).queryByText('생존',{exact:true})).toBeNull();expect.soft(within(living).queryByLabelText('현재 상태')).toBeNull();
});
it('T11 D02: cancelling the actual execution dialog preserves the living player and canonical history',async()=>{
 const app=await startT11(mutantRoster);apps.push(app);const p=app.play!,step=p.steps.find(s=>s.actionRef?.actionId==='resolveMadnessExecution')!;
 await p.freeAction(JSON.stringify(step.abilityUse),{madnessCheck:'violation'});
 const before=structuredClone(p.getSnapshot().file);renderPlay(app);
 fireEvent.click(screen.getByRole('button',{name:/변종 집착 확인 열기/}));
 fireEvent.click(screen.getByRole('button',{name:/6번.*처형$/}));
 const confirmation=screen.getByRole('alertdialog');fireEvent.click(within(confirmation).getByRole('button',{name:'취소'}));
 fireEvent.click(screen.getByRole('button',{name:/변종 집착 확인 닫기/}));const detail=inspect();
 expect(p.getSnapshot().replay.players[5].alive).toBe(true);expect(within(detail).queryByText('사망',{exact:true})).toBeNull();
 expect(p.getSnapshot().file).toEqual(before);
});
it('T11 D02/D04: impaired Mutant remains alive and its real poison information stays readable',async()=>{
 const first=await startT11(mutantRoster);apps.push(first);const session=first.play!.session;
 for(const input of [null,{characterIds:['washerwoman','librarian','chef']},{playerIds:[session.replay!.players[5].id]}]){
  const step=session.replay!.currentStep!;const result=await session.execute({type:'confirmStep',payload:{stepId:step.id,input}});expect(result.ok,JSON.stringify(result)).toBe(true);
 }
 const app=await resume(session.snapshot.canonical);apps.push(app);
 const mutant=app.play!.steps.find(s=>s.actionRef?.actionId==='resolveMadnessExecution')!;
 expect(mutant.madness?.sourceEffective).toBe(false);expect(mutant.madness?.canExecute).toBe(false);
 renderPlay(app);const detail=inspect();expect(within(detail).queryByLabelText('현재 상태')).toBeNull();expect(app.play!.getSnapshot().replay.ruleState.activeImpairments?.length).toBeGreaterThan(0);
 expect(within(detail).queryByText('사망',{exact:true})).toBeNull();expect(app.play!.getSnapshot().replay.players[5].alive).toBe(true);
});
it('T11 D04: a dead information recipient retains its real Librarian token',async()=>{
 const first=await startT11(mutantRoster.map(id=>id==='slayer'?'librarian':id));apps.push(first);const session=first.play!.session;
 for(const input of [null,{characterIds:['washerwoman','chef','sage']},{playerIds:[session.replay!.players[2].id]}]){
  const step=session.replay!.currentStep!;const result=await session.execute({type:'confirmStep',payload:{stepId:step.id,input}});expect(result.ok,JSON.stringify(result)).toBe(true);
 }
 const app=await resume(session.snapshot.canonical);apps.push(app);const p=app.play!;
 expect(p.step?.character).toBe('librarian');p.beginSelection();p.togglePlayer(p.getSnapshot().replay.players[5].id);p.togglePlayer(p.getSnapshot().replay.players[0].id);await p.acceptSelection();
 p.updateInput({characterIds:['mutant']});await p.prepareCurrent();expect(p.getSnapshot().error).toBeUndefined();p.conceal();await p.confirm();
 const reminders=p.getSnapshot().replay.ruleState.automaticReminders!.filter(t=>t.playerId===p.getSnapshot().replay.players[5].id);
 expect(reminders).toEqual(expect.arrayContaining([expect.objectContaining({characterId:'librarian'})]));
 const mutant=p.steps.find(s=>s.actionRef?.actionId==='resolveMadnessExecution')!;
 await p.freeAction(JSON.stringify(mutant.abilityUse),{madnessCheck:'violation'});await p.freeAction(JSON.stringify(mutant.abilityUse),{execute:true});
 expect(p.getSnapshot().replay.players[5].alive).toBe(false);
 renderPlay(app);const detail=inspect();expect(within(detail).getByRole('list',{name:/부착된 토큰 [1-9]/})).toBeTruthy();
 expect(p.getSnapshot().replay.ruleState.automaticReminders).toEqual(expect.arrayContaining(reminders));
 expect.soft(within(detail).queryByText('사망',{exact:true})).toBeNull();
});
it('T11 D04: actual Philosopher acquisition retains acquired ability and original-owner drunkenness in details',async()=>{
 const app=await startT11(['soldier','mayor','monk','virgin','philosopher','poisoner','vigormortis']);apps.push(app);const p=app.play!;
 for(let n=0;n<5&&!p.getSnapshot().replay.ruleState.abilityGrants?.length;n++){
  const action=p.step?.actionRef?.actionId;
  const inputs:Record<string,import('../src/custom/core/types').PhaseStepInput>={minionInfo:null,demonInfo:{characterIds:['washerwoman','librarian','chef']},choosePoisonTarget:{playerIds:[p.getSnapshot().replay.players[0].id]},chooseAbility:{characterIds:['mayor']}};
  expect(action&&Object.hasOwn(inputs,action)).toBe(true);
  await p.prepare({input:inputs[action!]});expect(p.getSnapshot().error,action).toBeUndefined();p.conceal();await p.confirm();expect(p.getSnapshot().error,action).toBeUndefined();
 }
 expect(p.getSnapshot().replay.ruleState.abilityGrants).toEqual(expect.arrayContaining([expect.objectContaining({characterId:'mayor'})]));
 renderPlay(app);fireEvent.click(screen.getByRole('button',{name:/^5번.*철학자/}));let detail=screen.getByRole('dialog',{name:/플레이어 상세/});expect(within(detail).getByText('획득 능력 · 시장')).toBeTruthy();
 fireEvent.click(within(detail).getByRole('button',{name:'플레이어 상세 닫기'}));fireEvent.click(screen.getByRole('button',{name:/2번.*시장/}));detail=screen.getByRole('dialog',{name:/플레이어 상세/});expect(within(detail).queryByLabelText('현재 상태')).toBeNull();expect(p.getSnapshot().replay.ruleState.activeImpairments).toEqual(expect.arrayContaining([expect.objectContaining({kind:'drunk'})]));expect(within(detail).queryByText('사망',{exact:true})).toBeNull();
});
