// Runs the locator against the radio simulator and scores it. Shared by the integration test and scripts/bench.ts.
import type { Venue } from '../data/schema';
import type { EstimatorKind } from './estimators';
import type { FilterKind } from './filters';
import { pointInPolygon } from './geometry';
import { Locator, type Fix } from './locator';
import { RadioSim, type Pose } from './simulator';

export const TICK_MS = 250;

export interface TrialOptions {
  estimator: EstimatorKind;
  filter: FilterKind;
  sigma: number;
  seed: number;
}

export interface Score {
  fixes: number;
  /** Horizontal error (m), over fixes on the correct floor. */
  median: number;
  p90: number;
  /** Share of fixes on the true floor. */
  floorRate: number;
  /** Share of fixes whose space is the space the walker is really in (only where the walker is inside one). */
  spaceRate: number;
}

export interface Sample {
  truth: Pose;
  fix: Fix | null;
}

const quantile = (sorted: number[], q: number) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : NaN;

export function score(venue: Venue, samples: Sample[]): Score {
  const errs: number[] = [];
  let fixes = 0;
  let onFloor = 0;
  let inSpace = 0;
  let spaceHit = 0;
  for (const { truth, fix } of samples) {
    if (!fix) continue;
    fixes++;
    if (fix.floor === truth.floor) {
      onFloor++;
      errs.push(Math.hypot(fix.x - truth.x, fix.y - truth.y));
    }
    const floor = venue.floors.find((f) => f.level === truth.floor);
    const space = floor?.spaces.find((s) => pointInPolygon([truth.x, truth.y], s.polygon));
    if (!space) continue;
    inSpace++;
    if (fix.floor === truth.floor && fix.spaceId === space.id) spaceHit++;
  }
  errs.sort((a, b) => a - b);
  return {
    fixes,
    median: quantile(errs, 0.5),
    p90: quantile(errs, 0.9),
    floorRate: fixes ? onFloor / fixes : 0,
    spaceRate: inSpace ? spaceHit / inSpace : 0,
  };
}

/** Walk `poseAt(seconds)` for `seconds`, one scan every TICK_MS, and score every fix. */
export function walk(venue: Venue, poseAt: (s: number) => Pose, seconds: number, o: TrialOptions): Score {
  const sim = new RadioSim(venue, { seed: o.seed, sigma: o.sigma });
  const loc = new Locator(venue, { estimator: o.estimator, filter: o.filter });
  const samples: Sample[] = [];
  for (let ms = 0; ms <= seconds * 1000; ms += TICK_MS) {
    const truth = poseAt(ms / 1000);
    loc.ingest(sim.sample(truth, ms));
    samples.push({ truth, fix: loc.locate(ms) });
  }
  return score(venue, samples);
}

/** Stand still at each spot for `dwellS` seconds with a fresh locator; score only the last fix. */
export function standAt(venue: Venue, spots: Pose[], dwellS: number, o: TrialOptions): Score {
  const sim = new RadioSim(venue, { seed: o.seed, sigma: o.sigma });
  const samples: Sample[] = [];
  for (const truth of spots) {
    const loc = new Locator(venue, { estimator: o.estimator, filter: o.filter });
    let fix: Fix | null = null;
    for (let ms = 0; ms <= dwellS * 1000; ms += TICK_MS) {
      loc.ingest(sim.sample(truth, ms));
      fix = loc.locate(ms);
    }
    samples.push({ truth, fix });
  }
  return score(venue, samples);
}
