import type {CustomActionResult,GameEvent,PhaseStep} from '../core/types';
import {actionAdapter} from './actions/registry';
export type HandoffStep = Pick<PhaseStep,'id'|'actionRef'|'character'|'abilityUse'|'playerId'> & Partial<Pick<PhaseStep,'requiredInput'>>;
/** A Storyteller checkpoint consumes the confirmed result, never a player reveal. */
export function reviewedAction(event:GameEvent|undefined) {
 if(event?.type!=='customActionConfirmed')return undefined;
 const {result,actionRef,abilityUse,simulationSource,stepId}=event.payload;
 const policy=actionAdapter({actionRef})?.resultReview;
 const review=policy==='attack'&&result.kind==='nightAttack'
  ||policy==='selection'
  ||policy==='changedIdentity'&&((result.kind==='pitHagChange'&&result.changed)||(result.kind==='barberSwap'&&result.effective&&result.playerIds.length>0))
  ||policy==='unchangedIdentity'&&result.kind==='snakeCharmer'&&result.outcome!=='swapped';
 if(!review)return undefined;
 const step:HandoffStep={id:stepId,actionRef,character:actionRef.kind==='character'?actionRef.characterId:undefined,abilityUse,playerId:abilityUse?.ownerPlayerId??simulationSource?.sourceAbilityUse.ownerPlayerId};
 const input=event.payload.input;
 return {step,result,playerIds:input&&'playerIds' in input?input.playerIds??[]:[]};
}
export function actionResultRows(result:CustomActionResult,person:(id:string)=>string,role:(id:string)=>string, pendingNightDeath=false) {
 switch(result.kind){
 case 'nightDeathsResolved':return result.playerIds.length?result.playerIds.map(id=>({label:'사망',value:person(id)})):[{label:'결과',value:'사망 없음'}];
 case 'nightAttack':return [{label:'공격 대상',value:person(result.targetPlayerId)},{label:'결과',value:result.killedPlayerId?`${person(result.killedPlayerId)} 사망`:pendingNightDeath?'사망 결정 대기':'사망 없음'}];
 case 'witch':return [{label:'저주 대상',value:person(result.targetPlayerId)}];
 case 'snakeCharmer':return [{label:'선택 대상',value:person(result.targetPlayerId)},{label:'결과',value:'교환 없음'}];
 case 'pitHagChange':return [{label:'변경 대상',value:person(result.targetPlayerId)},{label:'직업',value:role(result.characterId)}];
 case 'barberSwap':return [{label:'교환 대상',value:result.playerIds.map(person).join(' · ')}];
 default:return [];
 }
}
