import type { Floor, Venue } from '../data/schema';
import { pointInPolygon } from './geometry';
import type { Reading } from './locator';
import { rssiAt } from './pathLoss';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller; 1 - u keeps log() away from 0. */
export function gaussian(rng: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

export interface Pose {
  floor: number;
  x: number;
  y: number;
}

export interface SimOptions {
  seed: number;
  sigma: number;
  dropRate: number;
  slabDb: number;
  atriumSlabDb: number;
}

export const DEFAULT_SIM: SimOptions = { seed: 1, sigma: 4, dropRate: 0.1, slabDb: 18, atriumSlabDb: 3 };

const ANTENNA_H = 1.2;
const BEACON_H = 2.5;
const FLOOR_DB = -100;

export class RadioSim {
  sigma: number;
  private opts: SimOptions;
  private rng: () => number;
  private floors: Map<number, Floor>;

  constructor(private venue: Venue, opts: Partial<SimOptions> = {}) {
    this.opts = { ...DEFAULT_SIM, ...opts };
    this.sigma = this.opts.sigma;
    this.rng = mulberry32(this.opts.seed);
    this.floors = new Map(venue.floors.map((f) => [f.level, f]));
  }

  sample(pose: Pose, t: number): Reading[] {
    const uf = this.floors.get(pose.floor);
    if (!uf) return [];
    const out: Reading[] = [];
    for (const b of this.venue.beacons) {
      const bf = this.floors.get(b.floor);
      if (!bf) continue;
      // Always draw both numbers so the stream stays aligned whatever gets dropped.
      const drop = this.rng() < this.opts.dropRate;
      const noise = gaussian(this.rng) * this.sigma;
      if (drop) continue;
      const p1 = [pose.x, pose.y, uf.elevation + ANTENNA_H];
      const p2 = [b.x, b.y, bf.elevation + BEACON_H];
      const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
      const rssi = Math.round(rssiAt(d, b.txPower) - this.slabLoss(p1, p2, uf, bf) + noise);
      if (rssi >= FLOOR_DB) out.push({ beaconId: b.id, rssi, t });
    }
    return out;
  }

  // Each slab between the two floors: find where the segment crosses z = E; if that point
  // is inside a void of the floor at elevation E, the path went through the atrium.
  private slabLoss(p1: number[], p2: number[], f1: Floor, f2: Floor): number {
    const lo = Math.min(f1.elevation, f2.elevation);
    const hi = Math.max(f1.elevation, f2.elevation);
    let loss = 0;
    for (const f of this.venue.floors) {
      if (f.elevation <= lo || f.elevation > hi) continue;
      const s = (f.elevation - p1[2]) / (p2[2] - p1[2]);
      const xy: [number, number] = [p1[0] + s * (p2[0] - p1[0]), p1[1] + s * (p2[1] - p1[1])];
      loss += f.voids.some((v) => pointInPolygon(xy, v)) ? this.opts.atriumSlabDb : this.opts.slabDb;
    }
    return loss;
  }
}
