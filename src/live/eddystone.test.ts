import { describe, expect, it } from 'vitest';
import { parseEddystoneUid, rssiAt1m } from './eddystone';

const NS = '53425542454143304e31';
const INST = '000000010001';

function frame(type: number, tx: number, reserved = true): number[] {
  const bytes = [type, tx & 0xff];
  for (const h of (NS + INST).match(/../g)!) bytes.push(parseInt(h, 16));
  if (reserved) bytes.push(0, 0);
  return bytes;
}

const view = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

describe('parseEddystoneUid', () => {
  it('parses a UID frame with reserved bytes', () => {
    const f = frame(0x00, -18);
    expect(f[1]).toBe(0xee);
    expect(f).toHaveLength(20);
    expect(parseEddystoneUid(view(f))).toEqual({ namespace: NS, instance: INST, txPower0m: -18 });
    expect(rssiAt1m(-18)).toBe(-59);
  });

  it('accepts a frame without the reserved bytes', () => {
    const f = frame(0x00, -18, false);
    expect(f).toHaveLength(18);
    expect(parseEddystoneUid(view(f))).toEqual({ namespace: NS, instance: INST, txPower0m: -18 });
  });

  it('reads positive tx power and lowercases hex', () => {
    const f = frame(0x00, 4);
    f[2] = 0xab;
    const r = parseEddystoneUid(view(f))!;
    expect(r.txPower0m).toBe(4);
    expect(r.namespace).toBe('ab' + NS.slice(2));
  });

  it('rejects non-UID frame types', () => {
    expect(parseEddystoneUid(view(frame(0x10, -18)))).toBeNull();
    expect(parseEddystoneUid(view(frame(0x20, -18)))).toBeNull();
  });

  it('rejects short buffers', () => {
    expect(parseEddystoneUid(view(frame(0x00, -18, false).slice(0, 17)))).toBeNull();
    expect(parseEddystoneUid(view([]))).toBeNull();
  });

  it('respects a non-zero byteOffset', () => {
    const f = frame(0x00, -18);
    const buf = new Uint8Array([0x10, 0xff, 0xff, ...f, 0x20, 0x20]).buffer;
    const r = parseEddystoneUid(new DataView(buf, 3, f.length));
    expect(r).toEqual({ namespace: NS, instance: INST, txPower0m: -18 });
    expect(parseEddystoneUid(new DataView(buf, 3, 17))).toBeNull();
  });
});
