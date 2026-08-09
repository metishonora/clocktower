import { centeredArrowPoints, inwardSelfNominationPath } from "../sectsAndVioletsGrimoireLayout";

export function NominationArrow({
  nominatorIndex,
  nomineeIndex,
  label,
  desktopPositions,
  mobilePositions,
  markerPrefix = "liveNominationArrow",
}: {
  nominatorIndex: number;
  nomineeIndex: number;
  label: string;
  desktopPositions: { x: number; y: number }[];
  mobilePositions: { x: number; y: number }[];
  markerPrefix?: string;
}) {
  return <>
    <ArrowGraphic className="desktop" label={label} start={desktopPositions[nominatorIndex]} end={desktopPositions[nomineeIndex]} markerPrefix={markerPrefix} />
    <ArrowGraphic className="mobile" start={mobilePositions[nominatorIndex]} end={mobilePositions[nomineeIndex]} markerPrefix={markerPrefix} />
  </>;
}

function ArrowGraphic({ className, label, start, end, markerPrefix }: {
  className: string;
  label?: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  markerPrefix: string;
}) {
  const selfNomination = start.x === end.x && start.y === end.y;
  const markerId = `${markerPrefix}-${className}`;
  return (
    <svg className={`issue116NominationArrow ${className}${selfNomination ? " issue116SelfNominationArrow" : ""}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={label} aria-hidden={label ? undefined : true}>
      <defs><marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
      {selfNomination
        ? <path d={inwardSelfNominationPath(start)} markerEnd={`url(#${markerId})`} />
        : <polyline points={centeredArrowPoints(start, end)} markerEnd={`url(#${markerId})`} />}
    </svg>
  );
}
