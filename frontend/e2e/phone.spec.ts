import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The phone layout, at 390 px.
 *
 * This is a different layout rather than a narrower one, which is why it has
 * its own project: the sensor table stops being a table of eight columns and
 * becomes one card per station, and the sorting that lives in the column
 * headers moves into the footer. What is asserted here is the part that would
 * silently rot — that every measured column is actually on screen, that
 * sorting still applies to the whole network, and that neither page overflows.
 */

test('neither page scrolls sideways', async ({ page }) => {
  for (const path of ['/dashboard', '/sensors']) {
    await page.goto(path);
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows, `${path} overflows horizontally`).toBe(false);
  }
});

/**
 * The failure this replaces: at 390 px the table showed id, district and
 * neighbourhood, and hid PM2.5, PM10, AQI and connection behind a sideways
 * scroll inside the card — the half of the table an operator opened it for.
 */
test('every column reaches the screen as a card', async ({ page }) => {
  await page.goto('/sensors');
  await expect(page.getByText('BLN-0001')).toBeVisible({ timeout: 30_000 });

  const card = page.locator('tbody tr').first();
  const viewport = page.viewportSize()?.width ?? 0;

  // The labels are drawn from `data-label` through a `::before`, so they are
  // not in the text — the attribute is the contract, and the cell being inside
  // the viewport is the thing that used to be false.
  for (const label of ['ID', 'District', 'Neighborhood', 'PM2.5', 'PM10', 'AQI', 'Connection']) {
    const cell = card.locator(`td[data-label="${label}"]`);
    await expect(cell, `${label} is missing from the card`).toBeVisible();

    const box = await cell.boundingBox();
    expect(box, `${label} has no box`).not.toBeNull();
    expect(box!.x + box!.width, `${label} sits outside the viewport`).toBeLessThanOrEqual(viewport);
  }

  // The readings, not just the identity: this is what the old layout hid.
  await expect(card.locator('td[data-label="Connection"]')).toContainText(
    /HQ link|Poor link|Offline/,
  );
});

/**
 * The column headers are collapsed to a pixel on a phone, so the footer control
 * is the only way a sighted operator can sort — and it has to mean the same
 * thing the header does: order the whole network, not the page.
 *
 * It sorts by *district* rather than by PM2.5 deliberately. Both are
 * whole-network questions; only one of them needs every station's readings.
 * Ordering by a measured column pulls 240 series and then rolls them up in a
 * single synchronous pass that holds the main thread for ~595 ms (measured with
 * a long-task observer) — worth asserting exactly once, which the desktop suite
 * already does. Repeating it in four more projects bought no coverage and cost
 * four more request storms against a single-threaded mock server, which is what
 * turned this test into a coin flip under a full run.
 */
test('the footer control sorts the whole network', async ({ page }) => {
  await page.goto('/sensors');
  await expect(page.getByText('BLN-0001')).toBeVisible({ timeout: 30_000 });

  // The control lives in the table footer, thousands of pixels down. Clicking
  // it while the browser is still settling that scroll is how the overlay
  // failed to open on WebKit: the tap landed mid-flight and nothing happened.
  const sortBy = page.getByLabel('Sort the sensor list by');
  await sortBy.scrollIntoViewIfNeeded();
  await expect(sortBy).toBeInViewport();

  const district = page.getByRole('option', { name: 'District', exact: true });

  // Retried rather than clicked once: on WebKit a tap on this control is
  // occasionally swallowed under a loaded suite and the overlay never opens,
  // which is exactly what a person does about it — tap again. Anything else
  // here is a timeout dressed up as a failure.
  await expect(async () => {
    await sortBy.click();
    await expect(district).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });

  await district.click();

  await expect(page.getByText(/matching stations/)).toBeVisible({ timeout: 30_000 });

  // Every station on the first cursor page is in Mitte, and Mitte is not first
  // alphabetically. Charlottenburg-Wilmersdorf only appears if the ordering was
  // applied to all 240 rather than to the twenty on screen.
  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow.locator('td[data-label="District"]')).toHaveText(
    'Charlottenburg-Wilmersdorf',
  );
  await expect(firstRow.locator('td[data-label="ID"]')).toHaveText('BLN-0061');
});

test('the sort direction control reverses the order', async ({ page }) => {
  await page.goto('/sensors');
  await expect(page.getByText('BLN-0001')).toBeVisible({ timeout: 30_000 });

  // The id cell, not the whole row's text: the measured columns fill in
  // asynchronously, so comparing rendered rows compares loading states as much
  // as ordering. Reversing id ascending must reach the end of the *network*.
  const firstId = page.locator('tbody tr').first().locator('td[data-label="ID"]');
  await expect(firstId).toHaveText('BLN-0001');

  const direction = page.getByLabel(/Sorted ascending/);
  await direction.scrollIntoViewIfNeeded();
  await expect(direction).toBeInViewport();
  await direction.click();

  await expect(firstId).toHaveText('BLN-0240', { timeout: 30_000 });
  await expect(page.getByLabel(/Sorted descending/)).toBeVisible();
});

/**
 * The header row is collapsed with height and clipping rather than
 * `display: none`, precisely so it stays here. If that ever regresses, a
 * screen-reader user loses the column names and the sort state with them.
 */
test('the collapsed column headers stay in the accessibility tree', async ({ page }) => {
  await page.goto('/sensors');
  await expect(page.getByText('BLN-0001')).toBeVisible({ timeout: 30_000 });

  await expect(page.getByRole('columnheader', { name: /PM2\.5/ })).toBeAttached();
  await expect(page.getByRole('columnheader', { name: /^ID/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  // The cards are still rows and cells, not anonymous boxes.
  expect(await page.getByRole('row').count()).toBeGreaterThan(1);
});

for (const [name, path] of [
  ['dashboard', '/dashboard'],
  ['sensor list', '/sensors'],
] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${name} has no accessibility violations in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript(
        (value) => window.localStorage.setItem('aerolit:theme', value),
        theme,
      );
      await page.goto(path);
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(2500);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('.leaflet-control-container')
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
}

/**
 * Collapsed does not mean skippable-over.
 *
 * The header row survives as one clipped pixel so screen readers keep the
 * column names, their `aria-sort` and the sort buttons. Left in the tab order,
 * those same buttons became seven stops with no visible focus ring — a WCAG
 * 2.4.7 failure that the axe pass cannot see, because focus visibility is not
 * something it can evaluate. Found in review.
 */
test('the collapsed headers are not invisible tab stops', async ({ page }) => {
  await page.goto('/sensors');
  await expect(page.getByText('BLN-0001')).toBeVisible({ timeout: 30_000 });

  expect(await page.locator('.grid__sort').count()).toBeGreaterThan(0);
  expect(await page.locator('.grid__sort:not([tabindex="-1"])').count()).toBe(0);

  // Still named for assistive tech, which is the whole reason they are kept.
  await expect(page.getByRole('columnheader', { name: /PM2\.5/ })).toBeAttached();
});
