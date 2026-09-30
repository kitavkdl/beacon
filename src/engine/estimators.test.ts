import { describe, expect, it } from 'vitest';
import { estimate, type Anchor } from './estimators';
import { rssiAt } from './pathLoss';

const anchorsFor = (p: [number, number], xy: [number, number][]): Anchor[] =>
  xy.map(([x, y]) => ({ x, y, txPower: -59, rssi: rssiAt(Math.hypot(x - p[0], y - p[1]), -59) }));

const SQUARE: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];

describe('estimators', () => {
  it('empty → null', () => {
    expect(estimate('proximity', [])).toBeNull();
    expect(estimate('centroid', [])).toBeNull();
    expect(estimate('trilateration', [])).toBeNull();
  });

  it('proximity picks strongest anchor', () => {
    expect(estimate('proximity', anchorsFor([9, 8], SQUARE))).toEqual([10, 10]);
  });

  it('trilateration is exact on noise-free data', () => {
    const [x, y] = estimate('trilateration', anchorsFor([3, 7], SQUARE))!;
    expect(Math.hypot(x - 3, y - 7)).toBeLessThan(0.01);
  });

  it('centroid lies inside the anchors bounding box', () => {
    const [x, y] = estimate('centroid', anchorsFor([2, 3], SQUARE))!;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(10);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(10);
  });

  it('2 anchors → trilateration falls back to centroid', () => {
    const two = anchorsFor([4, 1], [[0, 0], [10, 0]]);
    const tri = estimate('trilateration', two)!;
    expect(tri.every(Number.isFinite)).toBe(true);
    expect(tri).toEqual(estimate('centroid', two));
  });

  it('collinear anchors → finite', () => {
    const line = anchorsFor([4, 3], [[0, 0], [5, 0], [10, 0], [15, 0]]);
    expect(estimate('trilateration', line)!.every(Number.isFinite)).toBe(true);
  });

  it('runaway solutions are clamped to bbox + 5 m', () => {
    // Wildly inconsistent ranges.
    const bad: Anchor[] = [
      { x: 0, y: 0, rssi: -40, txPower: -59 },
      { x: 10, y: 0, rssi: -99, txPower: -59 },
      { x: 0, y: 10, rssi: -99, txPower: -59 },
    ];
    const [x, y] = estimate('trilateration', bad)!;
    expect(x).toBeGreaterThanOrEqual(-5);
    expect(x).toBeLessThanOrEqual(15);
    expect(y).toBeGreaterThanOrEqual(-5);
    expect(y).toBeLessThanOrEqual(15);
  });
});
