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
  players: readonly Player[],
  ruleState?: RuleState,
): PlayerTokenPresentation[] {
  const tokens: PlayerTokenPresentation[] = [];

  if (ruleState?.activePoison?.playerId === player.id) {
    tokens.push(automaticToken(
      "active-poison",
      "중독",
      "poisoner",
      ruleState.activePoison.sourcePlayerId,
      players,
      "impairment",
      "독살범의 능력으로 현재 중독된 대상입니다.",
    ));
  }
  if (ruleState?.activeProtection?.playerId === player.id) {
    tokens.push(automaticToken(
      "active-protection",
      "보호",
      "monk",
      ruleState.activeProtection.sourcePlayerId,
      players,
      "assignment",
      "수도사의 능력으로 현재 보호받는 대상입니다.",
    ));
  }
  if (
    ruleState?.virginAbility?.actorPlayerId === player.id
    && ruleState.virginAbility.spent
  ) {
    tokens.push({
      instanceId: "virgin-no-ability",
      label: "능력 없음",
      sourceLabel: "성결자",
      sourceIconSrc: characterAsset("virgin")?.src,
      visualKind: "usage",
      description: "성결자의 능력이 지목으로 소모되었습니다.",
    });
  }

  player.systemTokenIds.forEach((tokenId, index) => {
    tokens.push({
      instanceId: `manual-system-${tokenId}-${index}`,
      label: systemTokens.find((token) => token.id === tokenId)?.label ?? tokenId,
      sourceLabel: "이야기꾼",
      visualKind: systemTokenVisualKinds[tokenId],
      description: "이야기꾼이 수동으로 부착한 System Token입니다.",
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
    });
  });

  return tokens;
}

function automaticToken(
  instanceId: string,
  label: string,
  fallbackCharacterId: string,
  sourcePlayerId: string,
  players: readonly Player[],
  visualKind: PlayerTokenVisualKind,
  description: string,
): PlayerTokenPresentation {
  const sourceCharacterId = players.find((player) => player.id === sourcePlayerId)?.actualCharacter
    ?? fallbackCharacterId;
  return {
    instanceId,
    label,
    sourceLabel: characterLabel(sourceCharacterId),
    sourceIconSrc: characterAsset(sourceCharacterId)?.src,
    visualKind,
    description,
  };
}
