import type {CustomActionResult, EventHistoryContext, GameEvent, GameFile, Phase, ReplayState} from '../core/types';
import {historyRole as role, informationText, informationValue, withParticle, type HistoryLabels} from './eventInformation';
import {actionLabels} from './actionPresentation';

export type EventHistoryRow = {id:string;phase:Phase;cycle?:number;summary:string;details:string[];playerIds:string[]};

/** One presentation shared by the full log, player history and Undo. Canonical events stay untouched. */
export function eventHistory(file:GameFile,replay?:Pick<ReplayState,'eventHistory'>):EventHistoryRow[] {
  const contexts=new Map(replay?.eventHistory?.map(c=>[c.eventId,c]));
  return file.game.events.map(event=>historyRow(file,event,contexts.get(event.id)));
}
export function eventPresentation(file:GameFile,event:GameEvent,context?:EventHistoryContext):string {
  return historyRow(file,event,context).summary;
}
export function historyPhaseLabel(row:Pick<EventHistoryRow,'phase'|'cycle'>):string {
  if(row.phase==='setup')return '초기 설정';
  if(row.phase==='firstNight')return '첫날 밤';
  if(!row.cycle)return row.phase==='day'?'낮':'밤';
  return `${row.cycle}${row.phase==='day'?'일 낮':'일 밤'}`;
}
function historyRow(file:GameFile,event:GameEvent,context?:EventHistoryContext):EventHistoryRow {
  const setup=file.game.events.find(e=>e.type==='setupConfirmed');
  const players=setup?.type==='setupConfirmed'?setup.payload.players:[];
  const involved=new Set<string>(context?.recipientPlayerIds);
  const label=(id:string)=>{const p=players.find(p=>p.id===id);return p?`${p.seat}번 ${p.name}`:'플레이어 기록 없음';};
  const person=(id:string)=>{involved.add(id);return label(id);};
  const details:string[]=[];
  const labels={person,label,details};
  let summary:string;
  if(event.type==='setupConfirmed')summary=`${event.payload.players.length}명의 직업과 좌석을 확정했습니다.`;
  else if(event.type==='dayConfirmed')summary=daySummary(event,context,labels);
  else {
    const p=event.payload, ref=p.actionRef;
    const owner=p.abilityUse?.ownerPlayerId??(event.type==='customActionConfirmed'?event.payload.simulationSource?.sourceAbilityUse.ownerPlayerId:undefined);
    const ability=ref?.kind==='character'?ref.characterId:undefined;
    const simulation=event.type==='customActionConfirmed'&&!!event.payload.simulationSource;
    const actor=owner?`${person(owner)}${ability?` · ${actorRole(ability,context?.actorCharacterId,simulation)}`:''}`:ability?role(ability):'';
    if(event.type==='customActionConfirmed')summary=[actor,actionSummary(event.payload.result,ability??'',labels,context,event.payload.input)].filter(Boolean).join(' · ');
    else if(event.payload.information)summary=[actor,informationText(event.payload.information,ability??'',labels)].filter(Boolean).join(' · ');
    else summary=systemSummary(file,event,context,labels);
  }
  for(const change of context?.identityChanges??[]) {
    const before=change.before,after=change.after;
    const parts:string[]=[];
    if(before.actualCharacter!==after.actualCharacter)parts.push(`${role(before.actualCharacter)} → ${role(after.actualCharacter)}`);
    if(before.alignment!==after.alignment)parts.push(`${before.alignment==='good'?'선':'악'} → ${after.alignment==='good'?'선':'악'}`);
    if(before.shownCharacter!==after.shownCharacter&&after.shownCharacter!==after.actualCharacter)parts.push(`보여준 직업 ${role(after.shownCharacter)}`);
    if(parts.length)summary+=` ${person(change.playerId)}: ${parts.join(' · ')}.`;
  }
  return {id:event.id,phase:context?.phase??event.phase,cycle:context?.cycle??(event.type==='dayConfirmed'?event.payload.day:event.phase==='firstNight'?1:undefined),summary,details,playerIds:[...involved]};
}
function actorRole(ability:string,actual:string|null|undefined,simulation=false):string {
  return actual&&actual!==ability?`${role(actual)} · ${role(ability)} ${simulation?'안내':'능력'}`:role(ability);
}
function actionSummary(r:CustomActionResult,character:string,l:HistoryLabels,c:EventHistoryContext|undefined,input:Extract<GameEvent,{type:'customActionConfirmed'}>['payload']['input']):string {
  const {person,details}=l;
  const object=(id:string)=>withParticle(person(id),'을','를');
  const together=(id:string)=>withParticle(person(id),'과','와');
  const subject=(id:string)=>withParticle(person(id),'이','가');
  const effect=(effective:boolean)=>effective?'적용됨':'효과 없음';
  switch(r.kind) {
    case 'informationDelivered':case 'preparedInformationDelivered':return informationText(r.information,character,l);
    case 'informationPrepared':return `“${informationValue(r.preparation.information,person)}” 정보를 준비했습니다.${r.preparation.correctPlayerId?` 실제 대상: ${person(r.preparation.correctPlayerId)}.`:''}`;
    case 'information':return `“${informationValue(r.value,person)}” 정보를 전달했습니다.`;
    case 'simulation':return !r.information&&!r.spent&&input===null?'오늘 밤 능력을 사용하지 않았습니다.':r.information?informationText(r.information,character,l):`${input&&'playerIds' in input&&input.playerIds?.length?`${input.playerIds.map(person).join(' / ')} 선택 · `:''}안내 행동을 확정했습니다. 실제 효과 없음.`;
    case 'simulationChoice':return r.characterId?`${role(r.characterId)} 안내를 선택했습니다. 실제 능력 획득 없음.`:'능력을 사용하지 않았습니다.';
    case 'philosopherDeferred':case 'seamstressDeferred':return '오늘 밤 능력을 사용하지 않았습니다.';
    case 'philosopherChoice':return `${role(r.characterId)} 능력을 선택했습니다. ${{acquired:'능력 획득',selfDrunk:'본인 취함',failed:'능력 획득 실패'}[r.outcome]}.`;
    case 'poisoner':return `${object(r.targetPlayerId)} 중독 대상으로 선택했습니다. ${effect(r.effective)}.`;
    case 'butler':return `${object(r.targetPlayerId)} 주인으로 선택했습니다. ${effect(r.effective)}.`;
    case 'monkProtection':return `${object(r.targetPlayerId)} 보호 대상으로 선택했습니다. ${effect(r.effective)}.`;
    case 'sweetheartDrunk':return `${object(r.targetPlayerId)} 취함 대상으로 선택했습니다. ${effect(r.effective)}.`;
    case 'witch':return `${object(r.targetPlayerId)} 저주 대상으로 선택했습니다. ${effect(r.effective)}.`;
    case 'cerenovus':return `${person(r.targetPlayerId)}에게 ${role(r.characterId)} 집착을 지정했습니다. ${effect(r.effective)}.`;
    case 'evilTwin':case 'twinInformed':return `${together(r.targetPlayerId)} 쌍둥이 정보를 확인했습니다. ${effect(r.effective)}.`;
    case 'twinAssigned':return `${object(r.targetPlayerId)} 쌍둥이로 지정했습니다.`;
    case 'redHerringAssigned':return `${object(r.targetPlayerId)} 붉은 청어로 지정했습니다.`;
    case 'shownCharacterAssigned':case 'marionetteShown':return `보여줄 직업을 ${role(r.characterId)}으로 지정했습니다.`;
    case 'snakeCharmer':return `${object(r.targetPlayerId)} 선택했습니다. ${{swapped:'악마와 정체 교환',impaired:'효과 없음',notDemon:'교환 없음'}[r.outcome]}.`;
    case 'nightAttack':return `${object(r.targetPlayerId)} 공격했습니다. ${r.killedPlayerId?`${person(r.killedPlayerId)} 사망`:c?.pendingNightDeath?'사망은 별도 단계에서 결정':r.died?'사망 확정':'즉시 사망 없음'}.`;
    case 'pitHagChange':return `${person(r.targetPlayerId)}의 직업으로 ${withParticle(role(r.characterId),'을','를')} 선택했습니다. ${r.changed?'변경됨':'변경 없음'}${r.createdDemon?' · 악마 생성':''}.`;
    case 'barberSwap':return r.playerIds.length?`${r.chooserPlayerId?`${person(r.chooserPlayerId)}의 선택 · `:''}${r.playerIds.map(person).join(' / ')}의 직업 교환. ${effect(r.effective)}.`:'직업을 교환하지 않았습니다.';
    case 'arbitraryDeaths':case 'nightDeathsResolved':return r.playerIds.length?`${r.playerIds.map(person).join(' / ')}의 사망을 확정했습니다.`:'사망 없음으로 확정했습니다.';
    case 'vigormortisPoison':return `${object(r.targetPlayerId)} 중독 대상으로 지정했습니다.`;
    case 'mutantJudgment':case 'pixieJudgment':return `집착 ${r.result==='violation'?'위반':'유지'}로 판단했습니다.`;
    case 'mutantExecution':return r.executed?`집착 위반으로 처형했습니다. ${r.died?'사망':'생존'}.`:r.execute?'처형을 선택했습니다. 효과 없음.':'처형하지 않았습니다.';
    case 'preacherSelected':return `${object(r.targetPlayerId)} 선택했습니다. ${r.effective?'하수인 능력 상실':'효과 없음'}.`;
    case 'pixieLearned':return `${withParticle(role(r.characterId),'을','를')} 전달했습니다. 집착 대상: ${person(r.targetPlayerId)}.`;
    case 'balloonistLearned':details.push(`당시 등록 유형: ${{Townsfolk:'주민',Outsider:'외지인',Minion:'하수인',Demon:'악마'}[r.registeredKind]}`);return `${object(r.targetPlayerId)} 알려주었습니다.`;
    case 'boffinGranted':return `${person(r.targetPlayerId)}에게 ${role(r.characterId)} 능력을 부여했습니다.`;
    case 'nightwatchmanUsed':return `${object(r.targetPlayerId)} 선택했습니다. ${r.revealedPlayerId?`${subject(r.revealedPlayerId)} 야경꾼이라는 정보를 전달했습니다.`:'효과 없음.'}`;
    case 'noEffect':return input===null?'오늘 밤 능력을 사용하지 않았습니다.':'행동을 확정했습니다. 효과 없음.';
    default:return exhaustive(r);
  }
}
function daySummary(event:Extract<GameEvent,{type:'dayConfirmed'}>,c:EventHistoryContext|undefined,l:HistoryLabels):string {
  const {input,result}=event.payload,{person,details}=l;
  const object=(id:string)=>withParticle(person(id),'을','를');
  const subject=(id:string)=>withParticle(person(id),'이','가');
  switch(input.kind) {
    case 'nominate':return `${subject(input.nominatorId)} ${object(input.nomineeId)} 지명했습니다.`;
    case 'vote':if(c?.nomination)details.push(`지명: ${person(c.nomination.nominatorId)} → ${person(c.nomination.nomineeId)}`);if(input.voterIds.length!==result.countedVoterIds.length)details.push(`집계된 투표자: ${result.countedVoterIds.map(person).join(' / ')||'없음'}`);details.push(`투표자: ${input.voterIds.map(person).join(' / ')||'없음'}`);if(result.ghostVoteSpentPlayerIds.length)details.push(`유령표 사용: ${result.ghostVoteSpentPlayerIds.map(person).join(' / ')}`);return `${c?.nomination?`${person(c.nomination.nomineeId)} 지명에 `:''}${result.countedVoterIds.length}표를 확정했습니다.`;
    case 'confirmExecution':return c?c.executionPlayerId?`${person(c.executionPlayerId)}의 처형을 확정했습니다.`:'처형 없음으로 확정했습니다.':'처형 결정을 확정했습니다.';
    case 'confirmDeath':return `${result.deathPlayerIds.map(person).join(' / ')||'대상 기록 없음'}의 사망을 확정했습니다.${c?.death?` 원인: ${{execution:'처형',virgin:'성결자',madness:'집착 위반',witch:'마녀',slayer:'처단자'}[c.death.cause]}.`:''}`;
    case 'useAbility': {
      const a=result.abilityRecord?.action;
      const prefix=a?`${person(a.actorPlayerId)} · ${actorRole(a.characterId,c?.actorCharacterId,!!a.simulationSource)} · `:'';
      if(a?.impaired)details.push('당시 취함·중독');
      if(a?.vortox)details.push('보르톡스');
      const record=input.record;
      switch(record.kind) {
        case 'artist':details.push(`답변 판정: ${record.truthful?'진실':'거짓'}`);return `${prefix}“${record.question||'질문 내용 미기록'}”에 “${{yes:'예',no:'아니오',unknown:'알 수 없음'}[record.answer]}”로 답했습니다.`;
        case 'savant':details.push(...record.statements.map((s,i)=>`${i+1}. ${s.text||'내용 미기록'} · ${s.truthful?'진실':'거짓'}`));return `${prefix}두 문장을 전달했습니다. ① ${record.statements[0].text||'내용 미기록'} ② ${record.statements[1].text||'내용 미기록'}`;
        case 'juggler':return `${prefix}추측 정답 ${record.correctCount}개를 기록했습니다.`;
        case 'slayer':return `${prefix}${person(record.targetPlayerId)}에게 능력을 사용했습니다. ${result.pendingDeath?.playerId===record.targetPlayerId?'사망 확인 대기':'사망 없음'}.`;
      }
    }
    case 'checkMadness':return `${c?.madness?`${person(c.madness.targetPlayerId)} · ${role(c.madness.observerCharacterId??c.madness.source.characterId)} · `:''}집착 ${input.violation?'위반':'유지'}로 판단했습니다.`;
    case 'executeMadness':return `${c?.madness?`${person(c.madness.targetPlayerId)} · `:''}집착 위반 처형을 확정했습니다.`;
    case 'resolveConsequence':return `${c?.consequence?`${person(c.consequence.source.ownerPlayerId)} · ${role(c.consequence.source.characterId)} · `:''}${input.playerId?`${object(input.playerId)} 선택했습니다.`:'대상 선택 없이 후속 처리를 마쳤습니다.'}${c?.consequence?.impairedAtDeath?' 사망 당시 취함·중독 · 효과 없음.':''}`;
    case 'beginNight':return `${event.payload.day+1}일 밤을 시작했습니다.`;
    case 'closeNominations':return '지명을 마쳤습니다.';
    case 'advance':return `${({announcement:'사망 발표',whisper:'밀담',discussion:'공개 토론',nomination:'지명 및 투표',voting:'투표',execution:'처형 결정',executionDeath:'처형 사망 확인',death:'사망 확인',nightReady:'낮 종료',night:'밤'} as const)[result.stage]} 단계로 진행했습니다.`;
    case 'endGame':return `이야기꾼이 ${input.winningAlignment==='good'?'선':'악'}팀 승리로 게임을 종료했습니다.`;
    case 'confirmGameEnd':return c?.gameEnd?`${c.gameEnd.winningAlignment==='good'?'선':'악'}팀 승리를 확정했습니다.`:'게임 종료를 확정했습니다.';
    default:return exhaustive(input);
  }
}
function systemSummary(file:GameFile,event:Extract<GameEvent,{type:'phaseStepConfirmed'}>,c:EventHistoryContext|undefined,l:HistoryLabels):string {
  const action=event.payload.actionRef?.actionId;
  const reveal=c?.systemReveal;
  const setup=file.game.events.find(e=>e.type==='setupConfirmed');
  const atSeat=(p:{seat:number;name:string})=>{const player=setup?.type==='setupConfirmed'?setup.payload.players.find(x=>x.seat===p.seat):undefined;return player?.id?l.person(player.id):`${p.seat}번 ${p.name}`;};
  if(reveal&&'kind' in reveal&&reveal.kind==='minionInformation')return `하수인 정보를 전달했습니다. 악마: ${reveal.demonPlayers.map(atSeat).join(' / ')||'없음'} · 하수인: ${reveal.minionPlayers.map(atSeat).join(' / ')||'없음'}.`;
  if(reveal&&'kind' in reveal&&reveal.kind==='demonInformation')return `악마 정보를 전달했습니다. 하수인: ${reveal.minionPlayers.map(atSeat).join(' / ')||'없음'}${reveal.marionettePlayers?.length?` · 꼭두각시: ${reveal.marionettePlayers.map(atSeat).join(' / ')}`:''} · 블러프: ${reveal.bluffCharacterIds.map(role).join(' / ')}.`;
  if(action==='dawn')return '밤을 마치고 낮을 시작했습니다.';
  if(action==='dusk')return '밤을 시작했습니다.';
  const input=event.payload.input;
  if(action==='demonInfo'&&input&&'characterIds' in input)return `악마 정보를 전달했습니다. 블러프: ${input.characterIds.map(role).join(' / ')}.`;
  return `${withParticle(action?actionLabels[action]??'진행':'진행','을','를')} 확정했습니다.`;
}
function exhaustive(value:never):never {throw new Error(`지원하지 않는 기록 형식: ${JSON.stringify(value)}`);}
