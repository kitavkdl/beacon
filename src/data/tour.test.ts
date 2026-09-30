import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '../engine/geometry';
import type { Category } from './schema';
import { TOUR, TOUR_SECONDS, tourPose } from './tour';
import { NCS } from './venue';

// Categories the walker may pass through. Anything else (offices, labs...) means the route cuts through a room.
const OPEN: Category[] = ['walkway', 'stairs', 'lounge'];

describe('tour', () => {
  it('starts at the main entrance and loops', () => {
    expect(tourPose(0)).toEqual(TOUR[0]);
    const p = tourPose(TOUR_SECONDS + 12);
    expect(p).toEqual(tourPose(12));
    expect(TOUR_SECONDS).toBeGreaterThan(200);
  });

  it('visits all three floors', () => {
    const floors = new Set<number>();
    for (let t = 0; t < TOUR_SECONDS; t += 1) floors.add(tourPose(t).floor);
    expect([...floors].sort()).toEqual([1, 2, 3]);
  });

  it('only walks through corridors, stairs and open areas, never over a void', () => {
    const bad: string[] = [];
    for (let t = 0; t < TOUR_SECONDS; t += 0.5) {
      const p = tourPose(t);
      const floor = NCS.floors.find((f) => f.level === p.floor)!;
      const here = floor.spaces.filter((s) => pointInPolygon([p.x, p.y], s.polygon));
      if (here.some((s) => !OPEN.includes(s.category)) || here.length === 0)
        bad.push(`t=${t} F${p.floor} (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) ${here.map((s) => s.name).join('|') || 'no space'}`);
      if (floor.voids.some((v) => pointInPolygon([p.x, p.y], v))) bad.push(`t=${t} F${p.floor} over void`);
    }
    expect(bad).toEqual([]);
  });
});
