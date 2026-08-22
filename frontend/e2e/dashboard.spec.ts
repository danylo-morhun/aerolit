import { expect, test } from '@playwright/test';

/**
 * The dashboard against the real mock API.
 *
 * The numbers asserted here are the ones the shipped dataset actually produces
 * (cross-checked in `tests/dataset.spec.ts`), so this fails if the API contract,
 * the proxy, or any derivation between them changes.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
});

test('rolls the real 240-station network up into the KPI row', async ({ page }) => {
  const active = page.getByRole('article').filter({ hasText: 'Active Sensors' });

  await expect(active.getByText('223', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Avg PM2.5 · Moderate')).toBeVisible();
  await expect(
    page
      .getByRole('article')
      .filter({ hasText: 'Poor Connection' })
      .getByText('17', { exact: true }),
  ).toBeVisible();
});

test('shows a real week-over-week delta, not a placeholder', async ({ page }) => {
  const active = page.getByRole('article').filter({ hasText: 'Active Sensors' });
  await expect(active.getByText('223', { exact: true })).toBeVisible({ timeout: 30_000 });

  // −6 active sensors week over week: a regression, so the badge reads "worse".
  await expect(active.getByText(/Week over week: −6 sensors, worse/)).toBeVisible();
});

test('renders the OpenStreetMap layer with one marker per station', async ({ page }) => {
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();

  // Markers are drawn once readings land; 240 stations, one circle each.
  await expect.poll(() => page.locator('path.marker').count(), { timeout: 30_000 }).toBe(240);

  await expect(page.getByText('Air Quality Index')).toBeVisible();
});

test('the pollutant toggle re-colours the map', async ({ page }) => {
  await expect.poll(() => page.locator('path.marker').count(), { timeout: 30_000 }).toBe(240);

  const beforeGood = await page.locator('path.marker--good').count();
  await page.getByRole('button', { name: 'PM10', exact: true }).click();

  // PM10 uses a coarser scale, so the same network classifies differently.
  await expect.poll(() => page.locator('path.marker--good').count()).not.toBe(beforeGood);
  await expect(page.getByText('Good · 0–24')).toBeVisible();
});

test('selecting a watchlist row loads that station into the chart', async ({ page }) => {
  const pankow = page.getByRole('button').filter({ hasText: 'Pankow' }).first();
  await expect(pankow).toBeVisible({ timeout: 30_000 });

  await pankow.click();

  await expect(page.getByText(/Pankow · Schoenhauser Allee · 24H · µg\/m³/)).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
});

test('the chart range selector switches window', async ({ page }) => {
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: '30D', exact: true }).click();
  await expect(page.getByText(/· 30D · µg\/m³/)).toBeVisible();

  await page.getByRole('button', { name: '7D', exact: true }).click();
  await expect(page.getByText(/· 7D · µg\/m³/)).toBeVisible();
});

test('the header search narrows the map and the watchlist together', async ({ page }) => {
  await expect.poll(() => page.locator('path.marker').count(), { timeout: 30_000 }).toBe(240);

  await page.getByRole('searchbox').fill('pankow');

  await expect.poll(() => page.locator('path.marker').count()).toBe(20);
  await expect(page.getByRole('list', { name: 'Tracked stations' }).getByText('Mitte')).toHaveCount(
    0,
  );
});

test('a search matching nothing says so instead of showing a blank map', async ({ page }) => {
  await expect.poll(() => page.locator('path.marker').count(), { timeout: 30_000 }).toBe(240);

  await page.getByRole('searchbox').fill('zzzz');

  await expect(page.getByRole('status')).toContainText('No station matches');
  await expect.poll(() => page.locator('path.marker').count()).toBe(0);
});

test('"View all" leads to the sensor list', async ({ page }) => {
  await page.getByRole('link', { name: 'View all' }).click();

  await expect(page).toHaveURL(/\/sensors$/);
  await expect(page.getByRole('heading', { name: 'Sensor List' })).toBeVisible();
});
