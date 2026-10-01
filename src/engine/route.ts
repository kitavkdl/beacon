// Multi-floor A* over 0.5 m occupancy grids plus connectors (stairs/elevators), then string-pulled per floor.
import type { Connector, Library, Vec2 } from '../data/schema';
import { buildGrid, CELL, cellCenter, cellIndex, isWalkable, lineOfSight, type Grid } from './grid';

/** Demo weights in meters of walking (not measurements): stairs win one floor, the elevator wins two or more. */
export const connectorCost = (kind: Connector['kind'], floors: number): number =>
  kind === 'stairs' ? 5 + 8 * floors : 15 + 2 * floors;
/** Lowest marginal cost of one more floor; the A* heuristic charges this per floor still to go. */
export const MIN_PER_FLOOR = Math.min(
  ...(['stairs', 'elevator'] as const).map((k) => connectorCost(k, 2) - connectorCost(k, 1)),
);

export interface Point {
  floor: number;
  x: number;
  y: number;
}
export interface Leg {
  floor: number;
  points: Vec2[];
}
export interface Transition {
  connector: Connector;
  from: number;
  to: number;
}
/** Invariant: transitions.length === legs.length - 1 (transition i links leg i to leg i + 1). */
export interface Route {
  legs: Leg[];
  transitions: Transition[];
  /** Walking distance along the smoothed legs, meters (floor changes not included). */
  lengthM: number;
}

const DIRS: [number, number, number][] = [
  [1, 0, CELL], [-1, 0, CELL], [0, 1, CELL], [0, -1, CELL],
  [1, 1, CELL * Math.SQRT2], [1, -1, CELL * Math.SQRT2], [-1, 1, CELL * Math.SQRT2], [-1, -1, CELL * Math.SQRT2],
];

class Heap {
  private a: [number, number][] = [];
  get size() {
    return this.a.length;
  }
  push(k: number, v: number) {
    const a = this.a;
    a.push([k, v]);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const octile = (a: Vec2, b: Vec2) => {
  const dx = Math.abs(a[0] - b[0]);
  const dy = Math.abs(a[1] - b[1]);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
};

export class Router {
  private grids = new Map<string, Grid>();
  private levels: number[];

  constructor(private lib: Library) {
    this.levels = lib.floors.map((f) => f.level);
  }

  grid(level: number, avoidStairs: boolean): Grid {
    const key = `${level}:${avoidStairs}`;
    let g = this.grids.get(key);
    if (!g) {
      g = buildGrid(this.lib.floors.find((f) => f.level === level)!, avoidStairs);
      this.grids.set(key, g);
    }
    return g;
  }

  private offsets(avoid: boolean): number[] {
    const out: number[] = [];
    let acc = 0;
    for (const l of this.levels) {
      out.push(acc);
      acc += this.grid(l, avoid).walk.length;
    }
    return out;
  }

  private state(p: Point, avoid: boolean, off: number[]): number {
    const fi = this.levels.indexOf(p.floor);
    const g = fi < 0 ? null : this.grid(p.floor, avoid);
    const idx = g ? cellIndex(g, [p.x, p.y]) : -1;
    if (!g || idx < 0 || g.walk[idx] !== 1) throw new Error(`Point (${p.floor}, ${p.x}, ${p.y}) is not walkable`);
    return off[fi] + idx;
  }

  /** Neighbours of a state: same-floor 8-moves (no corner cutting) and connector hops. */
  private expand(s: number, avoid: boolean, off: number[], visit: (t: number, cost: number, via?: Connector) => void) {
    let fi = this.levels.length - 1;
    while (off[fi] > s) fi--;
    const level = this.levels[fi];
    const g = this.grid(level, avoid);
    const idx = s - off[fi];
    const i = idx % g.w;
    const j = Math.floor(idx / g.w);
    for (const [di, dj, c] of DIRS) {
      if (!isWalkable(g, i + di, j + dj)) continue;
      if (di && dj && (!isWalkable(g, i + di, j) || !isWalkable(g, i, j + dj))) continue;
      visit(s + dj * g.w + di, c);
    }
    for (const k of this.lib.connectors) {
      if ((avoid && k.kind === 'stairs') || !k.floors.includes(level) || cellIndex(g, [k.x, k.y]) !== idx) continue;
      for (const other of k.floors) {
        if (other === level) continue;
        const ofi = this.levels.indexOf(other);
        const og = this.grid(other, avoid);
        const oidx = cellIndex(og, [k.x, k.y]);
        if (ofi >= 0 && oidx >= 0 && og.walk[oidx] === 1) visit(off[ofi] + oidx, connectorCost(k.kind, Math.abs(other - level)), k);
      }
    }
  }

  private locate(s: number, off: number[], avoid: boolean): { level: number; xy: Vec2 } {
    let fi = this.levels.length - 1;
    while (off[fi] > s) fi--;
    const level = this.levels[fi];
    return { level, xy: cellCenter(this.grid(level, avoid), s - off[fi]) };
  }

  route(from: Point, to: Point, avoidStairs: boolean): Route | null {
    const off = this.offsets(avoidStairs);
    const start = this.state(from, avoidStairs, off);
    const goal = this.state(to, avoidStairs, off);
    const goalXY = this.locate(goal, off, avoidStairs).xy;
    const h = (s: number) => {
      const { level, xy } = this.locate(s, off, avoidStairs);
      return octile(xy, goalXY) + MIN_PER_FLOOR * Math.abs(level - to.floor);
    };
    const gScore = new Map<number, number>([[start, 0]]);
    const prev = new Map<number, { s: number; via?: Connector }>();
    const heap = new Heap();
    heap.push(h(start), start);
    while (heap.size) {
      const [, s] = heap.pop();
      if (s === goal) return this.build(start, goal, prev, off, avoidStairs);
      const gs = gScore.get(s)!;
      this.expand(s, avoidStairs, off, (t, c, via) => {
        const ng = gs + c;
        if (ng < (gScore.get(t) ?? Infinity)) {
          gScore.set(t, ng);
          prev.set(t, { s, via });
          heap.push(ng + h(t), t);
        }
      });
    }
    return null;
  }

  reachable(from: Point, avoidStairs: boolean): (p: Point) => boolean {
    const off = this.offsets(avoidStairs);
    const seen = new Set<number>([this.state(from, avoidStairs, off)]);
    const queue = [...seen];
    while (queue.length) {
      const s = queue.pop()!;
      this.expand(s, avoidStairs, off, (t) => {
        if (!seen.has(t)) {
          seen.add(t);
          queue.push(t);
        }
      });
    }
    return (p) => {
      try {
        return seen.has(this.state(p, avoidStairs, off));
      } catch {
        return false;
      }
    };
  }

  private build(start: number, goal: number, prev: Map<number, { s: number; via?: Connector }>, off: number[], avoid: boolean): Route {
    const chain: { s: number; via?: Connector }[] = [{ s: goal }];
    for (let s = goal; s !== start; ) {
      const p = prev.get(s)!;
      chain[0].via = p.via;
      chain.unshift({ s: p.s });
      s = p.s;
    }
    const legs: { floor: number; cells: Vec2[] }[] = [];
    const transitions: Transition[] = [];
    for (const { s, via } of chain) {
      const { level, xy } = this.locate(s, off, avoid);
      const cur = legs[legs.length - 1];
      if (via) transitions.push({ connector: via, from: cur.floor, to: level });
      if (!cur || via) legs.push({ floor: level, cells: [xy] });
      else cur.cells.push(xy);
    }
    const out = legs.map((l) => ({ floor: l.floor, points: smooth(this.grid(l.floor, avoid), l.cells) }));
    let lengthM = 0;
    for (const l of out) for (let i = 1; i < l.points.length; i++) lengthM += Math.hypot(l.points[i][0] - l.points[i - 1][0], l.points[i][1] - l.points[i - 1][1]);
    return { legs: out, transitions, lengthM };
  }
}

/** String pulling: from each anchor jump to the farthest following cell in sight, then drop turns under 5°. */
export function smooth(g: Grid, cells: Vec2[]): Vec2[] {
  if (cells.length < 3) return cells;
  const pulled: Vec2[] = [cells[0]];
  for (let a = 0; a < cells.length - 1; ) {
    let b = a + 1;
    while (b + 1 < cells.length && lineOfSight(g, cells[a], cells[b + 1])) b++;
    pulled.push(cells[b]);
    a = b;
  }
  const out: Vec2[] = [pulled[0]];
  for (let i = 1; i < pulled.length - 1; i++) {
    const p = out[out.length - 1];
    const q = pulled[i];
    const r = pulled[i + 1];
    const a1 = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const a2 = Math.atan2(r[1] - q[1], r[0] - q[0]);
    const d = Math.abs(((a2 - a1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    // Drop a near-straight vertex only if the shortcut p -> r is itself clear.
    if (d >= (5 * Math.PI) / 180 || !lineOfSight(g, p, r)) out.push(q);
  }
  out.push(pulled[pulled.length - 1]);
  return out;
}
