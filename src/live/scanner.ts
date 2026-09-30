// Live BLE via Web Bluetooth scanning (requestLEScan). Only Android/macOS Chrome with the experimental flag can scan;
// iOS browsers cannot, and iBeacon is blocklisted in Web Bluetooth, hence Eddystone-UID. See docs/RESEARCH.md §2.
import type { Reading } from '../engine/locator';
import { EDDYSTONE_UUID, EDDYSTONE_UUID_128, parseEddystoneUid } from './eddystone';

// Minimal Web Bluetooth scanning types (not in lib.dom).
interface ServiceDataMap {
  get(uuid: string): DataView | undefined;
}

interface AdvertisingEvent extends Event {
  rssi?: number | null;
  serviceData: ServiceDataMap;
}

interface LEScan {
  active: boolean;
  stop(): void;
}

interface LEScanOptions {
  filters?: { serviceData: { service: number | string }[] }[];
  keepRepeatedDevices?: boolean;
  acceptAllAdvertisements?: boolean;
}

interface BluetoothScanning extends EventTarget {
  requestLEScan?(options: LEScanOptions): Promise<LEScan>;
}

export type LiveSupport = { ok: true } | { ok: false; reason: string };

function bluetooth(): BluetoothScanning | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as unknown as { bluetooth?: BluetoothScanning }).bluetooth;
}

export function liveSupport(): LiveSupport {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return { ok: false, reason: 'Live mode requires HTTPS (or localhost). Open the page over a secure connection.' };
  }
  const bt = bluetooth();
  if (!bt) {
    return {
      ok: false,
      reason:
        'Web Bluetooth is not available in this browser. iOS browsers and Firefox do not support it, ' +
        'and Chrome on Windows/Linux lacks BLE scanning. Use Chrome on Android or macOS.',
    };
  }
  if (typeof bt.requestLEScan !== 'function') {
    return {
      ok: false,
      reason:
        'BLE scanning is disabled. In Chrome on Android or macOS, enable ' +
        'chrome://flags/#enable-experimental-web-platform-features and restart the browser.',
    };
  }
  return { ok: true };
}

/** Emits readings for Eddystone-UID frames in `namespace`. `t` is performance.now() ms, same base as locate(now). */
export async function startScan(namespace: string, onReading: (r: Reading) => void): Promise<() => void> {
  const bt = bluetooth();
  if (!bt?.requestLEScan) throw new Error('BLE scanning is not supported in this browser.');
  const ns = namespace.toLowerCase();

  let scan: LEScan;
  try {
    const filters = [{ serviceData: [{ service: EDDYSTONE_UUID }] }];
    scan = await bt.requestLEScan({ filters, keepRepeatedDevices: true });
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    scan = await bt.requestLEScan({ acceptAllAdvertisements: true, keepRepeatedDevices: true });
  }

  const onAdvert = (ev: Event) => {
    const e = ev as AdvertisingEvent;
    if (typeof e.rssi !== 'number') return;
    const data = e.serviceData?.get(EDDYSTONE_UUID_128);
    if (!data) return;
    const uid = parseEddystoneUid(data);
    if (!uid || uid.namespace !== ns) return;
    onReading({ beaconId: uid.instance, rssi: e.rssi, t: performance.now() });
  };
  bt.addEventListener('advertisementreceived', onAdvert);

  return () => {
    bt.removeEventListener('advertisementreceived', onAdvert);
    if (scan.active) scan.stop();
  };
}
