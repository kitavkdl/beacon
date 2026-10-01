import bench from '../data/bench.json';
import type { Venue } from '../data/schema';
import { VENUES, type VenueEntry } from '../data/venues';
import type { Frame } from '../App';
import type { EstimatorKind } from '../engine/estimators';
import type { FilterKind } from '../engine/filters';
import { CATEGORY_COLOR, type FloorView } from '../scene/Building';

export type Mode = 'sim' | 'live';
export type LiveState =
  | { status: 'idle' | 'starting' | 'scanning' }
  | { status: 'unsupported' | 'error'; reason: string };

interface BenchRow {
  scenario: string;
  estimator: string;
  filter: string;
  sigma: number;
  median: number;
  p90: number;
  floorRate: number;
  spaceRate: number;
}

const ESTIMATORS: [EstimatorKind, string][] = [
  ['centroid', 'Weighted centroid'],
  ['trilateration', 'Trilateration'],
  ['proximity', 'Nearest beacon'],
];
const FILTERS: [FilterKind, string][] = [
  ['kalman', 'Kalman'],
  ['ema', 'Moving average (EMA)'],
  ['none', 'None'],
];
const views = (venue: Venue): [FloorView, string][] => [
  ['auto', 'Follow'],
  ['all', 'All'],
  ...venue.floors.map((f): [FloorView, string] => [f.level, String(f.level)]),
];
const BUILDINGS: [string, string][] = VENUES.map((e) => [e.venue.id, e.label]);
const LEGEND: [string, string][] = [
  ['Office', CATEGORY_COLOR.office],
  ['Lab', CATEGORY_COLOR.laboratory],
  ['Classroom', CATEGORY_COLOR.classroom],
  ['Meeting', CATEGORY_COLOR.conferenceroom],
  ['Corridor', CATEGORY_COLOR.walkway],
  ['Stairs / elevator', CATEGORY_COLOR.stairs],
];

interface Props {
  entry: VenueEntry;
  onVenue: (id: string) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  estimator: EstimatorKind;
  onEstimator: (e: EstimatorKind) => void;
  filter: FilterKind;
  onFilter: (f: FilterKind) => void;
  sigma: number;
  onSigma: (s: number) => void;
  paused: boolean;
  onPaused: (p: boolean) => void;
  speed: number;
  onSpeed: (s: number) => void;
  onRestart: () => void;
  view: FloorView;
  onView: (v: FloorView) => void;
  live: LiveState;
  onStartScan: () => void;
  frame: Frame;
}

function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={String(v)} className={v === value ? 'on' : ''} aria-pressed={v === value} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

function Readout({ mode, frame }: { mode: Mode; frame: Frame }) {
  const { fix, truth } = frame;
  let error = '–';
  if (fix && truth)
    error = fix.floor === truth.floor
      ? `${Math.hypot(fix.x - truth.x, fix.y - truth.y).toFixed(1)} m`
      : `wrong floor (true: ${truth.floor})`;
  return (
    <dl className="readout">
      <dt>Floor</dt>
      <dd>{fix ? fix.floor : '–'}</dd>
      <dt>Space</dt>
      <dd>{fix?.spaceName ?? '–'}</dd>
      <dt>Position</dt>
      <dd>{fix ? `x ${fix.x.toFixed(1)} m, y ${fix.y.toFixed(1)} m` : '–'}</dd>
      <dt>Beacons used</dt>
      <dd>{fix ? fix.used : '–'}</dd>
      {mode === 'sim' && (
        <>
          <dt>Error</dt>
          <dd>
            {error} <span className="tag">simulated</span>
          </dd>
        </>
      )}
    </dl>
  );
}

function BenchTable({ venueId, filter, sigma, estimator }: { venueId: string; filter: FilterKind; sigma: number; estimator: EstimatorKind }) {
  const rows = ((bench as Record<string, BenchRow[]>)[venueId] ?? []).filter((r) => r.filter === filter);
  if (rows.length === 0) return <p className="note">Not benchmarked yet. Run <code>npm run bench</code>.</p>;
  const sigmas = [...new Set(rows.map((r) => r.sigma))];
  const s = sigmas.reduce((best, v) => (Math.abs(v - sigma) < Math.abs(best - sigma) ? v : best), sigmas[0]);
  const pick = (scenario: string, e: string) => rows.find((r) => r.scenario === scenario && r.estimator === e && r.sigma === s);
  return (
    <>
      <table className="bench">
        <thead>
          <tr>
            <th>Method</th>
            <th>Median</th>
            <th>90th pct</th>
            <th>Floor</th>
            <th>In rooms</th>
          </tr>
        </thead>
        <tbody>
          {ESTIMATORS.map(([e, name]) => {
            const w = pick('walk', e);
            const r = pick('rooms', e);
            if (!w || !r) return null;
            return (
              <tr key={e} className={e === estimator ? 'current' : ''}>
                <td>{name}</td>
                <td>{w.median.toFixed(1)} m</td>
                <td>{w.p90.toFixed(1)} m</td>
                <td>{(w.floorRate * 100).toFixed(0)}%</td>
                <td>{r.median.toFixed(1)} m</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="note">
        Simulated with {FILTERS.find(([f]) => f === filter)![1]} filter, noise σ = {s} dB, from <code>npm run bench</code>.
        Median, 90th percentile and floor rate on the walking tour; last column is the median error standing at room
        centres. The simulator has no walls or people, so real errors will be larger.
      </p>
    </>
  );
}

export function Panel(p: Props) {
  const { venue } = p.entry;
  const heard = p.frame.heard.slice(0, 8);
  const beaconFloor = new Map(venue.beacons.map((b) => [b.id, b.floor]));
  return (
    <aside className="panel">
      <header>
        <h1>SBU Beacon Nav</h1>
        <p className="sub">Indoor positioning demo, {venue.name}, Stony Brook University</p>
      </header>

      {BUILDINGS.length > 1 && (
        <section>
          <h2>Building</h2>
          <Segmented label="Building" value={venue.id} onChange={p.onVenue} options={BUILDINGS} />
        </section>
      )}

      <section>
        <h2>Mode</h2>
        <Segmented label="Mode" value={p.mode} onChange={p.onMode} options={[['sim', 'Simulation'], ['live', 'Live BLE']]} />
        {p.mode === 'sim' && (
          <div className="row">
            <button onClick={() => p.onPaused(!p.paused)}>{p.paused ? 'Resume' : 'Pause'}</button>
            <button onClick={p.onRestart}>Restart tour</button>
            <label>
              Speed{' '}
              <select value={p.speed} onChange={(e) => p.onSpeed(Number(e.target.value))}>
                {[1, 2, 4].map((v) => (
                  <option key={v} value={v}>
                    {v}x
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {p.mode === 'sim' && (
          <p className="note">
            {p.entry.tourNote} The simulator turns their true position into beacon signal strengths; the app only sees
            those.
          </p>
        )}
        {p.mode === 'live' && <LivePanel namespace={venue.eddystoneNamespace} live={p.live} onStart={p.onStartScan} />}
      </section>

      <section>
        <h2>Location</h2>
        <Readout mode={p.mode} frame={p.frame} />
      </section>

      <section>
        <h2>Method</h2>
        <label className="field">
          Estimator
          <select value={p.estimator} onChange={(e) => p.onEstimator(e.target.value as EstimatorKind)}>
            {ESTIMATORS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          RSSI filter
          <select value={p.filter} onChange={(e) => p.onFilter(e.target.value as FilterKind)}>
            {FILTERS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {p.mode === 'sim' && (
          <label className="field">
            Signal noise σ: {p.sigma} dB
            <input type="range" min={0} max={10} step={1} value={p.sigma} onChange={(e) => p.onSigma(Number(e.target.value))} />
          </label>
        )}
      </section>

      <section>
        <h2>View</h2>
        <Segmented label="Floor" value={p.view} onChange={p.onView} options={views(venue)} />
        <ul className="legend">
          <li className="wide">
            <span className="dot" style={{ background: '#2d6cdf' }} /> Estimated position
          </li>
          {p.mode === 'sim' && (
            <li className="wide">
              <span className="ring" /> True position (simulation)
            </li>
          )}
          <li className="wide">
            <span className="dot" style={{ background: '#d23c3c' }} /> Beacon heard
            <span className="dot" style={{ background: '#8c8c8c', marginLeft: 10 }} /> not heard
          </li>
          <li className="wide">
            <span className="bar" style={{ background: '#c0662a' }} /> Atrium opening
          </li>
          {LEGEND.map(([name, c]) => (
            <li key={name}>
              <span className="swatch" style={{ background: c }} /> {name}
            </li>
          ))}
        </ul>
        <p className="note">Drag to rotate, scroll or pinch to zoom, right-drag to pan.</p>
      </section>

      <section>
        <h2>Beacons heard ({p.frame.heard.length})</h2>
        {heard.length === 0 ? (
          <p className="note">None.</p>
        ) : (
          <table className="beacons">
            <thead>
              <tr>
                <th>Instance</th>
                <th>Floor</th>
                <th>RSSI</th>
              </tr>
            </thead>
            <tbody>
              {heard.map((h) => (
                <tr key={h.beaconId}>
                  <td>
                    <code>{h.beaconId}</code>
                  </td>
                  <td>{beaconFloor.get(h.beaconId)}</td>
                  <td>{h.rssi.toFixed(0)} dBm</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Simulated accuracy</h2>
        <BenchTable venueId={venue.id} filter={p.filter} sigma={p.sigma} estimator={p.estimator} />
      </section>

      <footer>
        <p>
          {p.entry.credit} {venue.beacons.length} beacon positions are a proposed layout.
        </p>
        <p>Everything runs in this page. No location data is sent anywhere.</p>
        <p>
          <a href="https://github.com/kitavkdl/beacon">Source on GitHub</a>
        </p>
      </footer>
    </aside>
  );
}

function LivePanel({ namespace, live, onStart }: { namespace: string; live: LiveState; onStart: () => void }) {
  if (live.status === 'unsupported') return <p className="warn">{live.reason}</p>;
  return (
    <>
      <p className="note">
        Scans for Eddystone-UID beacons in namespace <code>{namespace}</code> using Web Bluetooth. Only
        beacons in this venue's list are used.
      </p>
      {live.status === 'error' && <p className="warn">{live.reason}</p>}
      {live.status === 'scanning' ? (
        <p className="note">Scanning.</p>
      ) : (
        <button onClick={onStart} disabled={live.status === 'starting'}>
          {live.status === 'starting' ? 'Starting...' : 'Start scan'}
        </button>
      )}
    </>
  );
}
