import {CustomBmrVerdicts} from './CustomBmrOutcome';
import {InformationTreatmentInput} from '../shared-ui/InformationInputPresentation';
import type {RegistrationJudgment} from '../custom/core/types';
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
  if(consequence&&['sweetheart','klutz','moonchild'].includes(consequence.source.characterId))return {kind:'consequence',id:consequence.id,consequence};
}
const deathTitles:Record<PendingDayDeath['cause'],string>={golem:'골렘',witch:'저주 발동',execution:'처형',virgin:'성결자 지목',madness:'집착 위반 처형',slayer:'악마 처단'};

/** Presentation only: death and consequence confirmation remain canonical day commands. */
export function CustomDayResolutionBoard({controller,resolution,onCancel}:{controller:FirstNightController;resolution:Resolution;onCancel:()=>void}) {
  const state=controller.getSnapshot(),{players}=state.replay;
  const [target,setTarget]=useState<string>();
  const [judgments,setJudgments]=useState<RegistrationJudgment[]>([]);
  const prompt=useRef<HTMLElement>(null);
  useEffect(()=>{prompt.current?.focus();},[]);
  const busy=state.busy||state.public||state.saveStatus!=='saved'||!!state.dayNotifications?.length;
  const death=resolution.kind==='death'?resolution.death:undefined;
  const consequence=resolution.kind==='consequence'?resolution.consequence:undefined;
  const actorId=death?.playerId??consequence?.source.ownerPlayerId;
  const person=(id?:string)=>{const p=players.find(p=>p.id===id);return p?`${p.seat}번 ${p.name}`:'선택 전';};
  const desktop=rectangularSeatPositions(players.length,false),mobile=rectangularSeatPositions(players.length,true),heights=grimoireHeights(players.length);
  const style={'--grimoire-height':`${heights.desktop}px`,'--mobile-grimoire-height':`${heights.mobile}px`} as CSSProperties;
  const moonchild=consequence?.source.characterId==='moonchild';
  const completed=!!moonchild&&!!consequence?.resolved;
  const choice=state.replay.ruleState.scheduledDeaths?.find(c=>c.source.abilityInstanceId===consequence?.source.abilityInstanceId&&c.night===state.replay.day!.day+1);
  const registration=state.replay.day?.alignmentRegistrationOptions?.find(j=>j.playerId===target);
  const selected=players.find(p=>p.id===target);
  const klutz=consequence?.source.characterId==='klutz';
  const roleLabel=consequence?characterPresentation(consequence.source.characterId)!.label:'';
  const targetLabel=moonchild?'공개 선택':klutz?'선택 대상':'취함 대상';
  const title=death?deathTitles[death.cause]:`${roleLabel} · ${targetLabel}`;
  const confirm=()=>{
    if(busy)return;
    if(death)void controller.confirmDay({kind:'confirmDeath'});
    else if(consequence&&(moonchild?target:consequence.impairedAtDeath||target))void controller.confirmDay({kind:'resolveConsequence',consequenceId:consequence.id,playerId:!moonchild&&consequence.impairedAtDeath?null:target!,...(moonchild?{registrationJudgments:judgments}:{})});
  };
  return <GrimoirePresentation ariaLabel="마도서" className="snvSeatingSurface bmrGrimoireSurface issue116GrimoireSurface confirmed issue116HandoffActive customDayResolution" workspaceClassName={`snvSeatingWorkspace bmrGrimoireWorkspace stable${death?' confirmed':''}`} style={style} toolbar={consequence?<GrimoireToolbar showCurrentActor>{!completed&&<button type="button" disabled={busy} onClick={onCancel}>취소</button>}</GrimoireToolbar>:null}
    board={<RectangularGrimoireBoard ariaLabel={`${players.length}자리 마도서`} className="snvGrimoireDraft bmrGrimoireBoard" style={style} centerClassName="snvGrimoireCenter live"
      center={death?<section ref={prompt} tabIndex={-1} className="customDayDeathPrompt" role="dialog" aria-label={`${title} 사망 확인`}><strong>{title}</strong><p>{person(death.playerId)} 사망</p><button type="button" disabled={busy} onClick={confirm}>사망 확인</button></section>:<section ref={prompt} tabIndex={-1} className="customDayDeathPrompt" aria-label={title}><strong>{title}</strong><p>{(consequence?.impairedAtDeath&&!moonchild)?'사망 당시 취함·중독 · 효과 없음':completed?'선택 기록 완료':'한 명을 선택'}</p></section>}
      seats={players.map((p,index)=>{
        const role=customSeatCharacter(p),actor=p.id===actorId,selected=p.id===target;
        const dying=!!death&&actor,ineligible=(klutz||moonchild)&&!p.alive;
        return {id:p.id,position:state.file.ui?.seatLayout?.positions[p.seat]??desktop[index],mobilePosition:mobile[index],pressed:selected,
          disabled:busy||completed||!!death||(!!consequence?.impairedAtDeath&&!moonchild)||ineligible,onSelect:()=>{setTarget(selected?undefined:p.id);setJudgments([]);},
          ariaLabel:`${p.seat}번 좌석, ${p.name}, ${role?.label}, ${dying?'사망 확인':p.alive?'생존':p.ghostVoteUsed?'사망 · 유령표 사용함':'사망 · 유령표 사용 가능'}${selected?`, ${targetLabel}`:''}`,
          className:`assigned alignment-${p.alignment} kind-${characterPresentation(p.actualCharacter)?.kind.toLowerCase()}${!p.alive||dying?' snvDeadSeat':''}${dying?' snvSeatStateTarget tbSeatStateAttack customDayDeathTarget':actor?' snvSeatStateActor':''}${selected?` snvSeatStateSelected snvSeatStateTarget ${klutz||moonchild?'tbSeatStateSelection':'tbSeatStatePoison'}`:''}${ineligible?' issue116IneligibleSeat':''}${death&&!actor?' snvSettledOtherSeat':''}`,
          content:<GrimoireSeatContent seat={p.seat} name={p.name} alive={p.alive&&!dying} ghostVoteUsed={p.ghostVoteUsed} icon={<img src={role?.image} alt=""/>} label={dying?'사망':selected?(klutz||moonchild?'선택':'취함'):role?.label??''}/>
        };
      })}/>}
    inspector={consequence&&<GrimoireHandoffView title={roleLabel} completed={completed} busy={busy} ready={(!moonchild&&consequence.impairedAtDeath)||!!target} showReset={moonchild||!consequence.impairedAtDeath} beforeRows={completed&&choice?<CustomBmrVerdicts replay={state.replay} items={[{playerId:choice.targetPlayerId,label:choice.chosenGood?'오늘 밤 사망':'효과 없음',tone:choice.chosenGood?'death':'none',reason:choice.chosenGood?undefined:state.replay.players.find(p=>p.id===choice.targetPlayerId)?.alignment==='good'?'악으로 취급':'악'}]}/>:undefined} rowsClassName={completed?'customBmrRows':undefined} rows={[{label:'사망자',value:person(actorId)},...((moonchild||!consequence.impairedAtDeath)?[{label:targetLabel,value:person(target)}]:[])]} onReset={()=>{setTarget(undefined);setJudgments([]);}} onConfirm={confirm} onContinue={onCancel} continueLabel="진행으로 →" confirmLabel={moonchild?'공개 선택 기록':consequence.impairedAtDeath?'효과 없음 확인':klutz?'선택 확정':'취함 확정'}>{!completed&&moonchild&&registration&&selected?<InformationTreatmentInput label={`${characterPresentation(selected.actualCharacter)?.label} 취급`} className="snvInformationBinary" options={[{id:'actual',label:selected.alignment==='good'?'선':'악'},{id:'registered',label:registration.registeredAs==='good'?'선으로 취급':'악으로 취급'}]} value={judgments.length?'registered':'actual'} disabled={busy} onChange={v=>setJudgments(v==='registered'?[registration]:[])}/>:null}</GrimoireHandoffView>}/>
}
