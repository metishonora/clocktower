// Canonical review games produced exclusively by the production WASM command API.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import * as wasm from '../web/src/generated/clocktower_custom_wasm/clocktower_custom_wasm.js';
wasm.initSync({module:readFileSync(new URL('../web/src/generated/clocktower_custom_wasm/clocktower_custom_wasm_bg.wasm',import.meta.url))});
const unwrap=raw=>{const r=JSON.parse(raw);if(!r.ok)throw Error(JSON.stringify(r));return r.value;};
const replay=g=>unwrap(wasm.replay(JSON.stringify(g)));
function command(g,type,payload){const proposal=unwrap(wasm.propose(JSON.stringify(g),JSON.stringify({type,payload:{...payload,...(type==='createGame'?{}:{expectedEventCount:g.game.events.length})}})));g.game.events.push(proposal.event);replay(g);return proposal.event;}
function day(g,input){command(g,'confirmDay',{stepId:replay(g).day.stepId,input});}
const names=['서연','민준','지우','하윤','도현','수빈','예린','시우','유나'];
const root=new URL('../fixtures/acceptance/custom-golem/',import.meta.url);mkdirSync(root,{recursive:true});
for(const scene of ['normal','recluse','poisoned','sweetheart','spent','dead']){
 const target=scene==='recluse'?'recluse':scene==='sweetheart'?'sweetheart':'saint';
 const roster=['golem',target,'mayor','soldier','poisoner','imp','virgin','slayer','artist'];
 const pool=[...new Set([...roster,'recluse','undertaker','ravenkeeper','monk'])];
 const definition={id:`golem-${scene}`,name:`골렘 · ${scene}`,characterIds:pool};
 definition.firstNightOrder=unwrap(wasm.custom_first_night_plan(JSON.stringify({customDefinition:definition}))).plan;
 definition.otherNightOrder=unwrap(wasm.custom_other_night_plan(JSON.stringify({customDefinition:definition}))).plan;
 const g={schemaVersion:5,game:{id:`golem-${scene}`,name:'골렘 검토',script:{type:'custom',definition},createdAt:'2026-10-09T00:00:00Z',updatedAt:'2026-10-09T00:00:00Z',events:[]}};
 command(g,'createGame',{players:roster.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:names[i],actualCharacter}))});
 for(let n=0;n<40&&replay(g).phase!=='day';n++){
  const step=replay(g).currentStep,action=step.actionRef.actionId;
  const input=action==='demonInfo'?{characterIds:step.requiredInput.allowedCharacterIds.slice(0,3)}:action==='choosePoisonTarget'?{playerIds:[scene==='poisoned'?'p1':'p4']}:null;
  command(g,'confirmStep',{stepId:step.id,input});
 }
 for(let i=0;i<3;i++)day(g,{kind:'advance'});
 if(scene==='spent'){day(g,{kind:'nominate',nominatorId:'p1',nomineeId:'p6'});day(g,{kind:'vote',voterIds:[]});}
 if(scene==='dead'){
  day(g,{kind:'nominate',nominatorId:'p3',nomineeId:'p9'});day(g,{kind:'vote',voterIds:['p1','p2','p3','p4','p5']});day(g,{kind:'closeNominations'});day(g,{kind:'confirmExecution'});day(g,{kind:'confirmDeath'});day(g,{kind:'beginNight'});
  for(let n=0;n<40&&replay(g).phase!=='day';n++){
   const step=replay(g).currentStep,action=step.actionRef.actionId;
   const input=action==='attackPlayer'?{playerIds:['p2']}:action==='choosePoisonTarget'?{playerIds:['p4']}:null;
   command(g,'confirmStep',{stepId:step.id,input});
  }
  for(let i=0;i<3;i++)day(g,{kind:'advance'});
 }
 writeFileSync(new URL(`${scene}.game.json`,root),JSON.stringify(g,null,2)+'\n');
 console.log(`${scene}: ${g.game.events.length} confirmed events`);
}
