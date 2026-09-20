import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {FirstNightController} from '../custom/grimoire/firstNightController';
import type {ReplayState} from '../custom/core/types';
import type {DayConsequence,PendingDayDeath} from '../custom/core/dayTypes';
import {characterPresentation} from '../custom/authoring/characterPresentation';
import {GrimoirePresentation,RectangularGrimoireBoard,grimoireHeights,rectangularSeatPositions} from '../shared-ui/GrimoirePresentation';
import {GrimoireSeatContent} from '../shared-ui/GrimoireSeatContent';
import {GrimoireHandoffView} from '../shared-ui/GrimoireHandoffView';
import {GrimoireToolbar} from '../shared-ui/GrimoireToolbar';
import {customSeatCharacter} from './customPlayerPresentation';
import './customDay.css';

type Resolution={kind:'death';id:string;death:PendingDayDeath}|{kind:'consequence';id:string;consequence:DayConsequence};
export function dayBoardResolution(replay:ReplayState):Resolution|undefined {
  const day=replay.phase==='day'?replay.day:undefined;
  if(!day||replay.gameEnd||day.pendingGameEnd)return;
  if(day.pendingDeath)return day.pendingDeath.cause==='execution'?undefined:{kind:'death',id:day.stepId,death:day.pendingDeath};
  const consequence=day.consequences.find(c=>!c.resolved&&c.source.characterId!=='barber');
  if(consequence&&['sweetheart','klutz'].includes(consequence.source.characterId))return {kind:'consequence',id:consequence.id,consequence};
}
const deathTitles:Record<PendingDayDeath['cause'],string>={witch:'저주 발동',execution:'처형',virgin:'성결자 지목',madness:'집착 위반 처형',slayer:'악마 처단'};

/** Presentation only: death and consequence confirmation remain canonical day commands. */
export function CustomDayResolutionBoard({controller,resolution,onCancel}:{controller:FirstNightController;resolution:Resolution;onCancel:()=>void}) {
  const state=controller.getSnapshot(),{players}=state.replay;
  const [target,setTarget]=useState<string>();
  const prompt=useRef<HTMLElement>(null);
  useEffect(()=>{prompt.current?.focus();},[]);
  const busy=state.busy||state.public||state.saveStatus!=='saved'||!!state.dayNotifications?.length;
  const death=resolution.kind==='death'?resolution.death:undefined;
  const consequence=resolution.kind==='consequence'?resolution.consequence:undefined;
  const actorId=death?.playerId??consequence?.source.ownerPlayerId;
  const person=(id?:string)=>{const p=players.find(p=>p.id===id);return p?`${p.seat}번 ${p.name}`:'선택 전';};
  const desktop=rectangularSeatPositions(players.length,false),mobile=rectangularSeatPositions(players.length,true),heights=grimoireHeights(players.length);
  const style={'--grimoire-height':`${heights.desktop}px`,'--mobile-grimoire-height':`${heights.mobile}px`} as CSSProperties;
  const klutz=consequence?.source.characterId==='klutz';
  const roleLabel=consequence?characterPresentation(consequence.source.characterId)!.label:'';
  const targetLabel=klutz?'선택 대상':'취함 대상';
  const title=death?deathTitles[death.cause]:`${roleLabel} · ${targetLabel}`;
  const confirm=()=>{
    if(busy)return;
    if(death)void controller.confirmDay({kind:'confirmDeath'});
    else if(consequence&&(consequence.impairedAtDeath||target))void controller.confirmDay({kind:'resolveConsequence',consequenceId:consequence.id,playerId:consequence.impairedAtDeath?null:target!});
  };
  return <GrimoirePresentation ariaLabel="마도서" className="snvSeatingSurface bmrGrimoireSurface issue116GrimoireSurface confirmed issue116HandoffActive customDayResolution" workspaceClassName={`snvSeatingWorkspace bmrGrimoireWorkspace stable${death?' confirmed':''}`} style={style} toolbar={consequence?<GrimoireToolbar showCurrentActor><button type="button" disabled={busy} onClick={onCancel}>취소</button></GrimoireToolbar>:null}
    board={<RectangularGrimoireBoard ariaLabel={`${players.length}자리 마도서`} className="snvGrimoireDraft bmrGrimoireBoard" style={style} centerClassName="snvGrimoireCenter live"
      center={death?<section ref={prompt} tabIndex={-1} className="customDayDeathPrompt" role="dialog" aria-label={`${title} 사망 확인`}><strong>{title}</strong><p>{person(death.playerId)} 사망</p><button type="button" disabled={busy} onClick={confirm}>사망 확인</button></section>:<section ref={prompt} tabIndex={-1} className="customDayDeathPrompt" aria-label={title}><strong>{title}</strong><p>{consequence?.impairedAtDeath?'사망 당시 취함·중독 · 효과 없음':'한 명을 선택'}</p></section>}
      seats={players.map((p,index)=>{
        const role=customSeatCharacter(p),actor=p.id===actorId,selected=p.id===target;
        const dying=!!death&&actor,ineligible=klutz&&!p.alive;
        return {id:p.id,position:state.file.ui?.seatLayout?.positions[p.seat]??desktop[index],mobilePosition:mobile[index],pressed:selected,
          disabled:busy||!!death||!!consequence?.impairedAtDeath||ineligible,onSelect:()=>setTarget(selected?undefined:p.id),
          ariaLabel:`${p.seat}번 좌석, ${p.name}, ${role?.label}, ${dying?'사망 확인':p.alive?'생존':p.ghostVoteUsed?'사망 · 유령표 사용함':'사망 · 유령표 사용 가능'}${selected?`, ${targetLabel}`:''}`,
          className:`assigned alignment-${p.alignment} kind-${characterPresentation(p.actualCharacter)?.kind.toLowerCase()}${!p.alive||dying?' snvDeadSeat':''}${dying?' snvSeatStateTarget tbSeatStateAttack customDayDeathTarget':actor?' snvSeatStateActor':''}${selected?` snvSeatStateSelected snvSeatStateTarget ${klutz?'tbSeatStateSelection':'tbSeatStatePoison'}`:''}${ineligible?' issue116IneligibleSeat':''}${death&&!actor?' snvSettledOtherSeat':''}`,
          content:<GrimoireSeatContent seat={p.seat} name={p.name} alive={p.alive&&!dying} ghostVoteUsed={p.ghostVoteUsed} icon={<img src={role?.image} alt=""/>} label={dying?'사망':selected?(klutz?'선택':'취함'):role?.label??''}/>
        };
      })}/>}
    inspector={consequence&&<GrimoireHandoffView title={roleLabel} completed={false} busy={busy} ready={consequence.impairedAtDeath||!!target} showReset={!consequence.impairedAtDeath} rows={[{label:'사망자',value:person(actorId)},...(!consequence.impairedAtDeath?[{label:targetLabel,value:person(target)}]:[])]} onReset={()=>setTarget(undefined)} onConfirm={confirm} onContinue={()=>{}} confirmLabel={consequence.impairedAtDeath?'효과 없음 확인':klutz?'선택 확정':'취함 확정'}/>}/>
}
