// End to end on every real venue: seeded radio sim -> Kalman -> weighted centroid -> floor + space.
import { describe, expect, it } from 'vitest';
import { NCS } from '../data/venue';
import { VENUES } from '../data/venues';
import { polygonCentroid, pointInPolygon } from './geometry';
import { score, standAt, walk } from './evaluate';
import type { Pose } from './simulator';

const DEFAULT = { estimator: 'centroid', filter: 'kalman', sigma: 4, seed: 7 } as const;

const CASES = VENUES.map((e) => [e.venue.id, e] as const);

describe.each(CASES)('%s simulated walk (sigma 4 dB, centroid + Kalman)', (_id, { venue, tour }) => {
  const s = walk(venue, tour.poseAt, tour.seconds, DEFAULT);

  it('fixes on almost every tick', () => {
    expect(s.fixes).toBeGreaterThan(0.99 * (tour.seconds * 4));
  });

  it('has median error under 6 m', () => {
    expect(s.median).toBeLessThan(6);
  });

  it('picks the right floor more than 90% of the time, atrium included', () => {
    expect(s.floorRate).toBeGreaterThan(0.9);
  });
});

describe.each(CASES)('%s standing still in rooms', (_id, { venue }) => {
  it('lands on the right floor in most rooms (centroids of all spaces, 5 s each)', () => {
    const spots: Pose[] = venue.floors.flatMap((f) =>
      f.spaces
        .map((sp) => ({ floor: f.level, sp, c: polygonCentroid(sp.polygon) }))
        .filter(({ sp, c }) => pointInPolygon(c, sp.polygon))
        .map(({ floor, c }) => ({ floor, x: c[0], y: c[1] })),
    );
    const s = standAt(venue, spots, 5, DEFAULT);
    expect(s.fixes).toBe(spots.length);
    expect(s.floorRate).toBeGreaterThan(0.9);
  });
});

describe('score', () => {
  it('counts missing fixes and wrong floors', () => {
    const truth = { floor: 1, x: 18.8, y: 5.8 };
    const s = score(NCS, [
      { truth, fix: null },
      { truth, fix: { floor: 1, x: 18.8, y: 8.8, spaceId: null, spaceName: null, used: 3 } },
      { truth, fix: { floor: 2, x: 18.8, y: 5.8, spaceId: null, spaceName: null, used: 3 } },
    ]);
    expect(s.fixes).toBe(2);
    expect(s.floorRate).toBe(0.5);
    expect(s.median).toBeCloseTo(3);
  });
});
