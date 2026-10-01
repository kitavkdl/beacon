// Stacked venue floors. Each floor group is rotated -90° about X, so polygons are drawn in venue (x, y)
// and "up" is local +z; world position is (x, elevation, -y).
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Category, Floor, Plan, Polygon } from '../data/schema';
import { pointInPolygon } from '../engine/geometry';

export const CATEGORY_COLOR: Record<Category, string> = {
  office: '#c9d6e3',
  laboratory: '#b8d8c4',
  classroom: '#e6d3a8',
  conferenceroom: '#e3c1b0',
  walkway: '#f2f2ef',
  restroom: '#cfcfe6',
  stairs: '#a9a9a9',
  elevator: '#a9a9a9',
  mechanical: '#d4d4d4',
  storage: '#d4d4d4',
  lounge: '#e8dcc8',
  kitchen: '#e8dcc8',
  workroom: '#d9cfe0',
};

export const SLAB = 0.15;
/** Visual-only vertical stretch so stacked floors can be seen between; venue data keeps real elevations. */
export const STACK_SCALE = 2.2;
const WALL_H = 1.1;

const shape = (poly: Polygon, holes: Polygon[] = []) => {
  const s = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  s.holes = holes.map((h) => new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
};

/** Closed polygon edges as a flat LineSegments position array at height z. */
function edges(polys: Polygon[], z: number): Float32Array {
  const out: number[] = [];
  for (const p of polys)
    p.forEach(([x, y], i) => {
      const [x2, y2] = p[(i + 1) % p.length];
      out.push(x, y, z, x2, y2, z);
    });
  return new Float32Array(out);
}

/** Vertical quads along the outline, as a see-through exterior wall. */
function wallGeometry(polys: Polygon[], h: number): THREE.BufferGeometry {
  const pos: number[] = [];
  for (const p of polys)
    p.forEach(([x, y], i) => {
      const [x2, y2] = p[(i + 1) % p.length];
      pos.push(x, y, 0, x2, y2, 0, x2, y2, h, x, y, 0, x2, y2, h, x, y, h);
    });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function FloorMesh({ floor, opacity }: { floor: Floor; opacity: number }) {
  const g = useMemo(() => {
    // Slab minus voids; each outline piece takes the voids that lie inside it.
    const slab = new THREE.ExtrudeGeometry(
      floor.outline.map((o) => shape(o, floor.voids.filter((v) => pointInPolygon(v[0], o)))),
      { depth: SLAB, bevelEnabled: false },
    );
    slab.translate(0, 0, -SLAB);
    const spaces = floor.spaces.map((s) => ({ id: s.id, color: CATEGORY_COLOR[s.category], geo: new THREE.ShapeGeometry(shape(s.polygon)) }));
    const lines = new THREE.BufferGeometry();
    lines.setAttribute('position', new THREE.BufferAttribute(edges(floor.spaces.map((s) => s.polygon), 0.02), 3));
    const voidLines = new THREE.BufferGeometry();
    voidLines.setAttribute('position', new THREE.BufferAttribute(edges(floor.voids, 0.02), 3));
    const walls = wallGeometry(floor.outline, WALL_H);
    return { slab, spaces, lines, voidLines, walls };
  }, [floor]);
  // Geometries passed via the geometry prop are not disposed by r3f; floors unmount/remount as the focus changes.
  useEffect(
    () => () => [g.slab, g.lines, g.voidLines, g.walls, ...g.spaces.map((s) => s.geo)].forEach((x) => x.dispose()),
    [g],
  );

  const faded = opacity < 1;
  return (
    <group>
      <mesh geometry={g.slab}>
        <meshStandardMaterial color="#8a8f96" transparent opacity={0.9 * opacity} depthWrite={!faded} />
      </mesh>
      {g.spaces.map((s) => (
        <mesh key={s.id} geometry={s.geo} position={[0, 0, 0.01]}>
          <meshStandardMaterial color={s.color} transparent opacity={opacity} depthWrite={!faded} />
        </mesh>
      ))}
      <lineSegments geometry={g.lines}>
        <lineBasicMaterial color="#5b6470" transparent opacity={0.8 * opacity} />
      </lineSegments>
      <lineSegments geometry={g.voidLines}>
        <lineBasicMaterial color="#c0662a" transparent opacity={opacity} />
      </lineSegments>
      <mesh geometry={g.walls}>
        <meshStandardMaterial color="#9fb3c8" transparent opacity={0.25 * opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

export type FloorView = 'auto' | 'all' | number;

/** Opacity of a floor given the view setting and the floor currently located (auto mode). */
export function floorOpacity(view: FloorView, level: number, current: number | null): number {
  if (view === 'all') return current === null || level === current ? 1 : 0.35;
  const focus = view === 'auto' ? current : view;
  if (focus === null) return 1;
  return level === focus ? 1 : 0.12;
}

export function Building({ venue, view, current }: { venue: Plan; view: FloorView; current: number | null }) {
  return (
    <>
      {venue.floors.map((f) => {
        const opacity = floorOpacity(view, f.level, current);
        // Floors above the focused one are hidden entirely so they don't block the view from above.
        const focus = view === 'auto' ? current : view === 'all' ? null : view;
        if (focus !== null && f.level > focus) return null;
        return (
          <group key={f.level} position={[0, f.elevation * STACK_SCALE, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <FloorMesh floor={f} opacity={opacity} />
          </group>
        );
      })}
    </>
  );
}
