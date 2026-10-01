import { describe, expect, it } from 'vitest';
import { lineOfSight } from './grid';
import { connectorCost, inZone, MIN_PER_FLOOR, Router } from './route';
import { routeFixture } from './routeFixture';

const P = (floor: number, x: number, y: number) => ({ floor, x, y });

describe('connector costs', () => {
  it('never undercut MIN_PER_FLOOR per floor (A* heuristic stays consistent)', () => {
    for (const k of ['stairs', 'elevator'] as const)
      for (let n = 1; n <= 10; n++) expect(connectorCost(k, n)).toBeGreaterThanOrEqual(MIN_PER_FLOOR * n);
  });
  it('stairs win one floor, elevator wins two', () => {
    expect(connectorCost('stairs', 1)).toBeLessThan(connectorCost('elevator', 1));
    expect(connectorCost('elevator', 2)).toBeLessThan(connectorCost('stairs', 2));
  });
});

describe('Router', () => {
  const r = new Router(routeFixture());

  it('walks a straight corridor as a single segment', () => {
    const route = r.route(P(2, 0.25, 5.25), P(2, 19.75, 5.25), false)!;
    expect(route.legs).toHaveLength(1);
    expect(route.legs[0].points).toEqual([[0.25, 5.25], [19.75, 5.25]]);
    expect(route.lengthM).toBeCloseTo(19.5, 6);
  });

  it('goes through the doorway between parallel corridors', () => {
    const route = r.route(P(1, 2.25, 1.25), P(1, 2.25, 5.25), false)!;
    const xs = route.legs[0].points.map((p) => p[0]);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(9);
  });

  it('one floor up from the middle takes the stairs, two floors the elevator', () => {
    expect(r.route(P(1, 10.25, 5.25), P(2, 10.25, 5.25), false)!.transitions[0].connector.kind).toBe('stairs');
    expect(r.route(P(1, 10.25, 5.25), P(3, 10.25, 5.25), false)!.transitions[0].connector.kind).toBe('elevator');
  });

  it('avoidStairs takes the elevator and never enters a stairs cell', () => {
    const route = r.route(P(1, 1.25, 5.25), P(2, 1.25, 5.25), true)!;
    expect(route.transitions.map((t) => t.connector.kind)).toEqual(['elevator']);
    for (const leg of route.legs) for (const [x, y] of leg.points) expect(x <= 2 && y >= 6).toBe(false);
  });

  it('avoidStairs with no elevator finds no route', () => {
    expect(new Router(routeFixture({ elevator: false })).route(P(1, 1.25, 5.25), P(2, 1.25, 5.25), true)).toBeNull();
  });

  it('straightens a run through a 1 m doorway to two points', () => {
    expect(r.route(P(1, 9.25, 0.25), P(1, 9.25, 5.75), false)!.legs[0].points).toEqual([[9.25, 0.25], [9.25, 5.75]]);
  });

  it('never cuts the doorway corners (every segment in sight)', () => {
    const route = r.route(P(1, 0.25, 0.25), P(1, 19.75, 5.75), false)!;
    const g = r.grid(1, false);
    const pts = route.legs[0].points;
    for (let i = 1; i < pts.length; i++) expect(lineOfSight(g, pts[i - 1], pts[i])).toBe(true);
    expect(pts.length).toBeGreaterThan(2);
  });

  it('returns null when the only link is a missing doorway', () => {
    const shut = new Router(routeFixture({ door: false }));
    expect(shut.route(P(1, 5.25, 1.25), P(1, 5.25, 5.25), false)).toBeNull();
    expect(shut.reachable(P(1, 5.25, 1.25), false)(P(1, 5.25, 5.25))).toBe(false);
  });

  it('start = end gives one leg with one point and zero length', () => {
    const route = r.route(P(1, 3.25, 5.25), P(1, 3.25, 5.25), false)!;
    expect(route.legs).toEqual([{ floor: 1, points: [[3.25, 5.25]] }]);
    expect(route.lengthM).toBe(0);
  });

  it('throws on a non-walkable endpoint (a data error)', () => {
    expect(() => r.route(P(1, 5.25, 3.25), P(1, 1.25, 1.25), false)).toThrow(/not walkable/);
  });

  it('every smoothed segment has line of sight; legs split at transitions', () => {
    const route = r.route(P(1, 2.25, 1.25), P(3, 15.25, 5.25), false)!;
    expect(route.legs.map((l) => l.floor)).toEqual([1, 3]);
    for (const leg of route.legs) {
      const g = r.grid(leg.floor, false);
      for (let i = 1; i < leg.points.length; i++) expect(lineOfSight(g, leg.points[i - 1], leg.points[i])).toBe(true);
    }
  });

  it('reachable() agrees with route()', () => {
    const reach = r.reachable(P(1, 2.25, 1.25), true);
    expect(reach(P(3, 15.25, 5.25))).toBe(true);
    expect(reach(P(1, 1.25, 7.25))).toBe(false); // stairs cell, avoid mode
  });
});

describe('inZone', () => {
  const zone: [number, number][] = [[10, 4], [14, 4], [14, 6], [10, 6]];
  const place = { id: 'E2320', number: 'E2320', name: 'X', floor: 2, zone, entry: [12, 3] as [number, number], source: 'library-web' as const };
  it('is true only on the same floor inside the zone', () => {
    expect(inZone({ floor: 2, x: 12, y: 5 }, place)).toBe(true);
    expect(inZone({ floor: 1, x: 12, y: 5 }, place)).toBe(false);
    expect(inZone({ floor: 2, x: 9, y: 5 }, place)).toBe(false);
  });
});
