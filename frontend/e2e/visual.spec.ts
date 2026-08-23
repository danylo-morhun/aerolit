import { expect, test } from '@playwright/test';

/**
 * Pixel baselines for both themes.
 *
 * This is the one class of defect the rest of the suite cannot see: every
 * other test asserts behaviour or structure, so a token pointed at the wrong
 * colour, a card that lost its border or a chart drawn in the light palette on
 * a dark page all pass everything and still look broken.
 *
 * Three things make the comparison stable enough to be worth having:
 *
 * - **The dataset is a fixed snapshot.** Every figure, bar and marker position
 *   is the same on every run, which is what makes a screenshot a test at all.
 * - **The fonts are bundled**, so text metrics do not depend on what the
 *   machine has installed.
 * - **The map tiles are masked.** They come from CARTO over the network and are
 *   the one genuinely non-deterministic region on the page; the markers drawn
 *   on top of them are ours and stay in the comparison.
 *
 * Baselines are per-platform — Playwright names them `…-darwin.png` — and these
 * were captured on macOS, so the suite skips itself elsewhere rather than
 * failing on a machine that was never going to match. Running them in CI means
 * capturing baselines in the same container CI uses; that is the standard
 * approach and is noted in NOTES.md as the next step rather than faked here.
 */

test.skip(
  process.platform !== 'darwin',
  'baselines were captured on macOS; other platforms need their own',
);

const PAGES = [
  { name: 'dashboard', path: '/dashboard', ready: /Berlin · Particulate Monitoring/ },
  { name: 'sensor-list', path: '/sensors', ready: /Sensor List/ },
] as const;

for (const page_ of PAGES) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${page_.name} looks right in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript(
        (value) => window.localStorage.setItem('aerolit:theme', value),
        theme,
      );

      // The chart animates in over 240 ms on a canvas, and `animations:
      // 'disabled'` below only reaches CSS — under parallel load the shot
      // caught a different frame each time, which is how these baselines went
      // from a test to a coin flip. Asking for reduced motion turns the
      // canvas animation off through `theme/motion.ts`, the same path a viewer
      // with the OS setting takes.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(page_.path);
      await expect(page.getByRole('heading', { name: page_.ready })).toBeVisible({
        timeout: 30_000,
      });

      // Everything derived lands before the shot: the KPI figures are the last
      // thing to arrive, and 223 is the number this dataset produces.
      if (page_.name === 'dashboard') {
        await expect(page.getByText('223', { exact: true })).toBeVisible({ timeout: 30_000 });
        await expect.poll(() => page.locator('path.marker').count()).toBe(240);

        // The watchlist scrolls the selected row into view, and *when* the
        // selection settles decides where that leaves the panel — which is how
        // these baselines picked up a scrollbar and a two-pixel shift of every
        // sparkline, deterministically, but only under parallel load. Scroll
        // position is not something a baseline should encode, so it is reset
        // once the selection has actually happened.
        await expect(page.locator('.watchlist__item--selected')).toHaveCount(1);
        await page.locator('.watchlist').evaluate((el) => {
          el.scrollTop = 0;
        });
      } else {
        await expect(page.getByText('BLN-0020')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(/HQ link|Poor link|Offline/).first()).toBeVisible();
      }

      await expect(page).toHaveScreenshot(`${page_.name}-${theme}.png`, {
        fullPage: true,
        // The tiles are a third party's bitmaps over the network; the markers
        // and the legend on top of them are ours and stay in the comparison.
        mask: [page.locator('.leaflet-tile-pane')],
        animations: 'disabled',
        // Tightened from Playwright's default 0.2, with the run-to-run
        // rasterisation noise absorbed by the pixel count instead.
        //
        // What that buys, measured by breaking each thing on purpose and
        // watching the suite: a card losing its border — caught. A semantic
        // token wired to the neighbouring hue — caught. `--aq-c-moderate`
        // moved twelve values — caught. Moved *two* values — not caught, and
        // not at any threshold that survives antialiasing. So these baselines
        // are for shape and for colour a person would notice; the wiring of a
        // token to its role is `tests/tokens.spec.ts`, which reads the
        // stylesheet rather than the pixels.
        threshold: 0.02,
        maxDiffPixels: 120,
      });
    });
  }
}
