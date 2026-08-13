export function TroubleBrewingSeatIdentity({
  actualLabel,
  shownLabel,
}: {
  actualLabel: string;
  shownLabel?: string;
}) {
  const hasShownIdentity = Boolean(shownLabel);

  return <small className={hasShownIdentity ? "tbSeatIdentityStack" : undefined}>
    <span>{actualLabel}</span>
    {shownLabel ? <span className="tbSeatShownIdentity">표시 · {shownLabel}</span> : null}
  </small>;
}
