import {actionAdapters} from '../src/custom/grimoire/actions/registry';
import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {resume} from './custom/issue220T10TestSupport';
import {actionCases,actionFixture,key} from './custom/issue220T13Support';
import {characterPresentation} from '../src/custom/authoring/characterPresentation';
afterEach(cleanup);
const revealKinds:Record<string,string>={minionInfo:'minionInformation',demonInfo:'demonInformation',learnTownsfolk:'setupInformation',learnOutsider:'setupInformation',learnMinion:'setupInformation',learnEvilPairs:'numericInformation',learnEvilNeighbors:'numericInformation',learnSteps:'numericInformation',learnCount:'numericInformation',checkDemon:'fortuneTellerInformation',learnCharacters:'dreamerInformation',compareAlignments:'seamstressInformation',inspectGrimoire:'spyGrimoire'};
const notificationKinds:Record<string,string>={learnTwin:'evilTwinPair',assignMadness:'madnessAssignment'};
for(const c of actionCases)it(`T13 P3 ${c[0]} ${c[1]}.${c[2]}: real action result has its own public/complete contract`,async()=>{
 const f=await actionFixture(c),app=await resume(f.session.snapshot.canonical);
 try{
  const p=app.play!,action=c[2];if(action==='resolveMadnessExecution')p.selectStep(f.step.id);
  render(<CustomGrimoirePlay controller={p} onNewGame={()=>{}} onImport={()=>{}} onRestart={()=>{}}/>);
  expect(screen.queryByText('이 행동의 화면 연결을 확인할 수 없습니다.')).toBeNull();
  if(action==='dusk'){
   expect(screen.queryByText('첫날 밤 준비',{exact:true})).toBeNull();expect(key(p.step?.actionRef)).toBe('system.minionInfo');return;
  }
  const before=structuredClone(p.getSnapshot().file.game.events);
  // These cases test command→actual UI/reveal, not the separate input-widget acceptance tests.
  await act(async()=>p.prepare({input:f.input,...(f.delivered?{deliveredResult:f.delivered}:{})}));
  expect(p.getSnapshot().error).toBeUndefined();
  if(revealKinds[action]){
   expect(p.getSnapshot().reveal).toMatchObject({kind:revealKinds[action]});
   expect(p.getSnapshot().public).toBe(true);
   const close=screen.getByRole('button',{name:action==='inspectGrimoire'?'확인 완료':'확인했으면 눈을 감으세요'});
   expect(p.getSnapshot().file.game.events).toEqual(before);
   fireEvent.click(close);expect(p.getSnapshot().public).toBe(false);
   await act(async()=>p.confirm());
  }else if(notificationKinds[action]){
   expect(p.getSnapshot().public).toBe(false);
   expect(p.getSnapshot().handoff?.notifications).toEqual(expect.arrayContaining([expect.objectContaining({kind:notificationKinds[action]})]));
   await act(async()=>p.showNotification());
   expect(screen.getByRole('dialog',{name:'플레이어 정보'})).toBeTruthy();
   fireEvent.click(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'}));
   expect(p.getSnapshot().public).toBe(false);
  }else expect(p.getSnapshot().public).toBe(false);
  expect(p.getSnapshot().file.game.events).toHaveLength(before.length+1);
 }finally{app.dispose();}
});

for(const id of ['R05','R10','R11','R12','R13','R14'])it(`T13 P3 ${id}: real board selection confirms without an extra generic Next`,async()=>{
 const c=actionCases.find(c=>c[0]===id)!,f=await actionFixture(c),app=await resume(f.session.snapshot.canonical);
 try{
  const p=app.play!;render(<CustomGrimoirePlay controller={p} onNewGame={()=>{}} onImport={()=>{}} onRestart={()=>{}}/>);
  const before=p.getSnapshot().file.game.events.length;
  fireEvent.click(screen.getByRole('button',{name:id==='R13'?'저주 대상 선택':id==='R14'?'쌍둥이 선택':'대상 선택'}));
  fireEvent.click(screen.getByRole('button',{name:/^2번 P2,/}));
  const confirm=screen.getByRole('button',{name:id==='R13'?'2번 P2 저주 확정':'선택 확정'});expect(confirm).toHaveProperty('disabled',false);fireEvent.click(confirm);
  await waitFor(()=>{expect(p.getSnapshot().file.game.events.length).toBeGreaterThan(before);expect(p.getSnapshot().busy).toBe(false);});
  expect(screen.queryByRole('button',{name:'다음'})).toBeNull();
  if(id==='R05'){
   // Do not carry the single red-herring target into the two-target action.
   expect(p.step?.actionRef?.actionId).toBe('checkDemon');
   await waitFor(()=>expect(p.getSnapshot().selecting).toBe(true));expect(p.selectedPlayerIds).toEqual([]);
   await waitFor(()=>expect(screen.getByRole('button',{name:'선택 확정'})).toHaveProperty('disabled',true));
  }else if(id==='R14'){
   expect(p.getSnapshot().public).toBe(false);
   await waitFor(()=>expect(p.getSnapshot().handoff?.stage).toBe('notification'));
   expect(p.getSnapshot().handoff?.notifications[0]).toMatchObject({kind:'evilTwinPair'});
  }else if(id==='R10'||id==='R11'){
   await waitFor(()=>expect(screen.getByRole('button',{name:'진행'}).className).toContain('active'));
   expect(p.getSnapshot().handoff).toBeUndefined();
  }
 }finally{app.dispose();}
});
for(const id of ['R05','R06','R07','R08','R14'])it(`T13 P3 ${id}: one displayed action instead of preparation/delivery rows`,async()=>{
 const c=actionCases.find(c=>c[0]===id)!,f=await actionFixture(c),app=await resume(f.session.snapshot.canonical);
 try{
  render(<CustomGrimoirePlay controller={app.play!} onNewGame={()=>{}} onImport={()=>{}} onRestart={()=>{}}/>);
  const list=screen.getByRole('list',{name:'진행 순서'}),label=characterPresentation(c[1])!.label;
  const rows=within(list).getAllByRole('listitem').filter(r=>r.textContent?.includes(label));
  expect(rows).toHaveLength(1);expect(rows[0].textContent).not.toMatch(/준비|지정|통지/);
 }finally{app.dispose();}
});
it('T13 P3: unknown action cannot become a generic working editor',async()=>{
 const f=await actionFixture(actionCases[17]),app=await resume(f.session.snapshot.canonical);
 try{
  // Corrupt only the read boundary to exercise fail-closed display, not to manufacture a valid game.
  const step=structuredClone(app.play!.step!);step.actionRef={kind:'character',characterId:'chef',actionId:'missing'};
  vi.spyOn(app.play!,'step','get').mockReturnValue(step);
  render(<CustomGrimoirePlay controller={app.play!} onNewGame={()=>{}} onImport={()=>{}} onRestart={()=>{}}/>);
  expect(screen.getByRole('alert').textContent).toContain('연결');
  const before=structuredClone(app.play!.getSnapshot().file);await app.play!.prepareCurrent();expect(app.play!.getSnapshot().file).toEqual(before);
 }finally{app.dispose();}
});

it('T13 P3: every approved action has exactly one explicit adapter',()=>{
 expect(Object.keys(actionAdapters).sort()).toEqual(actionCases.map(c=>`${c[1]}.${c[2]}`).sort());
});

it('T13 P3 A05: an independent interruption is displayed from Core and Undo resumes the original row',async()=>{
 const {newScenario,confirmAction}=await import('./custom/issue220ScenarioOrderSupport');
 const {t11Definition}=await import('./custom/issue220T11Support');
 const definition=structuredClone((await t11Definition()).definition);
 const information=definition.firstNightOrder.find(x=>x.actionId==='learnTownsfolk')!;
 definition.firstNightOrder=[{kind:'system',actionId:'dusk'},{kind:'system',actionId:'minionInfo'},{kind:'system',actionId:'demonInfo'},information,...definition.firstNightOrder.filter(x=>x.kind==='character'&&x!==information),{kind:'system',actionId:'dawn'}];
 const {session}=await newScenario(definition,['washerwoman','mayor','monk','virgin','slayer','mutant','poisoner','imp']);
 await confirmAction(session,'minionInfo',null);await confirmAction(session,'demonInfo',{characterIds:['librarian','chef','empath']});
 await confirmAction(session,'prepareInformation',{playerIds:['p2','p3'],characterId:'monk',correctPlayerId:'p3'});
 const free=session.replay!.availableActions!.find(s=>s.actionRef?.actionId==='resolveMadnessExecution')!;
 const result=await session.execute({type:'confirmStep',payload:{stepId:free.id,input:{execute:false}}});expect(result.ok).toBe(true);if(!result.ok)return;await result.value.autosave;
 const app=await resume(session.snapshot.canonical);
 try{
  render(<CustomGrimoirePlay controller={app.play!} onNewGame={()=>{}} onImport={()=>{}}/>);
  const list=screen.getByRole('list',{name:'진행 순서'});
  expect(app.play!.getSnapshot().replay.actionExecutions.some(e=>e.status==='interrupted')).toBe(true);
  expect(within(list).getByText('중단')).toBeDefined();
  await act(()=>app.play!.undo());
  expect(within(list).queryByText('중단')).toBeNull();
  expect(within(list).getAllByRole('listitem').filter(row=>row.textContent?.includes('세탁부'))).toHaveLength(1);
 }finally{app.dispose();}
});
