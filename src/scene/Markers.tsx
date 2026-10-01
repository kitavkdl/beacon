// Beacons, true position (simulation only), estimated position with trail and the current space label.
import { Html, Line } from '@react-three/drei';
import type { Plan, Venue } from '../data/schema';
import type { Fix } from '../engine/locator';
import type { Pose } from '../engine/simulator';
import { STACK_SCALE } from './Building';

const BEACON_H = 2.5;
const MARK_H = 0.6;

/** Venue (floor, x, y) + height above that floor -> world position (floors drawn with STACK_SCALE). */
export function world(venue: Plan, floor: number, x: number, y: number, h = 0): [number, number, number] {
  const e = venue.floors.find((f) => f.level === floor)?.elevation ?? 0;
  return [x, e * STACK_SCALE + h, -y];
}

export function Beacons({ venue, heard, visible }: { venue: Venue; heard: Set<string>; visible: (floor: number) => boolean }) {
  return (
    <>
      {venue.beacons
        .filter((b) => visible(b.floor))
        .map((b) => (
          <mesh key={b.id} position={world(venue, b.floor, b.x, b.y, BEACON_H)}>
            <sphereGeometry args={[heard.has(b.id) ? 0.35 : 0.22, 12, 8]} />
            <meshBasicMaterial color={heard.has(b.id) ? '#d23c3c' : '#8c8c8c'} />
          </mesh>
        ))}
    </>
  );
}

export function Truth({ venue, pose }: { venue: Venue; pose: Pose }) {
  return (
    <mesh position={world(venue, pose.floor, pose.x, pose.y, 0.08)} rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
      <ringGeometry args={[0.7, 1.0, 32]} />
      <meshBasicMaterial color="#333" transparent depthTest={false} />
    </mesh>
  );
}

export function Estimate({ venue, fix, trail }: { venue: Venue; fix: Fix; trail: Fix[] }) {
  // Trail only on the current floor; a floor switch starts a new trail visually.
  const pts = trail.filter((t) => t.floor === fix.floor).map((t) => world(venue, t.floor, t.x, t.y, 0.15));
  return (
    <>
      {pts.length > 1 && <Line points={pts} color="#2d6cdf" lineWidth={2} transparent opacity={0.6} />}
      {/* Transparent + late renderOrder: drawn after the (transparent) floors, on top of everything. */}
      <mesh position={world(venue, fix.floor, fix.x, fix.y, MARK_H)} renderOrder={10}>
        <sphereGeometry args={[0.9, 20, 14]} />
        <meshBasicMaterial color="#2d6cdf" transparent depthTest={false} />
      </mesh>
      {fix.spaceName && (
        <Html position={world(venue, fix.floor, fix.x, fix.y, 3)} center className="space-label">
          {fix.spaceName}
        </Html>
      )}
    </>
  );
}
