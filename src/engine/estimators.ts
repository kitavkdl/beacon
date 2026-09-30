import type { Vec2 } from '../data/schema';
import { distanceFrom } from './pathLoss';

export interface Anchor {
  x: number;
  y: number;
  rssi: number;
  txPower: number;
}

export type EstimatorKind = 'proximity' | 'centroid' | 'trilateration';

const CENTROID_K = 4;
const TRILAT_K = 6;
const CLAMP_MARGIN = 5;

function centroid(sorted: Anchor[]): Vec2 {
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (const a of sorted.slice(0, CENTROID_K)) {
    const w = 1 / distanceFrom(a.rssi, a.txPower) ** 2;
    sx += w * a.x;
    sy += w * a.y;
    sw += w;
  }
  return [sx / sw, sy / sw];
}

// Linearised least squares: subtracting the last circle equation from the others leaves
// 2(xn-xi)x + 2(yn-yi)y = di² - dn² - xi² + xn² - yi² + yn²; solve the 2x2 normal equations.
function trilaterate(sorted: Anchor[]): Vec2 | null {
  const as = sorted.slice(0, TRILAT_K);
  if (as.length < 3) return null;
  const d = as.map((a) => distanceFrom(a.rssi, a.txPower));
  const n = as.length - 1;
  const { x: xn, y: yn } = as[n];
  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const ax = 2 * (xn - as[i].x);
    const ay = 2 * (yn - as[i].y);
    const b = d[i] ** 2 - d[n] ** 2 - as[i].x ** 2 + xn ** 2 - as[i].y ** 2 + yn ** 2;
    a11 += ax * ax;
    a12 += ax * ay;
    a22 += ay * ay;
    b1 += ax * b;
    b2 += ay * b;
  }
  const det = a11 * a22 - a12 * a12;
  // Relative test: det is ~0 compared to trace² when the anchors are (nearly) collinear.
  if (!(Math.abs(det) > 1e-9 * (a11 + a22) ** 2)) return null;
  const x = (a22 * b1 - a12 * b2) / det;
  const y = (a11 * b2 - a12 * b1) / det;
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

export function estimate(kind: EstimatorKind, anchors: Anchor[]): Vec2 | null {
  if (anchors.length === 0) return null;
  const sorted = [...anchors].sort((a, b) => b.rssi - a.rssi);
  if (kind === 'proximity') return [sorted[0].x, sorted[0].y];
  if (kind === 'centroid') return centroid(sorted);
  const [x, y] = trilaterate(sorted) ?? centroid(sorted);
  const xs = anchors.map((a) => a.x);
  const ys = anchors.map((a) => a.y);
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo - CLAMP_MARGIN), hi + CLAMP_MARGIN);
  return [clamp(x, Math.min(...xs), Math.max(...xs)), clamp(y, Math.min(...ys), Math.max(...ys))];
}
