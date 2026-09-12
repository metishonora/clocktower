import type {GameEvent,GameFile} from '../core/types';
import {characterPresentation} from '../authoring/characterPresentation';
import {actionLabels} from './actionPresentation';
/** Display only; persisted event summaries, IDs, history and Undo boundaries stay unchanged. */
export function eventPresentation(file:GameFile,event:GameEvent):string {
 if(event.type==='setupConfirmed')return '직업과 좌석 확정';
 const setup=file.game.events.find(e=>e.type==='setupConfirmed');
 const players=setup?.type==='setupConfirmed'?setup.payload.players:[];
 const person=(id:string|undefined)=>{const p=players.find(p=>p.id===id);return p?`${p.seat}번 ${p.name}`:undefined;};
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
