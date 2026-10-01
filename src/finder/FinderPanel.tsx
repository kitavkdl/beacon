import type { Library, Place, Tag } from '../data/schema';
import type { Step } from '../engine/directions';
import { floorName } from '../engine/directions';

export const NOTES =
  "Simulated demo. Routes use the library's 2014 emergency floor plans. Room locations and distances are approximate.";
export const CREDIT =
  'Floor geometry traced from the Melville Library Emergency Plan (Stony Brook University Libraries, 2014). Room numbers from its directory and the library website.';
export const STEP_FREE = 'Based on 2014 plans; not verified as step-free.';

export function FinderPanel(p: {
  lib: Library;
  tagId: string | null;
  tag: Tag | null;
  onTag: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
  results: Place[];
  place: Place | null;
  onPlace: (id: string) => void;
  avoidStairs: boolean;
  onAvoidStairs: (v: boolean) => void;
  status: 'need-tag' | 'need-place' | 'no-route' | 'ok';
  steps: Step[];
  activeStep: number | null;
  totalFt: number | null;
  onReplay: () => void;
  onSkip: () => void;
}) {
  const unknown = p.tagId !== null && !p.tag;
  return (
    <aside className="panel finder">
      <h1>Room finder</h1>
      <p className="sub">Melville Library. Tap a tag (simulated), then search for a room.</p>

      <section>
        <h2>You are here</h2>
        <p>{p.tag ? `${p.tag.name} (${floorName(p.tag.floor)})` : 'No tag yet'}</p>
        <label className="field">
          Simulate a tag tap
          <select value={p.tag?.id ?? ''} onChange={(e) => p.onTag(e.target.value)}>
            <option value="" disabled>Choose a tag</option>
            {p.lib.tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        {unknown && <p className="warn">Unknown tag</p>}
      </section>

      <section>
        <h2>Find a room</h2>
        <input type="search" placeholder="Room number or name, e.g. E2320" value={p.query} onChange={(e) => p.onQuery(e.target.value)} aria-label="Find a room" />
        {p.results.length > 0 && (
          <ul className="results">
            {p.results.map((r) => (
              <li key={r.id}>
                <button type="button" className={p.place?.id === r.id ? 'on' : ''} onClick={() => p.onPlace(r.id)}>
                  <strong>{r.number ?? ''}</strong> {r.name} <span className="note">{floorName(r.floor)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {p.place && <p className="note">Approximate location. Source: {p.place.source === 'library-web' ? 'library website' : '2014 directory'}.</p>}
      </section>

      <section>
        <label className="check">
          <input type="checkbox" checked={p.avoidStairs} onChange={(e) => p.onAvoidStairs(e.target.checked)} /> Avoid stairs (elevators only)
        </label>
        <p className="note">{STEP_FREE}</p>
      </section>

      <section>
        <h2>Directions</h2>
        {p.status === 'need-tag' && <p>Choose where you are first.</p>}
        {p.status === 'need-place' && <p>Search for a room.</p>}
        {p.status === 'no-route' && <p className="warn">{p.avoidStairs ? 'No elevator-only route found in these plans.' : 'No route found in these plans.'}</p>}
        {p.status === 'ok' && (
          <>
            <ol className="steps">
              {p.steps.map((s, i) => <li key={i} className={i === p.activeStep ? 'on' : ''}>{s.text}</li>)}
            </ol>
            <p>Total: about {p.totalFt} ft</p>
            {p.avoidStairs && <p className="note">{STEP_FREE}</p>}
            <div className="row">
              <button type="button" onClick={p.onReplay}>Replay</button>
              <button type="button" onClick={p.onSkip}>Skip</button>
            </div>
          </>
        )}
      </section>

      <section>
        <p className="note">{NOTES}</p>
        <p className="note">{CREDIT}</p>
      </section>
    </aside>
  );
}
