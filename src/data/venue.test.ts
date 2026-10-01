import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '../engine/geometry';
import { MELVILLE } from './library';
import type { Plan, Polygon, Vec2 } from './schema';
import { VENUES } from './venues';

// Traces follow wall centrelines, so shared edges sit exactly on the outline.
const TOL = 0.3;

function distToSegment([px, py]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function nearOrInside(p: Vec2, polys: Polygon[]): boolean {
  return polys.some(
    (poly) => pointInPolygon(p, poly) || poly.some((a, i) => distToSegment(p, a, poly[(i + 1) % poly.length]) <= TOL),
  );
}

const PLANS: [string, Plan][] = [...VENUES.map((e): [string, Plan] => [e.venue.id, e.venue]), ['melville', MELVILLE]];

describe.each<[string, Plan]>(PLANS)('%s plan data', (_id, V) => {
  it('has consecutive floors in ascending elevation', () => {
    const levels = V.floors.map((f) => f.level);
    expect(levels).toEqual(levels.map((_, i) => levels[0] + i));
    for (let i = 1; i < V.floors.length; i++) expect(V.floors[i].elevation).toBeGreaterThan(V.floors[i - 1].elevation);
  });

  it('has unique space ids', () => {
    const spaceIds = V.floors.flatMap((f) => f.spaces.map((s) => s.id));
    expect(new Set(spaceIds).size).toBe(spaceIds.length);
  });

  it('keeps every space vertex inside its floor outline', () => {
    const bad: string[] = [];
    for (const f of V.floors)
      for (const s of f.spaces) for (const p of s.polygon) if (!nearOrInside(p, f.outline)) bad.push(`${s.id} ${p}`);
    expect(bad).toEqual([]);
  });

  it('keeps every void inside its floor outline', () => {
    for (const f of V.floors) for (const v of f.voids) for (const p of v) expect(nearOrInside(p, f.outline)).toBe(true);
  });

  it('never uses room numbers in space names (they live in places, if anywhere)', () => {
    for (const f of V.floors) for (const s of f.spaces) expect(s.name).not.toMatch(/\b\d{3,4}[A-Z]?\b/);
  });
});

describe.each(VENUES.map((e) => [e.venue.id, e.venue] as const))('%s venue beacons', (_id, V) => {
  it('has unique beacon ids and a valid namespace', () => {
    const beaconIds = V.beacons.map((b) => b.id);
    expect(new Set(beaconIds).size).toBe(beaconIds.length);
    for (const id of beaconIds) expect(id).toMatch(/^[0-9a-f]{12}$/);
    expect(V.eddystoneNamespace).toMatch(/^[0-9a-f]{20}$/);
  });

  it('puts every beacon on an existing floor, inside its outline', () => {
    for (const b of V.beacons) {
      const floor = V.floors.find((f) => f.level === b.floor);
      expect(floor, b.id).toBeDefined();
      expect(nearOrInside([b.x, b.y], floor!.outline), b.id).toBe(true);
    }
  });

});
