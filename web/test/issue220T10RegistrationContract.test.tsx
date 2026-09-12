import {afterEach,expect,it} from 'vitest';
import {act,cleanup,fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {newScenario,scenario,roster,confirmAction} from './custom/issue220ScenarioOrderSupport';
import {resume} from './custom/issue220T10TestSupport';
afterEach(cleanup);
async function start(role:'chef'|'empath'|'fortuneTeller'|'clockmaker'|'seamstress'){
 const action={chef:'learnEvilPairs',empath:'learnEvilNeighbors',fortuneTeller:'checkDemon',clockmaker:'learnSteps',seamstress:'compareAlignments'}[role];
 const definition=structuredClone(scenario);if(!definition.characterIds.includes(role))definition.characterIds.push(role);
 definition.firstNightOrder=definition.firstNightOrder.filter(r=>r.actionId!==action);definition.firstNightOrder.splice(3,0,{kind:'character',characterId:role,actionId:action});
 const roles=roster.map(id=>['clockmaker','seamstress'].includes(role)?id==='monk'?role:id:role==='empath'?({chef:'empath',investigator:'spy',spy:'investigator',fortuneTeller:'recluse',recluse:'fortuneTeller'}[id]??id):id);
 const {session}=await newScenario(definition,roles);await confirmAction(session,'minionInfo',null);await confirmAction(session,'demonInfo',{characterIds:['ravenkeeper','undertaker','juggler']});
 if(role==='fortuneTeller')await confirmAction(session,'assignRedHerring',{playerIds:['p6']});
 return resume(session.snapshot.canonical);
}
for(const role of ['chef','empath'] as const)for(const spyAs of ['good','evil'] as const)for(const recluseAs of ['good','evil'] as const)it(`T10-4/7 ${role}: contextual team buttons produce the chosen ${spyAs} Spy / ${recluseAs} Recluse result`,async()=>{
 const app=await start(role);try{const p=app.play!;const identities=p.getSnapshot().replay.players.map(p=>[p.id,p.actualCharacter,p.alignment]);
 render(<CustomGrimoirePlay controller={p} onImport={()=>{}} onNewGame={()=>{}} onRestart={()=>{}}/>);
 const recluse=screen.getByRole('group',{name:'이번 판정의 은둔자 취급'}),spy=screen.getByRole('group',{name:'이번 판정의 첩자 취급'});
 for(const group of [recluse,spy])expect(within(group).getAllByRole('button').map(b=>b.textContent)).toEqual(['선','악']);
 fireEvent.click(within(recluse).getByRole('button',{name:recluseAs==='evil'?'악한 팀으로 취급':'선한 팀으로 취급'}));fireEvent.click(within(spy).getByRole('button',{name:spyAs==='evil'?'악한 팀으로 취급':'선한 팀으로 취급'}));
 fireEvent.click(screen.getByRole('button',{name:'정보 공개'}));await waitFor(()=>expect(p.getSnapshot().public).toBe(true));
 expect(p.getSnapshot().reveal).toMatchObject({kind:'numericInformation',characterId:role,value:role==='chef'?(spyAs==='evil'?3:1):(spyAs==='evil'?1:0)+(recluseAs==='evil'?1:0)});
 fireEvent.click(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'}));await act(async()=>p.confirm());
 expect(p.getSnapshot().replay.players.map(p=>[p.id,p.actualCharacter,p.alignment])).toEqual(identities);
 const event=p.getSnapshot().file.game.events.at(-1)!;
 expect(event.type).toBe('customActionConfirmed');if(event.type!=='customActionConfirmed')throw Error(event.type);
 const spyId=role==='chef'?'p13':'p3';
 if(recluseAs==='evil')expect(event.payload.registrationJudgments).toEqual(expect.arrayContaining([expect.objectContaining({playerId:role==='chef'?'p10':'p5',registeredAs:'evil'})]));
 // Actual evil identity may be represented without an override; a good registration must retain its witness.
 if(spyAs==='good')expect(event.payload.registrationJudgments).toEqual(expect.arrayContaining([expect.objectContaining({playerId:spyId,registeredAs:'good'})]));
 else expect((event.payload.registrationJudgments??[]).filter(j=>j.playerId===spyId).every(j=>j.registeredAs==='evil')).toBe(true);
 }finally{app.dispose();}
});
for(const demon of [false,true])for(const actualDemon of [false,true])it(`T10-4/9 Fortune Teller: board treatment ${demon}, actual demon=${actualDemon} completes targets and returns only the result`,async()=>{
 const app=await start('fortuneTeller');try{const p=app.play!;render(<CustomGrimoirePlay controller={p} onImport={()=>{}} onNewGame={()=>{}} onRestart={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:'대상 선택'}));fireEvent.click(screen.getByRole('button',{name:/^10번 P10,/}));fireEvent.click(screen.getByRole('button',{name:actualDemon?/^15번 P15,/:/^8번 P8,/}));
 const panel=screen.getByRole('complementary',{name:'현재 마도서 작업'});const treatment=within(panel).getByRole('group',{name:'이번 판정의 은둔자 취급'});
 expect(within(treatment).getAllByRole('button')).toHaveLength(2);expect((within(panel).getByRole('button',{name:'선택 확정'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(within(treatment).getByRole('button',{name:demon?'은둔자를 악마로 취급':'은둔자를 악마로 취급하지 않음'}));fireEvent.click(within(panel).getByRole('button',{name:'선택 확정'}));
 await waitFor(()=>expect(screen.queryByRole('complementary',{name:'현재 마도서 작업'})).toBeNull());expect(screen.queryByRole('group',{name:'이번 판정의 은둔자 취급'})).toBeNull();
 expect(within(screen.getByRole('group',{name:'정보 결과'})).getByText(demon||actualDemon?'있음':'없음',{exact:true})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'정보 공개'}));await waitFor(()=>expect(p.getSnapshot().public).toBe(true));expect(p.getSnapshot().reveal).toMatchObject({kind:'fortuneTellerInformation',hasDemon:demon||actualDemon});
 }finally{app.dispose();}
});

for(const spyAs of ['good','evil'] as const)for(const recluseAs of ['good','evil'] as const)it(`T10 mixed Seamstress: ${spyAs}/${recluseAs} explicit teams, one Core result`,async()=>{
 const app=await start('seamstress');try{const p=app.play!;render(<CustomGrimoirePlay controller={p} onImport={()=>{}} onNewGame={()=>{}} onRestart={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:'대상 선택'}));for(const seat of [13,10])fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${seat}번 P${seat},`)}));fireEvent.click(screen.getByRole('button',{name:'선택 확정'}));
 expect(screen.queryByRole('complementary',{name:'현재 마도서 작업'})).toBeNull();
 for(const [name,value] of [['첩자',spyAs],['은둔자',recluseAs]] as const){const group=screen.getByRole('group',{name:`이번 판정의 ${name} 취급`});expect(within(group).getAllByRole('button').map(b=>b.textContent)).toEqual(['선','악']);fireEvent.click(within(group).getByRole('button',{name:value==='good'?'선한 팀으로 취급':'악한 팀으로 취급'}));}
 expect(screen.queryByRole('group',{name:'전달할 정보'})).toBeNull();expect(screen.queryByText('실제 정체')).toBeNull();
 expect(screen.getByRole('group',{name:'정보 결과'}).textContent).toContain(spyAs===recluseAs?'같은 진영':'다른 진영');
 fireEvent.click(screen.getByRole('button',{name:'정보 공개'}));await waitFor(()=>expect(p.getSnapshot().public).toBe(true));expect(p.getSnapshot().reveal).toMatchObject({kind:'seamstressInformation',sameAlignment:spyAs===recluseAs});
 }finally{app.dispose();}
});
for(const recluseKind of ['외지인','하수인','악마'])it(`T10 mixed Clockmaker: explicit ${recluseKind} and Spy kind retain the chosen witness`,async()=>{
 const app=await start('clockmaker');try{const p=app.play!;render(<CustomGrimoirePlay controller={p} onImport={()=>{}} onNewGame={()=>{}} onRestart={()=>{}}/>);
 const recluse=screen.getByRole('group',{name:'이번 판정의 은둔자 취급'}),spy=screen.getByRole('group',{name:'이번 판정의 첩자 취급'});
 expect(within(recluse).getAllByRole('button').map(b=>b.textContent)).toEqual(['외지인','하수인','악마']);expect(within(spy).getAllByRole('button').map(b=>b.textContent)).toEqual(['하수인','주민','외지인']);
 fireEvent.click(within(recluse).getByRole('button',{name:recluseKind}));fireEvent.click(within(spy).getByRole('button',{name:'외지인'}));
 expect(screen.queryByText('실제 정체')).toBeNull();expect(screen.queryByRole('group',{name:'전달 정보'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'정보 공개'}));await waitFor(()=>expect(p.getSnapshot().public).toBe(true));expect(p.getSnapshot().reveal).toMatchObject({kind:'numericInformation',characterId:'clockmaker',value:1});
 fireEvent.click(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'}));await act(async()=>p.confirm());const e=p.getSnapshot().file.game.events.at(-1)!;if(e.type!=='customActionConfirmed')throw Error(e.type);
 expect(e.payload.registrationJudgments).toEqual(expect.arrayContaining([expect.objectContaining({playerId:'p13',registeredAs:'outsider'})]));
 if(recluseKind!=='외지인')expect(e.payload.registrationJudgments).toEqual(expect.arrayContaining([expect.objectContaining({playerId:'p10',registeredAs:recluseKind==='악마'?'demon':'minion'})]));
 }finally{app.dispose();}
});
