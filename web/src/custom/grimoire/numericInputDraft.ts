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

/** Explain why the Core-owned numeric contract rejected the entered value. */
export function numericInputFeedback(prompt:InformationPrompt,choices:readonly InformationChoice[],text:string) {
 const draft=numericInputDraft(prompt,choices,text);
 if(text===''||draft.delivery||draft.choiceIndex!=='')return {error:undefined,truthWarning:false};
 const value=Number(text),integer=/^\d+$/.test(text)&&Number.isSafeInteger(value);
 const truthWarning=integer&&(prompt.numberConstraint?.excludedValues.includes(value)??
   (prompt.activeReasons.some(reason=>reason.type==='vortox')&&prompt.computedResult?.kind==='number'&&prompt.computedResult.value===value));
 return {truthWarning,error:truthWarning?'거짓 정보만 전달할 수 있습니다':!/^\d+$/.test(text)?'0 이상의 정수를 입력하세요.':'입력할 수 있는 정수 범위를 벗어났습니다.'};
}
