import type {CustomGameEnd} from '../custom/core/types';
export function endReason(reason:CustomGameEnd['reason']):string {
 return {goodTwinExecuted:'선한 쌍둥이가 처형됐습니다.',saintExecuted:'성자가 처형됐습니다.',mayorNoExecution:'생존자 3명 · 시장 생존 · 처형 없음',vortoxNoExecution:'보르톡스 · 처형 없음',demonAbsent:'살아 있는 악마 없음',twoLivingPlayers:'생존자 2명 이하',klutzChoice:'얼뜨기가 악한 플레이어를 선택했습니다.',storytellerDecision:'이야기꾼 판정'}[reason];
}
