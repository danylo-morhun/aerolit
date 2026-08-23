import { describe, expect, it } from 'vitest';

import { readSelectionQuery, selectionQuery } from './useSelectionUrl';

describe('readSelectionQuery', () => {
  it('reads all three choices', () => {
    expect(
      readSelectionQuery({ station: 'BLN-0041', range: '7d', pollutant: 'pm10' }),
    ).toStrictEqual({ station: 'BLN-0041', range: '7d', pollutant: 'pm10' });
  });

  it('returns nulls for an empty query', () => {
    expect(readSelectionQuery({})).toStrictEqual({
      station: null,
      range: null,
      pollutant: null,
    });
  });

  /**
   * A hand-edited or stale link is a normal thing to receive. An unknown range
   * reaching the chart would be a key with no window behind it.
   */
  it('drops a range or pollutant it does not recognise', () => {
    const parsed = readSelectionQuery({ range: '90d', pollutant: 'co2' });

    expect(parsed.range).toBeNull();
    expect(parsed.pollutant).toBeNull();
  });

  /**
   * The bug this replaces: validation used `range in RANGE_HOURS`, and `in`
   * answers true for everything on `Object.prototype`. `?range=constructor`
   * reached `windowStart` as a *function*, produced a `NaN` window, drew an
   * empty chart and was written back into the address bar so a reload
   * reproduced it. `'90d'` — the only case tested before — happens to be
   * rejected by `in`, which is why the test passed while the check was wrong.
   */
  it.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__'])(
    'drops the inherited object key %s as a range',
    (key) => {
      expect(readSelectionQuery({ range: key }).range).toBeNull();
    },
  );

  it.each(['toString', 'constructor', 'valueOf'])(
    'drops the inherited object key %s as a pollutant',
    (key) => {
      expect(readSelectionQuery({ pollutant: key }).pollutant).toBeNull();
    },
  );

  /** The station cannot be checked here; the dashboard replaces it if unknown. */
  it('passes an unrecognised station through', () => {
    expect(readSelectionQuery({ station: 'NOPE-9999' }).station).toBe('NOPE-9999');
  });

  it('takes the first value when a key is repeated', () => {
    expect(readSelectionQuery({ station: ['BLN-0001', 'BLN-0002'] }).station).toBe('BLN-0001');
  });

  it('treats a blank station as absent', () => {
    expect(readSelectionQuery({ station: '  ' }).station).toBeNull();
  });
});

describe('selectionQuery', () => {
  it('writes the choices that differ from the defaults', () => {
    expect(
      selectionQuery({ stationId: 'BLN-0041', range: '30d', pollutant: 'pm10' }, {}),
    ).toStrictEqual({ station: 'BLN-0041', range: '30d', pollutant: 'pm10' });
  });

  /** A link should carry choices, not restate what the app does anyway. */
  it('leaves the defaults out', () => {
    expect(
      selectionQuery({ stationId: 'BLN-0001', range: '24h', pollutant: 'pm25' }, {}),
    ).toStrictEqual({ station: 'BLN-0001' });
  });

  it('clears a key when its choice goes back to the default', () => {
    expect(
      selectionQuery({ stationId: 'BLN-0001', range: '24h', pollutant: 'pm25' }, { range: '7d' }),
    ).toStrictEqual({ station: 'BLN-0001' });
  });

  it('keeps query keys it does not own', () => {
    const next = selectionQuery(
      { stationId: 'BLN-0001', range: '24h', pollutant: 'pm25' },
      {
        utm_source: 'email',
      },
    );

    expect(next).toStrictEqual({ station: 'BLN-0001', utm_source: 'email' });
  });

  /**
   * The signal the caller needs to not navigate. A `replace` per change of
   * derived state is how a router ends up fighting its own watchers.
   */
  it('returns null when the query already says this', () => {
    expect(
      selectionQuery(
        { stationId: 'BLN-0041', range: '7d', pollutant: 'pm25' },
        {
          station: 'BLN-0041',
          range: '7d',
        },
      ),
    ).toBeNull();
  });

  it('drops the station when nothing is selected', () => {
    expect(
      selectionQuery({ stationId: null, range: '24h', pollutant: 'pm25' }, { station: 'BLN-0001' }),
    ).toStrictEqual({});
  });
});
