# SPEC — SBU Beacon Nav

Goal: a web demo that shows "you are here" inside Stony Brook's New Computer Science (NCS)
building in 3D, driven by BLE-beacon RSSI. It must work on any device (simulation) and be
honest about accuracy (simulated numbers are labeled as such).

## Milestones (priority order)

| # | Milestone | Done when |
|---|---|---|
| M1 | Real floor geometry | `src/data/ncs.json` traced from the official plans (all 3 floors), calibration documented in `FLOORPLAN_TRACING.md`, rendered in the app |
| M2 | Positioning engine | `src/engine` (path loss, EMA/Kalman, proximity / weighted centroid / trilateration, locator with floor hysteresis + space lookup, seeded simulator) with unit tests |
| M3 | 3D demo | Floors stacked in 3D, atrium voids visible, beacons + true + estimated position, trail, floor focus |
| M4 | Control panel | Estimator/filter/noise controls, live readouts (floor, space, error), simulated-accuracy table from `npm run bench` |
| M5 | Live BLE (bonus) | Eddystone-UID parser (tested) + Web Bluetooth `requestLEScan`, feature-detected, disabled with a reason where unsupported |
| M6 | Deploy | `npm run build` green, static deploy on Vercel |

## Decisions

- **Coordinates**: building-local meters, x = east, y = north, origin = SW corner of the footprint.
  "North" = plan-up. True north is ~9° counter-clockwise from plan-up (OSM way 529707497); not used in code.
- **Geometry source**: 2015 plans by Mitchell | Giurgola (SBU CS building page; the live URLs 404 as of
  2026-09-30, Wayback snapshots 2015-06-22 work). Scale bar: 88.5 px = 16 ft → 0.0551 m/px, all floors.
- **Names**: only labels printed on the plan (e.g. "RVG Off.", "Conf. Room"). No room numbers exist on the plan; none are invented.
- **Categories**: IMDF unit categories (`office`, `laboratory`, `classroom`, `conferenceroom`, `walkway`, `restroom`, `stairs`, `elevator`, `mechanical`, `storage`, `lounge`, `opentobelow`) so an IMDF export stays a mapping, not a redesign.
- **Radio model (simulator only)**: log-distance path loss (n = 2.2, RSSI@1m = −59 dBm), Gaussian noise σ (default 4 dB),
  10% packet drop, 18 dB per floor slab crossed — reduced to 3 dB where the straight path crosses the slab inside an atrium void.
  The estimator never sees the model's internals beyond RSSI@1m and n.
- **Default estimator**: weighted centroid (k = 4, 1/d² weights) on Kalman-filtered RSSI (RESEARCH.md §3–4).
- **Floor detection**: per-floor score = mean of the top-3 filtered RSSI on that floor; switch floors only after another floor leads by ≥ 3 dB for 3 consecutive updates.
- **Privacy**: no backend, no telemetry, nothing leaves the browser.

## Out of scope (for now)
Routing/turn-by-turn, wall attenuation, fingerprinting, barometer fusion, native apps, other buildings.
