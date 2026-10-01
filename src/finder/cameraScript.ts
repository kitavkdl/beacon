// Pure camera choreography for a route. World mapping = scene/Markers world(): (x, elevation * stackScale + h, -y).
// Director.tsx plays these shots by calling poseAt every frame; nothing here imports three or React.
import type { Plan, Polygon, Vec2 } from '../data/schema';
import { polygonCentroid } from '../engine/geometry';
import type { Route } from '../engine/route';

export type V3 = [number, number, number];
export interface Pose {
  pos: V3;
  target: V3;
}
/** Same limit as OrbitControls in App/Finder, so control hand-back never snaps. */
export const MAX_POLAR = Math.PI / 2.05;

const BACK = 12;
const UP = 8;
const LOOK = 4;
const EYE = 1;
const SPEED = 6;
const CAP = 45;
const MIN_SHOT = 1.5;

export type Shot =
  | { kind: 'orbit' | 'arrive'; durationS: number; focus: number; start: Pose; center: V3 }
  | { kind: 'move'; durationS: number; focus: number; from: Pose; to: Pose }
  | { kind: 'follow'; durationS: number; focus: number; leg: number; points: Vec2[]; y: number }
  | { kind: 'lift'; durationS: number; focus: number; leg: number; from: Pose; to: Pose; axis: Vec2 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Raise the camera if it would sit below OrbitControls' polar limit. */
function clampPolar(p: Pose): Pose {
  const flat = Math.hypot(p.pos[0] - p.target[0], p.pos[2] - p.target[2]);
  const minDy = flat / Math.tan(MAX_POLAR);
  return p.pos[1] - p.target[1] >= minDy ? p : { pos: [p.pos[0], p.target[1] + minDy, p.pos[2]], target: p.target };
}

export function lengthOf(pts: Vec2[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

function pointAt(pts: Vec2[], s: number): { p: Vec2; seg: Vec2 } {
  for (let i = 1; i < pts.length; i++) {
    const d: Vec2 = [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]];
    const L = Math.hypot(d[0], d[1]);
    if (s <= L || i === pts.length - 1) {
      const t = L ? Math.min(1, Math.max(0, s / L)) : 0;
      return { p: [pts[i - 1][0] + d[0] * t, pts[i - 1][1] + d[1] * t], seg: d };
    }
    s -= L;
  }
  return { p: pts[0], seg: [0, 1] };
}

/** Camera riding behind and above the walker at arc length s; looks LOOK m ahead. y = world height of the floor. */
export function followPose(pts: Vec2[], s: number, y: number): Pose {
  const L = lengthOf(pts);
  const at = pointAt(pts, Math.min(L, Math.max(0, s)));
  const a = pointAt(pts, Math.max(0, s - LOOK)).p;
  const b = pointAt(pts, Math.min(L, s + LOOK));
  let dir: Vec2 = [b.p[0] - a[0], b.p[1] - a[1]];
  if (Math.hypot(dir[0], dir[1]) < 0.5) dir = Math.hypot(at.seg[0], at.seg[1]) > 0 ? at.seg : [0, 1];
  const n = Math.hypot(dir[0], dir[1]);
  const [ux, uy] = [dir[0] / n, dir[1] / n];
  return clampPolar({
    pos: [at.p[0] - ux * BACK, y + UP, -(at.p[1] - uy * BACK)],
    target: [b.p[0], y + EYE, -b.p[1]],
  });
}

function rotateAbout(p: V3, c: V3, ang: number): V3 {
  const dx = p[0] - c[0];
  const dz = p[2] - c[2];
  return [c[0] + dx * Math.cos(ang) - dz * Math.sin(ang), p[1], c[2] + dx * Math.sin(ang) + dz * Math.cos(ang)];
}

export function poseAt(shot: Shot, u: number): Pose {
  const t = Math.min(1, Math.max(0, u));
  switch (shot.kind) {
    case 'orbit':
    case 'arrive': {
      // Full turn around center; the look target eases from the start target to the center in the first quarter.
      const k = ease(Math.min(1, t * 4));
      const target = lerp3(shot.start.target, shot.center, shot.kind === 'arrive' ? k : 0);
      return clampPolar({ pos: rotateAbout(shot.start.pos, shot.center, 2 * Math.PI * t), target });
    }
    case 'move': {
      const k = ease(t);
      return clampPolar({ pos: lerp3(shot.from.pos, shot.to.pos, k), target: lerp3(shot.from.target, shot.to.target, k) });
    }
    case 'follow':
      return followPose(shot.points, t * lengthOf(shot.points), shot.y);
    case 'lift': {
      // Cylindrical blend about the connector axis; the sweep is the end angle's 2πk-alias closest to +120°.
      const k = ease(t);
      const c = shot.axis;
      const cyl = (p: V3) => ({ r: Math.hypot(p[0] - c[0], p[2] + c[1]), a: Math.atan2(p[2] + c[1], p[0] - c[0]), y: p[1] });
      const s0 = cyl(shot.from.pos);
      const s1 = cyl(shot.to.pos);
      let a1 = s1.a;
      while (a1 - s0.a < (2 * Math.PI) / 3 - Math.PI) a1 += 2 * Math.PI;
      while (a1 - s0.a > (2 * Math.PI) / 3 + Math.PI) a1 -= 2 * Math.PI;
      const r = lerp(s0.r, s1.r, k);
      const a = lerp(s0.a, a1, k);
      return clampPolar({
        pos: [c[0] + r * Math.cos(a), lerp(s0.y, s1.y, k), -c[1] + r * Math.sin(a)],
        target: lerp3(shot.from.target, shot.to.target, k),
      });
    }
  }
}

export const totalDuration = (shots: Shot[]) => shots.reduce((s, x) => s + x.durationS, 0);

export function cameraScript(route: Route, plan: Plan, stackScale: number, zone: Polygon, reducedMotion: boolean): Shot[] {
  const elev = (level: number) => (plan.floors.find((f) => f.level === level)?.elevation ?? 0) * stackScale;
  const first = route.legs[0];
  const last = route.legs[route.legs.length - 1];
  const zc = polygonCentroid(zone.length ? zone : [last.points[last.points.length - 1]]);
  const center: V3 = [zc[0], elev(last.floor) + EYE, -zc[1]];

  // Bounding box of the whole plan for the overview, and of the route for reduced motion.
  const allPts = plan.floors.flatMap((f) => f.outline.flat());
  const span = (pts: Vec2[]) => {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, r: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) };
  };
  const overview = (pts: Vec2[], level: number): Pose => {
    const { cx, cy, r } = span(pts);
    const y = elev(level);
    return clampPolar({ pos: [cx + r * 0.6, y + r * 0.9, -(cy - r * 0.9)], target: [cx, y, -cy] });
  };

  if (reducedMotion) {
    const p = overview([...route.legs.flatMap((l) => l.points), ...zone], last.floor);
    return [{ kind: 'move', durationS: 0, focus: last.floor, from: p, to: p }];
  }

  const shots: Shot[] = [];
  const startPose = overview(allPts, first.floor);
  const { cx, cy } = span(allPts);
  shots.push({ kind: 'orbit', durationS: 6, focus: first.floor, start: startPose, center: [cx, elev(first.floor), -cy] });
  shots.push({ kind: 'move', durationS: 2, focus: first.floor, from: startPose, to: followPose(first.points, 0, elev(first.floor)) });

  route.legs.forEach((leg, i) => {
    if (i > 0) {
      const prev = route.legs[i - 1];
      const t = route.transitions[i - 1];
      shots.push({
        kind: 'lift',
        durationS: 2.5,
        focus: leg.floor,
        leg: i,
        from: followPose(prev.points, lengthOf(prev.points), elev(prev.floor)),
        to: followPose(leg.points, 0, elev(leg.floor)),
        axis: [t.connector.x, t.connector.y],
      });
    }
    if (leg.points.length >= 2)
      shots.push({ kind: 'follow', durationS: Math.min(8, Math.max(2, lengthOf(leg.points) / SPEED)), focus: leg.floor, leg: i, points: leg.points, y: elev(leg.floor) });
  });

  const endPose = followPose(last.points, lengthOf(last.points), elev(last.floor));
  shots.push({ kind: 'arrive', durationS: 5, focus: last.floor, start: endPose, center });

  if (totalDuration(shots) > CAP) {
    const fixed = shots.filter((s) => s.kind !== 'follow' && s.kind !== 'lift').reduce((a, s) => a + s.durationS, 0);
    const scalable = totalDuration(shots) - fixed;
    const f = Math.max(0, (CAP - fixed) / scalable);
    for (const s of shots) if (s.kind === 'follow' || s.kind === 'lift') s.durationS = Math.max(MIN_SHOT, s.durationS * f);
    if (totalDuration(shots) > CAP) {
      // Drop the overview orbit; the approach then starts from the same overview pose, so continuity holds.
      shots.shift();
    }
  }
  return shots;
}
