import './styles/informationTask.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
export function InformationInputPresentation({label,children,className=''}:{label:ReactNode;children:ReactNode;className?:string}) {
 return <dl className={`snvInformationValues ${className}`}><div><dt>{label}</dt><dd>{children}</dd></div></dl>;
}
export function InformationNumberInput({value,text,onTextChange,min,max,excludedValues,disabled,onChange}:{value?:number;text?:string;onTextChange?:(text:string)=>void;min:number;max:number;excludedValues:readonly number[];disabled:boolean;onChange:(value:number|undefined)=>void}) {
 const [localText,setLocalText]=useState(String(value ?? ''));
 const emitted=useRef(value);
 useEffect(()=>{if(value!==emitted.current){setLocalText(String(value ?? ''));emitted.current=value;}},[value]);
 return <input type="text" role="spinbutton" aria-label="전달할 숫자" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} inputMode="numeric" value={text ?? localText} disabled={disabled} onChange={e=>{
  const raw=e.target.value;
  const number=Number(raw);
  const valid=/^\d+$/.test(raw)&&Number.isSafeInteger(number)&&number>=min&&number<=max&&!excludedValues.includes(number)?number:undefined;
  emitted.current=valid;setLocalText(raw);onTextChange?.(raw);onChange(valid);
 }}/>;
}

export function CharacterAbilityInput({value,options,disabled,onChange,label='능력',ariaLabel='얻을 선한 캐릭터 능력'}:{value:string;options:readonly {id:string;label:string}[];disabled:boolean;onChange:(id:string)=>void;label?:string;ariaLabel?:string}) {return <label className="issue107AbilitySelect"><span>{label}</span><select aria-label={ariaLabel} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">선택</option>{options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>;}

export function SetupInformationInput({value,options,zeroAllowed,disabled,onChange}:{value:string;options:readonly {id:string;label:string}[];zeroAllowed:boolean;disabled:boolean;onChange:(id:string)=>void}) {
 return <InformationInputPresentation className="tbSetupInformationEditor" label="보여줄 캐릭터"><select aria-label="보여줄 캐릭터" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">플레이어 2명 선택</option>{options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}{zeroAllowed&&<option value="__zero_outsiders__">외지인 없음</option>}</select></InformationInputPresentation>;
}
export function InformationTreatmentInput({label,options,value,disabled,onChange,className='tbScalarTreatment'}:{label:string;options:readonly {id:string;label:string;accessibleLabel?:string;className?:string}[];value?:string;disabled:boolean;onChange:(id:string)=>void;className?:string}) {
 return <fieldset className={className}><legend>{label}</legend>{options.map(option=><button type="button" key={option.id} className={`${option.className ?? ''}${value===option.id?' selected':''}`} aria-label={option.accessibleLabel} aria-pressed={value===option.id} disabled={disabled} onClick={()=>onChange(option.id)}>{option.label}</button>)}</fieldset>;
}
