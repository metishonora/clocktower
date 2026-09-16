import type {GameEvent,GameFile} from '../core/types';
import {characterPresentation} from '../authoring/characterPresentation';
import {actionLabels} from './actionPresentation';
/** Display only; persisted event summaries, IDs, history and Undo boundaries stay unchanged. */
export function eventPresentation(file:GameFile,event:GameEvent):string {
 if(event.type==='setupConfirmed')return '직업과 좌석 확정';
 const setup=file.game.events.find(e=>e.type==='setupConfirmed');
 const players=setup?.type==='setupConfirmed'?setup.payload.players:[];
 const person=(id:string|undefined)=>{const p=players.find(p=>p.id===id);return p?`${p.seat}번 ${p.name}`:undefined;};
 if(event.type==='dayConfirmed'){
  const {input,result}=event.payload;
  if(input.kind==='nominate')return `${person(input.nominatorId)} → ${person(input.nomineeId)} · 지목`;
  if(input.kind==='vote')return `투표 확정 · ${result.countedVoterIds.length}표`;
  if(input.kind==='confirmDeath')return `${result.deathPlayerIds.map(person).join(' · ')} · 사망 확정`;
  if(input.kind==='useAbility'&&result.abilityRecord){const a=result.abilityRecord.action;return `${person(a.actorPlayerId)} · ${characterPresentation(a.characterId)?.label} · 능력 기록`;}
  return event.summary;
 }
 const payload=event.payload,ref=payload.actionRef;
 if(!ref)return '진행 확정';
 if(ref.kind==='system')return actionLabels[ref.actionId]??'진행 확정';
 const owner=payload.abilityUse?.ownerPlayerId??(event.type==='customActionConfirmed'?event.payload.simulationSource?.sourceAbilityUse.ownerPlayerId:undefined);
 const role=(id:string)=>characterPresentation(id)?.label??'직업';
 const action=actionLabels[ref.actionId]??'정보 전달';
 const input=payload.input;
 const targets=input&&'playerIds' in input?input.playerIds?.map(person).filter(Boolean).join(' · '):undefined;
 const characters=input&&'characterIds' in input?input.characterIds:input&&'characterId' in input&&input.characterId?[input.characterId]:[];
 return [person(owner),role(ref.characterId),action,targets,characters.map(role).join(' · ')].filter(Boolean).join(' · ');
}
