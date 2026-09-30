import { describe, expect, it } from 'vitest';
import { FIXTURE } from './fixture';
import { rssiAt } from './pathLoss';
import { RadioSim } from './simulator';

const meanFor = (sim: RadioSim, pose: { floor: number; x: number; y: number }, id: string, n: number) => {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const r = sim.sample(pose, i * 250).find((r) => r.beaconId === id);
    if (r) {
      sum += r.rssi;
      count++;
    }
  }
  return sum / count;
};

describe('RadioSim', () => {
  it('is deterministic for a seed', () => {
    const a = new RadioSim(FIXTURE, { seed: 7 });
    const b = new RadioSim(FIXTURE, { seed: 7 });
    for (let i = 0; i < 20; i++) expect(a.sample({ floor: 1, x: 3, y: 9 }, i)).toEqual(b.sample({ floor: 1, x: 3, y: 9 }, i));
  });

  it('readings are integers stamped with t, all >= -100', () => {
    const rs = new RadioSim(FIXTURE).sample({ floor: 1, x: 3, y: 9 }, 1234);
    expect(rs.length).toBeGreaterThan(0);
    for (const r of rs) {
      expect(Number.isInteger(r.rssi)).toBe(true);
      expect(r.t).toBe(1234);
      expect(r.rssi).toBeGreaterThanOrEqual(-100);
    }
  });

  it('same-floor beacon directly overhead averages the path-loss value', () => {
    // Antenna 1.2 m, beacon 2.5 m → 1.3 m apart; 1 m is geometrically unreachable in this model.
    const sim = new RadioSim(FIXTURE, { seed: 3, sigma: 4, dropRate: 0 });
    const m = meanFor(sim, { floor: 1, x: 5, y: 4 }, 'b10000000000', 4000);
    expect(Math.abs(m - rssiAt(1.3, -59))).toBeLessThan(1);
  });

  it('slab loss is reduced through the atrium void', () => {
    const sim = new RadioSim(FIXTURE, { sigma: 0, dropRate: 0 });
    const d = 4.2 + 2.5 - 1.2;
    const viaVoid = sim.sample({ floor: 1, x: 15, y: 16 }, 0).find((r) => r.beaconId === 'b20000000004')!.rssi;
    const viaSlab = sim.sample({ floor: 1, x: 5, y: 16 }, 0).find((r) => r.beaconId === 'b20000000003')!.rssi;
    expect(Math.abs(viaVoid - (rssiAt(d, -59) - 3))).toBeLessThanOrEqual(0.5);
    expect(Math.abs(viaSlab - (rssiAt(d, -59) - 18))).toBeLessThanOrEqual(0.5);
  });

  it('dropRate 1 drops everything', () => {
    expect(new RadioSim(FIXTURE, { dropRate: 1 }).sample({ floor: 1, x: 5, y: 5 }, 0)).toEqual([]);
  });
});
