import {characterPresentation} from '../custom/authoring/characterPresentation';
import type {CustomGameEnd} from '../custom/core/types';
import {useState,useSyncExternalStore} from 'react';
import type {FirstNightController} from '../custom/grimoire/firstNightController';
import type {DayInput,DayStage} from '../custom/core/dayTypes';
import './customDay.css';
const titles:Record<DayStage,string>={announcement:'사망 발표',whisper:'밀담',discussion:'공개 토론',nomination:'지명 및 투표',voting:'투표',execution:'처형 결정',executionDeath:'처형 사망 확인',death:'사망 확인',nightReady:'낮 종료',night:'다음 밤'};
export function CustomDayTask({controller}:{controller:FirstNightController}) {
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const day=state.replay.day!;
  const [consequenceTarget,setConsequenceTarget]=useState('');
  const busy=state.busy||state.public||state.saveStatus!=='saved';
  const person=(id:string|null|undefined)=>{const p=state.replay.players.find(p=>p.id===id);return p?`${p.seat}번 ${p.name}`:'없음';};
  const submit=(input:DayInput)=>void controller.confirmDay(input);
  const select=(label:string,value:string,onChange:(id:string)=>void,ids:string[])=><label>{label}<select aria-label={label} value={value} onChange={e=>onChange(e.target.value)} disabled={busy}><option value="">선택</option>{ids.map(id=><option key={id} value={id}>{person(id)}</option>)}</select></label>;
  const active=day.nominations.at(-1);
  if(state.dayNotifications?.length)return <article className="snvCurrentStep customDayTask"><h3>정체 변경 알림</h3><div className="snvStepActions"><button type="button" disabled={busy} onClick={()=>controller.showPayload(state.dayNotifications![0]!)}>공개</button><button type="button" disabled={busy} onClick={controller.finishDayNotification}>확인</button></div></article>;
  if(state.replay.gameEnd)return <article className="snvCurrentStep"><h3>{state.replay.gameEnd.winningAlignment==='good'?'선팀 승리':'악팀 승리'}</h3></article>;
  if(day.pendingGameEnd)return <article className="snvCurrentStep customDayTask"><h3>{day.pendingGameEnd.winningAlignment==='good'?'선팀 승리':'악팀 승리'}</h3><p>{endReason(day.pendingGameEnd.reason)}</p><div className="snvStepActions"><button type="button" disabled={busy} onClick={()=>submit({kind:'confirmGameEnd'})}>게임 종료 확정</button></div></article>;
  const consequence=day.consequences.find(c=>!c.resolved&&c.source.characterId!=='barber');
  if(consequence)return <article className="snvCurrentStep customDayTask"><h3>{characterPresentation(consequence.source.characterId)?.label} · 사망 후속 처리</h3><p>{person(consequence.source.ownerPlayerId)}</p>{consequence.impairedAtDeath?<p>사망 당시 취함·중독 · 효과 없음</p>:select('대상',consequenceTarget,setConsequenceTarget,state.replay.players.filter(p=>consequence.source.characterId!=='klutz'||p.alive).map(p=>p.id))}<div className="snvStepActions"><button type="button" disabled={busy||(!consequence.impairedAtDeath&&!consequenceTarget)} onClick={()=>submit({kind:'resolveConsequence',consequenceId:consequence.id,playerId:consequence.impairedAtDeath?null:consequenceTarget})}>확정</button></div></article>;
  return <article className="snvCurrentStep issue116CurrentStep customDayTask" aria-label={titles[day.stage]}>
    <h3>{titles[day.stage]}</h3>
    {day.stage==='announcement'&&<p>{state.replay.ruleState.unannouncedNightDeathPlayerIds.length?state.replay.ruleState.unannouncedNightDeathPlayerIds.map(person).join(' · '):'밤 사망 없음'}</p>}
    {['announcement','whisper','discussion'].includes(day.stage)&&<div className="snvStepActions"><button type="button" disabled={busy} onClick={()=>submit({kind:'advance'})}>{day.stage==='announcement'?'발표 완료':day.stage==='whisper'?'공개 토론으로':'지명 및 투표로'}</button></div>}
    {day.stage==='nomination'&&<>
      <div className="issue116CandidateSummary" aria-label="현재 최고 득표"><strong>{day.executionCandidateId?person(day.executionCandidateId):'후보 없음'}</strong><span>{day.highestVoteCount}표</span></div>
      <div className="snvStepActions issue116NominationActions"><button type="button" disabled={busy} onClick={controller.beginDayHandoff}>← 지명하기</button><button type="button" className="secondary" disabled={busy} onClick={()=>submit({kind:'closeNominations'})}>지명 종료</button></div>
    </>}
    {day.stage==='voting'&&<><p>{person(active?.nominatorId)} → {person(active?.nomineeId)}</p><div className="snvStepActions"><button type="button" disabled={busy} onClick={controller.beginDayHandoff}>← 투표하기</button></div></>}
    {(day.stage==='execution'||day.stage==='executionDeath')&&<><div className="issue116ExecutionTarget"><span>처형 대상</span><strong>{person(day.stage==='execution'?day.executionCandidateId:day.pendingDeath?.playerId)}</strong>{(()=>{const target=state.replay.players.find(p=>p.id===(day.stage==='execution'?day.executionCandidateId:day.pendingDeath?.playerId));return target?<small>{characterPresentation(target.actualCharacter)?.label}</small>:null;})()}</div><button type="button" className="issue116ExecutionConfirm" disabled={busy} onClick={()=>day.stage==='execution'?void controller.confirmDayExecution():submit({kind:'confirmDeath'})}>확정</button></>}
    {day.stage==='death'&&<><p>{person(day.pendingDeath?.playerId)}</p><div className="snvStepActions"><button type="button" disabled={busy} onClick={()=>submit({kind:'confirmDeath'})}>사망 확정</button></div></>}
    {day.stage==='nightReady'&&<div className="snvStepActions"><button type="button" disabled={busy} onClick={()=>submit({kind:'beginNight'})}>다음 밤으로</button></div>}
    {day.stage==='night'&&<p role="status">낮 종료 · 다음 밤 진행 준비 완료</p>}
    {(day.nominations.length>0||day.abilityRecords.length>0||day.deaths.length>0)&&<details className="customDayHistory"><summary>낮 기록</summary><ol>{day.nominations.map(n=><li key={n.eventId}><strong>{person(n.nominatorId)} → {person(n.nomineeId)}</strong><span>{n.countedVoterIds===null?'투표 미확정':`${n.countedVoterIds.length}표`}</span>{n.voterIds!==null&&<small>투표자: {n.voterIds.length?n.voterIds.map(person).join(' · '):'없음'}</small>}</li>)}</ol>{day.execution&&<p>처형: {person(day.execution.playerId)} · 사망: {day.pendingDeath&&day.pendingDeath.playerId===day.execution.playerId?'미확정':day.execution.died?'있음':'없음'}</p>}{day.abilityRecords.map(r=><div className="customDayRecordedAbility" key={r.eventId}><strong>{person(r.action.actorPlayerId)} · {characterPresentation(r.action.characterId)?.label}</strong>{r.record.kind==='artist'?<p>{r.record.question} · {r.record.answer==='yes'?'예':r.record.answer==='no'?'아니오':'알 수 없음'} · {r.record.truthful?'진실':'거짓'}</p>:r.record.kind==='savant'?r.record.statements.map((s,i)=><p key={i}>{s.text} · {s.truthful?'진실':'거짓'}</p>):r.record.kind==='juggler'?<p>정답 {r.record.correctCount}개</p>:<p>대상: {person(r.record.targetPlayerId)}</p>}</div>)}{day.deaths.map(d=><p key={d.eventId}>{person(d.participant.playerId)} · 사망 · {characterPresentation(d.participant.characterId)?.label}</p>)}</details>}
  </article>;
}

function endReason(reason:CustomGameEnd['reason']):string{return {goodTwinExecuted:'선한 쌍둥이가 처형됐습니다.',saintExecuted:'성자가 처형됐습니다.',mayorNoExecution:'생존자 3명 · 시장 생존 · 처형 없음',vortoxNoExecution:'보르톡스 · 처형 없음',demonAbsent:'살아 있는 악마 없음',twoLivingPlayers:'생존자 2명 이하',klutzChoice:'얼뜨기가 악한 플레이어를 선택했습니다.',storytellerDecision:'이야기꾼 판정'}[reason];}
