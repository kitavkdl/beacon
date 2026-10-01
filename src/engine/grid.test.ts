import { describe, expect, it } from 'vitest';
import type { Floor, Polygon, Space } from '../data/schema';
import { buildGrid, cellCenter, cellIndex, lineOfSight } from './grid';

const rect = (x0: number, y0: number, x1: number, y1: number): Polygon => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const sp = (id: string, polygon: Polygon, category: Space['category'] = 'walkway'): Space => ({ id, name: id, category, polygon });
const floor = (spaces: Space[], voids: Polygon[] = []): Floor => ({
  level: 1, name: 'F1', elevation: 0, height: 4, outline: [rect(0, 0, 10, 10)], voids, spaces,
});

describe('grid', () => {
  it('rasterises an L corridor, cell centres on the 0.25 + 0.5k lattice', () => {
    const g = buildGrid(floor([sp('a', rect(0, 0, 10, 1)), sp('b', rect(0, 1, 1, 10))]));
    expect([g.x0, g.y0, g.w, g.h]).toEqual([0, 0, 20, 20]);
    expect(cellCenter(g, cellIndex(g, [3.1, 0.4]))).toEqual([3.25, 0.25]);
    expect(g.walk[cellIndex(g, [5, 0.5])]).toBe(1);
    expect(g.walk[cellIndex(g, [5, 5])]).toBe(0);
    expect(cellIndex(g, [-1, 0])).toBe(-1);
  });

  it('ignores non-walkable categories, drops stairs when avoiding them, subtracts voids', () => {
    const f = floor([sp('o', rect(0, 0, 2, 2), 'office'), sp('s', rect(2, 0, 4, 2), 'stairs'), sp('w', rect(4, 0, 8, 2))], [rect(6, 0, 8, 2)]);
    const g = buildGrid(f);
    expect(g.walk[cellIndex(g, [1, 1])]).toBe(0);
    expect(g.walk[cellIndex(g, [3, 1])]).toBe(1);
    expect(g.walk[cellIndex(g, [5, 1])]).toBe(1);
    expect(g.walk[cellIndex(g, [7, 1])]).toBe(0);
    expect(buildGrid(f, true).walk[cellIndex(g, [3, 1])]).toBe(0);
  });

  it('blocks line of sight across a one-cell wall gap and opens it with a threshold', () => {
    const a = sp('a', rect(0, 0, 10, 2));
    const b = sp('b', rect(0, 2.5, 10, 4.5));
    const shut = buildGrid(floor([a, b]));
    expect(lineOfSight(shut, [5.25, 1.75], [5.25, 2.75])).toBe(false);
    const open = buildGrid(floor([a, b, sp('door', rect(5, 2, 6, 2.5))]));
    expect(lineOfSight(open, [5.25, 1.75], [5.25, 2.75])).toBe(true);
  });

  it('supercover catches a wall corner that a diagonal grazes', () => {
    // Walkable: x 0..1 for y 0..1, and x 1..2 for y 1..2. They touch only at the corner (1,1).
    const g = buildGrid(floor([sp('a', rect(0, 0, 1, 1)), sp('b', rect(1, 1, 2, 2))]));
    expect(lineOfSight(g, [0.75, 0.75], [1.25, 1.25])).toBe(false);
  });

  it('sees straight along a 1 m corridor', () => {
    const g = buildGrid(floor([sp('a', rect(0, 0, 10, 1))]));
    expect(lineOfSight(g, [0.25, 0.25], [9.75, 0.75])).toBe(true);
    expect(lineOfSight(g, [0.25, 0.25], [9.75, 1.25])).toBe(false);
  });
});
