// Room finder tab: tag (from #tag= or the picker) + place search -> route -> directions + scripted camera.
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo, useState } from 'react';
import { MELVILLE } from '../data/library';
import { directions } from '../engine/directions';
import { inZone, Router, type Route } from '../engine/route';
import { searchPlaces } from '../engine/search';
import { Building, STACK_SCALE } from '../scene/Building';
import { cameraScript, lengthOf, MAX_POLAR } from './cameraScript';
import { Director, type PlayCommand } from './Director';
import { FinderPanel } from './FinderPanel';
import { RouteLine } from './RouteLine';

const lib = MELVILLE;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function home() {
  const pts = lib.floors.flatMap((f) => f.outline.flat());
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const r = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return { target: [cx, 6, -cy] as [number, number, number], position: [cx + r * 0.7, r * 1.0, -cy + r * 0.8] as [number, number, number] };
}
const HOME = home();

export default function Finder({ tagId, onTag }: { tagId: string | null; onTag: (id: string) => void }) {
  const router = useMemo(() => new Router(lib), []);
  const [query, setQuery] = useState('');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [avoidStairs, setAvoidStairs] = useState(false);
  const [command, setCommand] = useState<PlayCommand>({ id: 0, kind: 'play' });
  const [shotIdx, setShotIdx] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const tag = lib.tags.find((t) => t.id === tagId) ?? null;
  const place = lib.places.find((p) => p.id === placeId) ?? null;
  const results = useMemo(() => searchPlaces(lib.places, query), [query]);
  const route = useMemo((): Route | null => {
    if (!tag || !place) return null;
    // Already standing in the (approximate) zone: "right here", no walk and no follow shots.
    if (inZone(tag, place)) return { legs: [{ floor: tag.floor, points: [[tag.x, tag.y]] }], transitions: [], lengthM: 0 };
    return router.route(tag, { floor: place.floor, x: place.entry[0], y: place.entry[1] }, avoidStairs);
  }, [router, tag, place, avoidStairs]);
  const dir = useMemo(() => (route && tag && place ? directions(route, lib, tag.name, place) : null), [route, tag, place]);
  const shots = useMemo(() => (route && place ? cameraScript(route, lib, STACK_SCALE, place.zone, reducedMotion()) : []), [route, place]);

  const status = !tag ? 'need-tag' : !place ? 'need-place' : route ? 'ok' : 'no-route';
  const shot = shotIdx === null ? null : shots[shotIdx];
  const focus = shot ? shot.focus : route ? route.legs[route.legs.length - 1].floor : tag ? tag.floor : null;
  const steps = dir?.steps ?? [];
  const stepAt = (i: number, u: number): number | null => {
    const sh = shots[i];
    let k = -1;
    if (sh.kind === 'follow') {
      const s = u * lengthOf(sh.points);
      k = steps.findIndex((st) => st.kind === 'walk' && st.leg === sh.leg && s >= st.s0 && s <= st.s1);
    } else if (sh.kind === 'lift') k = steps.findIndex((st) => st.kind === 'floor' && st.leg === sh.leg);
    else if (sh.kind === 'arrive') k = steps.length - 1;
    return k < 0 ? null : k;
  };

  return (
    <div className="app">
      <div className="stage">
        <Canvas camera={{ fov: 40, near: 0.5, far: 2000, position: HOME.position }}>
          <color attach="background" args={['#eef0f2']} />
          <ambientLight intensity={1.6} />
          <directionalLight position={[40, 120, 30]} intensity={1.2} />
          <Building venue={lib} view={focus ?? 'all'} current={focus} />
          <RouteLine lib={lib} route={route} tag={tag} place={place} visible={(f) => focus === null || f <= focus} />
          <OrbitControls makeDefault target={HOME.target} maxPolarAngle={MAX_POLAR} />
          <Director
            shots={shots}
            command={command}
            onShot={setShotIdx}
            stepAt={stepAt}
            onStep={setActiveStep}
            onDone={() => {
              setShotIdx(null);
              setActiveStep(null);
            }}
          />
        </Canvas>
      </div>
      <FinderPanel
        lib={lib}
        tagId={tagId}
        tag={tag}
        onTag={onTag}
        query={query}
        onQuery={setQuery}
        results={results}
        place={place}
        onPlace={(id) => setPlaceId(id)}
        avoidStairs={avoidStairs}
        onAvoidStairs={setAvoidStairs}
        status={status}
        steps={steps}
        activeStep={activeStep}
        totalFt={dir?.totalFt ?? null}
        onReplay={() => setCommand((c) => ({ id: c.id + 1, kind: 'play' }))}
        onSkip={() => setCommand((c) => ({ id: c.id + 1, kind: 'skip' }))}
      />
    </div>
  );
}
