import { describe, expect, it } from 'vitest';
import type { Place } from '../data/schema';
import { compass, directions, feet, floorName, turnDeg } from './directions';
import type { Route } from './route';
import { routeFixture } from './routeFixture';

const lib = routeFixture();
const place: Place = { id: 'E2320', number: 'E2320', name: 'Special Collections', floor: 2, zone: [], entry: [0, 0], source: 'library-web' };

describe('units and words', () => {
  it('rounds to 5 ft, never below 5', () => {
    expect(feet(0)).toBe(5);
    expect(feet(3)).toBe(10); // 9.84 ft
    expect(feet(30)).toBe(100); // 98.4 ft
  });
  it('names the basement', () => {
    expect(floorName(0)).toBe('the basement');
    expect(floorName(3)).toBe('floor 3');
  });
  it('turns left positive with x east, y north', () => {
    expect(turnDeg([1, 0], [0, 1])).toBeCloseTo(90); // heading east, then north = left
    expect(turnDeg([1, 0], [0, -1])).toBeCloseTo(-90);
    expect(compass(0, 1)).toBe('north');
    expect(compass(-1, -1)).toBe('southwest');
  });
});

describe('directions', () => {
  it('merges straight runs, then turns, then arrives', () => {
    const route: Route = {
      legs: [{ floor: 1, points: [[0.25, 5.25], [5.25, 5.25], [9.75, 5.5], [9.75, 1.25]] }],
      transitions: [],
      lengthM: 13.76,
    };
    const { steps, totalFt } = directions(route, lib, 'Fixture tag', place);
    // 5 m + 4.51 m (3° drift, merged) = 9.51 m = 31.2 ft -> 30; the doorway leg 4.25 m = 13.9 ft -> 15.
    expect(steps.map((s) => s.text)).toEqual([
      'Start at Fixture tag. Head east and walk about 30 ft along North corridor, floor 1.',
      'Turn right and walk about 15 ft along Doorway.',
      'Special Collections (E2320) is in this area. Approximate location.',
    ]);
    expect(totalFt).toBe(feet(13.76));
  });

  it('folds a doorway jog into the step instead of two 5 ft turns', () => {
    const route: Route = { legs: [{ floor: 1, points: [[0.25, 0.25], [5.75, 2.25], [5.75, 2.75], [9.75, 4.25]] }], transitions: [], lengthM: 10.6 };
    const walks = directions(route, lib, 'T', place).steps.filter((s) => s.kind === 'walk');
    expect(walks).toHaveLength(1);
    expect(walks[0]).toMatchObject({ s0: 0 });
    expect(walks[0].s1).toBeCloseTo(5.85 + 0.5 + 4.27, 1);
  });

  it('says turn around for a reversal', () => {
    const route: Route = { legs: [{ floor: 2, points: [[1.25, 5.25], [10.25, 5.25], [3.25, 5.25]] }], transitions: [], lengthM: 16 };
    expect(directions(route, lib, 'T', place).steps[1].text).toMatch(/^Turn around and walk about 25 ft/);
  });

  it('writes the floor change and leaves the connector without a turn verb', () => {
    const k = lib.connectors[1];
    const route: Route = {
      legs: [
        { floor: 1, points: [[10.25, 5.25], [19.25, 5.25], [19.25, 7.25]] },
        { floor: 3, points: [[19.25, 7.25], [19.25, 5.25], [12.25, 5.25]] },
      ],
      transitions: [{ connector: k, from: 1, to: 3 }],
      lengthM: 27,
    };
    const texts = directions(route, lib, 'T', place).steps.map((s) => s.text);
    expect(texts).toContain('Take the East elevator to floor 3.');
    const i = texts.indexOf('Take the East elevator to floor 3.');
    expect(texts[i + 1]).toMatch(/^Leave the elevator, head south and walk about 5 ft/);
  });

  it('start = destination is a single step', () => {
    const route: Route = { legs: [{ floor: 1, points: [[3.25, 5.25]] }], transitions: [], lengthM: 0 };
    expect(directions(route, lib, 'T', place).steps.map((s) => s.text)).toEqual([
      'Special Collections (E2320) is right here. Approximate location.',
    ]);
  });
});
