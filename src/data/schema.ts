// Venue data model. Units: meters, building-local frame (x = east, y = north,
// origin = SW corner of the footprint). Field names follow Apple IMDF where one exists.

export type Vec2 = [number, number];
export type Polygon = Vec2[];

/** IMDF unit categories used by the venues. */
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
  | 'kitchen'
  | 'workroom';

export interface Space {
  id: string;
  /** Label as printed on the official plan, or a descriptive name. Never an invented room number. */
  name: string;
  category: Category;
  polygon: Polygon;
}

export interface Floor {
  /** As numbered on the plan: 1 = "1st floor"; 0 = basement. */
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

/** Geometry shared by every building. */
export interface Plan {
  id: string;
  name: string;
  source: string;
  floors: Floor[];
}

export interface Venue extends Plan {
  /** Eddystone-UID namespace shared by all beacons, 20 hex chars. */
  eddystoneNamespace: string;
  beacons: Beacon[];
}

/** A simulated NFC sticker / QR code position. Descriptive name only. */
export interface Tag {
  id: string;
  name: string;
  floor: number;
  x: number;
  y: number;
}

/** A searchable destination; its location is approximate (a wing segment on one floor). */
export interface Place {
  /** Canonical room number ("E2320"), or a slug when the source has none. */
  id: string;
  number?: string;
  /** Department or room name as written in the source. Never a person. */
  name: string;
  floor: number;
  zone: Polygon;
  /** Walkable point where a route ends. */
  entry: Vec2;
  source: 'emergency-plan-2014' | 'library-web';
}

/** Vertical link between floors. One (x, y) for every floor it serves. */
export interface Connector {
  id: string;
  kind: 'stairs' | 'elevator';
  name: string;
  x: number;
  y: number;
  floors: number[];
}

export interface Library extends Plan {
  tags: Tag[];
  places: Place[];
  connectors: Connector[];
}
