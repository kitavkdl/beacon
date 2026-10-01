// Top tabs: the NCS beacon demo (App, unchanged) or the Melville room finder (lazy, so melville.json is not in the
// NCS first load). Switching away from NCS unmounts App, whose cleanup stops any Web Bluetooth scan.
import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import App from './App';
import { formatHash, parseHash } from './finder/hash';

const Finder = lazy(() => import('./finder/Finder'));

/** If the room finder's chunk fails to load (offline, or a deploy replaced it), say so instead of a blank page. */
class LoadError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="loading">
        Could not load the room finder. <button type="button" onClick={() => location.reload()}>Reload</button>
      </div>
    ) : (
      this.props.children
    );
  }
}

export default function Root() {
  const [tab, setTab] = useState(() => parseHash(location.hash).tab);
  const [tag, setTag] = useState<string | null>(() => {
    const s = parseHash(location.hash);
    return s.tab === 'finder' ? s.tag : null;
  });

  useEffect(() => {
    const onHash = () => {
      const s = parseHash(location.hash);
      setTab(s.tab);
      if (s.tab === 'finder' && s.tag !== null) setTag(s.tag);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const want = tab === 'finder' ? formatHash(tag) : '';
    if (location.hash !== want) history.replaceState(null, '', want || location.pathname + location.search);
  }, [tab, tag]);

  return (
    <div className="root">
      <nav className="tabs" aria-label="Demo">
        <button type="button" className={tab === 'ncs' ? 'on' : ''} onClick={() => setTab('ncs')}>Beacon positioning (NCS)</button>
        <button type="button" className={tab === 'finder' ? 'on' : ''} onClick={() => setTab('finder')}>Room finder (Library)</button>
      </nav>
      {tab === 'ncs' ? (
        <App />
      ) : (
        <LoadError>
          <Suspense fallback={<div className="loading">Loading the library…</div>}>
            <Finder tagId={tag} onTag={setTag} />
          </Suspense>
        </LoadError>
      )}
    </div>
  );
}
