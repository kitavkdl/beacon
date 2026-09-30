// Every building the demo can show, with its simulated tour and the text the panel shows for it.
import type { Venue } from './schema';
import { NCS_TOUR, type Tour } from './tour';
import { NCS } from './venue';

export interface VenueEntry {
  venue: Venue;
  /** Short name for the building picker. */
  label: string;
  tour: Tour;
  /** One or two sentences on what the simulated walk does. */
  tourNote: string;
  /** Where the geometry came from; shown in the panel footer. */
  credit: string;
}

export const VENUES: VenueEntry[] = [
  {
    venue: NCS,
    label: 'Computer Science',
    tour: NCS_TOUR,
    tourNote:
      'A simulated visitor walks from the main entrance through the atrium and up to floors 2 and 3.',
    credit:
      'Floor geometry traced from the official 2015 floor plans (Mitchell | Giurgola Architects). Room labels are the plan\'s own; the plan has no room numbers.',
  },
];

export const venueEntry = (id: string): VenueEntry => VENUES.find((v) => v.venue.id === id) ?? VENUES[0];
