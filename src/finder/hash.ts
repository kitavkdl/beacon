// URL fragment <-> finder state. The fragment never reaches a server (SPEC privacy).
export type HashState = { tab: 'ncs' } | { tab: 'finder'; tag: string | null };

export function parseHash(hash: string): HashState {
  const s = hash.replace(/^#/, '');
  if (s === 'finder') return { tab: 'finder', tag: null };
  const m = /^tag=(.*)$/s.exec(s);
  if (!m) return { tab: 'ncs' };
  try {
    return { tab: 'finder', tag: decodeURIComponent(m[1]) || null };
  } catch {
    return { tab: 'finder', tag: null };
  }
}

export const formatHash = (tag: string | null): string => (tag ? `#tag=${encodeURIComponent(tag)}` : '#finder');
