/**
 * Wire formats, exactly as the mock API returns them.
 *
 * Kept separate from the domain models so the shape of the response is never
 * assumed to be the shape the app reasons about. Today the only difference is
 * the timestamp representation, but that difference is precisely the kind that
 * leaks everywhere if it isn't converted at the boundary.
 */

export interface StationDto {
  id: string;
  district: string;
  location: string;
  coordinates: { lat: number; lng: number };
}

export interface StationPageDto {
  items: StationDto[];
  pageInfo: {
    /** Cursor for the next page; absent on the last page. */
    after?: string;
    /** Cursor for the previous page; absent on the first page. */
    before?: string;
  };
}

export interface ReadingDto {
  /** ISO-8601, always on the hour, UTC. */
  t: string;
  pm25: number;
  pm10: number;
}

export interface StationCountDto {
  total: number;
}

export interface ReadingCountDto {
  count: number;
}
