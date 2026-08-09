import type { Player, ScriptTokenRef, SystemTokenId } from "../../core/types.js";
import { characterLabel } from "../../setupDraft.js";
import { troubleBrewingReminderInventory } from "../../troubleBrewingCharacterMatrix.js";

export const systemTokens: Array<{ id: SystemTokenId; label: string }> = [
  { id: "drunk", label: "술취함" },
  { id: "poisoned", label: "중독" },
  { id: "protected", label: "보호" },
  { id: "noAbility", label: "능력 없음" },
  { id: "abilitySpent", label: "능력 소모" },
  { id: "needsFollowUp", label: "후속 처리" },
];

export const scriptTokens: Array<ScriptTokenRef & { character: string; label: string }> =
  troubleBrewingReminderInventory.map(({ characterId, tokenId, label }) => ({
    characterId,
    tokenId,
    character: characterLabel(characterId),
    label,
  }));

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
