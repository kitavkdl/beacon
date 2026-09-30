import { describe, expect, it } from 'vitest';
import { makeFilter } from './filters';
import { gaussian, mulberry32 } from './simulator';

const std = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

describe('filters', () => {
  const rng = mulberry32(42);
  const raw = Array.from({ length: 300 }, () => -70 + gaussian(rng) * 4);
  const run = (kind: 'none' | 'ema' | 'kalman') => {
    const f = makeFilter(kind);
    return raw.map((x) => f.update(x));
  };
  const WARM = 50;

  it("'none' passes input through", () => {
    expect(run('none')).toEqual(raw);
  });

  it('first sample passes through', () => {
    expect(makeFilter('ema').update(-63)).toBe(-63);
    expect(makeFilter('kalman').update(-63)).toBe(-63);
  });

  it('ema reduces noise below 75%', () => {
    expect(std(run('ema').slice(WARM))).toBeLessThan(0.75 * std(raw.slice(WARM)));
  });

  it('kalman reduces noise below 50%', () => {
    expect(std(run('kalman').slice(WARM))).toBeLessThan(0.5 * std(raw.slice(WARM)));
  });
});
