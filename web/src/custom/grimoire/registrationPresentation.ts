import {characterPresentation} from '../authoring/characterPresentation';
import type {PhaseStep,ReplayState} from '../core/types';
import type {CurrentInputDraft} from './firstNightController';
import {informationChoices} from './stepInputModel';
export type RegistrationSelections=Record<string,'good'|'evil'|'demon'|'notDemon'|'townsfolk'|'outsider'|'minion'>;
/** Map existing Core choices to the original TB control granularity. No result is calculated here. */
export function registrationPresentation(step:PhaseStep|undefined,replay:ReplayState,draft:CurrentInputDraft) {
 const impaired=step?.informationPrompt?.activeReasons.some(r=>['drunk','poisoned','vortox'].includes(r.type));
 const kind=!impaired&&step?.informationPrompt?['chef','empath','seamstress'].includes(step.character??'')?'team':step.character==='fortuneTeller'?'demon':step.character==='clockmaker'?'kind':undefined:undefined;
 const all=step?informationChoices(step,draft.playerIds):[];
 const choices=all.filter(c=>c.registrationJudgments.every(j=>!j.scope&&(kind==='team'?['good','evil'].includes(j.registeredAs):kind==='kind'?['townsfolk','outsider','minion','demon'].includes(j.registeredAs):j.registeredAs==='demon')));
 const ids=kind?[...new Set(choices.flatMap(c=>c.registrationJudgments.map(j=>j.playerId)))]:[];
 const candidates=ids.flatMap(id=>{const player=replay.players.find(p=>p.id===id);return player?[player]:[];});
 const complete=candidates.every(p=>draft.treatments[p.id]!==undefined);
 const choice=kind&&complete?choices.find(c=>candidates.every(p=>{
  const judgment=c.registrationJudgments.find(j=>j.playerId===p.id);
  return kind==='team'?(judgment?.registeredAs??p.alignment)===draft.treatments[p.id]
   :kind==='kind'?(judgment?.registeredAs??characterPresentation(p.actualCharacter)?.kind.toLowerCase())===draft.treatments[p.id]
   : (judgment?.registeredAs==='demon')===(draft.treatments[p.id]==='demon');
 })):undefined;
 return {kind,candidates,choices,choice,index:choice?all.indexOf(choice):-1,ready:!kind||!!choice};
}
