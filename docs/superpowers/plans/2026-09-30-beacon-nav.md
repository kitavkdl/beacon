# SBU Beacon Nav Implementation Plan

> **Status 2026-09-30:** Tasks 1–2 done, Task 3 data done. Continue from docs/HANDOFF.md §5.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static web demo that locates a (simulated or live-BLE) user inside the NCS building and renders it in 3D.

**Architecture:** Pure-TS engine (`src/engine`) consumes RSSI readings and a `Venue` (`src/data/ncs.json`, traced from the official plans) and returns a `Fix`. React + react-three-fiber render the venue and the fix. A seeded radio simulator feeds the engine in the demo, tests and bench.

**Tech Stack:** Vite, React 19, TypeScript, three / @react-three/fiber / @react-three/drei, vitest. Deploy: Vercel (static).

**Spec:** `docs/SPEC.md`

## Global Constraints
- `src/engine` imports nothing from react/three. Every estimator/filter has a test.
- Venue data follows `src/data/schema.ts`. Names only from plan labels; no room numbers.
- Accuracy numbers shown in UI/docs come from `npm run bench` and say "simulated".
- No backend, no telemetry. UI text English, plain (no emoji, no slogans).

## Review Focus
1. Zero readings / all beacons stale → `locate()` returns `null`, UI shows "No signal" (test in locator).
2. Fewer than 3 beacons heard → trilateration falls back to weighted centroid, never NaN (test in estimators).
3. Position outside every space polygon (walls, voids) → nearest space by centroid distance, not `null` (test in locator).
4. Beacon in `readings` that is not in the venue (live mode: foreign Eddystone) → ignored (test in locator).
5. Standing under the atrium → floor may flip; hysteresis must stop flapping on a single noisy update (test in locator).

---

### Task 1: Scaffold + schema
**Files:** `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/data/schema.ts`, `.gitignore`
**Produces:** types `Vec2 = [number, number]`, `Polygon = Vec2[]`, `Category`, `Space {id,name,category,polygon}`, `Floor {level,name,elevation,height,outline: Polygon[],voids: Polygon[],spaces}`, `Beacon {id,floor,x,y,txPower}`, `Venue {id,name,source,eddystoneNamespace,floors,beacons}`.
- [x] `npm create`-equivalent by hand, install deps, `npm run build` passes on an empty App. Commit.

### Task 2: Engine (subagent)
**Files:** `src/engine/{geometry,pathLoss,filters,estimators,locator,simulator}.ts` + `*.test.ts` next to each.
**Produces:**
- `geometry.ts`: `pointInPolygon(p: Vec2, poly: Polygon): boolean`, `polygonCentroid(poly): Vec2`, `polygonArea(poly): number`.
- `pathLoss.ts`: `PATH_LOSS_N = 2.2`, `rssiAt(d, txPower, n?)`, `distanceFrom(rssi, txPower, n?)`.
- `filters.ts`: `type FilterKind = 'none'|'ema'|'kalman'`, `interface RssiFilter { update(x: number): number }`, `makeFilter(kind): RssiFilter`.
- `estimators.ts`: `interface Anchor {x,y,rssi,txPower}`, `type EstimatorKind = 'proximity'|'centroid'|'trilateration'`, `estimate(kind, anchors): Vec2 | null`.
- `locator.ts`: `interface Reading {beaconId: string; rssi: number; t: number}`, `interface Fix {floor: number; x: number; y: number; spaceId: string|null; spaceName: string|null; used: number}`, `class Locator(venue, {estimator, filter})` with `ingest(readings)`, `locate(now): Fix|null`, `setOptions(partial)`, `reset()`.
- `simulator.ts`: `mulberry32(seed)`, `interface Pose {floor; x; y}`, `class RadioSim(venue, {seed, sigma, dropRate, slabDb, atriumSlabDb})` with `sample(pose, t): Reading[]` and a mutable `sigma`.
- [x] Tests first for each module (Review Focus 1–5 included), then implementation, `npm test` green. Commit.

### Task 3: Trace NCS (M1)
**Files:** `scripts/trace-ncs.mjs` (pixel rectangles + calibration → `src/data/ncs.json` and overlay SVGs), `src/data/ncs.json`, `src/data/venue.ts` (typed loader), `src/data/venue.test.ts`, `docs/FLOORPLAN_TRACING.md`.
- [x] Trace floor 1, check overlay, then floors 2–3 + beacons (data done: `scripts/trace-ncs.mjs` → `src/data/ncs.json`).
- [ ] Remaining: `src/data/venue.ts`, `venue.test.ts`, `docs/FLOORPLAN_TRACING.md` (see docs/HANDOFF.md §5). Tests: every space inside its floor outline, ids unique, beacons on existing floors, no name matches `/\b\d{3,4}[A-Z]?\b/` (room-number guard). Commit.

### Task 4: Tour + integration test + bench
**Files:** `src/data/tour.ts`, `src/engine/integration.test.ts`, `scripts/bench.ts`, `docs/benchmark-sim.md`.
- [ ] Tour walks entrance → atrium → floors 2, 3 via stairs. Integration: centroid+kalman median error < 6 m, floor accuracy > 90% at σ = 4 dB (seeded). Bench prints the markdown table. Commit.

### Task 5: 3D scene + panel + app loop (M3, M4)
**Files:** `src/scene/{Building,Markers}.tsx`, `src/ui/Panel.tsx`, `src/App.tsx`, `src/styles.css`.
- [ ] 250 ms loop: sim.sample → locator.ingest → locate → state. Floor focus, labels for current space, "simulated" label on errors. Manual check in browser. Commit.

### Task 6: Live BLE (M5)
**Files:** `src/live/eddystone.ts` (+ test), `src/live/scanner.ts`.
- [ ] Parser test with a known frame; scanner feature-detects `navigator.bluetooth.requestLEScan`; panel shows reason when unavailable. Commit.

### Task 7: Docs, review, deploy (M6)
- [ ] CLAUDE.md, RESEARCH.md (from owner), README; whole-branch review subagent; `npm run build`; report before push/deploy; deploy.
