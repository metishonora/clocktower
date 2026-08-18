import type { Player, Proposal } from "../../core/types";

export type TroubleBrewingImpAttackPresentation = {
  targetPlayerId: string;
  attackTargetPlayerId: string;
  summary: Array<{ label: string; value: string }>;
  bounced: boolean;
};

export function troubleBrewingImpAttackPresentation(
  proposal: Proposal,
  players: Player[],
): TroubleBrewingImpAttackPresentation | undefined {
  if (
    proposal.event.type !== "nightActionResolved"
    || proposal.event.payload.resolution.kind !== "impAttack"
  ) return undefined;

  const resolution = proposal.event.payload.resolution;
  const mayorContext = resolution.mayorContext ?? { kind: "notApplicable" as const };
  const targetPlayerId = resolution.outcome.kind === "death" || resolution.outcome.kind === "soldierProtected"
    ? resolution.outcome.playerId
    : mayorContext.kind === "bounced"
      ? mayorContext.bounceTargetPlayerId
      : resolution.targetPlayerId;
  const target = players.find((player) => player.id === targetPlayerId);
  if (!target) return undefined;
  const attackTarget = players.find((player) => player.id === resolution.targetPlayerId);

  const outcome = resolution.outcome.kind === "death"
    ? "사망"
    : resolution.outcome.kind === "prevented"
      ? "수도승에 의해 보호됨"
      : resolution.outcome.kind === "soldierProtected"
        ? "군인 능력으로 생존"
        : resolution.outcome.reason === "alreadyDead"
          ? "이미 사망"
          : "효과 없음";

  const summaryValue = `${target.seat}번 ${target.name} · ${outcome}`;
  const bounced = mayorContext.kind === "bounced";
  return {
    targetPlayerId,
    attackTargetPlayerId: resolution.targetPlayerId,
    summary: bounced && attackTarget
      ? [
          { label: "공격 대상", value: `${attackTarget.seat}번 ${attackTarget.name} · 생존` },
          { label: resolution.outcome.kind === "death" ? "대신 사망" : "튕긴 대상", value: summaryValue },
        ]
      : [{ label: "공격 대상", value: summaryValue }],
    bounced,
  };
}
