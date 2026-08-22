import { expect, test, type Page } from '@playwright/test';

/**
 * The sensor table against the real cursor API.
 *
 * The pagination assertions are the point of this file: MSW can mimic the
 * cursor contract, but only the real server proves the round-trip — that
 * `after` and `before` land on the same page, and that the last page really
 * does omit its forward cursor.
 */

const rows = (page: Page) => page.locator('tbody tr');
const firstId = (page: Page) => rows(page).first().locator('.aq-mono').innerText();

test.beforeEach(async ({ page }) => {
  await page.goto('/sensors');
  await expect(rows(page)).toHaveCount(20, { timeout: 30_000 });
});

test('lists one cursor page at a time', async ({ page }) => {
  expect(await firstId(page)).toBe('BLN-0001');
  await expect(page.getByText('Browsing the network one page at a time')).toBeVisible();
});

test('disables Previous on the first page', async ({ page }) => {
  await expect(page.getByRole('button', { name: /Previous/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Next/ })).toBeEnabled();
});

test('pages forward and back to the same rows', async ({ page }) => {
  const page1 = await firstId(page);

  await page.getByRole('button', { name: /Next/ }).click();
  await expect.poll(() => firstId(page)).toBe('BLN-0021');
  await expect(page.getByRole('button', { name: /Previous/ })).toBeEnabled();

  await page.getByRole('button', { name: /Previous/ }).click();
  await expect.poll(() => firstId(page)).toBe(page1);
});

test('disables Next once the last page is reached', async ({ page }) => {
  // 240 stations at 20 per page: 11 forward steps lands on the final page.
  for (let i = 0; i < 11; i += 1) {
    await page.getByRole('button', { name: /Next/ }).click();
    await expect(rows(page)).toHaveCount(20);
  }

  expect(await firstId(page)).toBe('BLN-0221');
  await expect(page.getByRole('button', { name: /Next/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Previous/ })).toBeEnabled();
});

test('search reports matches across the whole network, not the page', async ({ page }) => {
  await page.getByRole('searchbox').fill('pankow');

  // 20 Pankow stations exist network-wide, none of them on the first page.
  await expect(page.getByText('20 matching stations')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('· showing 1–20')).toBeVisible();
});

test('sorting by a measured column orders the whole network', async ({ page }) => {
  await page.getByRole('button', { name: /sort by PM2\.5/ }).click();

  await expect(page.getByText(/240 matching stations/)).toBeVisible({ timeout: 30_000 });

  const values = await rows(page).locator('td:nth-child(5)').allInnerTexts();
  const numbers = values.map((v) => Number(v.trim()));
  expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
});

test('reverses the order on a second click and marks the header', async ({ page }) => {
  const header = page.getByRole('button', { name: /sort by PM2\.5/ });
  await header.click();
  await expect(page.getByText(/240 matching stations/)).toBeVisible({ timeout: 30_000 });
  await header.click();

  const values = await rows(page).locator('td:nth-child(5)').allInnerTexts();
  const numbers = values.map((v) => Number(v.trim()));
  expect(numbers).toEqual([...numbers].sort((a, b) => b - a));

  await expect(page.locator('th', { has: header })).toHaveAttribute('aria-sort', 'descending');
});

test('tracking a station here shows it on the dashboard watchlist', async ({ page }) => {
  // The full loop the watchlist's empty state promises.
  await page.getByRole('button', { name: 'Track Mitte BLN-0003' }).click();
  await expect(page.getByRole('button', { name: 'Stop tracking Mitte BLN-0003' })).toBeVisible();

  await page.getByRole('link', { name: 'Dashboard' }).click();

  const watchlist = page.getByRole('list', { name: 'Tracked stations' });
  await expect(watchlist.getByText('BLN-0003', { exact: false })).toBeVisible({ timeout: 30_000 });
});
