import { describe, expect, it } from 'vitest';
import { distanceFrom, rssiAt } from './pathLoss';

describe('pathLoss', () => {
  it('rssi at 1 m is txPower', () => {
    expect(rssiAt(1, -59)).toBeCloseTo(-59);
  });

  it('round trips', () => {
    for (const d of [0.5, 1, 3.7, 12, 40]) expect(distanceFrom(rssiAt(d, -59), -59)).toBeCloseTo(d, 6);
  });

  it('clamps tiny distances to 0.1 m', () => {
    expect(rssiAt(0, -59)).toBe(rssiAt(0.1, -59));
  });
});
