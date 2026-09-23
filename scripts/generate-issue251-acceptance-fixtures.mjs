import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {initSync,propose,replay,custom_first_night_plan,custom_other_night_plan} from '../web/src/generated/clocktower_custom_wasm/clocktower_custom_wasm.js';

initSync({module:readFileSync(new URL('../web/src/generated/clocktower_custom_wasm/clocktower_custom_wasm_bg.wasm',import.meta.url))});
const unwrap=s=>{const r=JSON.parse(s);if(!r.ok)throw Error(JSON.stringify(r.error));return r.value;};
const directory=new URL('../fixtures/acceptance/issue251/',import.meta.url);
mkdirSync(directory,{recursive:true});
for(const mode of ['preacher','chambermaid','chambermaid-poisoned','chambermaid-vortox']){
 const characterIds=['preacher','chambermaid','mathematician','nightwatchman','artist','savant','poisoner','imp','vortox','soldier','mayor','virgin'];
 const definition={id:`issue251-${mode}`,name:mode==='preacher'?'전도사 진행 확인':`객실 청소부 · ${mode==='chambermaid'?'정상':mode.endsWith('vortox')?'보르톡스':'중독'}`,characterIds};
 definition.firstNightOrder=unwrap(custom_first_night_plan(JSON.stringify({customDefinition:definition}))).plan;
 definition.otherNightOrder=unwrap(custom_other_night_plan(JSON.stringify({customDefinition:definition}))).plan;
 const game={schemaVersion:5,game:{id:definition.id,name:definition.name,script:{type:'custom',definition},createdAt:'2026-09-23T00:00:00Z',updatedAt:'2026-09-23T00:00:00Z',events:[]}};
 const append=command=>game.game.events.push(unwrap(propose(JSON.stringify(game),JSON.stringify(command))).event);
 const roster=[mode==='preacher'?'preacher':'nightwatchman','chambermaid','mathematician','artist','savant','poisoner',mode.endsWith('vortox')?'vortox':'imp'];
 append({type:'createGame',payload:{players:roster.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:['민지','태오','서윤','도현','지우','하린','서준'][i],actualCharacter}))}});
 if(mode!=='preacher'){
  for(let i=0;i<10;i++){
   const state=unwrap(replay(JSON.stringify(game))),step=state.currentStep;
   if(step.character==='chambermaid')break;
   const input=step.actionRef.actionId==='demonInfo'?{characterIds:['soldier','mayor','virgin']}:step.character==='poisoner'?{playerIds:[mode==='chambermaid-poisoned'?'p2':'p5']}:null;
   append({type:'confirmStep',payload:{stepId:step.id,expectedEventCount:game.game.events.length,input}});
  }
  if(unwrap(replay(JSON.stringify(game))).currentStep.character!=='chambermaid')throw Error('Chambermaid checkpoint missing');
 }
 writeFileSync(new URL(`${mode}.game.json`,directory),`${JSON.stringify(game,null,2)}\n`);
}
