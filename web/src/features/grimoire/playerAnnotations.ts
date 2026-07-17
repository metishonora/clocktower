import type { Player, ScriptTokenRef, SystemTokenId } from "../../core/types";

export const systemTokens: Array<{ id: SystemTokenId; label: string }> = [
  { id: "drunk", label: "술취함" },
  { id: "poisoned", label: "중독" },
  { id: "protected", label: "보호" },
  { id: "noAbility", label: "능력 없음" },
  { id: "abilitySpent", label: "능력 소모" },
  { id: "needsFollowUp", label: "후속 처리" },
];

export const scriptTokens: Array<ScriptTokenRef & { character: string; label: string }> = [
  { characterId: "butler", tokenId: "master", character: "집사", label: "주인" },
  { characterId: "drunk", tokenId: "isTheDrunk", character: "술꾼", label: "술꾼임" },
  { characterId: "fortuneTeller", tokenId: "redHerring", character: "점쟁이", label: "오답 대상" },
  { characterId: "imp", tokenId: "dead", character: "임프", label: "사망" },
  { characterId: "investigator", tokenId: "minion", character: "조사관", label: "하수인" },
  { characterId: "investigator", tokenId: "wrong", character: "조사관", label: "오답" },
  { characterId: "librarian", tokenId: "outsider", character: "사서", label: "이방인" },
  { characterId: "librarian", tokenId: "wrong", character: "사서", label: "오답" },
  { characterId: "monk", tokenId: "safe", character: "수도사", label: "안전" },
  { characterId: "poisoner", tokenId: "poisoned", character: "독살자", label: "중독" },
  { characterId: "scarletWoman", tokenId: "isTheDemon", character: "붉은 여인", label: "악마임" },
  { characterId: "slayer", tokenId: "noAbility", character: "학살자", label: "능력 없음" },
  { characterId: "undertaker", tokenId: "diedToday", character: "장의사", label: "오늘 사망" },
  { characterId: "virgin", tokenId: "noAbility", character: "처녀", label: "능력 없음" },
  { characterId: "washerwoman", tokenId: "townsfolk", character: "세탁부", label: "마을 주민" },
  { characterId: "washerwoman", tokenId: "wrong", character: "세탁부", label: "오답" },
];

export function playerAnnotationBadges(player?: Player) {
  if (!player) return [];
  return [
    ...player.systemTokenIds.map((id) => ({
      key: `system-${id}`,
      label: systemTokens.find((token) => token.id === id)?.label ?? id,
      accessibleLabel: `수동 System Token · ${systemTokens.find((token) => token.id === id)?.label ?? id}`,
    })),
    ...player.scriptTokens.map((reference) => {
      const token = scriptTokens.find((candidate) =>
        candidate.characterId === reference.characterId && candidate.tokenId === reference.tokenId,
      );
      return {
        key: `script-${reference.characterId}-${reference.tokenId}`,
        label: token?.label ?? reference.tokenId,
        accessibleLabel: token
          ? `수동 Script Token · ${token.character} · ${token.label}`
          : `수동 Script Token · ${reference.characterId} · ${reference.tokenId}`,
      };
    }),
  ];
}

export function sameScriptToken(left: ScriptTokenRef, right: ScriptTokenRef) {
  return left.characterId === right.characterId && left.tokenId === right.tokenId;
}
