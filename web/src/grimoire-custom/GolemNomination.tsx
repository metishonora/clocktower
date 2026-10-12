import type {GolemNominationEffect} from '../custom/core/dayTypes';
import {characterPresentation} from '../custom/authoring/characterPresentation';
import './golemNomination.css';
const reason:Record<GolemNominationEffect['outcome'],string>={death:'',protected:'사망 방지',demon:'악마',registeredDemon:'악마로 취급',impaired:'',alreadyDead:'이미 사망'};
const impairmentLabel=(kind:'drunk'|'poisoned')=>kind==='drunk'?'취함':'중독';
export function GolemNominationPreview({effect,target}:{effect:GolemNominationEffect;target:{seat:number;name:string;actualCharacter:string}}) {
 const role=characterPresentation(target.actualCharacter),golem=characterPresentation('golem');
 const explanation=effect.outcome==='impaired'?`골렘 ${effect.abilityImpairments.map(impairmentLabel).join('·')}`:reason[effect.outcome];
 return <section className="golemPreview" aria-label="골렘 지명 결과"><p className="golemAbility"><img src={golem?.image} alt=""/><span>골렘 · 지명 1회 사용</span>{effect.abilityImpairments.map(kind=><em key={kind}>{impairmentLabel(kind)}</em>)}</p>
  <div className={`golemVerdict tone-${effect.outcome==='death'?'death':'none'}`}><img src={role?.image} alt=""/><span><strong>{target.seat}번 {target.name}</strong><small>{role?.label}{explanation?` · ${explanation}`:''}</small></span><em>{effect.outcome==='death'?'사망':'사망 없음'}</em></div>
 </section>;
}
export function GolemNominationNote({effect,person}:{effect:GolemNominationEffect;person:(id:string)=>string}) {
 return <p className="golemNote" role="status"><img src={characterPresentation('golem')?.image} alt=""/><span>골렘</span><strong>{effect.outcome==='death'?`${person(effect.targetPlayerId)} 사망`:'사망 없음'}</strong></p>;
}
