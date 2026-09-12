import type {PhaseStep,RevealPayload} from '../../custom/core/types';
import {systemActions} from './system';
import {troubleBrewingActions} from './troubleBrewing';
import {sectsAndVioletsActions} from './sectsAndViolets';
export type ActionAdapter={
 selectionLabel?:string;
 stage:'preparation'|'action'|'delivery'|'transition';
 inputView:'team'|'setup'|'ability'|'players'|'madness'|'execution'|'information'|'none';
 acceptedInputs:readonly string[];
 selectionContract:'none'|'direct'|'information'|'setup';
 completionContract:{afterSelection:'confirm'|'edit';continuationEntry:'select'|'prepare'|'edit'};
 revealView:'team'|'tb'|'snv'|'identity'|'twin'|'madness'|'spy'|'none';
 revealOpen:'preview'|'notification'|'result';
 closeDestination:'board'|'progress';
 cancellation:'discardInput';
};
export const actionAdapters:Readonly<Record<string,ActionAdapter>>=Object.freeze({...systemActions,...troubleBrewingActions,...sectsAndVioletsActions});
export function actionAdapter(step:PhaseStep):ActionAdapter|undefined {
 const ref=step.actionRef;return ref?actionAdapters[`${ref.kind==='system'?'system':ref.characterId}.${ref.actionId}`]:undefined;
}
export function revealDisposition(adapter:ActionAdapter,payload:RevealPayload|undefined) {
 if(!payload)return 'none';
 const allowed:Record<ActionAdapter['revealView'],readonly string[]>={
  team:['minionInformation','demonInformation'],tb:['setupInformation','numericInformation','fortuneTellerInformation'],
  snv:['numericInformation','dreamerInformation','seamstressInformation'],identity:['characterChange'],
  twin:['evilTwinPair'],madness:['madnessAssignment'],spy:['spyGrimoire'],none:['mutantExecution'],
 };
 if(!('kind' in payload)||!allowed[adapter.revealView].includes(payload.kind))throw Error('이 행동의 공개 연결을 확인할 수 없습니다.');
 return adapter.revealOpen;
}
