// Main loop: every 250 ms, sample (simulation) or drain the BLE buffer (live) -> locator.ingest -> locate -> render.
import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import { tourPose } from './data/tour';
import { NCS } from './data/venue';
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
const TARGET: [number, number, number] = [22, 3, -40];
const VIEW_OFFSET: [number, number, number] = [70, 62, 65];

/** Back the camera off on narrow (portrait) screens so the whole building fits. */
function FitCamera() {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / s.size.height);
  useEffect(() => {
    const k = Math.max(1, 1.25 / aspect);
    camera.position.set(TARGET[0] + VIEW_OFFSET[0] * k, TARGET[1] + VIEW_OFFSET[1] * k, TARGET[2] + VIEW_OFFSET[2] * k);
    camera.lookAt(...TARGET);
  }, [camera, aspect]);
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

  const locator = useRef(new Locator(NCS, { estimator: 'centroid', filter: 'kalman' }));
  const sim = useRef(new RadioSim(NCS, { sigma: 4 }));
  const simMs = useRef(0);
  const buffer = useRef<Reading[]>([]);
  const stopScan = useRef<(() => void) | null>(null);

  useEffect(() => locator.current.setOptions({ estimator, filter }), [estimator, filter]);
  useEffect(() => {
    sim.current.sigma = sigma;
  }, [sigma]);

  const push = useCallback((f: Frame) => {
    setFrame(f);
    if (f.fix) setTrail((t) => [...t.slice(-(TRAIL - 1)), f.fix!]);
  }, []);

  useEffect(() => {
    if (mode === 'sim' && paused) return;
    const id = setInterval(() => {
      const loc = locator.current;
      if (mode === 'sim') {
        // Several 250 ms scans per tick at higher speed, so the radio rate per simulated second stays the same.
        let truth: Pose = tourPose(simMs.current / 1000);
        for (let i = 0; i < speed; i++) {
          simMs.current += TICK_MS;
          truth = tourPose(simMs.current / 1000);
          loc.ingest(sim.current.sample(truth, simMs.current));
        }
        push({ started: true, truth, fix: loc.locate(simMs.current), heard: loc.heardBeacons(simMs.current) });
      } else {
        loc.ingest(buffer.current.splice(0));
        const now = performance.now();
        push({ started: true, truth: null, fix: loc.locate(now), heard: loc.heardBeacons(now) });
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [mode, paused, speed, push]);

  const stopLive = useCallback(() => {
    stopScan.current?.();
    stopScan.current = null;
    buffer.current = [];
  }, []);
  useEffect(() => stopLive, [stopLive]);

  const changeMode = (m: Mode) => {
    if (m === mode) return;
    stopLive();
    locator.current.reset();
    setTrail([]);
    setFrame(EMPTY);
    const support = liveSupport();
    setLive(m === 'live' && !support.ok ? { status: 'unsupported', reason: support.reason } : { status: 'idle' });
    setMode(m);
  };

  const beginScan = async () => {
    setLive({ status: 'starting' });
    try {
      stopScan.current = await startScan(NCS.eddystoneNamespace, (r) => buffer.current.push(r));
      setLive({ status: 'scanning' });
    } catch (e) {
      setLive({ status: 'error', reason: e instanceof Error ? e.message : String(e) });
    }
  };

  const restart = () => {
    simMs.current = 0;
    locator.current.reset();
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
          <FitCamera />
          <color attach="background" args={['#eef0f2']} />
          <ambientLight intensity={1.6} />
          <directionalLight position={[40, 80, 30]} intensity={1.2} />
          <Building venue={NCS} view={view} current={current} />
          <Beacons venue={NCS} heard={heardIds} visible={(f) => focus === null || f === focus} />
          {frame.truth && mode === 'sim' && <Truth venue={NCS} pose={frame.truth} />}
          {frame.fix && <Estimate venue={NCS} fix={frame.fix} trail={trail} />}
          <OrbitControls makeDefault target={TARGET} maxPolarAngle={Math.PI / 2.05} />
        </Canvas>
        {mode === 'live' && live.status !== 'scanning' ? (
          <div className="overlay-note">Live BLE: not scanning</div>
        ) : (
          frame.started && !frame.fix && <div className="overlay-note">No signal</div>
        )}
      </div>
      <Panel
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
