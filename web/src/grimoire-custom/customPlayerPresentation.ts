import type { AutomaticReminder, Player } from '../custom/core/types';
import type { PlayerTokenPresentation } from '../features/grimoire/playerTokenPresentation';
import { characterPresentation } from '../custom/authoring/characterPresentation';
const labels:Record<string,string>={redHerring:'오인',townsfolk:'마을 주민',outsider:'외부인',minion:'하수인',wrong:'오답',isTheDrunk:'주정뱅이',poisoned:'중독',drunk:'취함',master:'주인',cursed:'저주',mad:'광기',twin:'쌍둥이',noAbility:'능력 사용함',safe:'안전',hasAbility:'능력 있음',once:'한 번',dead:'사망',haircutsTonight:'오늘 밤 이발',demonDidNotVote:'악마 투표 안 함',demonVoted:'악마 투표함',correct:'정답',abnormal:'비정상',isThePhilosopher:'철학자임',isTheDemon:'악마임',minionDidNotNominate:'하수인 지목 안 함',minionNominated:'하수인 지목함',diedToday:'오늘 사망'};
export function customPlayerTokens(reminders:readonly Omit<AutomaticReminder,'sourceEventId'>[]):PlayerTokenPresentation[]{
  return reminders.map((token,index)=>{const role=characterPresentation(token.characterId);return {instanceId:`${token.playerId}:${token.characterId}:${token.tokenId}:${index}`,label:labels[token.tokenId] ?? token.label,sourceLabel:role?.label ?? token.characterId,sourceIconSrc:role?.image,visualKind:['poisoned','drunk'].includes(token.tokenId)?'impairment':['master','twin','mad','cursed'].includes(token.tokenId)?'relationship':token.tokenId==='noAbility'?'usage':'assignment',description:labels[token.description] ?? token.description,count:token.count,inactiveReason:token.inactiveReason,origin:'automatic'};});
}

/** Keep the Townsfolk token the Drunk believes they drew; rules still use actualCharacter. */
export function customSeatCharacter(player: Pick<Player,'actualCharacter'|'shownCharacter'>) {
  return characterPresentation(player.actualCharacter==='drunk'?player.shownCharacter:player.actualCharacter);
}
