import type { Floor, Library, Polygon, Space } from '../data/schema';

const rect = (x0: number, y0: number, x1: number, y1: number): Polygon => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const sp = (id: string, name: string, category: Space['category'], polygon: Polygon): Space => ({ id, name, category, polygon });

function floor(level: number, extra: Space[]): Floor {
  return {
    level,
    name: `Floor ${level}`,
    elevation: (level - 1) * 4,
    height: 4,
    outline: [rect(0, 0, 20, 10)],
    voids: [],
    spaces: [
      sp(`n${level}`, `North corridor, floor ${level}`, 'walkway', rect(0, 4, 20, 6)),
      sp(`st${level}`, 'West stairs', 'stairs', rect(0, 6, 2, 8)),
      sp(`el${level}`, 'East elevator', 'elevator', rect(18, 6, 20, 8)),
      ...extra,
    ],
  };
}

/** Synthetic three-floor library for engine tests. */
export function routeFixture({ door = true, elevator = true } = {}): Library {
  const f1extra = [sp('s1', 'South corridor, floor 1', 'walkway', rect(0, 0, 20, 2))];
  if (door) f1extra.push(sp('d1', 'Doorway', 'walkway', rect(9, 2, 10, 4)));
  return {
    id: 'fixture-lib',
    name: 'Fixture library',
    source: 'synthetic',
    floors: [floor(1, f1extra), floor(2, []), floor(3, [])],
    tags: [],
    places: [],
    connectors: [
      { id: 'w-stairs', kind: 'stairs', name: 'West stairs', x: 1.25, y: 7.25, floors: [1, 2, 3] },
      ...(elevator ? [{ id: 'e-elev', kind: 'elevator' as const, name: 'East elevator', x: 19.25, y: 7.25, floors: [1, 2, 3] }] : []),
    ],
  };
}
