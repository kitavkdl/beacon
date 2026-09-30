export const PATH_LOSS_N = 2.2;

export function rssiAt(d: number, txPower: number, n = PATH_LOSS_N): number {
  return txPower - 10 * n * Math.log10(Math.max(d, 0.1));
}

export function distanceFrom(rssi: number, txPower: number, n = PATH_LOSS_N): number {
  return 10 ** ((txPower - rssi) / (10 * n));
}
