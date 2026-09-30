// Synthetic 2-floor venue for engine tests. 30 m x 20 m, thin wall gaps between spaces.
import type { Beacon, Polygon, Space, Venue } from '../data/schema';

const rect = (x0: number, y0: number, x1: number, y1: number): Polygon => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

// Atrium opening in floor 2's slab.
export const ATRIUM = rect(12, 13, 18, 19);

const spaces = (level: number): Space[] => [
  { id: `f${level}-a`, name: 'Office A', category: 'office', polygon: rect(0, 0, 10, 8) },
  { id: `f${level}-b`, name: 'Office B', category: 'office', polygon: rect(10.2, 0, 20, 8) },
  { id: `f${level}-lab`, name: 'Lab', category: 'laboratory', polygon: rect(20.2, 0, 30, 8) },
  { id: `f${level}-hall`, name: 'Walkway', category: 'walkway', polygon: rect(0, 8.5, 30, 11.5) },
  { id: `f${level}-class`, name: 'Classroom', category: 'classroom', polygon: rect(0, 12, 12, 20) },
  { id: `f${level}-lounge`, name: 'Lounge', category: 'lounge', polygon: rect(18, 12, 30, 20) },
];

const BEACON_XY: [number, number][] = [
  [5, 4],
  [15, 4],
  [25, 4],
  [5, 16],
  [15, 16],
  [25, 16],
];

const beacons = (level: number): Beacon[] =>
  BEACON_XY.map(([x, y], i) => ({ id: `b${level}000000000${i}`, floor: level, x, y, txPower: -59 }));

export const FIXTURE: Venue = {
  id: 'fixture',
  name: 'Fixture Hall',
  source: 'synthetic',
  eddystoneNamespace: '00000000000000000000',
  floors: [
    { level: 1, name: '1st', elevation: 0, height: 4.2, outline: [rect(0, 0, 30, 20)], voids: [], spaces: spaces(1) },
    { level: 2, name: '2nd', elevation: 4.2, height: 4.2, outline: [rect(0, 0, 30, 20)], voids: [ATRIUM], spaces: spaces(2) },
  ],
  beacons: [...beacons(1), ...beacons(2)],
};
