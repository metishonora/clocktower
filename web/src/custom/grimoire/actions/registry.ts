import type {PhaseStep,RevealPayload} from '../../core/types';
import {systemActions} from './system';
import {troubleBrewingActions} from './troubleBrewing';
import {sectsAndVioletsActions} from './sectsAndViolets';
import {carouselActions} from './carousel';
export type ActionAdapter={
 emptySelection?:{label:string};
 confirmSelectionLabel?:string;
 resultReview?:'attack'|'selection'|'changedIdentity'|'unchangedIdentity';
 selectionLabel?:string;
 stage:'preparation'|'action'|'delivery'|'transition';
 inputView:'team'|'setup'|'ability'|'players'|'madness'|'execution'|'information'|'none';
 acceptedInputs:readonly string[];
 selectionContract:'none'|'direct'|'information'|'setup';
 completionContract:{afterSelection:'confirm'|'edit';continuationEntry:'select'|'prepare'|'edit'};
 revealView:'team'|'tb'|'snv'|'identity'|'twin'|'madness'|'spy'|'none'|'learnedCharacter'|'learnedPlayer';
 revealOpen:'preview'|'notification'|'result';
 closeDestination:'board'|'progress';
 cancellation:'discardInput';
};
export const actionAdapters:Readonly<Record<string,ActionAdapter>>=Object.freeze({...systemActions,...troubleBrewingActions,...sectsAndVioletsActions,...carouselActions});
export function actionAdapter(step:Pick<PhaseStep,'actionRef'>):ActionAdapter|undefined {
 const ref=step.actionRef;return ref?actionAdapters[`${ref.kind==='system'?'system':ref.characterId}.${ref.actionId}`]:undefined;
}
export function revealDisposition(adapter:ActionAdapter,payload:RevealPayload|undefined) {
 if(!payload)return 'none';
 const allowed:Record<ActionAdapter['revealView'],readonly string[]>={
  team:['minionInformation','demonInformation'],tb:['setupInformation','numericInformation','fortuneTellerInformation','characterInformation'],
  learnedCharacter:['learnedCharacter'],
  learnedPlayer:['learnedPlayer'],
  snv:['numericInformation','dreamerInformation','seamstressInformation','booleanInformation','sageInformation'],identity:['characterChange'],
  twin:['evilTwinPair'],madness:['madnessAssignment'],spy:['spyGrimoire'],none:['mutantExecution'],
 };
 if(!('kind' in payload)||!allowed[adapter.revealView].includes(payload.kind))throw Error('이 행동의 공개 연결을 확인할 수 없습니다.');
 return adapter.revealOpen;
}
