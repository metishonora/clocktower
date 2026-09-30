import type {ConfirmedInformation, InformationResult, DeliveryReason} from '../core/types';
import {characterPresentation} from '../authoring/characterPresentation';
export const historyRole = (id:string) => characterPresentation(id)?.label ?? '직업 기록 없음';
export type HistoryLabels = {person:(id:string)=>string; label:(id:string)=>string; details:string[]};

export function informationValue(value:InformationResult,person:(id:string)=>string):string {
  switch(value.kind) {
    case 'number': return String(value.value);
    case 'boolean': return value.value?'예':'아니오';
    case 'character': return historyRole(value.characterId);
    case 'characterPair': return value.characterIds.map(historyRole).join(' / ');
    case 'player': return person(value.playerId);
    case 'playerPair': return value.playerIds.map(person).join(' / ');
    case 'setupInfo': return value.zeroOutsiders?'외지인 없음':`${value.playerIds.map(person).join(' / ')} 중 ${value.characterId?historyRole(value.characterId):'직업 기록 없음'}`;
    case 'teamInfo': return `악마: ${value.demonPlayerIds.map(person).join(' · ')||'없음'} · 하수인: ${value.minionPlayerIds.map(person).join(' · ')||'없음'} · 블러프: ${value.bluffCharacterIds.map(historyRole).join(' · ')||'없음'}`;
    case 'spyGrimoire': return '당시 마도서';
  }
}
function reasonText(reason:DeliveryReason,label:(id:string)=>string):string {
  switch(reason.type) {
    case 'abilityChoice': return '능력에 따른 정보 선택';
    case 'drunk': return '취함';
    case 'poisoned': return `중독 · 출처 ${label(reason.poisonerPlayerId)}`;
    case 'vortox': return `보르톡스 · ${label(reason.demonPlayerId)}`;
    case 'registrationJudgment': return reason.judgments.map(j=>`${label(j.playerId)}: ${j.characterId?historyRole(j.characterId):({good:'선',evil:'악',townsfolk:'주민',outsider:'외지인',minion:'하수인',demon:'악마'}[j.registeredAs])}으로 등록`).join(' · ');
  }
}
export function informationText(info:ConfirmedInformation,character:string,labels:HistoryLabels):string {
  const {person,label,details}=labels;
  const value=info.deliveredResult;
  const targets=info.targetPlayerIds.map(person).join(' / ');
  if(info.computedResult && JSON.stringify(info.computedResult)!==JSON.stringify(value))details.push(`계산값: ${informationValue(info.computedResult,label)}`);
  if(info.deliveryContext.type==='discretionary')details.push(...info.deliveryContext.reasons.map(r=>reasonText(r,label)));
  if(value.kind==='spyGrimoire') {
    details.push(...value.players.map(p=>`${p.seat}번 ${p.name} · ${historyRole(p.characterId)}${p.alignment?` · ${p.alignment==='good'?'선':'악'}`:''}${p.alive===undefined?'':p.alive?' · 생존':' · 사망'}${p.ghostVoteUsed?' · 유령표 사용함':''}${p.automaticReminders?.length?` · 토큰 ${p.automaticReminders.map(t=>t.label).join(' / ')}`:''}${p.reminderTokens?.length?` · ${p.reminderTokens.map(t=>t==='poisoned'?'중독':'보호').join(' / ')}`:''}`));
    return '당시 마도서를 확인했습니다.';
  }
  let delivered=informationValue(value,person);
  if(value.kind==='number') {
    const prefix:Record<string,string>={clockmaker:'악마와 하수인의 거리',chef:'이웃한 악한 팀',empath:'살아 있는 양옆 이웃 중 악한 팀',oracle:'죽은 악한 플레이어',mathematician:'비정상 작동',juggler:'정답',chambermaid:'능력으로 깨어난 플레이어'};
    const unit:Record<string,string>={clockmaker:'칸',chef:'쌍',empath:'명',oracle:'명',mathematician:'명',juggler:'개',chambermaid:'명'};
    delivered=`${prefix[character]?`${prefix[character]} `:''}${value.value}${unit[character]??''}`;
  }
  if(value.kind==='boolean') {
    if(character==='seamstress')delivered=`진영 ${value.value?'같음':'다름'}`;
    if(character==='fortuneTeller')delivered=`악마 ${value.value?'있음':'없음'}`;
    if(character==='flowergirl')delivered=`악마 ${value.value?'투표함':'투표하지 않음'}`;
    if(character==='townCrier')delivered=`하수인 ${value.value?'지명함':'지명하지 않음'}`;
  }
  const subject=targets&&value.kind!=='setupInfo'?`${targets}에 대해 `:'';
  return `${subject}“${delivered}” 정보를 전달했습니다.`;
}

export function withParticle(text:string,consonant:string,vowel:string):string {
  const last=text.trim().at(-1)??'';
  const code=last.charCodeAt(0)-0xac00;
  const finalConsonant=code>=0&&code<=11171?code%28!==0:'013678'.includes(last);
  return text+(finalConsonant?consonant:vowel);
}
