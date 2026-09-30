import type { Beacon, Venue } from '../data/schema';
import { estimate, type Anchor, type EstimatorKind } from './estimators';
import { makeFilter, type FilterKind, type RssiFilter } from './filters';
import { pointInPolygon, polygonCentroid } from './geometry';

export interface Reading {
  beaconId: string;
  rssi: number;
  /** ms */
  t: number;
}

export interface Fix {
  floor: number;
  x: number;
  y: number;
  spaceId: string | null;
  spaceName: string | null;
  used: number;
}

export interface LocatorOptions {
  estimator: EstimatorKind;
  filter: FilterKind;
}

const STALE_MS = 3000;
const FLOOR_TOP_K = 3;
const FLOOR_LEAD_DB = 3;
const FLOOR_CONFIRM = 3;

interface Heard {
  filter: RssiFilter;
  rssi: number;
  t: number;
}

export class Locator {
  private beacons: Map<string, Beacon>;
  private heard = new Map<string, Heard>();
  private floor: number | null = null;
  private candidate: number | null = null;
  private streak = 0;

  constructor(private venue: Venue, private opts: LocatorOptions) {
    this.beacons = new Map(venue.beacons.map((b) => [b.id, b]));
  }

  setOptions(o: Partial<LocatorOptions>): void {
    if (o.filter !== undefined && o.filter !== this.opts.filter) this.heard.clear();
    this.opts = { ...this.opts, ...o };
  }

  reset(): void {
    this.heard.clear();
    this.floor = null;
    this.candidate = null;
    this.streak = 0;
  }

  ingest(readings: Reading[]): void {
    for (const r of readings) {
      if (!this.beacons.has(r.beaconId)) continue;
      let h = this.heard.get(r.beaconId);
      if (!h) this.heard.set(r.beaconId, (h = { filter: makeFilter(this.opts.filter), rssi: r.rssi, t: r.t }));
      h.rssi = h.filter.update(r.rssi);
      h.t = r.t;
    }
  }

  locate(now: number): Fix | null {
    const byFloor = new Map<number, Anchor[]>();
    for (const [id, h] of this.heard) {
      if (now - h.t > STALE_MS) {
        this.heard.delete(id);
        continue;
      }
      const b = this.beacons.get(id)!;
      const list = byFloor.get(b.floor) ?? [];
      list.push({ x: b.x, y: b.y, rssi: h.rssi, txPower: b.txPower });
      byFloor.set(b.floor, list);
    }
    if (byFloor.size === 0) return null;

    const score = new Map<number, number>();
    for (const [f, as] of byFloor) {
      const top = as.map((a) => a.rssi).sort((a, b) => b - a).slice(0, FLOOR_TOP_K);
      score.set(f, top.reduce((s, v) => s + v, 0) / top.length);
    }
    const best = (skip: number | null) => {
      let bf: number | null = null;
      for (const [f, s] of score) if (f !== skip && (bf === null || s > score.get(bf)!)) bf = f;
      return bf;
    };

    if (this.floor === null || !score.has(this.floor)) {
      this.floor = best(null)!;
      this.candidate = null;
      this.streak = 0;
    } else {
      const other = best(this.floor);
      if (other !== null && score.get(other)! - score.get(this.floor)! >= FLOOR_LEAD_DB) {
        this.streak = other === this.candidate ? this.streak + 1 : 1;
        this.candidate = other;
        if (this.streak >= FLOOR_CONFIRM) {
          this.floor = other;
          this.candidate = null;
          this.streak = 0;
        }
      } else {
        this.candidate = null;
        this.streak = 0;
      }
    }

    const anchors = byFloor.get(this.floor)!;
    const [x, y] = estimate(this.opts.estimator, anchors)!;
    const space = this.spaceAt(this.floor, x, y);
    return { floor: this.floor, x, y, spaceId: space?.id ?? null, spaceName: space?.name ?? null, used: anchors.length };
  }

  private spaceAt(level: number, x: number, y: number) {
    const spaces = this.venue.floors.find((f) => f.level === level)?.spaces ?? [];
    const hit = spaces.find((s) => pointInPolygon([x, y], s.polygon));
    if (hit || spaces.length === 0) return hit;
    // ponytail: centroids recomputed per call; cache per floor if venues get large.
    let nearest = spaces[0];
    let bestD = Infinity;
    for (const s of spaces) {
      const [cx, cy] = polygonCentroid(s.polygon);
      const d = Math.hypot(cx - x, cy - y);
      if (d < bestD) [nearest, bestD] = [s, d];
    }
    return nearest;
  }
}
