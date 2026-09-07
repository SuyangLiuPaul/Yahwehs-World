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
  /** Number of rival identifications that scored above zero. >1 means the
   *  location is genuinely disputed, and the UI says so. */
  rivals: number;
}

export interface PlacesBundle {
  meta: {
    source: string; license: string; licenseUrl: string; sourceUrl: string;
    generated: string; located: number; unlocated: number;
  };
  places: Place[];
  unlocated: Omit<Place, 'lon' | 'lat' | 'confidence' | 'precision' | 'precisionNote' | 'modern' | 'modernId' | 'rivals'>[];
}

export interface GeoJson {
  type: string;
  features: { geometry: { type: string; coordinates: unknown } | null }[];
}
