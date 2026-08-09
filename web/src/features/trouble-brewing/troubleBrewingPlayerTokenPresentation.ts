import { characterAsset } from "../../characterAssets";
import type { Player, RuleState, SystemTokenId } from "../../core/types";
import { characterLabel } from "../../setupDraft";
import { scriptTokens, systemTokens } from "../grimoire/playerAnnotations";
import type { PlayerTokenPresentation, PlayerTokenVisualKind } from "../grimoire/playerTokenPresentation";

const systemTokenVisualKinds: Record<SystemTokenId, PlayerTokenVisualKind> = {
  drunk: "impairment",
  poisoned: "impairment",
  protected: "assignment",
  noAbility: "usage",
  abilitySpent: "usage",
  needsFollowUp: "usage",
};

export function troubleBrewingPlayerTokens(
  player: Player,
  _players: readonly Player[],
  ruleState?: RuleState,
): PlayerTokenPresentation[] {
  const tokens: PlayerTokenPresentation[] = [];

  for (const reminder of ruleState?.automaticReminders ?? []) {
    if (reminder.playerId !== player.id) continue;
    tokens.push(automaticToken(reminder));
  }

  player.systemTokenIds.forEach((tokenId, index) => {
    tokens.push({
      instanceId: `manual-system-${tokenId}-${index}`,
      label: systemTokens.find((token) => token.id === tokenId)?.label ?? tokenId,
      sourceLabel: "이야기꾼",
      visualKind: systemTokenVisualKinds[tokenId],
      description: "이야기꾼이 수동으로 부착한 System Token입니다.",
      origin: "manual",
    });
  });

  player.scriptTokens.forEach((reference, index) => {
    const token = scriptTokens.find((candidate) =>
      candidate.characterId === reference.characterId && candidate.tokenId === reference.tokenId,
    );
    tokens.push({
      instanceId: `manual-script-${reference.characterId}-${reference.tokenId}-${index}`,
      label: token?.label ?? reference.tokenId,
      sourceLabel: token?.character ?? characterLabel(reference.characterId),
      sourceIconSrc: characterAsset(reference.characterId)?.src,
      visualKind: reference.tokenId === "poisoned" ? "impairment" : "assignment",
      description: "이야기꾼이 수동으로 부착한 Script Token입니다.",
      origin: "manual",
    });
  });

  return tokens;
}

function automaticToken(
  reminder: NonNullable<RuleState["automaticReminders"]>[number],
): PlayerTokenPresentation {
  return {
    instanceId: reminder.sourceEventId
      ? `canonical-${reminder.sourceEventId}-${reminder.tokenId}-${reminder.playerId}`
      : `canonical-${reminder.characterId}-${reminder.tokenId}-${reminder.playerId}`,
    label: reminder.label,
    sourceLabel: characterLabel(reminder.characterId),
    sourceIconSrc: characterAsset(reminder.characterId)?.src,
    visualKind: automaticTokenVisualKind(reminder.tokenId),
    description: reminder.description,
    count: reminder.count,
    inactiveReason: reminder.inactiveReason,
    origin: "automatic",
  };
}

function automaticTokenVisualKind(tokenId: string): PlayerTokenVisualKind {
  if (tokenId === "poisoned") return "impairment";
  if (tokenId === "noAbility") return "usage";
  if (tokenId === "master") return "relationship";
  return "assignment";
}
