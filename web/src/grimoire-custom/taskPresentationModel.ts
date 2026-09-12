import {actionAdapter} from './actions/registry';
import {registrationPresentation} from '../custom/grimoire/registrationPresentation';
import type { FirstNightController } from '../custom/grimoire/firstNightController';
import { actionInputIdentity, actionPresentation, type TaskStage } from '../custom/grimoire/actionPresentation';
import { informationChoices, selectedSetupChoice, setupChoices } from '../custom/grimoire/stepInputModel';
import { characterPresentation } from '../custom/authoring/characterPresentation';
import type { InformationResult, RegistrationJudgment, ReplayState } from '../custom/core/types';

export type TaskEditor =
 | {kind:'unavailable';message:string}
 | {kind:'setup';characters:{id:string;label:string}[];correctPlayers:{id:string;label:string}[];zeroAllowed:boolean;ready:boolean}
 | {kind:'team';isDemon:boolean;characters:{id:string;label:string}[]}
 | {kind:'ability'|'players'|'madness'|'execution'|'information'|'none'};
export function taskPresentationModel(controller:FirstNightController) {
 const state=controller.getSnapshot(),step=controller.step,draft=state.inputDraft;
 const action=step&&actionPresentation(step);
 const adapter=step&&actionAdapter(step);
 const actor=state.replay.players.find(p=>p.id===(step?.abilityUse?.ownerPlayerId??step?.playerId));
 const ability=step&&characterPresentation(step.actionRef?.kind==='character'?step.actionRef.characterId:step.character??'');
 const cause=step?.actionCause;
 const preparationId=step?.informationFlow?.preparationEventId ?? (cause?.kind==='delivery'?cause.preparationEventId:undefined);
 const preparation=state.replay.ruleState.preparations?.find(p=>p.sourceEventId===preparationId);
 const result=preparation?.result.kind==='informationPrepared'?preparation.result.preparation.information:undefined;
 const reprepare=controller.steps.find(candidate=>candidate.requiredInput.kind==='setupInfo'&&candidate.actionRef?.kind==='character'&&candidate.actionRef.characterId===step?.character&&candidate.abilityUse?.ownerPlayerId===step?.abilityUse?.ownerPlayerId&&JSON.stringify(candidate.simulationSource)===JSON.stringify(step?.simulationSource));
 const choices=step?informationChoices(step,draft.playerIds):[];
 const check=step?.informationPrompt?.targetChecks?.find(c=>c.targetPlayerIds.length===draft.playerIds.length&&c.targetPlayerIds.every(id=>draft.playerIds.includes(id)));
 const candidates=step?setupChoices(step,draft):[];
 let editor:TaskEditor=action?{kind:action.editor==='setup'?'none':action.editor==='team'?'none':action.editor}:{kind:'unavailable',message:'이 행동의 화면 연결을 확인할 수 없습니다.'};
 if(action?.editor==='team')editor={kind:'team',isDemon:step?.actionRef?.actionId==='demonInfo',characters:(step?.requiredInput.allowedCharacterIds??[]).map(id=>({id,label:characterPresentation(id)?.label??id}))};
 if(action?.editor==='setup'&&step) {
  const projected=step.requiredInput.setupInformationChoices;
  editor=projected?{kind:'setup',
   characters:[...new Set(setupChoices(step,{...draft,zero:false},false).flatMap(c=>c.preparation.information.kind==='setupInfo'&&c.preparation.information.characterId?[c.preparation.information.characterId]:[]))].map(id=>({id,label:characterPresentation(id)?.label??id})),
   correctPlayers:[...new Set(candidates.flatMap(c=>c.preparation.correctPlayerId?[c.preparation.correctPlayerId]:[]))].map(id=>{const p=state.replay.players.find(p=>p.id===id);return{id,label:p?`${p.seat}번 ${p.name}`:id};}),
   zeroAllowed:!!step.requiredInput.zeroAllowed,ready:!!selectedSetupChoice(step,draft),
  }:{kind:'unavailable',message:'정보 준비 후보가 없습니다. Core 연결을 확인해 주세요.'};
 }
 if(action?.editor==='information'&&!step?.informationPrompt&&!result)editor={kind:'unavailable',message:'전달 정보가 연결되지 않았습니다.'};
 if(step&&action) {
  const kind=step.requiredInput.kind;
  const expected=adapter?.acceptedInputs??[];
  if(!expected.includes(kind)||(['characterIds','madnessAssignment'].includes(kind)&&!step.requiredInput.allowedCharacterIds)) {
   editor={kind:'unavailable',message:'이 행동의 입력 연결을 확인할 수 없습니다.'};
  }
 }
 const stage:TaskStage=!step?'end':cause?.kind==='requiredPreparation'||cause?.kind==='initialPreparation'?'preparation':cause?.kind==='delivery'?'delivery':action?.stage??'action';
 const needsPlayers=!!adapter&&adapter.selectionContract!=='none'&&!draft.zero;
 const minPlayers=step?.requiredInput.minSelections??(editor.kind==='setup'?2:1);
 const maxPlayers=step?.requiredInput.maxSelections??(editor.kind==='setup'?2:1);
 const registration=registrationPresentation(step,state.replay,draft);
 const choice=registration.kind?registration.choice:draft.choiceIndex!==''?choices[Number(draft.choiceIndex)]:choices.length===1||choices[0]?.result.kind==='characterPair'?choices[0]:undefined;
 const registrationChoices=editor.kind==='setup'?candidates.map(c=>c.registrationJudgments):choices.map(c=>c.registrationJudgments);
 return {identity:actionInputIdentity(state.file,step),actor,ability,stage,editor,result,reprepareId:reprepare?.id,warnings:editor.kind==='unavailable'?[editor.message]:[],
  actions:{confirmLabel:stage==='delivery'?'정보 공개':stage==='transition'?'낮 시작':'확인',skip:!!step&&(step.canSkip||step.requiredInput.optional)},
  selection:{needsPlayers,minPlayers,maxPlayers},choices,choice,fixedCharacterId:check?.fixedCharacterId,
  treatments:treatmentGroups(registrationChoices,draft.judgments,state.replay.players),
 };
}
function treatmentGroups(variants:RegistrationJudgment[][],selected:RegistrationJudgment[],players:ReplayState['players']) {
 const key=(j:RegistrationJudgment)=>`${j.playerId}:${JSON.stringify(j.scope??null)}`;
 const keys=[...new Set(variants.flatMap(js=>js.map(key)))];
 return keys.map(group=>{
  const judgments=[...new Map(variants.flatMap(js=>js.filter(j=>key(j)===group)).map(j=>[JSON.stringify(j),j])).values()];
  const example=judgments[0],player=players.find(p=>p.id===example.playerId);
  const current=selected.find(j=>key(j)===group);
  const actualAllowed=variants.some(js=>!js.some(j=>key(j)===group));
  const scope=example.scope?.kind==='adjacentPair'?` · ${example.scope.playerIds.map(id=>players.find(p=>p.id===id)?.seat).join('–')}번`:'';
  const role=player?characterPresentation(player.actualCharacter):undefined;
  const actualLabel=judgments.some(j=>['good','evil'].includes(j.registeredAs))?(player?.alignment==='evil'?'악':'선'):({Townsfolk:'주민',Outsider:'외지인',Minion:'하수인',Demon:'악마'} as Record<string,string>)[role?.kind??'']??role?.label??'현재 직업';
  return {key:group,label:`이번 판정의 ${role?.label??player?.name} 취급 · ${player?.seat}번${scope}`,value:current?JSON.stringify(current):'actual',
   options:[...(actualAllowed?[{id:'actual',label:actualLabel,judgment:undefined as RegistrationJudgment|undefined}]:[]),...judgments.map(j=>({id:JSON.stringify(j),label:`${({good:'선',evil:'악',townsfolk:'마을 주민',outsider:'외지인',minion:'하수인',demon:'악마'})[j.registeredAs]}${j.characterId?` · ${characterPresentation(j.characterId)?.label??j.characterId}`:''}`,judgment:j}))],
   change:(id:string)=>[...selected.filter(j=>key(j)!==group),...judgments.filter(j=>JSON.stringify(j)===id)],
  };
 });
}
export function sameInformation(a:InformationResult,b:InformationResult){return JSON.stringify(a)===JSON.stringify(b);}
