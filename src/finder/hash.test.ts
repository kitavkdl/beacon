import { describe, expect, it } from 'vitest';
import { formatHash, parseHash } from './hash';

describe('hash', () => {
  it('parses the finder fragments', () => {
    expect(parseHash('#finder')).toEqual({ tab: 'finder', tag: null });
    expect(parseHash('#tag=f1-south-entrance')).toEqual({ tab: 'finder', tag: 'f1-south-entrance' });
    expect(parseHash('#tag=')).toEqual({ tab: 'finder', tag: null });
  });
  it('falls back to NCS for anything else', () => {
    expect(parseHash('')).toEqual({ tab: 'ncs' });
    expect(parseHash('#foo=bar')).toEqual({ tab: 'ncs' });
  });
  it('survives malformed percent escapes', () => {
    expect(parseHash('#tag=%E0%A4%A')).toEqual({ tab: 'finder', tag: null });
  });
  it('round-trips ids with spaces and #', () => {
    const id = 'odd id #2';
    expect(parseHash(formatHash(id))).toEqual({ tab: 'finder', tag: id });
    expect(formatHash(null)).toBe('#finder');
  });
});
