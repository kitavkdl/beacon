export const EDDYSTONE_UUID = 0xfeaa;
export const EDDYSTONE_UUID_128 = '0000feaa-0000-1000-8000-00805f9b34fb';

export interface EddystoneUid {
  /** 20 lowercase hex chars (10 B) */
  namespace: string;
  /** 12 lowercase hex chars (6 B) */
  instance: string;
  /** dBm at 0 m, signed int8 */
  txPower0m: number;
}

const FRAME_UID = 0x00;
const MIN_LEN = 18;

function hex(data: DataView, start: number, len: number): string {
  let s = '';
  for (let i = start; i < start + len; i++) s += data.getUint8(i).toString(16).padStart(2, '0');
  return s;
}

/** Service data for UUID 0xFEAA. Bytes 18-19 are reserved and may be absent. */
export function parseEddystoneUid(data: DataView): EddystoneUid | null {
  if (data.byteLength < MIN_LEN || data.getUint8(0) !== FRAME_UID) return null;
  return { namespace: hex(data, 2, 10), instance: hex(data, 12, 6), txPower0m: data.getInt8(1) };
}

/** Eddystone calibrates at 0 m; typical free-space loss 0 m -> 1 m is 41 dB. */
export function rssiAt1m(txPower0m: number): number {
  return txPower0m - 41;
}
