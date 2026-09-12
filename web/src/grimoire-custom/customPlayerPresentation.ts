import type { AutomaticReminder } from '../custom/core/types';
import type { PlayerTokenPresentation } from '../features/grimoire/playerTokenPresentation';
import { characterPresentation } from '../custom/authoring/characterPresentation';
const labels:Record<string,string>={redHerring:'오인',townsfolk:'마을 주민',outsider:'외부인',minion:'하수인',wrong:'오답',isTheDrunk:'주정뱅이',poisoned:'중독',drunk:'취함',master:'주인',cursed:'저주',mad:'광기',twin:'쌍둥이',noAbility:'능력 사용함'};
export function customPlayerTokens(reminders:readonly Omit<AutomaticReminder,'sourceEventId'>[]):PlayerTokenPresentation[]{
  return reminders.map((token,index)=>{const role=characterPresentation(token.characterId);return {instanceId:`${token.playerId}:${token.characterId}:${token.tokenId}:${index}`,label:labels[token.tokenId] ?? token.label,sourceLabel:role?.label ?? token.characterId,sourceIconSrc:role?.image,visualKind:['poisoned','drunk'].includes(token.tokenId)?'impairment':['master','twin','mad','cursed'].includes(token.tokenId)?'relationship':token.tokenId==='noAbility'?'usage':'assignment',description:token.description,count:token.count,inactiveReason:token.inactiveReason,origin:'automatic'};});
}
