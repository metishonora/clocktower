import {SetupAdjustment} from '../shared-ui/SetupAdjustment';
import type {SetupAdjustment as Adjustment} from '../custom/core/types';
import {characterPresentation} from '../custom/authoring/characterPresentation';
const signed=(n:number)=>n>0?`+${n}`:n<0?`−${-n}`:'0';
export function CustomSetupAdjustment({value,compact=false}:{value?:Adjustment;compact?:boolean}){
 if(!value?.modifiers.length)return null;
 return <div className={compact?'customCompactAdjustments':'bmrSetupChoiceReveal visible'}><div>{value.modifiers.map(m=><SetupAdjustment key={m.characterId} title={`${characterPresentation(m.characterId)?.label??m.characterId} 보정`} compact={compact}>
  <div className="bmrSetupChoiceOptions"><div className="bmrSetupAdjustmentValue applied"><strong>외지인 {signed(m.delta.Outsider)}</strong>{!compact&&<span>주민 {signed(m.delta.Townsfolk)}</span>}</div></div>
 </SetupAdjustment>)}{value.limited&&<p className="bmrSetupAdjustmentLimit">인원 한계 적용 · 실제 외지인 {signed(value.appliedDelta.Outsider)} · 주민 {signed(value.appliedDelta.Townsfolk)}</p>}</div></div>;
}
