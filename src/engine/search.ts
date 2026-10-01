import type { Place } from '../data/schema';

export const normalize = (s: string): string => s.toLowerCase().replace(/[\s-]+/g, '');
const NUMBER_QUERY = /^[nsewc]?\d+$/;

/** Rank: 0 exact number, 1 number prefix, 2 number contains (2+ chars), 3 name contains; ties by floor then id. */
export function searchPlaces(places: Place[], query: string, limit = 8): Place[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const isNum = NUMBER_QUERY.test(q);
  const ranked: [number, Place][] = [];
  for (const p of places) {
    const num = p.number ? normalize(p.number) : '';
    let r = -1;
    if (isNum && num) r = num === q ? 0 : num.startsWith(q) ? 1 : num.includes(q) ? 2 : -1;
    if (r < 0 && normalize(p.name).includes(q)) r = 3;
    if (r >= 0) ranked.push([r, p]);
  }
  ranked.sort((a, b) => a[0] - b[0] || a[1].floor - b[1].floor || a[1].id.localeCompare(b[1].id));
  return ranked.slice(0, limit).map(([, p]) => p);
}
