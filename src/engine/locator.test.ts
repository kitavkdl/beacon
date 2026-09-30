import { describe, expect, it } from 'vitest';
import { FIXTURE } from './fixture';
import { Locator, type Reading } from './locator';
import { RadioSim } from './simulator';

const floorIds = (level: number) => FIXTURE.beacons.filter((b) => b.floor === level).map((b) => b.id);
const all = (level: number, rssi: number, t: number): Reading[] => floorIds(level).map((beaconId) => ({ beaconId, rssi, t }));
const raw = () => new Locator(FIXTURE, { estimator: 'centroid', filter: 'none' });

describe('Locator', () => {
  it('no readings → null', () => {
    expect(raw().locate(0)).toBeNull();
  });

  it('all stale → null', () => {
    const loc = raw();
    loc.ingest(all(1, -60, 0));
    expect(loc.locate(3000)).not.toBeNull();
    expect(loc.locate(3001)).toBeNull();
  });

  it('ignores foreign beacon ids', () => {
    const loc = raw();
    loc.ingest([{ beaconId: 'ffffffffffff', rssi: -40, t: 0 }]);
    expect(loc.locate(0)).toBeNull();
    loc.ingest([...all(1, -70, 0), { beaconId: 'ffffffffffff', rssi: -40, t: 0 }]);
    expect(loc.locate(0)!.used).toBe(6);
  });

  it('point in a wall gap → nearest space by centroid', () => {
    // Single beacon at (5,4) → proximity fix there; move it into the gap via a fake venue beacon.
    const venue = { ...FIXTURE, beacons: [{ id: 'gap000000000', floor: 1, x: 5, y: 8.2, txPower: -59 }] };
    const loc = new Locator(venue, { estimator: 'proximity', filter: 'none' });
    loc.ingest([{ beaconId: 'gap000000000', rssi: -60, t: 0 }]);
    const fix = loc.locate(0)!;
    expect([fix.x, fix.y]).toEqual([5, 8.2]);
    expect(fix.spaceId).toBe('f1-a');
    expect(fix.spaceName).toBe('Office A');
  });

  it('point inside a space → that space', () => {
    const loc = new Locator(FIXTURE, { estimator: 'proximity', filter: 'none' });
    loc.ingest([...all(1, -80, 0), { beaconId: 'b10000000005', rssi: -55, t: 0 }]);
    expect(loc.locate(0)!.spaceId).toBe('f1-lounge');
  });

  it('first fix picks best floor', () => {
    const loc = raw();
    loc.ingest([...all(1, -85, 0), ...all(2, -65, 0)]);
    expect(loc.locate(0)!.floor).toBe(2);
  });

  it('floor hysteresis: one noisy update does not switch, three consecutive do', () => {
    const loc = raw();
    let t = 0;
    const step = (f1: number, f2: number) => {
      t += 250;
      loc.ingest([...all(1, f1, t), ...all(2, f2, t)]);
      return loc.locate(t)!.floor;
    };
    expect(step(-60, -80)).toBe(1);
    expect(step(-70, -60)).toBe(1); // single spike
    expect(step(-60, -80)).toBe(1); // back to normal, counter resets
    expect(step(-70, -60)).toBe(1);
    expect(step(-70, -60)).toBe(1);
    expect(step(-70, -60)).toBe(2); // third consecutive
  });

  it('a lead under 3 dB never switches', () => {
    const loc = raw();
    let t = 0;
    loc.ingest(all(1, -60, t));
    loc.locate(t);
    for (let i = 0; i < 10; i++) {
      t += 250;
      loc.ingest([...all(1, -60, t), ...all(2, -57.5, t)]);
      expect(loc.locate(t)!.floor).toBe(1);
    }
  });

  it('current floor with no fresh beacons switches immediately', () => {
    const loc = raw();
    loc.ingest(all(1, -60, 0));
    expect(loc.locate(0)!.floor).toBe(1);
    loc.ingest(all(2, -90, 3500));
    expect(loc.locate(3500)!.floor).toBe(2);
  });

  it('reset clears state', () => {
    const loc = raw();
    loc.ingest(all(1, -60, 0));
    loc.reset();
    expect(loc.locate(0)).toBeNull();
    expect(loc.heardBeacons(0)).toEqual([]);
  });

  it('setOptions filter change keeps the fix and restarts filters from the current value', () => {
    const loc = raw();
    loc.ingest(all(1, -60, 0));
    loc.setOptions({ filter: 'kalman' });
    expect(loc.locate(0)).not.toBeNull();
    loc.ingest(all(1, -80, 250));
    // A fresh Kalman would jump straight to -80; a restarted one blends from -60.
    const rssi = loc.heardBeacons(250)[0].rssi;
    expect(rssi).toBeGreaterThan(-80);
    expect(rssi).toBeLessThan(-60);
    loc.setOptions({ estimator: 'proximity' });
    expect(loc.locate(250)).not.toBeNull();
  });

  it('heardBeacons lists fresh beacons strongest first, with their floor', () => {
    const loc = raw();
    const [a, b] = floorIds(1);
    const [c] = floorIds(2);
    loc.ingest([
      { beaconId: a, rssi: -70, t: 0 },
      { beaconId: c, rssi: -65, t: 0 },
      { beaconId: b, rssi: -80, t: 2000 },
    ]);
    expect(loc.heardBeacons(2000)).toEqual([
      { beaconId: c, floor: 2, rssi: -65 },
      { beaconId: a, floor: 1, rssi: -70 },
      { beaconId: b, floor: 1, rssi: -80 },
    ]);
    expect(loc.heardBeacons(4000).map((h) => h.beaconId)).toEqual([b]);
  });

  it('walking across floor 1 with centroid+kalman: median error < 5 m, floor always 1', () => {
    const sim = new RadioSim(FIXTURE, { seed: 11, sigma: 4 });
    const loc = new Locator(FIXTURE, { estimator: 'centroid', filter: 'kalman' });
    const errs: number[] = [];
    for (let i = 0; i < 200; i++) {
      const t = i * 250;
      const pose = { floor: 1, x: 2 + (26 * i) / 199, y: 10 };
      loc.ingest(sim.sample(pose, t));
      const fix = loc.locate(t)!;
      expect(fix.floor).toBe(1);
      errs.push(Math.hypot(fix.x - pose.x, fix.y - pose.y));
    }
    errs.sort((a, b) => a - b);
    expect(errs[100]).toBeLessThan(5);
  });
});
