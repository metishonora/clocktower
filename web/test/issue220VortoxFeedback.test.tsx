import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {GameFile} from '../src/custom/core/types';
import {resume,preparedRole,setupCases} from './custom/issue220T10TestSupport';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {CustomEventLog} from '../src/grimoire-custom/CustomEventLog';
afterEach(cleanup);
const userFile=()=>JSON.parse(readFileSync(resolve('../fixtures/acceptance/custom-first-night/issue220/test0912-game.json'),'utf8')) as GameFile;
it('reported event log retains history but has no replay action',()=>{
 const file=userFile();render(<CustomEventLog file={file}/>);
 expect(screen.getAllByRole('listitem')).toHaveLength(file.game.events.length);
 expect(screen.queryByRole('button',{name:/다시\s*보기/})).toBeNull();
});
for(const c of setupCases)it(`reported Vortox ${c.role}: influence survives preparation and delivery`,async()=>{
 const file=userFile();file.game.events=file.game.events.slice(0,4);
 // The report has no Investigator; use the same legal setup with that Townsfolk instead.
 if(c.role==='investigator'){const setup=file.game.events[0];if(setup.type!=='setupConfirmed')throw Error('setup');const player=setup.payload.players.find(p=>p.actualCharacter==='washerwoman')!;player.actualCharacter='investigator';player.shownCharacter='investigator';}
 const d=file.game.script.definition,row=d.firstNightOrder.find(r=>r.actionId===c.action)!;
 d.firstNightOrder=d.firstNightOrder.filter(r=>r!==row);d.firstNightOrder.splice(d.firstNightOrder.findIndex(r=>r.actionId==='choosePoisonTarget')+1,0,row);
 const app=await resume(file),p=app.play!;
 try{
  expect(p.step?.character).toBe(c.role);
  render(<CustomGrimoirePlay controller={p} onNewGame={()=>{}} onImport={()=>{}}/>);
  expect(document.querySelector('.snvInformationInfluenceBadge.vortox')?.textContent).toBe('보르톡스');
  const choice=p.step!.requiredInput.setupInformationChoices!.find(c=>c.preparation.information.kind==='setupInfo'&&c.preparation.information.playerIds.length===2)!;
  const info=choice.preparation.information;if(info.kind!=='setupInfo')throw Error('expected setup information');
  fireEvent.click(screen.getByRole('button',{name:'대상 선택'}));
  for(const id of info.playerIds){const player=p.getSnapshot().replay.players.find(p=>p.id===id)!;fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${player.seat}번 ${player.name},`)}));}
  fireEvent.click(screen.getByRole('button',{name:'선택 확정'}));
  await waitFor(()=>expect(p.getSnapshot().selecting).toBe(false));
  fireEvent.change(screen.getByRole('combobox',{name:'보여줄 캐릭터'}),{target:{value:info.characterId}});
  const reveal=screen.getByRole('button',{name:'거짓 정보 공개'});expect(reveal.className).toContain('vortox');
  fireEvent.click(reveal);await waitFor(()=>expect(screen.getByRole('dialog',{name:'플레이어 정보'})).toBeDefined());
  expect(p.step?.actionRef?.actionId).toBe(c.action);
  expect(p.step?.informationPrompt?.activeReasons.some(r=>r.type==='vortox')).toBe(true);
 }finally{app.dispose();}
});
it('ordinary poisoned information retains its own badge and reveal style without Vortox',async()=>{
 const {app}=await preparedRole(setupCases[0],'poisoned');try{
  render(<CustomGrimoirePlay controller={app.play!} onNewGame={()=>{}} onImport={()=>{}}/>);
  expect(document.querySelector('.snvInformationInfluenceBadge.poisoned')).not.toBeNull();
  expect(document.querySelector('.snvInformationInfluenceBadge.vortox')).toBeNull();
 }finally{app.dispose();}
});

import {t11Definition} from './custom/issue220T11Support';
import {newScenario,confirmAction} from './custom/issue220ScenarioOrderSupport';
for(const role of ['chef','empath','clockmaker','mathematician'])it(`Vortox ${role}: entering the truth shows red false-information feedback`,async()=>{
 const d=structuredClone((await t11Definition()).definition);
 d.firstNightOrder=[{kind:'system',actionId:'dusk'},{kind:'system',actionId:'minionInfo'},{kind:'system',actionId:'demonInfo'},...d.firstNightOrder.filter(r=>r.kind==='character'),{kind:'system',actionId:'dawn'}];
 const row=d.firstNightOrder.find(r=>r.kind==='character'&&r.characterId===role)!;
 d.firstNightOrder=d.firstNightOrder.filter(r=>r!==row);d.firstNightOrder.splice(3,0,row);
 const {session}=await newScenario(d,[role,'soldier','mayor','monk','virgin','scarletWoman','vortox']);
 await confirmAction(session,'minionInfo',null);await confirmAction(session,'demonInfo',{characterIds:['washerwoman','librarian','investigator']});
 const app=await resume(session.snapshot.canonical),p=app.play!;
 try{
  expect(p.step?.character).toBe(role);const prompt=p.step!.informationPrompt!;
  expect(prompt.activeReasons.some(r=>r.type==='vortox')).toBe(true);
  if(prompt.computedResult?.kind!=='number')throw Error('numeric result required');
  const truth=prompt.computedResult.value;
  render(<CustomGrimoirePlay controller={p} onNewGame={()=>{}} onImport={()=>{}}/>);
  const input=screen.getByRole('spinbutton',{name:'전달할 숫자'});
  fireEvent.change(input,{target:{value:String(prompt.computedResult.value)}});
  expect(screen.getByRole('alert').textContent).toBe('거짓 정보만 전달할 수 있습니다');
  expect(screen.getByRole('alert').className).toBe('snvInformationInputTruthWarning');
  expect((screen.getByRole('button',{name:'거짓 정보 공개'}) as HTMLButtonElement).disabled).toBe(true);
  const falseNumber=prompt.numberChoices.find(c=>c.value!==truth)!.value;
  fireEvent.change(input,{target:{value:String(falseNumber)}});
  expect(screen.queryByRole('alert')).toBeNull();
  expect((screen.getByRole('button',{name:'거짓 정보 공개'}) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.change(input,{target:{value:'99999'}});
  expect(screen.getByRole('alert').textContent).toBe('입력할 수 있는 정수 범위를 벗어났습니다.');
 }finally{app.dispose();}
});

import {numericInputFeedback} from '../src/custom/grimoire/numericInputDraft';
import type {InformationPrompt} from '../src/custom/core/types';
it('numeric range constraints distinguish forbidden truth, invalid integers, and ordinary impairment',()=>{
 const prompt={numberConstraint:{min:0,max:15,excludedValues:[2]},computedResult:{kind:'number',value:2},activeReasons:[{type:'vortox'}],numberChoices:[]} as unknown as InformationPrompt;
 expect(numericInputFeedback(prompt,[],'2')).toEqual({truthWarning:true,error:'거짓 정보만 전달할 수 있습니다'});
 for(const value of ['','0','12'])expect(numericInputFeedback(prompt,[],value).error).toBeUndefined();
 expect(numericInputFeedback(prompt,[],'16')).toEqual({truthWarning:false,error:'입력할 수 있는 정수 범위를 벗어났습니다.'});
 expect(numericInputFeedback(prompt,[],'1.5')).toEqual({truthWarning:false,error:'0 이상의 정수를 입력하세요.'});
 prompt.numberConstraint!.excludedValues=[];prompt.activeReasons=[];
 expect(numericInputFeedback(prompt,[],'2').error).toBeUndefined();
});
