export interface Place {
  id: string;
  name: string;
  slug: string;
  types: string[];
  verseCount: number;
  /** Canonical position of the place's first mention, as bbbcccvvv. */
  first: number | null;
  last: number | null;
  refs: string[];
  readable: string[];
  lon: number;
  lat: number;
  /** OpenBible's score for this identification. Higher is firmer. */
  confidence: number;
  precision: string;
  precisionNote: string;
  modern: string;
  modernId: string;
  /** 简体 / 繁體 name from the SeekSparks gazetteer, where one was found. */
  zh?: string;
  zhHant?: string;
  /** How the Chinese name was matched: by name, by name minus OpenBible's
   *  disambiguating ordinal, or by proximity. A proximity match is a weaker
   *  claim and the UI can decline to use it. */
  zhMatch?: 'name' | 'bare-name' | 'coord';
  /** Number of rival identifications that scored above zero. >1 means the
   *  location is genuinely disputed, and the UI says so. */
  rivals: number;
}

/** One verse that names at least one locatable place. `p` indexes into
 *  `PlacesBundle.places`. These are the timeline's steps. */
export interface BibleEvent {
  /** Canonical position, bbbcccvvv. */
  sort: number;
  osis: string;
  readable: string;
  p: number[];
}

export interface PlacesBundle {
  meta: {
    source: string; license: string; licenseUrl: string; sourceUrl: string;
    generated: string; located: number; unlocated: number;
    events: number; instances: number;
  };
  places: Place[];
  events: BibleEvent[];
  unlocated: Omit<Place, 'lon' | 'lat' | 'confidence' | 'precision' | 'precisionNote' | 'modern' | 'modernId' | 'rivals'>[];
}

export interface GeoJson {
  type: string;
  features: {
    geometry: { type: string; coordinates: unknown } | null;
    properties?: Record<string, unknown>;
  }[];
}
