import { screen, waitFor, within } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import SensorListPage from '@/pages/SensorListPage.vue';
import { MAX_WATCHLIST, WATCHLIST_STORAGE_KEY } from '@/stores/watchlist';

import { failingHandlers } from './msw/handlers';
import { server } from './msw/server';
import { renderWithApp } from './render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

const table = () => screen.getByRole('table');

/**
 * Station identity and station readings arrive in separate requests, so a row
 * exists before its measured columns do. Every assertion about derived data
 * has to wait for the second wave, not the first.
 */
async function rowsWithReadings(): Promise<void> {
  await waitFor(() => expect(within(table()).getByText(/HQ link, 100%/)).toBeInTheDocument());
}

describe('Sensor List', () => {
  it('renders a row per station with values derived from its readings', async () => {
    renderWithApp(SensorListPage);
    await rowsWithReadings();

    const row = within(table()).getByText('BLN-0001').closest('tr')!;
    expect(within(row).getByText('Alexanderplatz')).toBeInTheDocument();
    expect(within(row).getByText('53')).toBeInTheDocument();
    expect(within(row).getByText('97')).toBeInTheDocument();
    expect(within(row).getByText('Elevated')).toBeInTheDocument();
  });

  it('marks a station that missed the latest hour as offline', async () => {
    renderWithApp(SensorListPage);
    await rowsWithReadings();

    const row = within(table()).getByText('BLN-0003').closest('tr')!;
    expect(within(row).getByText(/Connection: Offline/)).toBeInTheDocument();
  });

  it('distinguishes a poor link from a healthy one', async () => {
    renderWithApp(SensorListPage);
    await rowsWithReadings();

    const poor = within(table()).getByText('BLN-0002').closest('tr')!;
    const healthy = within(table()).getByText('BLN-0001').closest('tr')!;
    expect(within(poor).getByText(/Connection: Poor link/)).toBeInTheDocument();
    expect(within(healthy).getByText(/Connection: HQ link, 100%/)).toBeInTheDocument();
  });

  it('disables both cursor controls when the whole collection fits one page', async () => {
    // The fixture network is smaller than a page, so the API omits both
    // cursors — the controls must reflect that rather than paging into nothing.
    renderWithApp(SensorListPage);
    await rowsWithReadings();

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('filters across the whole network once a search is typed', async () => {
    const user = userEvent.setup();
    renderWithApp(SensorListPage);
    await rowsWithReadings();

    await user.type(screen.getByRole('searchbox'), 'pankow');

    await waitFor(() => {
      expect(within(table()).queryByText('BLN-0001')).not.toBeInTheDocument();
    });
    expect(within(table()).getByText('BLN-0002')).toBeInTheDocument();
    expect(screen.getByText(/1 matching station/)).toBeInTheDocument();
  });

  it('matches district names without diacritics', async () => {
    const user = userEvent.setup();
    renderWithApp(SensorListPage);
    await rowsWithReadings();
    await user.type(screen.getByRole('searchbox'), 'neukoelln');

    await waitFor(() => expect(screen.getByText(/1 matching station/)).toBeInTheDocument());
  });

  it('sorts by a measured column across the network, not just the page', async () => {
    const user = userEvent.setup();
    renderWithApp(SensorListPage);
    await rowsWithReadings();

    await user.click(screen.getByRole('button', { name: /PM2\.5/ }));

    await waitFor(() => {
      const ids = within(table())
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.querySelector('.aq-mono')?.textContent);
      // Ascending: 8, 22, 53.
      expect(ids).toEqual(['BLN-0002', 'BLN-0003', 'BLN-0001']);
    });
  });

  it('reverses the order when the same column is clicked again', async () => {
    const user = userEvent.setup();
    renderWithApp(SensorListPage);
    await rowsWithReadings();

    const header = screen.getByRole('button', { name: /PM2\.5/ });
    await user.click(header);
    await user.click(header);

    await waitFor(() => {
      const ids = within(table())
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.querySelector('.aq-mono')?.textContent);
      expect(ids).toEqual(['BLN-0001', 'BLN-0003', 'BLN-0002']);
    });
  });

  it('lets an operator track a station from the list', async () => {
    // Closes the loop the watchlist's own empty state promises: it tells the
    // operator to star a station here, so the control has to exist here.
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([]));
    const user = userEvent.setup();
    renderWithApp(SensorListPage);
    await rowsWithReadings();

    await user.click(screen.getByRole('button', { name: 'Track Pankow BLN-0002' }));

    expect(JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY)!)).toEqual(['BLN-0002']);
    expect(
      screen.getByRole('button', { name: 'Stop tracking Pankow BLN-0002' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('untracks a station that is already on the watchlist', async () => {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(['BLN-0001']));
    const user = userEvent.setup();
    renderWithApp(SensorListPage);
    await rowsWithReadings();

    await user.click(screen.getByRole('button', { name: 'Stop tracking Mitte BLN-0001' }));

    expect(JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY)!)).toEqual([]);
  });

  it('blocks adding past the watchlist limit and says why', async () => {
    const full = Array.from({ length: MAX_WATCHLIST }, (_, i) => `OTHER-${i}`);
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(full));
    renderWithApp(SensorListPage);
    await rowsWithReadings();

    // Every row is blocked, and each one explains why rather than just
    // going inert.
    const blocked = screen.getAllByRole('button', { name: /Watchlist is full/ });
    expect(blocked).toHaveLength(3);
    for (const star of blocked) expect(star).toBeDisabled();
  });

  it('offers a retry when the API is down', async () => {
    server.use(...failingHandlers);
    renderWithApp(SensorListPage);

    await waitFor(() => expect(screen.getByText('Could not load stations')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
