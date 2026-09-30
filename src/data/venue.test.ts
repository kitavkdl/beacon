import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '../engine/geometry';
import type { Polygon, Vec2 } from './schema';
import { NCS } from './venue';

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

describe('NCS venue data', () => {
  it('has three floors in ascending elevation', () => {
    expect(NCS.floors.map((f) => f.level)).toEqual([1, 2, 3]);
    for (let i = 1; i < NCS.floors.length; i++) expect(NCS.floors[i].elevation).toBeGreaterThan(NCS.floors[i - 1].elevation);
  });

  it('has unique space and beacon ids', () => {
    const spaceIds = NCS.floors.flatMap((f) => f.spaces.map((s) => s.id));
    expect(new Set(spaceIds).size).toBe(spaceIds.length);
    const beaconIds = NCS.beacons.map((b) => b.id);
    expect(new Set(beaconIds).size).toBe(beaconIds.length);
    for (const id of beaconIds) expect(id).toMatch(/^[0-9a-f]{12}$/);
    expect(NCS.eddystoneNamespace).toMatch(/^[0-9a-f]{20}$/);
  });

  it('puts every beacon on an existing floor, inside its outline', () => {
    for (const b of NCS.beacons) {
      const floor = NCS.floors.find((f) => f.level === b.floor);
      expect(floor, b.id).toBeDefined();
      expect(nearOrInside([b.x, b.y], floor!.outline), b.id).toBe(true);
    }
  });

  it('keeps every space vertex inside its floor outline', () => {
    const bad: string[] = [];
    for (const f of NCS.floors)
      for (const s of f.spaces) for (const p of s.polygon) if (!nearOrInside(p, f.outline)) bad.push(`${s.id} ${p}`);
    expect(bad).toEqual([]);
  });

  it('keeps every void inside its floor outline', () => {
    for (const f of NCS.floors) for (const v of f.voids) for (const p of v) expect(nearOrInside(p, f.outline)).toBe(true);
  });

  it('never uses room numbers in names (the plan has none)', () => {
    for (const f of NCS.floors) for (const s of f.spaces) expect(s.name).not.toMatch(/\b\d{3,4}[A-Z]?\b/);
  });
});
