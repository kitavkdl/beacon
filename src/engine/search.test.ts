import { describe, expect, it } from 'vitest';
import type { Place } from '../data/schema';
import { searchPlaces } from './search';

const pl = (number: string | undefined, name: string, floor: number): Place => ({
  id: number ?? name.toLowerCase().replace(/\W+/g, '-'), number, name, floor, zone: [], entry: [0, 0], source: 'emergency-plan-2014',
});
const P = [
  pl('E2320', 'Special Collections & University Archives', 2),
  pl('E2360', 'Academic Advising', 2),
  pl('S5415', 'United University Professions', 5),
  pl('E3320', 'College of Arts and Sciences', 3),
  pl(undefined, 'Main Stacks Help', 3),
];
const ids = (q: string) => searchPlaces(P, q).map((p) => p.id);

describe('searchPlaces', () => {
  it('matches numbers ignoring case, spaces and hyphens', () => {
    for (const q of ['E2320', 'e-2320', ' e 2320 ']) expect(ids(q)[0]).toBe('E2320');
  });
  it('orders exact, prefix, contains, then names', () => {
    expect(ids('e23')).toEqual(['E2320', 'E2360']);
    expect(ids('2320')).toEqual(['E2320']); // contains tier
    expect(ids('320')).toEqual(['E2320', 'E3320']); // contains tier; floor then id
  });
  it('does not flood on a single character', () => {
    expect(ids('5')).toEqual([]);
    expect(ids('e')).toEqual([]);
  });
  it('matches name substrings', () => {
    expect(ids('university')).toEqual(['E2320', 'S5415']);
    expect(ids('special collections')).toEqual(['E2320']);
  });
  it('returns nothing for an empty query and caps at the limit', () => {
    expect(ids('  ')).toEqual([]);
    expect(searchPlaces(P, 'e2', 1)).toHaveLength(1);
  });
});
