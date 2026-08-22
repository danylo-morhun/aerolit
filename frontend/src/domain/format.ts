/**
 * Display conventions, in one place.
 *
 * These are shared by the tiles, the table, the watchlist and the chart
 * tooltip. Keeping them together is what stops the same number rendering as
 * `28.9` in one view and `29` in another.
 */

const integer = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const EM_DASH = '—';

/**
 * Readings are timestamped in UTC, but the network is in Berlin and the people
 * reading this dashboard are on Berlin time — an 18:00 pollution peak should
 * land at 18:00 on the axis. Pinning the zone explicitly (rather than using the
 * viewer's) also keeps the rendering identical on every machine, including CI.
 */
export const DISPLAY_TIME_ZONE = 'Europe/Berlin';

/** Concentrations in table cells and watchlist rows: whole µg/m³. */
export function formatConcentration(value: number | null): string {
  return value === null || !Number.isFinite(value) ? EM_DASH : integer.format(value);
}

/** Headline averages, where a tenth carries information. */
export function formatConcentrationPrecise(value: number | null): string {
  return value === null || !Number.isFinite(value) ? EM_DASH : oneDecimal.format(value);
}

/**
 * A stability share as a whole percentage, e.g. 0.964 → "96%".
 *
 * Rounded *down*, not to nearest. The connection state is decided from the
 * unrounded share against an 86 % threshold, so a station at 0.8556 is a poor
 * link — and rounding its badge to "86%" would print a figure the brief says is
 * a healthy link right next to the word "Poor". Flooring keeps the number and
 * the label telling the same story: the displayed percentage clears 86 exactly
 * when the state does. One station in the shipped dataset (BLN-0011) sits in
 * that gap.
 */
export function formatStability(share: number | null): string {
  if (share === null || !Number.isFinite(share)) return EM_DASH;
  return `${integer.format(Math.floor(share * 100))}%`;
}

/** A 0–1 share with one decimal, for the KPI tile, e.g. 0.868 → "86.8". */
export function formatPercentPrecise(share: number | null): string {
  return share === null || !Number.isFinite(share) ? EM_DASH : oneDecimal.format(share * 100);
}

/**
 * A trend delta, always signed.
 *
 * Counts render whole (`+6`), measured quantities to a tenth (`-2.4`), which
 * is what the reference badges show. The sign is explicit because the badge
 * has no other indication of direction for screen-reader users.
 */
export function formatDelta(delta: number | null, fractionDigits: 0 | 1): string {
  if (delta === null || !Number.isFinite(delta)) return EM_DASH;
  const formatter = fractionDigits === 0 ? integer : oneDecimal;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${sign}${formatter.format(Math.abs(delta))}`;
}

/** Axis and tooltip timestamps, in the viewer's locale but a fixed shape. */
export function formatHour(t: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DISPLAY_TIME_ZONE,
  }).format(t);
}

export function formatDay(t: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(t);
}

export function formatDateTime(t: number): string {
  return `${formatDay(t)} ${formatHour(t)}`;
}
