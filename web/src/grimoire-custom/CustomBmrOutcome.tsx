import type {CustomActionResult,DeathOutcome,ReplayState,AbilityUseRef} from '../custom/core/types';
import {characterPresentation} from '../custom/authoring/characterPresentation';
import type {FirstNightController} from '../custom/grimoire/firstNightController';
import {CharacterAbilityInput,InformationTreatmentInput} from '../shared-ui/InformationInputPresentation';
import './customBmr.css';
export type BmrVerdict={playerId:string;label:string;tone:'death'|'alive'|'none';reason?:string};
/** Presentation-only context. Every value is read from Core projections; no rule is decided here. */
export type BmrVerdictContext={replay:ReplayState;impairments?:readonly string[];resultEventId?:string};
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
/** Names the protections an unpreventable kill ignored, from the target's current reminders. */
function bypassed(ctx:BmrVerdictContext|undefined,playerId:string):string|undefined {
 if(!ctx)return undefined;
 const p=ctx.replay.players.find(p=>p.id===playerId);
 const sources=new Set((ctx.replay.ruleState.automaticReminders??[]).filter(t=>t.playerId===playerId&&['monk','devilsAdvocate'].includes(t.characterId)).map(t=>t.characterId));
 // A Fool still unspent before this kill (its spent token, if any, comes from this very event).
 if(p?.actualCharacter==='fool'&&!(ctx.replay.ruleState.automaticReminders??[]).some(t=>t.playerId===playerId&&t.characterId==='fool'&&t.sourceEventId!==ctx.resultEventId))sources.add('fool');
 const effect:Record<string,string>={monk:'수도사 보호',devilsAdvocate:'처형 보호',fool:'최초 사망 방지'};
 return sources.size?`${[...sources].map(id=>effect[id]??label(id)).join('·')} 무시`:undefined;
}
export function bmrResultVerdicts(result:CustomActionResult|undefined,actor:string|undefined,deaths:DeathOutcome[],character?:string,ctx?:BmrVerdictContext):BmrVerdict[] {
 if(!result)return [];
 const impairment=impairmentLabel(ctx?.impairments);
 // On someone else's card, say whose ability was impaired.
 const impairedFor=(playerId:string)=>impairment&&(playerId===actor||!character?impairment:`${label(character)} ${impairment}`);
 const dead=(id:string)=>ctx?.replay.players.find(p=>p.id===id)?.alive===false;
 const none=(playerId:string,reason?:string):BmrVerdict=>({playerId,label:'효과 없음',tone:'none',reason});
 if(result.kind==='simulation'&&character==='gambler'&&actor)return [none(actor,impairedFor(actor))];
 if(result.kind==='gamblerGuessed')return result.deaths.length?result.deaths.map(deathVerdict):actor?[result.effective?{playerId:actor,label:'생존',tone:'alive'}:none(actor,impairedFor(actor))]:[];
 if(result.kind==='devilsAdvocateProtected')return [result.effective?{playerId:result.targetPlayerId,label:'보호',tone:'alive'}:none(result.targetPlayerId,impairedFor(result.targetPlayerId))];
 if(result.kind==='assassinUsed')return result.deaths.length?result.deaths.map(d=>d.died?{...deathVerdict(d),reason:bypassed(ctx,d.playerId)}:deathVerdict(d)):result.targetPlayerId?[none(result.targetPlayerId,impairedFor(result.targetPlayerId))]:[];
 if(result.kind==='moonchildResolved'){
  if(result.deaths.length)return result.deaths.map(deathVerdict);
  const target=ctx?.replay.players.find(p=>p.id===result.targetPlayerId);
  return [none(result.targetPlayerId,!result.chosenGood?(target?.alignment==='good'?'악으로 취급':'악'):!result.effective?impairedFor(result.targetPlayerId)??'능력 무효':undefined)];
 }
 if(result.kind==='nightAttack'){
  if(deaths.length)return deaths.map(deathVerdict);
  if(result.killedPlayerId&&result.killedPlayerId!==result.targetPlayerId)return [{playerId:result.targetPlayerId,label:'생존',tone:'alive',reason:'시장'},{playerId:result.killedPlayerId,label:'사망',tone:'death'}];
  if(result.killedPlayerId)return [{playerId:result.killedPlayerId,label:'사망',tone:'death'}];
  const target=ctx?.replay.players.find(p=>p.id===result.targetPlayerId);
  const protectedBy=(ctx?.replay.ruleState.automaticReminders??[]).find(t=>t.playerId===result.targetPlayerId&&t.characterId==='monk')?'수도사 보호':target?.actualCharacter==='soldier'?'군인':undefined;
  return [{playerId:result.targetPlayerId,label:'사망 없음',tone:'none',reason:impairedFor(result.targetPlayerId)??protectedBy??(dead(result.targetPlayerId)?'이미 사망':undefined)}];
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
