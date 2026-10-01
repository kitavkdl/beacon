// Occupancy grid over one floor: 0.5 m cells whose centres sit at 0.25 + 0.5k. Walkable = centre inside a walkable
// space and outside every void. Spaces and voids are lattice-snapped (scripts/trace-melville.mjs), so no centre lies on an edge.
import type { Category, Floor, Polygon, Vec2 } from '../data/schema';
import { pointInPolygon } from './geometry';

export const CELL = 0.5;
export const WALKABLE: ReadonlySet<Category> = new Set<Category>(['walkway', 'lounge', 'stairs', 'elevator']);

export interface Grid {
  level: number;
  /** Lower-left corner of cell (0, 0), meters. */
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** 1 = walkable, row-major: idx = j * w + i. */
  walk: Uint8Array;
}

function bbox(polys: Polygon[]): [number, number, number, number] {
  const pts = polys.flat();
  return [
    Math.min(...pts.map((p) => p[0])),
    Math.min(...pts.map((p) => p[1])),
    Math.max(...pts.map((p) => p[0])),
    Math.max(...pts.map((p) => p[1])),
  ];
}

/** Calls fn(idx, centre) for every cell whose centre lies in poly. */
function eachCellIn(g: Grid, poly: Polygon, fn: (idx: number) => void) {
  const [x0, y0, x1, y1] = bbox([poly]);
  const i0 = Math.max(0, Math.floor((x0 - g.x0) / CELL));
  const j0 = Math.max(0, Math.floor((y0 - g.y0) / CELL));
  const i1 = Math.min(g.w - 1, Math.ceil((x1 - g.x0) / CELL));
  const j1 = Math.min(g.h - 1, Math.ceil((y1 - g.y0) / CELL));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const idx = j * g.w + i;
      if (pointInPolygon(cellCenter(g, idx), poly)) fn(idx);
    }
}

export function buildGrid(floor: Floor, avoidStairs = false): Grid {
  const [bx0, by0, bx1, by1] = bbox(floor.outline);
  const x0 = Math.floor(bx0 / CELL) * CELL;
  const y0 = Math.floor(by0 / CELL) * CELL;
  const w = Math.ceil((bx1 - x0) / CELL);
  const h = Math.ceil((by1 - y0) / CELL);
  const g: Grid = { level: floor.level, x0, y0, w, h, walk: new Uint8Array(w * h) };
  for (const s of floor.spaces)
    if (WALKABLE.has(s.category) && !(avoidStairs && s.category === 'stairs')) eachCellIn(g, s.polygon, (k) => (g.walk[k] = 1));
  for (const v of floor.voids) eachCellIn(g, v, (k) => (g.walk[k] = 0));
  return g;
}

export function cellIndex(g: Grid, [x, y]: Vec2): number {
  const i = Math.floor((x - g.x0) / CELL);
  const j = Math.floor((y - g.y0) / CELL);
  return i < 0 || j < 0 || i >= g.w || j >= g.h ? -1 : j * g.w + i;
}

export function cellCenter(g: Grid, idx: number): Vec2 {
  return [g.x0 + ((idx % g.w) + 0.5) * CELL, g.y0 + (Math.floor(idx / g.w) + 0.5) * CELL];
}

export function isWalkable(g: Grid, i: number, j: number): boolean {
  return i >= 0 && j >= 0 && i < g.w && j < g.h && g.walk[j * g.w + i] === 1;
}

/** True when every cell the segment a-b touches is walkable (supercover: a corner crossing needs both side cells). */
export function lineOfSight(g: Grid, a: Vec2, b: Vec2): boolean {
  const x = (a[0] - g.x0) / CELL;
  const y = (a[1] - g.y0) / CELL;
  const dx = (b[0] - g.x0) / CELL - x;
  const dy = (b[1] - g.y0) / CELL - y;
  let i = Math.floor(x);
  let j = Math.floor(y);
  const ti = Math.floor(x + dx);
  const tj = Math.floor(y + dy);
  const si = Math.sign(dx);
  const sj = Math.sign(dy);
  const tdx = si ? Math.abs(1 / dx) : Infinity;
  const tdy = sj ? Math.abs(1 / dy) : Infinity;
  let tmx = si > 0 ? (i + 1 - x) * tdx : si < 0 ? (x - i) * tdx : Infinity;
  let tmy = sj > 0 ? (j + 1 - y) * tdy : sj < 0 ? (y - j) * tdy : Infinity;
  if (!isWalkable(g, i, j)) return false;
  for (let n = Math.abs(ti - i) + Math.abs(tj - j); n > 0 && (i !== ti || j !== tj); n--) {
    if (Math.abs(tmx - tmy) < 1e-9) {
      if (!isWalkable(g, i + si, j) || !isWalkable(g, i, j + sj)) return false;
      i += si;
      j += sj;
      tmx += tdx;
      tmy += tdy;
      n--;
    } else if (tmx < tmy) {
      i += si;
      tmx += tdx;
    } else {
      j += sj;
      tmy += tdy;
    }
    if (!isWalkable(g, i, j)) return false;
  }
  return i === ti && j === tj;
}
