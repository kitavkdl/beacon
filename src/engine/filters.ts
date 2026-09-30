export type FilterKind = 'none' | 'ema' | 'kalman';

export interface RssiFilter {
  update(x: number): number;
}

const EMA_ALPHA = 0.3;
const KALMAN_Q = 0.5;
const KALMAN_R = 16;

export function makeFilter(kind: FilterKind): RssiFilter {
  if (kind === 'none') return { update: (x) => x };
  if (kind === 'ema') {
    let s: number | null = null;
    return { update: (x) => (s = s === null ? x : s + EMA_ALPHA * (x - s)) };
  }
  // 1-D constant-state Kalman: predict P += q, then blend with gain K = P / (P + r).
  let s: number | null = null;
  let p = KALMAN_R;
  return {
    update(x) {
      if (s === null) return (s = x);
      p += KALMAN_Q;
      const k = p / (p + KALMAN_R);
      s += k * (x - s);
      p *= 1 - k;
      return s;
    },
  };
}
