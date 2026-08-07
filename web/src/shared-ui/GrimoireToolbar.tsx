import type { ReactNode } from "react";

export function GrimoireToolbar({
  ariaLabel = "마도서 도구",
  phaseLabel,
  showCurrentActor = false,
  children,
}: {
  ariaLabel?: string;
  phaseLabel?: string;
  showCurrentActor?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="snvSeatingToolbar" aria-label={ariaLabel}>
      {phaseLabel ? <span className="issue116PhaseChip">{phaseLabel}</span> : null}
      {showCurrentActor ? <div className="snvCurrentActorLegend" aria-label="현재 행동자 안내"><span aria-hidden="true" />현재 행동자</div> : null}
      {children}
    </div>
  );
}
