import type { Station } from './types';

/**
 * Matches a station against the header search.
 *
 * Case- and diacritic-insensitive so "neukolln" finds "Neukölln" — the dataset
 * romanises some district names and not others, and an operator typing on a
 * keyboard without umlauts should not have to know which. Matching is a
 * substring test across id, district and location: with 240 stations the naive
 * scan is instant, and fuzzy matching would surface confusing near-misses for
 * ids that differ by one digit.
 */
export function normalise(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function matchesStation(station: Station, query: string): boolean {
  const needle = normalise(query);
  if (needle === '') return true;

  return (
    normalise(station.id).includes(needle) ||
    normalise(station.district).includes(needle) ||
    normalise(station.location).includes(needle)
  );
}
