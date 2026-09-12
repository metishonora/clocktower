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
