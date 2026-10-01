import { describe, expect, it } from 'vitest';
import type { Route } from '../engine/route';
import { routeFixture } from '../engine/routeFixture';
import { cameraScript, followPose, MAX_POLAR, poseAt, totalDuration, type Pose } from './cameraScript';

const lib = routeFixture();
const zone: [number, number][] = [[12, 4], [16, 4], [16, 6], [12, 6]];
const close = (a: Pose, b: Pose) => [...a.pos, ...a.target].every((v, i) => Math.abs(v - [...b.pos, ...b.target][i]) < 1e-6);
const elevationOK = (p: Pose) => {
  const dy = p.pos[1] - p.target[1];
  const flat = Math.hypot(p.pos[0] - p.target[0], p.pos[2] - p.target[2]);
  return Math.atan2(flat, dy) <= MAX_POLAR + 1e-9;
};
const twoFloors: Route = {
  legs: [
    { floor: 1, points: [[10.25, 5.25], [19.25, 5.25], [19.25, 7.25]] },
    { floor: 3, points: [[19.25, 7.25], [19.25, 5.25], [12.25, 5.25]] },
  ],
  transitions: [{ connector: lib.connectors[1], from: 1, to: 3 }],
  lengthM: 27,
};

describe('cameraScript', () => {
  it('orders the shots with the right focus floors', () => {
    const shots = cameraScript(twoFloors, lib, 2.2, zone, false);
    expect(shots.map((s) => `${s.kind}:${s.focus}`)).toEqual(['orbit:1', 'move:1', 'follow:1', 'lift:3', 'follow:3', 'arrive:3']);
  });

  it('is continuous and respects the polar limit everywhere', () => {
    const shots = cameraScript(twoFloors, lib, 2.2, zone, false);
    for (let i = 1; i < shots.length; i++) expect(close(poseAt(shots[i - 1], 1), poseAt(shots[i], 0))).toBe(true);
    for (const s of shots) for (let u = 0; u <= 1; u += 0.05) expect(elevationOK(poseAt(s, u))).toBe(true);
  });

  it('followPose rides 12 m behind and 8 m above, looking 4 m ahead', () => {
    const p = followPose([[0, 0], [20, 0]], 10, 0);
    [-2, 8, 0].forEach((v, i) => expect(p.pos[i]).toBeCloseTo(v));
    [14, 1, 0].forEach((v, i) => expect(p.target[i]).toBeCloseTo(v));
  });

  it('caps a long route at 45 s', () => {
    const legs = Array.from({ length: 12 }, (_, i) => ({ floor: (i % 3) + 1, points: [[0.25, 5.25], [19.75, 5.25]] as [number, number][] }));
    const transitions = Array.from({ length: 11 }, (_, i) => ({ connector: lib.connectors[1], from: (i % 3) + 1, to: ((i + 1) % 3) + 1 }));
    const shots = cameraScript({ legs, transitions, lengthM: 234 }, lib, 2.2, zone, false);
    expect(totalDuration(shots)).toBeLessThanOrEqual(45);
    for (const s of shots) if (s.kind === 'follow' || s.kind === 'lift') expect(s.durationS).toBeGreaterThanOrEqual(1.5);
  });

  it('start = destination: orbit, move, arrive only', () => {
    const shots = cameraScript({ legs: [{ floor: 1, points: [[3.25, 5.25]] }], transitions: [], lengthM: 0 }, lib, 2.2, zone, false);
    expect(shots.map((s) => s.kind)).toEqual(['orbit', 'move', 'arrive']);
  });

  it('reduced motion is one still shot on the destination floor', () => {
    const shots = cameraScript(twoFloors, lib, 2.2, zone, true);
    expect(shots).toHaveLength(1);
    expect(shots[0]).toMatchObject({ kind: 'move', focus: 3, durationS: 0 });
  });
});
