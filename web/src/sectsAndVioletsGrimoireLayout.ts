export {
  grimoireHeights,
  rectangularSeatPositions,
} from "./shared-ui/GrimoirePresentation";

export function centeredArrowPoints(start: { x: number; y: number }, end: { x: number; y: number }): string {
  const center = { x: 50, y: 50 };
  const startDistance = Math.hypot(center.x - start.x, center.y - start.y);
  const endDistance = Math.hypot(end.x - center.x, end.y - center.y);
  const visibleStart = {
    x: start.x + (center.x - start.x) / startDistance * 12,
    y: start.y + (center.y - start.y) / startDistance * 12,
  };
  const visibleEnd = {
    x: end.x - (end.x - center.x) / endDistance * 15,
    y: end.y - (end.y - center.y) / endDistance * 15,
  };
  return `${visibleStart.x},${visibleStart.y} 50,50 ${visibleEnd.x},${visibleEnd.y}`;
}

export function inwardSelfNominationPath(position: { x: number; y: number }): string {
  const center = { x: 50, y: 50 };
  const distance = Math.hypot(center.x - position.x, center.y - position.y);
  const inward = { x: (center.x - position.x) / distance, y: (center.y - position.y) / distance };
  const tangent = { x: -inward.y, y: inward.x };
  const point = (inwardOffset: number, tangentOffset: number) => ({
    x: position.x + inward.x * inwardOffset + tangent.x * tangentOffset,
    y: position.y + inward.y * inwardOffset + tangent.y * tangentOffset,
  });
  const start = point(13, 6);
  const firstControl = point(32, 22);
  const secondControl = point(32, -22);
  const end = point(13, -6);
  return `M ${start.x},${start.y} C ${firstControl.x},${firstControl.y} ${secondControl.x},${secondControl.y} ${end.x},${end.y}`;
}
