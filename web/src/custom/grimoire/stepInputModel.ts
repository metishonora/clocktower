import type { InformationResult, PhaseStep, PhaseStepConfirmation, RegistrationJudgment } from '../core/types.js';
export type InformationChoice = { result: InformationResult; registrationJudgments: RegistrationJudgment[]; isComputed: boolean };
export function informationChoices(step: PhaseStep, playerIds: string[]): InformationChoice[] {
  const prompt = step.informationPrompt;
  if (!prompt) return [];
  const check = prompt.targetChecks?.find(check => check.targetPlayerIds.length === playerIds.length && check.targetPlayerIds.every(id => playerIds.includes(id)));
  if (check) return check.choices;
  if (prompt.targetChecks?.length) return [];
  if (prompt.numberChoices.length) return prompt.numberChoices.map(choice => ({ ...choice, result: { kind: 'number', value: choice.value } }));
  if (prompt.booleanChoices?.length) return prompt.booleanChoices.map(choice => ({ ...choice, result: { kind: 'boolean', value: choice.value } }));
  return prompt.computedResult ? [{ result: prompt.computedResult, registrationJudgments: [], isComputed: true }] : [];
}
export type StepSelection = { playerIds: string[]; characterIds: string[]; correctPlayerId: string; zero: boolean; execute: boolean; choice?: InformationChoice; registrationJudgments: RegistrationJudgment[]; deliveredResult?: InformationResult };
export function stepConfirmation(step: PhaseStep, selection: StepSelection, skip = false): PhaseStepConfirmation {
  const { playerIds, characterIds, correctPlayerId, zero, execute } = selection;
  let input: PhaseStepConfirmation['input'] = null;
  if (!skip) switch (step.requiredInput.kind) {
    case 'playerIds': input = { playerIds }; break;
    case 'characterIds': input = { characterIds }; break;
    case 'setupInfo': input = zero ? { zeroOutsiders: true } : { playerIds, characterId: characterIds[0], correctPlayerId: correctPlayerId || undefined }; break;
    case 'madnessAssignment': input = { playerIds, characterId: characterIds[0] }; break;
    case 'characterTransformation': input = { playerIds, characterIds }; break;
    case 'executionDecision': input = { execute }; break;
  }
  return { input, ...(!skip && selection.choice ? { deliveredResult: selection.choice.result, registrationJudgments: selection.choice.registrationJudgments } : {}),
    ...(!skip && selection.deliveredResult ? { deliveredResult: selection.deliveredResult } : {}),
    ...(!skip && selection.registrationJudgments.length ? { registrationJudgments: selection.registrationJudgments } : {}) };
}

export type SetupChoice=NonNullable<PhaseStep['requiredInput']['setupInformationChoices']>[number];
export type SetupDraft={playerIds:string[];characterIds:string[];correct:string;zero:boolean;judgments:RegistrationJudgment[]};
/** Whether this partial selection extends a Core-projected legal information pair. */
export function setupSelectionCanComplete(step:PhaseStep,playerIds:string[]):boolean {
 return new Set(playerIds).size===playerIds.length && (step.requiredInput.setupInformationChoices??[]).some(c=>{
  const info=c.preparation.information;
  return info.kind==='setupInfo'&&!info.zeroOutsiders&&playerIds.every(id=>info.playerIds.includes(id));
 });
}
export function setupChoices(step:PhaseStep,draft:SetupDraft,withRole=true):SetupChoice[] {
 return (step.requiredInput.setupInformationChoices ?? []).filter(c=>{
  const info=c.preparation.information;
  return info.kind==='setupInfo' && (draft.zero?info.zeroOutsiders:!info.zeroOutsiders &&
   info.playerIds.length===draft.playerIds.length&&info.playerIds.every(id=>draft.playerIds.includes(id))&&
   (!withRole||info.characterId===draft.characterIds[0]));
 });
}
export function normalizeSetupDraft<T extends SetupDraft>(step:PhaseStep,draft:T):T {
 if(step.requiredInput.kind!=='setupInfo')return draft;
 let candidates=setupChoices(step,draft);
 const exact=candidates.filter(c=>judgmentsEqual(c.registrationJudgments,draft.judgments));
 if(exact.length)candidates=exact;
 const correct=[...new Set(candidates.map(c=>c.preparation.correctPlayerId ?? ''))];
 const normalizedCorrect=correct.includes(draft.correct)?draft.correct:correct.length===1?correct[0]:'';
 const byCorrect=candidates.filter(c=>!normalizedCorrect||c.preparation.correctPlayerId===normalizedCorrect);
 const judgments=[...new Map(byCorrect.map(c=>[JSON.stringify(c.registrationJudgments),c.registrationJudgments])).values()];
 return {...draft,correct:normalizedCorrect,judgments:judgments.length===1?judgments[0]:draft.judgments};
}
export function selectedSetupChoice(step:PhaseStep,draft:SetupDraft):SetupChoice|undefined {
 return setupChoices(step,draft).find(c=>(c.preparation.correctPlayerId ?? '')===draft.correct&&judgmentsEqual(c.registrationJudgments,draft.judgments));
}

export function judgmentsEqual(a:RegistrationJudgment[],b:RegistrationJudgment[]):boolean {
 return JSON.stringify(a.map(j=>JSON.stringify(j)).sort())===JSON.stringify(b.map(j=>JSON.stringify(j)).sort());
}
