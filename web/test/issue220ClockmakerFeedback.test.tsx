import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {resume} from './custom/issue220T10TestSupport';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
afterEach(cleanup);
it('reported drunk Clockmaker uses numeric input without registration or enumerated choices',async()=>{
 const app=await resume(JSON.parse(readFileSync(resolve('../fixtures/acceptance/custom-first-night/issue220/test0912-game-3.json'),'utf8')));try{
 const p=app.play!;expect(p.step?.character).toBe('clockmaker');
 render(<CustomGrimoirePlay controller={p} onNewGame={()=>{}} onImport={()=>{}}/>);
 expect(screen.queryByText('실제 정체')).toBeNull();expect(screen.queryByRole('button',{name:'7'})).toBeNull();
 const input=screen.getByRole('spinbutton',{name:'전달할 숫자'});
 fireEvent.change(input,{target:{value:'99'}});expect(screen.getByRole('button',{name:'취한 정보 공개'})).toHaveProperty('disabled',true);
 fireEvent.change(input,{target:{value:'2'}});fireEvent.click(screen.getByRole('button',{name:'취한 정보 공개'}));
 await waitFor(()=>expect(screen.getByRole('dialog',{name:'플레이어 정보'})).toBeDefined());
 expect(p.getSnapshot().activeReveal?.payload).toMatchObject({kind:'numericInformation',value:2});
 }finally{app.dispose();}
});

import {t11Definition} from './custom/issue220T11Support';
import {newScenario,confirmAction} from './custom/issue220ScenarioOrderSupport';
for(const [role,action] of [['chef','learnEvilPairs'],['empath','learnEvilNeighbors'],['clockmaker','learnSteps'],['mathematician','learnCount']] as const)it(`numeric contract: poisoned ${role} accepts input without enumerated buttons or registration`,async()=>{
 const d=structuredClone((await t11Definition()).definition);
 const ref=d.firstNightOrder.find(r=>r.kind==='character'&&r.characterId===role&&r.actionId===action)!;
 const poison=d.firstNightOrder.find(r=>r.actionId==='choosePoisonTarget')!;
 d.firstNightOrder=[{kind:'system',actionId:'dusk'},{kind:'system',actionId:'minionInfo'},{kind:'system',actionId:'demonInfo'},poison,ref,...d.firstNightOrder.filter(r=>r.kind==='character'&&r!==poison&&r!==ref),{kind:'system',actionId:'dawn'}];
 const {session}=await newScenario(d,[role,'mayor','monk','virgin','slayer','poisoner','imp']);
 await confirmAction(session,'minionInfo',null);await confirmAction(session,'demonInfo',{characterIds:['washerwoman','librarian','investigator']});await confirmAction(session,'choosePoisonTarget',{playerIds:['p1']});
 const app=await resume(session.snapshot.canonical);try{
  const p=app.play!;expect(p.step?.character).toBe(role);
  render(<CustomGrimoirePlay controller={p} onNewGame={()=>{}} onImport={()=>{}}/>);
  expect(screen.queryByText('실제 정체')).toBeNull();expect(screen.queryByRole('button',{name:'2'})).toBeNull();
  const input=screen.getByRole('spinbutton',{name:'전달할 숫자'}),reveal=screen.getByRole('button',{name:'중독 정보 공개'});
  fireEvent.change(input,{target:{value:'-1'}});expect(reveal).toHaveProperty('disabled',true);
  fireEvent.change(input,{target:{value:'2'}});fireEvent.click(reveal);
  await waitFor(()=>expect(screen.getByRole('dialog',{name:'플레이어 정보'})).toBeDefined());expect(p.getSnapshot().activeReveal?.payload).toMatchObject({kind:'numericInformation',value:2});
 }finally{app.dispose();}
});
