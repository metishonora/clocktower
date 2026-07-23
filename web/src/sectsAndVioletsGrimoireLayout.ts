export function grimoireHeights(playerCount: number): { desktop: number; mobile: number } {
  const desktopCounts = perimeterCounts(playerCount, false);
  const mobileCounts = perimeterCounts(playerCount, true);
  return {
    desktop: wrappedPerimeterHeight(Math.max(desktopCounts.right, desktopCounts.left), 88, 16, 12),
    mobile: wrappedPerimeterHeight(Math.max(mobileCounts.right, mobileCounts.left), 76, 12, 8),
  };
}

export function rectangularSeatPositions(playerCount: number, mobile: boolean): Array<{ x: number; y: number }> {
  const counts = perimeterCounts(playerCount, mobile);
  const horizontalStart = mobile ? 30 : 28;
  const horizontalEnd = mobile ? 70 : 72;
  const leftX = mobile ? 14 : 10;
  const rightX = mobile ? 86 : 90;
  const seatHeight = mobile ? 76 : 88;
  const gap = mobile ? 12 : 16;
  const padding = mobile ? 8 : 12;
  const height = mobile ? grimoireHeights(playerCount).mobile : grimoireHeights(playerCount).desktop;
  const topY = (padding + seatHeight / 2) / height * 100;
  const bottomY = (height - padding - seatHeight / 2) / height * 100;
  const maximumSideCount = Math.max(counts.right, counts.left);
  const positions: Array<{ x: number; y: number }> = [];

  positions.push(...distributedLine(counts.top, horizontalStart, horizontalEnd).map((x) => ({ x, y: topY })));
  positions.push(...sideSlotCenters(counts.right, maximumSideCount, seatHeight, gap, padding, height).map((y) => ({ x: rightX, y })));
  positions.push(...distributedLine(counts.bottom, horizontalEnd, horizontalStart).map((x) => ({ x, y: bottomY })));
  positions.push(...sideSlotCenters(counts.left, maximumSideCount, seatHeight, gap, padding, height).reverse().map((y) => ({ x: leftX, y })));
  return positions;
}

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
  const start = point(12, 4);
  const firstControl = point(24, 14);
  const secondControl = point(24, -14);
  const end = point(12, -4);
  return `M ${start.x},${start.y} C ${firstControl.x},${firstControl.y} ${secondControl.x},${secondControl.y} ${end.x},${end.y}`;
}

function perimeterCounts(playerCount: number, mobile: boolean) {
  const top = mobile ? Math.min(2, playerCount) : Math.ceil(playerCount / 4);
  const bottom = Math.min(mobile ? 2 : Math.ceil(playerCount / 4), playerCount - top);
  const vertical = playerCount - top - bottom;
  const right = Math.ceil(vertical / 2);
  return { top, right, bottom, left: vertical - right };
}

function wrappedPerimeterHeight(maximumSideCount: number, seatHeight: number, gap: number, padding: number) {
  const sideLaneHeight = maximumSideCount * seatHeight + Math.max(0, maximumSideCount - 1) * gap;
  return padding * 2 + seatHeight * 2 + gap * 2 + sideLaneHeight;
}

function sideSlotCenters(count: number, maximumCount: number, seatHeight: number, gap: number, padding: number, height: number) {
  if (count <= 0) return [];
  const maximumLaneHeight = maximumCount * seatHeight + Math.max(0, maximumCount - 1) * gap;
  const occupiedHeight = count * seatHeight + Math.max(0, count - 1) * gap;
  const laneTop = padding + seatHeight + gap + (maximumLaneHeight - occupiedHeight) / 2;
  return Array.from({ length: count }, (_, index) => (laneTop + seatHeight / 2 + index * (seatHeight + gap)) / height * 100);
}

function distributedLine(count: number, start: number, end: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(start + end) / 2];
  return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1));
}
