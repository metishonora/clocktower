import type { ActiveImpairment } from "../../core/types";

export type VisibleImpairment = ActiveImpairment["kind"];

export function visibleImpairmentsForPlayer(
  impairments: readonly ActiveImpairment[] | undefined,
  playerId: string | undefined,
): VisibleImpairment[] {
  if (!playerId) return [];
  return (["poisoned", "drunk"] as const).filter((kind) =>
    impairments?.some((impairment) => impairment.playerId === playerId && impairment.kind === kind),
  );
}

export function ImpairmentBadges({
  impairments,
  label = "행동자 상태",
}: {
  impairments: readonly VisibleImpairment[];
  label?: string;
}) {
  if (impairments.length === 0) return null;
  return (
    <span className="snvInformationInfluenceBadges" aria-label={label}>
      {impairments.map((impairment) => (
        <em key={impairment} className={`snvInformationInfluenceBadge ${impairment}`}>
          {impairment === "drunk" ? "취함" : "중독"}
        </em>
      ))}
    </span>
  );
}

export function PlayerImpairmentBadges({
  activeImpairments,
  playerId,
  label,
}: {
  activeImpairments: readonly ActiveImpairment[] | undefined;
  playerId: string | undefined;
  label?: string;
}) {
  return (
    <ImpairmentBadges
      impairments={visibleImpairmentsForPlayer(activeImpairments, playerId)}
      label={label}
    />
  );
}
