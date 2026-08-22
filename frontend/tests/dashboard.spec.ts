import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/vue';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import DashboardPage from '@/pages/DashboardPage.vue';
import { WATCHLIST_STORAGE_KEY } from '@/stores/watchlist';

import { failingHandlers } from './msw/handlers';
import { server } from './msw/server';
import { renderWithApp } from './render';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

/** All three fixture stations are tracked, so the watchlist renders them. */
function trackAll(): void {
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(['BLN-0001', 'BLN-0002', 'BLN-0003']));
}

const kpiTile = (label: string | RegExp) => screen.getByText(label).closest('article')!;

describe('Dashboard', () => {
  it('rolls the network up into the four KPIs', async () => {
    renderWithApp(DashboardPage);

    // Two of the three fixture stations still report; one missed the last hour.
    await waitFor(() =>
      expect(within(kpiTile('Active Sensors')).getByText('2')).toBeInTheDocument(),
    );

    // Only the reporting stations feed the average: (53 + 8) / 2 = 30.5.
    expect(within(kpiTile(/^Avg PM2\.5/)).getByText('30.5')).toBeInTheDocument();
    // BLN-0002 reports but sits below the 86% threshold.
    expect(within(kpiTile('Poor Connection')).getByText('1')).toBeInTheDocument();
  });

  it('labels the average with its air-quality category', async () => {
    renderWithApp(DashboardPage);

    await waitFor(() => expect(screen.getByText('Avg PM2.5 · Moderate')).toBeInTheDocument());
  });

  it('shows a week-over-week badge rather than a placeholder', async () => {
    renderWithApp(DashboardPage);

    await waitFor(() =>
      expect(within(kpiTile('Active Sensors')).getByText(/Week over week/)).toBeInTheDocument(),
    );
  });

  it('renders a watchlist row per tracked station', async () => {
    trackAll();
    renderWithApp(DashboardPage);

    const watchlist = await screen.findByRole('list', { name: 'Tracked stations' });

    await waitFor(() => expect(within(watchlist).getAllByRole('listitem')).toHaveLength(3));
    expect(within(watchlist).getByText('Mitte')).toBeInTheDocument();
    expect(within(watchlist).getByText('Pankow')).toBeInTheDocument();
    expect(within(watchlist).getByText('Neukoelln')).toBeInTheDocument();
  });

  it('loads a station into the chart when its watchlist row is clicked', async () => {
    trackAll();
    const user = userEvent.setup();
    renderWithApp(DashboardPage);

    await waitFor(() => expect(screen.getByText('Pankow')).toBeInTheDocument());

    await user.click(screen.getByText('Pankow').closest('button')!);

    await waitFor(() =>
      expect(screen.getByText(/Pankow · Schoenhauser Allee · 24H/)).toBeInTheDocument(),
    );
  });

  it('untracks a station from the watchlist and persists the change', async () => {
    trackAll();
    const user = userEvent.setup();
    renderWithApp(DashboardPage);

    await waitFor(() => expect(screen.getByText('Pankow')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Stop tracking Pankow/ }));

    await waitFor(() => expect(screen.queryByText('Pankow')).not.toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY)!)).not.toContain('BLN-0002');
  });

  it('narrows the watchlist through the header search', async () => {
    trackAll();
    const user = userEvent.setup();
    renderWithApp(DashboardPage);

    await waitFor(() => expect(screen.getByText('Pankow')).toBeInTheDocument());

    await user.type(screen.getByRole('searchbox'), 'mitte');

    await waitFor(() => expect(screen.queryByText('Pankow')).not.toBeInTheDocument());
    expect(screen.getByText('Mitte')).toBeInTheDocument();
  });

  it('says so when a search matches no station', async () => {
    trackAll();
    const user = userEvent.setup();
    renderWithApp(DashboardPage);

    await waitFor(() => expect(screen.getByText('Pankow')).toBeInTheDocument());
    await user.type(screen.getByRole('searchbox'), 'zzzz');

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/No station matches/));
  });

  it('distinguishes "nothing tracked" from "search hid them"', async () => {
    trackAll();
    const user = userEvent.setup();
    renderWithApp(DashboardPage);

    await waitFor(() => expect(screen.getByText('Pankow')).toBeInTheDocument());
    await user.type(screen.getByRole('searchbox'), 'zzzz');

    await waitFor(() =>
      expect(
        screen.getByText('No tracked station matches the current search.'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Star a station in the sensor list/)).not.toBeInTheDocument();
  });

  it('explains itself when the API is unreachable', async () => {
    server.use(...failingHandlers);
    renderWithApp(DashboardPage);

    await waitFor(() =>
      expect(screen.getByText('Could not load the sensor network')).toBeInTheDocument(),
    );
  });
});
