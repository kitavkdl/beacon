// Route -> English steps. x = east, y = north (plan-up); a positive cross product is a left turn.
import type { Place, Plan, Vec2 } from '../data/schema';
import { pointInPolygon } from './geometry';
import type { Route } from './route';

export const feet = (m: number): number => Math.max(5, Math.round(m / 0.3048 / 5) * 5);
export const floorName = (level: number): string => (level === 0 ? 'the basement' : `floor ${level}`);

const WORDS = ['east', 'northeast', 'north', 'northwest', 'west', 'southwest', 'south', 'southeast'];
export function compass(dx: number, dy: number): string {
  const a = Math.atan2(dy, dx);
  return WORDS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}

/** Signed turn from heading a to heading b, degrees; left is positive. */
export function turnDeg(a: Vec2, b: Vec2): number {
  return (Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]) * 180) / Math.PI;
}

export interface Step {
  text: string;
  /** Index of the leg the step belongs to (floor steps: the leg they lead into). */
  leg: number;
  kind: 'walk' | 'floor' | 'arrive';
  /** Arc-length range along the leg covered by a walk step, meters (0, 0 for other kinds). */
  s0: number;
  s1: number;
}

/** Segments shorter than this (doorway jogs through a 0.5 m threshold) never start a step or change the heading. */
const SHORT = 1.5;

function walkwayName(plan: Plan, level: number, p: Vec2): string | null {
  const f = plan.floors.find((x) => x.level === level);
  const s = f?.spaces.find((s) => (s.category === 'walkway' || s.category === 'lounge') && pointInPolygon(p, s.polygon));
  return s ? s.name : null;
}

const label = (place: Place) => (place.number ? `${place.name} (${place.number})` : place.name);

export function directions(route: Route, plan: Plan, startName: string, place: Place): { steps: Step[]; totalFt: number } {
  const steps: Step[] = [];
  const single = route.legs.length === 1 && route.legs[0].points.length === 1;
  if (single) return { steps: [{ text: `${label(place)} is right here. Approximate location.`, leg: 0, kind: 'arrive', s0: 0, s1: 0 }], totalFt: feet(0) };

  route.legs.forEach((leg, li) => {
    if (li > 0) {
      const t = route.transitions[li - 1];
      steps.push({ text: `Take the ${t.connector.name} to ${floorName(t.to)}.`, leg: li, kind: 'floor', s0: 0, s1: 0 });
    }
    const pts = leg.points;
    let open: { verb: string; meters: number; mid: Vec2; s0: number } | null = null;
    let heading: Vec2 | null = null;
    let s = 0;
    // The first compass word comes from the first real segment, not from a doorway jog.
    const k = pts.findIndex((q, j) => j > 0 && Math.hypot(q[0] - pts[j - 1][0], q[1] - pts[j - 1][1]) >= SHORT);
    const firstDir: Vec2 | null = k > 0 ? [pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]] : null;
    const close = () => {
      if (!open) return;
      const name = walkwayName(plan, leg.floor, open.mid);
      steps.push({ text: `${open.verb} and walk about ${feet(open.meters)} ft${name ? ` along ${name}` : ''}.`, leg: li, kind: 'walk', s0: open.s0, s1: s });
      open = null;
    };
    for (let i = 1; i < pts.length; i++) {
      const d: Vec2 = [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]];
      const m = Math.hypot(d[0], d[1]);
      const mid: Vec2 = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2];
      if (!open) {
        const head = compass(...(firstDir ?? d));
        const verb =
          li === 0
            ? `Start at ${startName}. Head ${head}`
            : `Leave the ${route.transitions[li - 1].connector.kind === 'stairs' ? 'stairs' : 'elevator'}, head ${head}`;
        open = { verb, meters: m, mid, s0: s };
        heading = m >= SHORT ? d : null;
        s += m;
        continue;
      }
      if (m < SHORT || heading === null) {
        // A doorway jog, or the first real heading after one: walk on without a new step.
        open.meters += m;
        if (m >= SHORT) heading = d;
        s += m;
        continue;
      }
      const t = turnDeg(heading, d);
      heading = d;
      if (Math.abs(t) < 30) {
        open.meters += m;
        s += m;
        continue;
      }
      close();
      open = { verb: Math.abs(t) > 150 ? 'Turn around' : t > 0 ? 'Turn left' : 'Turn right', meters: m, mid, s0: s };
      s += m;
    }
    close();
  });
  steps.push({ text: `${label(place)} is in this area. Approximate location.`, leg: route.legs.length - 1, kind: 'arrive', s0: 0, s1: 0 });
  return { steps, totalFt: feet(route.lengthM) };
}
