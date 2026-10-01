import { Line } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Library, Place, Tag } from '../data/schema';
import type { Route } from '../engine/route';
import { STACK_SCALE } from '../scene/Building';
import { world } from '../scene/Markers';

const LIFT = 0.35;

export function RouteLine({ lib, route, tag, place, visible }: {
  lib: Library;
  route: Route | null;
  tag: Tag | null;
  place: Place | null;
  visible: (floor: number) => boolean;
}) {
  const zoneGeo = useMemo(() => {
    if (!place) return null;
    return new THREE.ShapeGeometry(new THREE.Shape(place.zone.map(([x, y]) => new THREE.Vector2(x, y))));
  }, [place]);
  useEffect(() => () => zoneGeo?.dispose(), [zoneGeo]);
  const zoneY = place ? (lib.floors.find((f) => f.level === place.floor)?.elevation ?? 0) * STACK_SCALE + 0.05 : 0;
  return (
    <>
      {route?.legs.filter((l) => visible(l.floor) && l.points.length > 1).map((l, i) => (
        <Line key={i} points={l.points.map(([x, y]) => world(lib, l.floor, x, y, LIFT))} color="#d23c3c" lineWidth={4} />
      ))}
      {tag && visible(tag.floor) && (
        <mesh position={world(lib, tag.floor, tag.x, tag.y, 0.8)}>
          <sphereGeometry args={[0.6, 16, 12]} />
          <meshBasicMaterial color="#2d6cdf" />
        </mesh>
      )}
      {place && zoneGeo && visible(place.floor) && (
        <mesh geometry={zoneGeo} position={[0, zoneY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color="#f08c00" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}
