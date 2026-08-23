import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * App shell: routing, theming and accessibility.
 *
 * The theme assertions are here rather than in a unit test because the thing
 * worth proving — that the choice survives a reload without flashing the wrong
 * palette, and that the map basemap follows it — only exists in a real browser.
 */

test('each page has its own URL and the tabs navigate between them', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Sensor List' }).click();
  await expect(page).toHaveURL(/\/sensors$/);
  await expect(page).toHaveTitle(/Sensor List/);

  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('heading', { name: 'Berlin · Particulate Monitoring' }),
  ).toBeVisible();
});

test('a deep link opens the page directly', async ({ page }) => {
  await page.goto('/sensors');
  await expect(page.getByRole('heading', { name: 'Sensor List' })).toBeVisible();
});

test('the theme toggle survives a reload and takes the map with it', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /Switch to dark theme|Switch to light theme/ }).click();
  const wasDark = await page.locator('html').evaluate((el) => el.classList.contains('dark'));

  await page.reload();

  await expect
    .poll(() => page.locator('html').evaluate((el) => el.classList.contains('dark')))
    .toBe(wasDark);

  // Map tiles follow the theme: CARTO swaps basemap, it does not stay light.
  const tileSrc = await page.locator('.leaflet-tile').first().getAttribute('src');
  expect(tileSrc).toContain(wasDark ? 'dark_all' : 'light_all');
});

test('the first tab stop is a skip link to the content', async ({ page }) => {
  await page.goto('/dashboard');
  await page.keyboard.press('Tab');

  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
});

test('a station can be reached and selected with the keyboard alone', async ({ page }) => {
  // The map's markers are not tab stops by design; the watchlist is the
  // keyboard path to the same action, so it has to actually work.
  await page.goto('/dashboard');
  const row = page.getByRole('button').filter({ hasText: 'Pankow' }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });

  await row.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByText(/Pankow · Schoenhauser Allee/)).toBeVisible();
});

/**
 * Any station, not just a tracked one, from the keyboard alone.
 *
 * The map's markers are deliberately not tab stops — 240 of them would be a
 * worse experience than none. The claim that makes that acceptable is that
 * every station is still reachable without a mouse, and this is it: the header
 * search narrows the map to one station, the dashboard selects it because the
 * previous selection is no longer on screen, and the chart follows. BLN-0137 is
 * on no watchlist and no first page.
 */
test('an arbitrary station is reachable from the keyboard alone', async ({ page }) => {
  await page.goto('/dashboard');
  await expect.poll(() => page.locator('path.marker').count(), { timeout: 30_000 }).toBe(240);

  await page.getByRole('searchbox').focus();
  await page.keyboard.type('BLN-0137');

  await expect.poll(() => page.locator('path.marker').count()).toBe(1);
  await expect(page.locator('path.marker--selected')).toHaveCount(1);
  await expect(page.getByText(/Tempelhof-Schoeneberg · Innsbrucker Platz · 24H/)).toBeVisible();
  await expect(page).toHaveURL(/station=BLN-0137/);
});

test('the page never scrolls sideways on a tablet', async ({ page }) => {
  // Wide content (the sensor table) is allowed its own scroll container; the
  // document is not.
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
 * A phone layout is not part of the brief and this is not one. What this holds
 * is that the shell degrades honestly at a width nobody designed for: the tab
 * pair used to be clipped mid-word inside a strip that scrolled with no visible
 * scrollbar, which reads as a rendering fault rather than as a hint to swipe.
 */
test('the tabs fit at phone width instead of hiding in a scroller', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: 'Sensor List' })).toBeVisible({ timeout: 30_000 });

  const nav = await page
    .locator('.shell__nav')
    .evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(nav.scroll, 'the tab strip is clipped').toBe(nav.client);

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows, 'the page overflows horizontally at 320 px').toBe(false);
});

/**
 * Accessibility, in both themes.
 *
 * Running only the default theme would have missed half the palette: the chips
 * keep light backgrounds on a dark page, so their contrast is a separate
 * question from the light theme's.
 */
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
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark).*$/);
      // Let the deferred data land so the assertion covers the populated page.
      await page.waitForTimeout(2500);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        // Leaflet injects its own attribution markup and tile <img> elements;
        // they are third-party output, not something this app controls.
        .exclude('.leaflet-control-container')
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
}
