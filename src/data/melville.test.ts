import { describe, expect, it } from 'vitest';
import { buildGrid, cellIndex } from '../engine/grid';
import { pointInPolygon } from '../engine/geometry';
import { Router } from '../engine/route';
import { MELVILLE as M } from './library';

const onLattice = (v: number) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
const rectilinear = (poly: [number, number][]) =>
  poly.every((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return p[0] === q[0] || p[1] === q[1];
  });
const strings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];

describe('melville data', () => {
  it('has rectilinear, lattice-snapped outlines, voids and walkable spaces', () => {
    for (const f of M.floors)
      for (const poly of [...f.outline, ...f.voids, ...f.spaces.map((s) => s.polygon)]) {
        expect(rectilinear(poly)).toBe(true);
        for (const [x, y] of poly) expect(onLattice(x) && onLattice(y)).toBe(true);
      }
  });

  it('puts tags and place entries on walkable cells in both grids', () => {
    for (const avoid of [false, true]) {
      const grid = (level: number) => buildGrid(M.floors.find((f) => f.level === level)!, avoid);
      for (const t of M.tags) expect(grid(t.floor).walk[cellIndex(grid(t.floor), [t.x, t.y])], `${t.id} avoid=${avoid}`).toBe(1);
      for (const p of M.places) expect(grid(p.floor).walk[cellIndex(grid(p.floor), p.entry)], `${p.id} avoid=${avoid}`).toBe(1);
    }
  });

  it('keeps each connector inside a stairs/elevator space, walkable, on every floor it serves', () => {
    for (const c of M.connectors)
      for (const level of c.floors) {
        const f = M.floors.find((x) => x.level === level)!;
        const core = f.spaces.find((s) => (s.category === 'stairs' || s.category === 'elevator') && pointInPolygon([c.x, c.y], s.polygon));
        expect(core?.category, `${c.id} on ${level}`).toBe(c.kind);
      }
  });

  it('reaches every place from every tag, with and without stairs', () => {
    const r = new Router(M);
    for (const avoid of [false, true])
      for (const t of M.tags) {
        const reach = r.reachable(t, avoid);
        const missing = M.places.filter((p) => !reach({ floor: p.floor, x: p.entry[0], y: p.entry[1] })).map((p) => p.id);
        expect(missing, `${t.id} avoid=${avoid}`).toEqual([]);
      }
  });

  it('keeps the key destinations and a sensible number of tags', () => {
    const ids = new Set(M.places.map((p) => p.id));
    for (const id of ['E2320', 'W1530', 'N1001', 'C1600', 'E3320']) expect(ids.has(id), id).toBe(true);
    expect(M.places.length).toBeGreaterThanOrEqual(40);
    expect(M.tags.length).toBeGreaterThanOrEqual(6);
    expect(M.tags.length).toBeLessThanOrEqual(10);
  });

  it('carries no phone numbers or person-like fields, ids canonical and unique', () => {
    for (const s of strings(M)) {
      expect(s).not.toMatch(/\d{3}[-.\s]\d{4}/);
      expect(s).not.toMatch(/\d{7,}/);
      expect(s).not.toMatch(/@/);
    }
    const ids = M.places.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of M.places) {
      expect(p.id).toMatch(/^[NSEWC]\d{4}$/);
      expect(p.number).toBe(p.id);
      expect(['emergency-plan-2014', 'library-web']).toContain(p.source);
      expect(Object.keys(p).sort()).toEqual(['entry', 'floor', 'id', 'name', 'number', 'source', 'zone']);
    }
  });
});
