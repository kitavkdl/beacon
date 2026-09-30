import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '../engine/geometry';
import type { Category } from './schema';
import { VENUES } from './venues';

// Categories the walker may pass through. Anything else (offices, labs...) means the route cuts through a room.
const OPEN: Category[] = ['walkway', 'stairs', 'lounge'];

describe.each(VENUES.map((e) => [e.venue.id, e] as const))('%s tour', (_id, { venue: V, tour }) => {
  const { waypoints, seconds, poseAt } = tour;
  it('starts at the main entrance and loops', () => {
    expect(poseAt(0)).toEqual(waypoints[0]);
    const p = poseAt(seconds + 12);
    expect(p).toEqual(poseAt(12));
    expect(seconds).toBeGreaterThan(200);
  });

  it('visits every floor', () => {
    const floors = new Set<number>();
    for (let t = 0; t < seconds; t += 1) floors.add(poseAt(t).floor);
    expect([...floors].sort((a, b) => a - b)).toEqual(V.floors.map((f) => f.level));
  });

  it('only walks through corridors, stairs and open areas, never over a void', () => {
    const bad: string[] = [];
    for (let t = 0; t < seconds; t += 0.5) {
      const p = poseAt(t);
      const floor = V.floors.find((f) => f.level === p.floor)!;
      const here = floor.spaces.filter((s) => pointInPolygon([p.x, p.y], s.polygon));
      if (here.some((s) => !OPEN.includes(s.category)) || here.length === 0)
        bad.push(`t=${t} F${p.floor} (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) ${here.map((s) => s.name).join('|') || 'no space'}`);
      if (floor.voids.some((v) => pointInPolygon([p.x, p.y], v))) bad.push(`t=${t} F${p.floor} over void`);
    }
    expect(bad).toEqual([]);
  });
});
