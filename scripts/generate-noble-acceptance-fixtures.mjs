import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {initSync,propose,replay,custom_first_night_plan,custom_other_night_plan} from '../web/src/generated/clocktower_custom_wasm/clocktower_custom_wasm.js';

initSync({module:readFileSync(new URL('../web/src/generated/clocktower_custom_wasm/clocktower_custom_wasm_bg.wasm',import.meta.url))});
const unwrap=json=>{const result=JSON.parse(json);if(!result.ok)throw Error(JSON.stringify(result.error));return result.value;};
const directory=new URL('../fixtures/acceptance/noble/',import.meta.url);
mkdirSync(directory,{recursive:true});
const labels={normal:'정상',recluse:'은둔자 취급',spy:'첩자 취급',poisoned:'중독',vortox:'보르톡스'};
for(const mode of Object.keys(labels)){
 const roster=['recluse','spy'].includes(mode)?['noble','recluse','artist','savant','soldier','mayor','spy','imp']:['noble','artist','soldier','poisoner',mode==='vortox'?'vortox':'imp'];
 const definition={id:`noble-${mode}`,name:`귀족 · ${labels[mode]}`,characterIds:[...new Set([...roster,'mayor','virgin','saint','chef','empath'])]};
 definition.firstNightOrder=unwrap(custom_first_night_plan(JSON.stringify({customDefinition:definition}))).plan;
 definition.otherNightOrder=unwrap(custom_other_night_plan(JSON.stringify({customDefinition:definition}))).plan;
 const game={schemaVersion:5,game:{id:definition.id,name:definition.name,script:{type:'custom',definition},createdAt:'2026-10-09T00:00:00Z',updatedAt:'2026-10-09T00:00:00Z',events:[]}};
 const append=command=>game.game.events.push(unwrap(propose(JSON.stringify(game),JSON.stringify(command))).event);
 append({type:'createGame',payload:{players:roster.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:['민지','도현','유나','도윤','서윤','하린','서준','지우'][i],actualCharacter}))}});
 for(let i=0;i<10;i++){
  const state=unwrap(replay(JSON.stringify(game))),step=state.currentStep;
  if(step?.character==='noble')break;
  if(!step)throw Error('Noble step missing');
  const input=step.actionRef.actionId==='demonInfo'?{characterIds:step.requiredInput.allowedCharacterIds.slice(0,3)}:step.character==='poisoner'?{playerIds:[mode==='poisoned'?'p1':'p2']}:null;
  append({type:'confirmStep',payload:{stepId:step.id,expectedEventCount:game.game.events.length,input}});
 }
 if(unwrap(replay(JSON.stringify(game))).currentStep?.character!=='noble')throw Error('Noble checkpoint missing');
 writeFileSync(new URL(`${mode}.game.json`,directory),`${JSON.stringify(game,null,2)}\n`);
}
