export type SpySeatPosition = { x: number; y: number };

export function spySeatPosition(index: number, playerCount: number): SpySeatPosition {
  const angle = ((360 / playerCount) * index - 90) * (Math.PI / 180);
  const horizontalRadius = playerCount >= 15 ? 43 : playerCount >= 10 ? 41 : 37;
  const verticalRadius = playerCount >= 15 ? 40 : playerCount >= 10 ? 38 : 34;
  return {
    x: 50 + horizontalRadius * Math.sin(angle),
    y: 50 - verticalRadius * Math.cos(angle),
  };
}
