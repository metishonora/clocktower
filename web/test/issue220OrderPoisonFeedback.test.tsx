import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {resume} from './custom/issue220T10TestSupport';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import type {GameFile,PhaseStepInput} from '../src/custom/core/types';
afterEach(cleanup);
const fixture=()=>JSON.parse(readFileSync(resolve('../fixtures/acceptance/custom-first-night/issue220/test0912-game-2.json'),'utf8')) as GameFile;
it('saved setup overview follows scenario order from minion information, not prerequisite insertion',async()=>{
 const app=await resume(fixture());try{
 const p=app.play!;expect(p.step?.actionRef?.actionId).toBe('minionInfo');
 render(<CustomGrimoirePlay controller={p} onNewGame={()=>{}} onImport={()=>{}}/>);
 const labels=within(screen.getByRole('list',{name:'진행 순서'})).getAllByRole('listitem').map(r=>r.querySelector('strong')?.textContent);
 expect(labels).toEqual(['하수인','악마','독살범','세탁부','사서','요리사','첩자','낮 시작']);
 }finally{app.dispose();}
});
it('reported game reaches poisoned Chef with original numeric editor and disclosure state',async()=>{
 let file=fixture();
 for(let i=0;i<10;i++){
  const app=await resume(file);try{
   const p=app.play!,s=p.step!;
   if(s.character==='chef'){
    render(<CustomGrimoirePlay controller={p} onNewGame={()=>{}} onImport={()=>{}}/>);
    expect(screen.getByRole('spinbutton',{name:'전달할 숫자'})).toBeDefined();
    expect(screen.getByRole('button',{name:'중독 정보 공개'}).className).toContain('poisoned');
    expect(file.game.events.map(e=>e.type)).toEqual(JSON.parse(readFileSync(resolve('../fixtures/acceptance/custom-first-night/issue220/test0912-game-2-chef.json'),'utf8')).game.events.map((e:{type:string})=>e.type));return;
   }
   let input:PhaseStepInput=null;let registrationJudgments;
   if(s.actionRef?.actionId==='demonInfo')input={characterIds:['empath','fortuneTeller','investigator']};
   if(s.actionRef?.actionId==='choosePoisonTarget')input={playerIds:['player-10']};
   if(s.requiredInput.kind==='setupInfo'){
    const c=s.requiredInput.setupInformationChoices![0],v=c.preparation.information;
    if(v.kind!=='setupInfo')throw Error('setup');
    input=v.zeroOutsiders?{zeroOutsiders:true}:{playerIds:v.playerIds,characterId:v.characterId,correctPlayerId:c.preparation.correctPlayerId??undefined};registrationJudgments=c.registrationJudgments;
   }
   const result=await p.session.execute({type:'confirmStep',payload:{stepId:s.id,input,...(registrationJudgments?{registrationJudgments}:{})}});
   expect(result.ok,JSON.stringify({action:s.actionRef,input,result})).toBe(true);if(result.ok)await result.value.autosave;
   file=p.session.snapshot.canonical;
  }finally{app.dispose();}
 }
 throw Error('Chef not reached');
});
