// Scripted walk used by the simulation, the integration test and the bench.
// Waypoints are venue meters, converted from plan pixels with scripts/trace-ncs.mjs's transform
// (pixel source in the comments). The route stays on corridors, the atrium floor and its galleries.
import type { Pose } from '../engine/simulator';

export const WALK_SPEED = 1.2; // m/s
/** Time to climb or descend one flight; the floor switches halfway. */
export const STAIR_S = 8;

export const TOUR: Pose[] = [
  { floor: 1, x: 18.8, y: 0.8 }, // Main entrance (F1 px 447,1590)
  { floor: 1, x: 18.8, y: 5.8 }, // Atrium, south end (447,1500)
  { floor: 1, x: 18.8, y: 69.7 }, // Atrium, north end (447,340)
  { floor: 1, x: 18.5, y: 71.9 }, // North lobby (440,300)
  { floor: 1, x: 13.2, y: 72.5 }, // North lobby, west (345,290)
  { floor: 1, x: 13.2, y: 74.7 }, // Stair (northwest) (345,250)
  { floor: 2, x: 13.7, y: 74.8 }, // Stair (northwest) (F2 px 350,200)
  { floor: 2, x: 13.7, y: 72.7 }, // North corridor (350,238)
  { floor: 2, x: 16.2, y: 72.4 }, // North corridor at the west gallery (395,245)
  { floor: 2, x: 16.2, y: 20.6 }, // Atrium gallery (west side), south (395,1180)
  { floor: 2, x: 21.1, y: 20.6 }, // Across the south bridge to the east gallery (483,1180)
  { floor: 2, x: 21.1, y: 72.4 }, // Atrium gallery (east side), north (483,245)
  { floor: 2, x: 13.7, y: 72.7 }, // North corridor (350,238)
  { floor: 2, x: 13.7, y: 74.8 }, // Stair (northwest)
  { floor: 3, x: 13.9, y: 75.3 }, // Stair (northwest) (F3 px 340,130)
  { floor: 3, x: 13.9, y: 72.8 }, // North corridor (340,175)
  { floor: 3, x: 16.3, y: 72.8 }, // North corridor at the west gallery (385,175)
  { floor: 3, x: 16.3, y: 22.5 }, // Atrium gallery (west side), south (385,1105)
  { floor: 3, x: 21.1, y: 22.5 }, // Atrium gallery (south end) to the east side (473,1105)
  { floor: 3, x: 21.1, y: 72.8 }, // Atrium gallery (east side), north (473,175)
  { floor: 3, x: 13.9, y: 72.8 }, // North corridor
  { floor: 3, x: 13.9, y: 75.3 }, // Stair (northwest)
  { floor: 2, x: 13.7, y: 74.8 }, // down through floor 2
  { floor: 1, x: 13.2, y: 74.7 }, // Stair (northwest), floor 1
  { floor: 1, x: 13.2, y: 72.5 }, // North lobby, west
  { floor: 1, x: 18.5, y: 71.9 }, // North lobby
  { floor: 1, x: 18.8, y: 69.7 }, // Atrium, north end; then south back to the entrance
];

const legSeconds = (a: Pose, b: Pose) =>
  a.floor !== b.floor ? STAIR_S * Math.abs(b.floor - a.floor) : Math.hypot(b.x - a.x, b.y - a.y) / WALK_SPEED;

// Closed loop: the last waypoint walks back to the first.
const LEGS = TOUR.map((a, i) => ({ a, b: TOUR[(i + 1) % TOUR.length], s: legSeconds(a, TOUR[(i + 1) % TOUR.length]) }));
export const TOUR_SECONDS = LEGS.reduce((s, l) => s + l.s, 0);

/** Where the walker is `t` seconds into the (looping) tour. */
export function tourPose(t: number): Pose {
  let r = ((t % TOUR_SECONDS) + TOUR_SECONDS) % TOUR_SECONDS;
  for (const { a, b, s } of LEGS) {
    if (r > s) {
      r -= s;
      continue;
    }
    const k = s === 0 ? 0 : r / s;
    const floor = a.floor === b.floor ? a.floor : Math.round(a.floor + (b.floor - a.floor) * k);
    return { floor, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }
  return { ...TOUR[0] };
}
