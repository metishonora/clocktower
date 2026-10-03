import type { Cast } from './cast';
import type { Spot } from './plazaParts';

// Equal arc-length spacing keeps the tall mobile oval from crowding its sides.
export function readableLayout(c: Cast, width: number, height: number): Map<number, Spot> {
  const rx = Math.max(70, width / 2 - 35);
  const top = Math.max(94, height * .2);
  const bottom = height - 10;
  const cy = (top + bottom) / 2;
  const ry = Math.max(60, (bottom - top) / 2);
  const point = (angle: number) => ({ x: width / 2 - rx * Math.sin(angle), y: cy + ry * Math.cos(angle) });
  const samples = [{ angle: 0, distance: 0 }];
  let previous = point(0);
  for (let i = 1; i <= 360; i++) {
    const angle = i * Math.PI / 180;
    const next = point(angle);
    samples.push({ angle, distance: samples[i - 1].distance + Math.hypot(next.x - previous.x, next.y - previous.y) });
    previous = next;
  }
  const circumference = samples.at(-1)!.distance;
  return new Map(c.players.map((person) => {
    const index = (person.seat - c.meSeat + c.players.length) % c.players.length;
    const distance = index / c.players.length * circumference;
    const sample = samples.find((sample) => sample.distance >= distance)!;
    const p = point(sample.angle);
    return [person.seat, { x: p.x / width * 100, y: p.y / height * 100, scale: 1, z: Math.round(p.y) }];
  }));
}
