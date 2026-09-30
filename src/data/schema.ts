// Venue data model. Units: meters, building-local frame (x = east, y = north,
// origin = SW corner of the footprint). Field names follow Apple IMDF where one exists.

export type Vec2 = [number, number];
export type Polygon = Vec2[];

/** IMDF unit categories used in NCS. */
export type Category =
  | 'office'
  | 'laboratory'
  | 'classroom'
  | 'conferenceroom'
  | 'walkway'
  | 'restroom'
  | 'stairs'
  | 'elevator'
  | 'mechanical'
  | 'storage'
  | 'lounge'
  | 'workroom';

export interface Space {
  id: string;
  /** Label as printed on the official plan, or a descriptive name. Never an invented room number. */
  name: string;
  category: Category;
  polygon: Polygon;
}

export interface Floor {
  /** 1-based, matches the plan ("1st floor" = 1). */
  level: number;
  name: string;
  /** Slab top above ground, meters. */
  elevation: number;
  height: number;
  /** Footprint of the enclosed floor area (may be several pieces). */
  outline: Polygon[];
  /** Openings in this floor's slab (atrium "open to below"). */
  voids: Polygon[];
  spaces: Space[];
}

export interface Beacon {
  /** Eddystone-UID instance, 12 hex chars. */
  id: string;
  floor: number;
  x: number;
  y: number;
  /** Expected RSSI at 1 m, dBm. */
  txPower: number;
}

export interface Venue {
  id: string;
  name: string;
  source: string;
  /** Eddystone-UID namespace shared by all beacons, 20 hex chars. */
  eddystoneNamespace: string;
  floors: Floor[];
  beacons: Beacon[];
}
