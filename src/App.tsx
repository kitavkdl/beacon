// Main loop: every 250 ms, sample (simulation) or drain the BLE buffer (live) -> locator.ingest -> locate -> render.
import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Venue } from './data/schema';
import { venueEntry, VENUES } from './data/venues';
import { TICK_MS } from './engine/evaluate';
import type { EstimatorKind } from './engine/estimators';
import type { FilterKind } from './engine/filters';
import { Locator, type Fix, type HeardBeacon, type Reading } from './engine/locator';
import { RadioSim, type Pose } from './engine/simulator';
import { liveSupport, startScan } from './live/scanner';
import { Building, type FloorView } from './scene/Building';
import { Beacons, Estimate, Truth } from './scene/Markers';
import { Panel, type LiveState, type Mode } from './ui/Panel';

const TRAIL = 40;
/** Camera offset for a building whose longest side is REF_SPAN m (tuned on NCS); scaled for other sizes. */
const VIEW_OFFSET: [number, number, number] = [70, 62, 65];
const REF_SPAN = 79;

/** Orbit target (centre of the footprint, a little above floor 1) and building size, in world units. */
function framing(venue: Venue) {
  const pts = venue.floors.flatMap((f) => f.outline.flat());
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const target: [number, number, number] = [(x0 + x1) / 2, 3, -(y0 + y1) / 2];
  return { target, span: Math.max(x1 - x0, y1 - y0) };
}

/** Frame the building; back the camera off on narrow (portrait) screens so it all fits. */
function FitCamera({ target, span }: { target: [number, number, number]; span: number }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / s.size.height);
  useEffect(() => {
    const k = Math.max(1, 1.25 / aspect) * Math.max(0.6, span / REF_SPAN);
    camera.position.set(target[0] + VIEW_OFFSET[0] * k, target[1] + VIEW_OFFSET[1] * k, target[2] + VIEW_OFFSET[2] * k);
    camera.lookAt(...target);
  }, [camera, aspect, target, span]);
  return null;
}

export interface Frame {
  /** False until the first tick after a (re)start. */
  started: boolean;
  truth: Pose | null;
  fix: Fix | null;
  heard: HeardBeacon[];
}

const EMPTY: Frame = { started: false, truth: null, fix: null, heard: [] };

export default function App() {
  const [venueId, setVenueId] = useState(VENUES[0].venue.id);
  const entry = venueEntry(venueId);
  const { venue, tour } = entry;
  const [mode, setMode] = useState<Mode>('sim');
  const [estimator, setEstimator] = useState<EstimatorKind>('centroid');
  const [filter, setFilter] = useState<FilterKind>('kalman');
  const [sigma, setSigma] = useState(4);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<FloorView>('auto');
  const [live, setLive] = useState<LiveState>({ status: 'idle' });
  const [frame, setFrame] = useState<Frame>(EMPTY);
  const [trail, setTrail] = useState<Fix[]>([]);

  // One locator and radio sim per building. Built when the building changes, with the current settings
  // (the effects below keep them in sync after that).
  const locator = useMemo(() => new Locator(venue, { estimator, filter }), [venue]);
  const sim = useMemo(() => new RadioSim(venue, { sigma }), [venue]);
  const view3d = useMemo(() => framing(venue), [venue]);
  const simMs = useRef(0);
  const buffer = useRef<Reading[]>([]);
  const stopScan = useRef<(() => void) | null>(null);
  /** Bumped by stopLive, so a scan whose permission prompt resolves after leaving Live mode is stopped at once. */
  const scanGen = useRef(0);

  useEffect(() => locator.setOptions({ estimator, filter }), [locator, estimator, filter]);
  useEffect(() => {
    sim.sigma = sigma;
  }, [sim, sigma]);

  const push = useCallback((f: Frame) => {
    setFrame(f);
    if (f.fix) setTrail((t) => [...t.slice(-(TRAIL - 1)), f.fix!]);
  }, []);

  useEffect(() => {
    if (mode === 'sim' && paused) return;
    const id = setInterval(() => {
      const loc = locator;
      if (mode === 'sim') {
        // Several 250 ms scans per tick at higher speed, so the radio rate per simulated second stays the same.
        // locate() runs every scan too, because floor hysteresis counts locate() calls.
        let truth: Pose = tour.poseAt(simMs.current / 1000);
        let fix: Fix | null = null;
        for (let i = 0; i < speed; i++) {
          simMs.current += TICK_MS;
          truth = tour.poseAt(simMs.current / 1000);
          loc.ingest(sim.sample(truth, simMs.current));
          fix = loc.locate(simMs.current);
        }
        push({ started: true, truth, fix, heard: loc.heardBeacons(simMs.current) });
      } else {
        loc.ingest(buffer.current.splice(0));
        const now = performance.now();
        push({ started: true, truth: null, fix: loc.locate(now), heard: loc.heardBeacons(now) });
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [mode, paused, speed, push, locator, sim, tour]);

  const stopLive = useCallback(() => {
    scanGen.current++;
    stopScan.current?.();
    stopScan.current = null;
    buffer.current = [];
  }, []);
  useEffect(() => stopLive, [stopLive]);

  const changeMode = (m: Mode) => {
    if (m === mode) return;
    stopLive();
    locator.reset();
    setTrail([]);
    setFrame(EMPTY);
    const support = liveSupport();
    setLive(m === 'live' && !support.ok ? { status: 'unsupported', reason: support.reason } : { status: 'idle' });
    setMode(m);
  };

  const beginScan = async () => {
    const gen = scanGen.current;
    setLive({ status: 'starting' });
    try {
      const stop = await startScan(venue.eddystoneNamespace, (r) => buffer.current.push(r));
      if (gen !== scanGen.current) return stop();
      stopScan.current = stop;
      setLive({ status: 'scanning' });
    } catch (e) {
      if (gen === scanGen.current) setLive({ status: 'error', reason: e instanceof Error ? e.message : String(e) });
    }
  };

  const changeVenue = (id: string) => {
    if (id === venueId) return;
    // Live scans filter by the building's namespace, so a running scan stops; press Start again for the new one.
    stopLive();
    simMs.current = 0;
    setTrail([]);
    setFrame(EMPTY);
    setView('auto');
    if (mode === 'live') setLive((l) => (l.status === 'unsupported' ? l : { status: 'idle' }));
    setVenueId(id);
  };

  const restart = () => {
    simMs.current = 0;
    locator.reset();
    setTrail([]);
    setFrame(EMPTY);
  };

  const current = frame.fix?.floor ?? null;
  const focus = view === 'auto' ? current : view === 'all' ? null : view;
  const heardIds = new Set(frame.heard.map((h) => h.beaconId));

  return (
    <div className="app">
      <div className="stage">
        <Canvas camera={{ fov: 40, near: 0.5, far: 1500 }}>
          <FitCamera target={view3d.target} span={view3d.span} />
          <color attach="background" args={['#eef0f2']} />
          <ambientLight intensity={1.6} />
          <directionalLight position={[40, 80, 30]} intensity={1.2} />
          <Building venue={venue} view={view} current={current} />
          <Beacons venue={venue} heard={heardIds} visible={(f) => focus === null || f === focus} />
          {frame.truth && mode === 'sim' && <Truth venue={venue} pose={frame.truth} />}
          {frame.fix && <Estimate venue={venue} fix={frame.fix} trail={trail} />}
          <OrbitControls makeDefault target={view3d.target} maxPolarAngle={Math.PI / 2.05} />
        </Canvas>
        {mode === 'live' && live.status !== 'scanning' ? (
          <div className="overlay-note">Live BLE: not scanning</div>
        ) : (
          frame.started && !frame.fix && <div className="overlay-note">No signal</div>
        )}
      </div>
      <Panel
        entry={entry}
        onVenue={changeVenue}
        mode={mode}
        onMode={changeMode}
        estimator={estimator}
        onEstimator={setEstimator}
        filter={filter}
        onFilter={setFilter}
        sigma={sigma}
        onSigma={setSigma}
        paused={paused}
        onPaused={setPaused}
        speed={speed}
        onSpeed={setSpeed}
        onRestart={restart}
        view={view}
        onView={setView}
        live={live}
        onStartScan={beginScan}
        frame={frame}
      />
    </div>
  );
}
