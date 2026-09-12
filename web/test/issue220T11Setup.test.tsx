import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import {CustomGrimoireSetup} from '../src/grimoire-custom/CustomGrimoireSetup';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {CustomGrimoireApplicationController} from '../src/custom/grimoire/applicationController';
import {t11Setup,settle,startT11,vigormortisRoster} from './custom/issue220T11Support';
import {realWasmCore} from './custom/realCustomWasmHarness';
import {resume} from './custom/issue220T10TestSupport';
import type {PhaseStepInput} from '../src/custom/core/types';
import type {CoreAdapter} from '../src/custom/core/coreAdapter';
const apps:CustomGrimoireApplicationController[]=[];
// jsdom has no scrolling; real scrolling/layout remains a production-browser review.
beforeEach(()=>{vi.spyOn(window,'scrollTo').mockImplementation(()=>{});});
afterEach(()=>{cleanup();apps.splice(0).forEach(a=>a.dispose());});
const noop=()=>{};
function showSetup(app:CustomGrimoireApplicationController){return render(<CustomGrimoireSetup controller={app.setup!} onNewGame={noop} onImport={noop}/>);}
function showPlay(app:CustomGrimoireApplicationController){return render(<CustomGrimoirePlay controller={app.play!} onNewGame={noop} onImport={noop} onRestart={noop}/>);}
// Desktop + compact may both exist in jsdom. Do not prescribe their DOM structure.
function adjustment(name:string){return screen.queryAllByText(`${name} 보정`,{exact:true});}
function expectCause(name:string,amount:number){
 const headings=adjustment(name);expect.soft(headings.length).toBeGreaterThan(0);
 for(const heading of headings){const section=heading.closest('section')!;expect(section).toBeTruthy();expect.soft(section.textContent).toMatch(new RegExp(`외지인\\s*[${amount<0?'−-':'+'}]\\s*${Math.abs(amount)}`));expect(within(section).queryAllByRole('button')).toHaveLength(0);}
}
function expectCounts(t:number,o:number){const panel=screen.getByRole('region',{name:'적용 인원 구성'});expect(within(panel).getByLabelText(`인원 구성 마을 주민 ${t}명`)).toBeTruthy();expect(within(panel).getByLabelText(`인원 구성 이방인 ${o}명`)).toBeTruthy();}
for(const c of [{id:'vigormortis',name:'비고르모르티스',n:8,t:6,o:0},{id:'fangGu',name:'팡 구',n:7,t:4,o:1},{id:'baron',name:'남작',n:7,t:3,o:2}])it(`T11 M01/M03 ${c.id}: causes follow actual selection and removal`,async()=>{
 const app=await t11Setup();apps.push(app);showSetup(app);
 expect(adjustment(c.name)).toHaveLength(0);
 await act(async()=>{app.setup!.setPlayerCount(c.n);await settle(app);});
 await act(async()=>{if(c.id==='baron')app.setup!.toggleCharacter(c.id);else app.setup!.selectDemon(c.id);await settle(app);});
 expectCounts(c.t,c.o);expectCause(c.name,c.id==='vigormortis'?-1:c.id==='baron'?2:1);
 await act(async()=>{if(c.id==='baron')app.setup!.toggleCharacter(c.id);else app.setup!.selectDemon('imp');await settle(app);});
 expect(adjustment(c.name)).toHaveLength(0);expectCounts(5,c.n===8?1:0);
});
it('T11 M07: a real Snake Charmer swap cannot change the initial setup adjustment',async()=>{
 const first=await startT11(vigormortisRoster.map(id=>id==='slayer'?'snakeCharmer':id));apps.push(first);
 const session=first.play!.session;
 for(const [action,input] of [['minionInfo',null],['demonInfo',{characterIds:['washerwoman','librarian','chef']}],['choosePoisonTarget',{playerIds:[session.replay!.players[0].id]}],['chooseSwapTarget',{playerIds:[session.replay!.players[6].id]}]] as Array<[string,PhaseStepInput]>){
  const step=session.replay!.currentStep!;
  // The action ID is read below for the swap; the first two system steps are fixed.
  if(action!=='chooseSwapTarget')expect(step.actionRef?.actionId).toBe(action);
  else expect(step.character).toBe('snakeCharmer');
  const result=await session.execute({type:'confirmStep',payload:{stepId:step.id,input}});expect(result.ok,JSON.stringify(result)).toBe(true);
 }
 expect(session.replay!.players[6].actualCharacter).toBe('snakeCharmer');expect(session.replay!.players[4].actualCharacter).toBe('vigormortis');
 const app=await resume(JSON.parse(JSON.stringify(session.snapshot.canonical)));apps.push(app);
 const before=structuredClone(app.play!.getSnapshot().file.game.events);
 showPlay(app);fireEvent.click(screen.getByRole('button',{name:'직업'}));
 await waitFor(()=>expect(adjustment('비고르모르티스').length).toBeGreaterThan(0));expectCounts(5,0);
 expect(app.play!.getSnapshot().file.game.events).toEqual(before);
});
it('T11 M02/M04: combined modifiers display separately and survive removal of just one source',async()=>{
 const app=await t11Setup();apps.push(app);showSetup(app);
 await act(async()=>{app.setup!.selectDemon('vigormortis');await settle(app);app.setup!.toggleCharacter('baron');await settle(app);});
 expectCounts(4,1);expect.soft(adjustment('비고르모르티스').length).toBeGreaterThan(0);expect.soft(adjustment('남작').length).toBeGreaterThan(0);
 await act(async()=>{app.setup!.toggleCharacter('baron');await settle(app);});
 expectCounts(5,0);expect(adjustment('남작')).toHaveLength(0);expect.soft(adjustment('비고르모르티스').length).toBeGreaterThan(0);
 // Specific limit wording and BMR compact layout are direct-review items. The Core
 // contract independently requires requested=-1, applied=0, limited=true.
});
it('T11 M06: pending and failed requests hide obsolete causes and allow retry',async()=>{
 const core=realWasmCore();let hold=false,reject=false;
 const pending:Array<()=>Promise<void>>=[];
 const delayed:CoreAdapter={...core,setupDistribution:request=>!hold?core.setupDistribution(request):new Promise(resolve=>pending.push(async()=>resolve(reject?{ok:false,error:{code:'test',messageKo:'구성 조회 실패'}} as never:await core.setupDistribution(request))))};
 const app=await t11Setup(delayed);apps.push(app);showSetup(app);
 await act(async()=>{app.setup!.selectDemon('vigormortis');await settle(app);});
 expect.soft(adjustment('비고르모르티스').length).toBeGreaterThan(0);
 hold=true;await act(async()=>{app.setup!.selectDemon('fangGu');});
 expect(adjustment('비고르모르티스')).toHaveLength(0);expect(adjustment('팡 구')).toHaveLength(0);
 reject=true;await act(async()=>{await pending.shift()!();});
 expect(screen.getByRole('alert').textContent).toContain('구성 조회 실패');expect(adjustment('팡 구')).toHaveLength(0);
 hold=false;await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'구성 다시 확인'}));await settle(app);});
 expectCounts(4,1);expect(adjustment('팡 구').length).toBeGreaterThan(0);
});
it('T11 M06: late older replies cannot combine an obsolete modifier with new counts',async()=>{
 const core=realWasmCore();let hold=false;const pending:Array<()=>Promise<void>>=[];
 const app=await t11Setup({...core,setupDistribution:r=>!hold?core.setupDistribution(r):new Promise(resolve=>pending.push(async()=>resolve(await core.setupDistribution(r))))});apps.push(app);showSetup(app);
 await act(async()=>{app.setup!.selectDemon('vigormortis');await settle(app);});
 hold=true;await act(async()=>{app.setup!.setPlayerCount(8);app.setup!.setPlayerCount(9);});
 await act(async()=>{await pending[1]();await pending[0]();});
 expectCounts(6,1);expect(adjustment('비고르모르티스').length).toBeGreaterThan(0);
});
for(const mode of ['confirmed','json','autosave','restart'] as const)it(`T11 M07 ${mode}: initial adjustment survives without changing canonical events`,async()=>{
 const first=await startT11();apps.push(first);const file=structuredClone(first.play!.getSnapshot().file);
 let app=first;
 if(mode==='json'){app=await resume(JSON.parse(JSON.stringify(file)));apps.push(app);}
 if(mode==='autosave'){app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());apps.push(app);await app.restore(file.game.script.definition.id);}
 if(mode==='restart'){app.restartFromSetup();await settle(app);showSetup(app);fireEvent.click(screen.getByRole('button',{name:'직업'}));expect(adjustment('비고르모르티스').length).toBeGreaterThan(0);return;}
 showPlay(app);fireEvent.click(screen.getByRole('button',{name:'직업'}));
 await waitFor(()=>expect(adjustment('비고르모르티스').length).toBeGreaterThan(0));expectCounts(5,0);
 expect(app.play!.getSnapshot().file.game.events).toEqual(file.game.events);
 expect(app.play!.getSnapshot().file.game).not.toHaveProperty('adjustment');
});
it('T11 M06/M07: a restored setup projection failure is visible and retry preserves the game',async()=>{
 const first=await startT11();apps.push(first);const file=structuredClone(first.play!.getSnapshot().file),core=realWasmCore();let fail=true;
 const error={ok:false,error:{code:'QUERY_FAILED',messageKo:'구성 조회 실패'}} as const;
 const app=new CustomGrimoireApplicationController({...core,
  setupDistribution:request=>fail?Promise.resolve(error):core.setupDistribution(request),
  setupDistributionSync:request=>fail?error:core.setupDistributionSync(request),
 },vi.fn());apps.push(app);await app.resumeImported({file});
 showPlay(app);fireEvent.click(screen.getByRole('button',{name:'직업'}));
 const alert=await screen.findByRole('alert');expect(alert.textContent).toContain('구성 조회 실패');expect(adjustment('비고르모르티스')).toHaveLength(0);
 expect(app.play!.getSnapshot().file.game.events).toEqual(file.game.events);
 fail=false;await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'구성 다시 확인'}));});
 await waitFor(()=>expect(adjustment('비고르모르티스').length).toBeGreaterThan(0));expectCounts(5,0);
 expect(app.play!.getSnapshot().file.game.events).toEqual(file.game.events);
});
it('T11 M08: actual dawn UI enters Day and preserves original setup modifiers',async()=>{
 const app=await startT11(['vigormortis','baron','soldier','mayor','monk','virgin','recluse']);apps.push(app);
 const p=app.play!;
 for(const input of [null,{characterIds:['washerwoman','librarian','chef']}]){await p.prepare({input});p.conceal();await p.confirm();expect(p.getSnapshot().error).toBeUndefined();}
 expect(p.step?.actionRef?.actionId).toBe('dawn');expect(p.step?.requiredInput.kind).toBe('day');showPlay(app);
 fireEvent.click(screen.getByRole('button',{name:'진행'}));
 fireEvent.click(screen.getByRole('button',{name:'낮 시작'}));
 await waitFor(()=>expect(p.getSnapshot().replay.phase).toBe('day'));
 fireEvent.click(screen.getByRole('button',{name:'직업'}));await waitFor(()=>expectCause('비고르모르티스',-1));expectCause('남작',2);expectCounts(4,1);
});
