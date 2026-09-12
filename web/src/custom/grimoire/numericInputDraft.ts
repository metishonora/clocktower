import type {InformationPrompt} from '../core/types';
import type {InformationChoice} from './stepInputModel';
import type {CurrentInputDraft} from './firstNightController';
/** Both Core numeric contracts feed the same draft. Values and exclusions remain Core-owned. */
export function numericInputDraft(prompt:InformationPrompt,choices:readonly InformationChoice[],text:string):Pick<CurrentInputDraft,'numberText'|'choiceIndex'|'judgments'|'delivery'> {
 const value=Number(text),integer=/^\d+$/.test(text)&&Number.isSafeInteger(value);
 const constraint=prompt.numberConstraint;
 if(constraint){
  const valid=integer&&value>=constraint.min&&value<=constraint.max&&!constraint.excludedValues.includes(value);
  return {numberText:text,choiceIndex:'',judgments:[],delivery:valid?{kind:'number',value}:undefined};
 }
 const index=integer?choices.findIndex(c=>c.result.kind==='number'&&c.result.value===value):-1;
 return {numberText:text,choiceIndex:index<0?'':String(index),judgments:index<0?[]:choices[index].registrationJudgments,delivery:undefined};
}
