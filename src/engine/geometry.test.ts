import { describe, expect, it } from 'vitest';
import type { Polygon } from '../data/schema';
import { pointInPolygon, polygonArea, polygonCentroid } from './geometry';

const square: Polygon = [[0, 0], [4, 0], [4, 4], [0, 4]];
// L-shape: 4x2 bottom bar + 2x2 block on the left, clockwise.
const ell: Polygon = [[0, 0], [0, 4], [2, 4], [2, 2], [4, 2], [4, 0]];

describe('geometry', () => {
  it('pointInPolygon', () => {
    expect(pointInPolygon([2, 2], square)).toBe(true);
    expect(pointInPolygon([5, 2], square)).toBe(false);
    expect(pointInPolygon([3, 3], ell)).toBe(false);
    expect(pointInPolygon([1, 3], ell)).toBe(true);
  });

  it('polygonArea is absolute', () => {
    expect(polygonArea(square)).toBe(16);
    expect(polygonArea(ell)).toBe(12);
  });

  it('polygonCentroid is area-weighted', () => {
    expect(polygonCentroid(square)).toEqual([2, 2]);
    // bar (8 @ [2,1]) + block (4 @ [1,3]) → [20/12, 20/12]
    const [x, y] = polygonCentroid(ell);
    expect(x).toBeCloseTo(5 / 3);
    expect(y).toBeCloseTo(5 / 3);
  });
});
