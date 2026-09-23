import { Fragment, useEffect, useState, type CSSProperties, type RefObject } from 'react';
import type { RevealPayload, RevealIdentity } from '../custom/core/types';
import type { PublicInstruction } from '../custom/grimoire/publicInstruction';
import { characterPresentation } from '../custom/authoring/characterPresentation';
import { scalarInformationLabel, scalarInformationValueLabel } from '../shared-ui/scalarInformationPresentation';
import './customReadableReveal.css';

type ReadablePayload = Extract<RevealPayload, {kind:'minionInformation'|'demonInformation'|'evilTwinPair'|'madnessAssignment'|'characterChange'|'dreamerInformation'|'seamstressInformation'|'sageInformation'|'booleanInformation'|'numericInformation'|'setupInformation'|'fortuneTellerInformation'|'characterInformation'|'preacherInformation'|'chambermaidInformation'|'learnedCharacter'|'learnedPlayer'|'grantedAbilityInformation'|'nightwatchmanInformation'|'marionetteInformation'}> | PublicInstruction;
export function isReadableReveal(payload: RevealPayload | PublicInstruction): payload is ReadablePayload {
  if (!('kind' in payload)) return false;
  return ['minionInformation','demonInformation','evilTwinPair','madnessAssignment','characterChange','dreamerInformation','seamstressInformation','sageInformation','booleanInformation','barberInstruction','numericInformation','setupInformation','fortuneTellerInformation','characterInformation','preacherInformation','chambermaidInformation','learnedCharacter','learnedPlayer','grantedAbilityInformation','nightwatchmanInformation','marionetteInformation'].includes(payload.kind);
}
const sizeKey = 'clocktower.custom-reveal.text-size';
function savedSize() {
  try { const value=Number(localStorage.getItem(sizeKey)); return Number.isFinite(value)&&value>=80&&value<=140 ? value : 100; }
  catch { return 100; }
}
function Icon({id, heading=false}:{id:string;heading?:boolean}) {
  const role=characterPresentation(id);
  return <img className={heading?'customRevealRoleIcon':undefined} src={role?.image} alt={heading?role?.label??id:''}/>;
}
function Character({id,label}:{id:string;label?:string}) {
  return <article className="customReadableCard"><Icon id={id}/><strong>{label??characterPresentation(id)?.label??id}</strong></article>;
}
function People({players,marionette=false}:{players:readonly RevealIdentity[];marionette?:boolean}) {
  return <div className="customReadableCards">{players.length?players.map(p=><article className={`customReadableCard${marionette?' customReadableMarionetteCard':''}`} key={p.seat}><span>{p.seat}번</span><strong>{p.name}</strong>{marionette&&<small>꼭두각시</small>}</article>):<strong>없음</strong>}</div>;
}
function Role({id}:{id:string}) {
  return <div className="customReadableCards"><Character id={id}/></div>;
}
function PairPeople({players}:{players:readonly RevealIdentity[]}) {
  return <div className="customReadablePair">{players.map((p,i)=><Fragment key={p.seat}>{i>0&&<b>또는</b>}<article className="customReadableCard"><span>{p.seat}번</span><strong>{p.name}</strong></article></Fragment>)}</div>;
}
export function CustomReadableReveal({payload:p,onClose,closeRef}:{payload:ReadablePayload;onClose:()=>void;closeRef:RefObject<HTMLButtonElement|null>}) {
  const [size,setSize]=useState(savedSize);
  const [twinStage,setTwinStage]=useState<'private'|'wake'|'both'>('private');
  useEffect(()=>{closeRef.current?.focus({preventScroll:true});},[twinStage,closeRef]);
  const resize=(delta:number)=>{const next=Math.max(80,Math.min(140,size+delta));setSize(next);try{localStorage.setItem(sizeKey,String(next));}catch{/* Memory state still works. */}};
  const twin=p.kind==='evilTwinPair';
  const advance=()=>{if(twin&&twinStage!=='both')setTwinStage(twinStage==='private'?'wake':'both');else onClose();};
  const closeLabel=twin&&twinStage!=='both'?(twinStage==='private'?'확인했으면 다음 단계로':'두 쌍둥이에게 공개'):p.kind==='barberInstruction'?'결정했다면 눈을 감으세요':'확인했으면 눈을 감으세요';
  return <div className="bmrRevealBackdrop bmrRoleRevealBackdrop customReadableBackdrop">
    <div className="customReadableReveal" role="dialog" aria-modal="true" aria-label="플레이어 정보" style={{'--reveal-scale':size/100} as CSSProperties}>
      <div className="customRevealSizeControls" role="group" aria-label="글씨 크기 조절">
        <button type="button" aria-label="글씨 작게" disabled={size<=80} onClick={()=>resize(-10)}>−</button>
        <output className="customRevealSrOnly" aria-live="polite">글씨 크기 {size}%</output>
        <button type="button" aria-label="글씨 크게" disabled={size>=140} onClick={()=>resize(10)}>+</button>
      </div>
      <section className="bmrRoleReveal customReadablePanel">
        {twin ? twinStage==='wake'?<section className="customReadableSection"><p>선한 쌍둥이</p><People players={p.players.filter(player=>player.alignment==='good')}/><p>를 깨웁니다.</p></section>:<>
          <h1>사악한 쌍둥이</h1>
          <section className="customReadableSection">{twinStage==='private'?<><p>당신의 쌍둥이를 확인하세요.</p><p>쌍둥이의 직업을 흉내내세요.</p></>:<p>여러분은 쌍둥이입니다.</p>}</section>
          <div className="evilTwinRevealPair customReadableTwins">{p.players.map((player,i)=><Fragment key={player.playerId}>{i>0&&<b aria-hidden="true">↔</b>}<article className={`evilTwinRevealIdentity alignment-${player.alignment}`}>
            <span>{player.seat}번 · {player.name}</span><Icon id={player.characterId}/><strong>{player.alignment==='good'&&player.characterId==='evilTwin'?'쌍둥이':characterPresentation(player.characterId)?.label??player.characterId}</strong><small>{player.alignment==='good'?'선':'악'}</small>
          </article></Fragment>)}</div>
        </>:<Content payload={p}/>}
      </section>
      <button type="button" ref={closeRef} className="customReadableClose" onClick={advance}>{closeLabel}</button>
    </div>
  </div>;
}
function Content({payload:p}:{payload:Exclude<ReadablePayload,{kind:'evilTwinPair'}>}) {
  switch(p.kind) {
    case 'minionInformation': return <><h1>하수인 정보</h1><section className="customReadableSection" aria-label="하수인"><People players={p.minionPlayers}/><p>여러분은 <strong>하수인</strong>입니다.</p></section><section className="customReadableSection" aria-label="악마"><p>악마는</p><People players={p.demonPlayers}/><p>입니다.</p></section></>;
    case 'demonInformation': return <><h1>악마 정보</h1><section className="customReadableSection" aria-label="하수인">{p.minionPlayers.length||p.marionettePlayers?.length?<><p>당신의 하수인은</p><div className="customReadableMinionGroup">{!!p.minionPlayers.length&&<People players={p.minionPlayers}/>} {!!p.marionettePlayers?.length&&<People players={p.marionettePlayers} marionette/>}</div><p>입니다.</p></>:<p>당신의 하수인은 없습니다.</p>}</section><section className="customReadableSection"><p>이 직업들은 이번 게임에 없습니다.</p><div className="customReadableCards">{p.bluffCharacterIds.map(id=><Character key={id} id={id}/>)}</div></section></>;
    case 'marionetteInformation': return <><Icon id="marionette" heading/><People players={[p.marionettePlayer]}/><p>꼭두각시입니다.</p></>;
    case 'setupInformation': return <><Icon id={p.characterId} heading/>{p.zeroOutsiders?<p>이 게임에는 외부인이 없습니다.</p>:<><People players={p.candidatePlayers}/><p>둘 중 한 명은</p><Role id={p.revealedCharacterId}/><p>입니다.</p></>}</>;
    case 'numericInformation': return <><Icon id={p.characterId} heading/><p>{p.characterId==='chef'?'서로 이웃한 악한 플레이어 쌍':p.characterId==='empath'?<>살아 있는 양옆 이웃 중<br/>악한 플레이어</>:scalarInformationLabel(p.characterId)}</p><strong className="customReadableNumber">{p.value}{p.characterId==='chef'?<small>쌍</small>:p.characterId==='empath'?<small>명</small>:null}</strong></>;
    case 'fortuneTellerInformation': return <><Icon id="fortuneTeller" heading/><People players={p.targetPlayers}/><p>이 중 악마가</p><strong className="customReadableAnswer">{p.hasDemon?'있습니다.':'없습니다.'}</strong></>;
    case 'characterInformation': return <><Icon id={p.characterId} heading/><People players={[p.targetPlayer]}/><p>이 사람의 직업은</p><Role id={p.revealedCharacterId}/><p>입니다.</p></>;
    case 'chambermaidInformation': return <><Icon id="chambermaid" heading/><People players={p.targetPlayers}/><p>이 중 <strong className="customReadableInlineAnswer">{p.value}명</strong>이 깨어났습니다.</p></>;
    case 'preacherInformation': return <><Icon id="preacher" heading/><p><strong>전도사</strong>가 당신을 선택했습니다.</p></>;
    case 'nightwatchmanInformation': return <><Icon id="nightwatchman" heading/><People players={[p.nightwatchmanPlayer]}/><p>이 사람이 <strong>야경꾼</strong>입니다.</p></>;
    case 'learnedPlayer': return <><Icon id={p.sourceCharacterId} heading/><People players={[p.player]}/></>;
    case 'learnedCharacter': return <><Icon id={p.sourceCharacterId} heading/><p>이 직업이 게임에 있습니다.</p><Role id={p.characterId}/></>;
    case 'grantedAbilityInformation': return <><Icon id={p.sourceCharacterId} heading/><p>{p.recipientIsSource?'악마에게 부여한 능력':'과학자가 준 능력'}</p><Role id={p.characterId}/></>;
    case 'booleanInformation': return <><Icon id={p.characterId} heading/><p>{p.characterId==='flowergirl'?'오늘 악마가':'오늘 하수인이'}</p><strong className="customReadableAnswer">{scalarInformationValueLabel(p.characterId,p.value)}</strong></>;
    case 'dreamerInformation': return <><Icon id="dreamer" heading/>{p.targetPlayer&&<People players={[p.targetPlayer]}/>}<p>이 자의 직업은</p><div className="customReadablePair">{p.characterIds.map((id,i)=><Fragment key={`${id}-${i}`}>{i>0&&<b>또는</b>}<Character id={id}/></Fragment>)}</div></>;
    case 'seamstressInformation': return <><Icon id="seamstress" heading/><People players={p.targetPlayers}/><strong className="customReadableAnswer">{p.sameAlignment?'같은 진영':'다른 진영'}</strong></>;
    case 'sageInformation': return <><Icon id="sage" heading/><p>당신을 죽인 악마는</p><PairPeople players={p.candidatePlayers}/></>;
    case 'madnessAssignment': return <><Icon id="cerenovus" heading/><section className="customReadableSection"><p><strong className="customRevealEvilAccent">세레노버스</strong>가 당신을 선택했습니다.</p><p>살고 싶다면 내일 <strong className="customRevealGoldAccent">{characterPresentation(p.characterId)?.label??p.characterId}</strong>에 집착하십시오.</p></section><div className="customReadableCards customRevealGoldAccent"><Character id={p.characterId}/></div></>;
    case 'characterChange': return <><p>당신의 직업이 변경되었습니다.</p><div className="customReadableCards"><Character id={p.characterId} label={p.alignment==='good'&&p.characterId==='evilTwin'?'쌍둥이':undefined}/></div><strong className={`customReadableAlignment ${p.alignment}`}>{p.alignment==='good'?'선':'악'}</strong></>;
    case 'barberInstruction': return <><Icon id="barber" heading/><p>이발사가 사망했습니다.</p><section className="customReadableSection"><p>직업을 교환할 두 명을 고르십시오.</p><p>고르지 않으려면, 고개를 저으십시오.</p></section></>;
  }
}
