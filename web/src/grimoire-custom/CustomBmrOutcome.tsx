import type {CustomActionResult,DeathOutcome,DeathExplanation,ReplayState,AbilityUseRef} from '../custom/core/types';
import {characterPresentation} from '../custom/authoring/characterPresentation';
import type {FirstNightController} from '../custom/grimoire/firstNightController';
import {CharacterAbilityInput,InformationTreatmentInput} from '../shared-ui/InformationInputPresentation';
import './customBmr.css';
export type BmrVerdict={playerId:string;label:string;tone:'death'|'alive'|'none';reason?:string};
/** Presentation-only context. Every value is read from Core projections; no rule is decided here. */
export type BmrVerdictContext={replay:ReplayState;impairments?:readonly string[];explanations?:readonly DeathExplanation[]};
const label=(id:string)=>characterPresentation(id)?.label??id;
const impairmentLabel=(kinds:readonly string[]|undefined)=>kinds?.includes('poisoned')?'중독':kinds?.includes('drunk')?'취함':undefined;
function preventionReason(o:DeathOutcome):string|undefined {
 if(!o.prevention)return undefined;
 const id=o.prevention.source.characterId;
 return `${label(id)} · ${id==='fool'?'최초 사망 방지':id==='devilsAdvocate'?'처형 보호':'보호'}`;
}
export function deathVerdict(o:DeathOutcome):BmrVerdict {return {playerId:o.playerId,label:o.died?'사망':o.prevention?'생존':'효과 없음',tone:o.died?'death':o.prevention?'alive':'none',reason:preventionReason(o)};}
/** Values come from confirmed outcomes or Core's preview; no death rules live here. */
export function CustomBmrVerdicts({items,replay}:{items:BmrVerdict[];replay:ReplayState}) {
 return <ul className="customBmrVerdicts" aria-label="예상 결과">{items.map((item,i)=>{const p=replay.players.find(p=>p.id===item.playerId);const role=p&&characterPresentation(p.actualCharacter);return <li key={`${item.playerId}:${i}`} className={`tone-${item.tone}`}><img src={role?.image} alt=""/><span><strong>{p?`${p.seat}번 ${p.name}`:item.playerId}</strong><small>{[role?.label,item.reason].filter(Boolean).join(' · ')}</small></span><em>{item.label}</em></li>;})}</ul>;
}
type ExecutionEffectView={source:AbilityUseRef;spent:boolean};
/** `applied` is Core's chosen prevention; other unspent effects stay available. */
export function CustomBmrEffects({effects,applied}:{effects:ExecutionEffectView[];applied?:AbilityUseRef|null}) {
 return <div className="customBmrAppliedList">{effects.map(e=>{const r=characterPresentation(e.source.characterId);const kept=!e.spent&&!!applied&&applied.abilityInstanceId!==e.source.abilityInstanceId;
  const what=e.source.characterId==='fool'?'최초 사망 방지':'처형 보호';
  return <span className={`customBmrApplied${e.spent?' spent':kept?' kept':''}`} key={e.source.abilityInstanceId}><img src={r?.image} alt=""/><span>{r?.label}<small>{e.spent?'사용 완료':kept?`${what} · 유지`:what}</small></span></span>;})}</div>;
}
/** Format Core's event-time reasons without inferring abilities from roles or tokens. */
function recordedReason(ctx:BmrVerdictContext|undefined,playerId:string):string|undefined {
 const values=ctx?.explanations?.filter(e=>e.playerId===playerId).map(({reason:r})=>{
  if(r.kind==='alreadyDead')return '이미 사망';
  if(r.kind==='impaired')return `${label(r.source.characterId)} ${impairmentLabel(r.impairments)??'능력 무효'}`;
  if(r.kind==='redirected')return label(r.source.characterId);
  const effect=r.source.characterId==='fool'?'최초 사망 방지':r.source.characterId==='devilsAdvocate'?'처형 보호':`${label(r.source.characterId)} 보호`;
  return r.kind==='bypassedProtection'?`${effect} 무시`:effect;
 });
 return values?.length?[...new Set(values)].join(' · '):undefined;
}
export function bmrResultVerdicts(result:CustomActionResult|undefined,actor:string|undefined,deaths:DeathOutcome[],character?:string,ctx?:BmrVerdictContext):BmrVerdict[] {
 if(!result)return [];
 const impairment=impairmentLabel(ctx?.impairments);
 // On someone else's card, say whose ability was impaired.
 const impairedFor=(playerId:string)=>impairment&&(playerId===actor||!character?impairment:`${label(character)} ${impairment}`);
 const none=(playerId:string,reason?:string):BmrVerdict=>({playerId,label:'효과 없음',tone:'none',reason});
 if(result.kind==='simulation'&&character==='gambler'&&actor)return [none(actor,impairedFor(actor))];
 if(result.kind==='gamblerGuessed')return result.deaths.length?result.deaths.map(deathVerdict):actor?[result.effective?{playerId:actor,label:'생존',tone:'alive'}:none(actor,impairedFor(actor))]:[];
 if(result.kind==='devilsAdvocateProtected')return [result.effective?{playerId:result.targetPlayerId,label:'보호',tone:'alive'}:none(result.targetPlayerId,impairedFor(result.targetPlayerId))];
 if(result.kind==='assassinUsed')return result.deaths.length?result.deaths.map(d=>d.died?{...deathVerdict(d),reason:recordedReason(ctx,d.playerId)}:deathVerdict(d)):result.targetPlayerId?[none(result.targetPlayerId,impairedFor(result.targetPlayerId))]:[];
 if(result.kind==='moonchildResolved'){
  if(result.deaths.length)return result.deaths.map(deathVerdict);
  const target=ctx?.replay.players.find(p=>p.id===result.targetPlayerId);
  return [none(result.targetPlayerId,!result.chosenGood?(target?.alignment==='good'?'악으로 취급':'악'):!result.effective?impairedFor(result.targetPlayerId)??'능력 무효':undefined)];
 }
 if(result.kind==='nightAttack'){
  const redirected=(ctx?.explanations??[]).filter(e=>e.reason.kind==='redirected').map(e=>({playerId:e.playerId,label:'생존',tone:'alive' as const,reason:recordedReason(ctx,e.playerId)}));
  if(deaths.length)return [...redirected,...deaths.map(deathVerdict)];
  if(result.killedPlayerId)return [...redirected,{playerId:result.killedPlayerId,label:'사망',tone:'death'}];
  const targets=[...new Set([result.targetPlayerId,...(ctx?.explanations??[]).map(e=>e.playerId)])];
  return [...redirected,...targets.filter(id=>!redirected.some(r=>r.playerId===id)).map(playerId=>({playerId,label:'사망 없음',tone:'none' as const,reason:recordedReason(ctx,playerId)}))];
 }
 return deaths.some(d=>d.sourceCharacterId==='grandmother'||d.prevention?.source.characterId==='fool')?deaths.map(deathVerdict):[];
}
export function CustomGamblerRegistration({controller}:{controller:FirstNightController}) {
 const state=controller.getSnapshot(),draft=state.inputDraft;
 const p=state.replay.players.find(p=>p.id===draft.playerIds[0]);
 const options=controller.step?.requiredInput.playerRegistrationOptions?.filter(j=>j.playerId===p?.id)??[];
 const matching=options.find(j=>j.characterId===draft.characterIds[0]);
 const option=matching??(p?.actualCharacter===draft.characterIds[0]?options[0]:undefined);
 if(!p||!option)return null;
 const role=characterPresentation(p.actualCharacter),guess=characterPresentation(option.characterId!);
 const registered=options.find(j=>j.characterId===draft.judgments[0]?.characterId);
 return <><InformationTreatmentInput label={`${role?.label} 취급`} className="snvInformationBinary" options={[{id:'actual',label:role?.label??p.actualCharacter},{id:'registered',label:matching?`${guess?.label}로 취급`:'다른 직업'}]} value={registered?'registered':'actual'} disabled={state.busy} onChange={value=>controller.updateInput({judgments:value==='registered'?[option]:[]})}/>
  {!matching&&registered&&<CharacterAbilityInput label="취급 직업" ariaLabel="취급 직업" value={registered.characterId!} options={options.map(j=>({id:j.characterId!,label:characterPresentation(j.characterId!)?.label??j.characterId!}))} disabled={state.busy} onChange={id=>controller.updateInput({judgments:options.filter(j=>j.characterId===id)})}/>}</>;
}
