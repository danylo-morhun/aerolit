import type { ChartRange, Reading, Station } from '@/domain/types';

import { apiGet, type RequestOptions } from './client';
import type { ReadingCountDto, ReadingDto, StationCountDto, StationPageDto } from './types';

/** The server caps `limit` at 100. */
export const MAX_PAGE_SIZE = 100;

export interface StationPage {
  readonly items: readonly Station[];
  /** Present only when a page exists in that direction. */
  readonly nextCursor: string | undefined;
  readonly prevCursor: string | undefined;
}

export interface StationPageQuery {
  readonly limit?: number;
  readonly after?: string | undefined;
  readonly before?: string | undefined;
}

/**
 * One page of the station list.
 *
 * The cursors are opaque and one-directional by design — there is no page
 * number to jump to — so this returns them as-is and lets the caller decide
 * which direction to follow. `undefined` means "no page that way", which the
 * UI turns into a disabled control.
 */
export async function fetchStationPage(
  { limit = 20, after, before }: StationPageQuery = {},
  options: RequestOptions = {},
): Promise<StationPage> {
  const dto = await apiGet<StationPageDto>('/stations', {
    ...options,
    params: { limit: Math.min(limit, MAX_PAGE_SIZE), after, before },
  });

  return {
    items: dto.items.map(toStation),
    nextCursor: dto.pageInfo.after,
    prevCursor: dto.pageInfo.before,
  };
}

export async function fetchStationCount(options: RequestOptions = {}): Promise<number> {
  const dto = await apiGet<StationCountDto>('/stations/count', options);
  return dto.total;
}

/**
 * A station's readings, newest last.
 *
 * Timestamps are converted from ISO strings to epoch milliseconds here, at the
 * boundary. Everything downstream compares and buckets by hour; doing that on
 * strings, or re-parsing in each consumer, would be both slower and a standing
 * invitation to compare a string with a number.
 */
export async function fetchReadings(
  stationId: string,
  range?: ChartRange,
  options: RequestOptions = {},
): Promise<Reading[]> {
  const dto = await apiGet<ReadingDto[]>(`/stations/${encodeURIComponent(stationId)}/readings`, {
    ...options,
    params: { range },
  });
  return dto.map(toReading);
}

export interface ReadingCountQuery {
  readonly from?: string;
  readonly to?: string;
  readonly range?: ChartRange;
}

/**
 * The number of readings a station filed in a window.
 *
 * Unused by the dashboard, which already holds the full series and derives the
 * tally from it (see docs/adr/0005). Kept because it is the right tool the
 * moment a caller needs stability *without* the series — the sensor table's
 * lazy row enrichment being the obvious candidate if the row set grows.
 */
export async function fetchReadingCount(
  stationId: string,
  query: ReadingCountQuery = {},
  options: RequestOptions = {},
): Promise<number> {
  const dto = await apiGet<ReadingCountDto>(
    `/stations/${encodeURIComponent(stationId)}/readings/count`,
    { ...options, params: { ...query } },
  );
  return dto.count;
}

function toStation(dto: StationPageDto['items'][number]): Station {
  return {
    id: dto.id,
    district: dto.district,
    location: dto.location,
    coordinates: { lat: dto.coordinates.lat, lng: dto.coordinates.lng },
  };
}

function toReading(dto: ReadingDto): Reading {
  return { t: Date.parse(dto.t), pm25: dto.pm25, pm10: dto.pm10 };
}
