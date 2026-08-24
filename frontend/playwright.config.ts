import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run the real app against the real mock API.
 *
 * The Vitest suites stub the network with MSW, which proves the components
 * behave given a response. These prove the whole thing works: the Vite proxy,
 * the cursor round-trip against the actual server implementation, the map and
 * chart actually rendering, and the theme surviving a reload.
 *
 * Two viewports, because the brief requires the layout to hold from a wide
 * desktop down to an iPad and there is no mockup for the tablet case.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,

  /**
   * Fewer workers than the default `cores / 2`.
   *
   * Six projects share one fixture: a single-threaded Node mock server. Several
   * tests open the dashboard, which pulls 240 series apiece, and one of them
   * rolls those up in a 595 ms synchronous pass. At the default width the suite
   * failed roughly one run in four, always somewhere different — a tap not
   * delivered, an overlay that never opened, an assertion that ran out of
   * patience. None of that is the app; it is the harness outrunning its own
   * server. Capping the workers costs a few seconds and buys a suite whose red
   * means something.
   */
  workers: process.env['CI'] ? 2 : 4,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1512, height: 950 } },
      testIgnore: /phone\.spec\.ts/,
    },
    {
      /**
       * iPad portrait, driven by Chromium rather than the WebKit device
       * profile. What is being tested here is the responsive layout and that
       * nothing needs a hover — both engine-independent — and requiring a
       * second browser engine would mean anyone running this suite has to
       * download WebKit as well. `hasTouch` is what actually matters: it makes
       * Playwright dispatch taps instead of mouse events.
       */
      name: 'ipad',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
        isMobile: false,
      },
      // Visual baselines are captured once, at desktop width on Chromium.
      // Repeating them per project would triple the images for the same
      // information — the layout at other widths is asserted by measurement.
      testIgnore: /(phone|visual)\.spec\.ts/,
    },
    {
      /**
       * The iPad on the engine it actually runs.
       *
       * The Chromium project above is the fast one and covers behaviour; this
       * one covers the engine. A real iPad is Safari, and WebKit is where the
       * differences that matter to this app live — CSS media range syntax,
       * `clip-path`, `color-mix`, flex and grid rounding, canvas text metrics.
       * A layout that holds in Chromium at 768 px is evidence, not proof.
       *
       * It runs the same specs as the Chromium iPad rather than a subset:
       * anything worth asserting at that width is worth asserting on the
       * engine that will render it.
       */
      name: 'ipad-webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
        isMobile: false,
      },
      testIgnore: /(phone|visual)\.spec\.ts/,
    },
    {
      /**
       * Phone. The brief does not ask for this layout; the app has one anyway,
       * and it is a different layout rather than a narrower one — the sensor
       * table becomes cards and its sorting moves into the footer. Only the
       * phone spec runs here: re-running the desktop suite at 390 px would
       * assert against a layout it was not written for and prove nothing.
       */
      name: 'phone',
      testMatch: /phone\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: false,
      },
    },
    {
      /**
       * The phone on the engine phones actually run.
       *
       * Chromium above is the fast one; this is the honest one. A 390 px screen
       * is overwhelmingly an iPhone, and the card layout leans on exactly the
       * features engines disagree about — `clip-path` to collapse the header
       * row, `::before` content from a `data-label`, and a table whose `tr` and
       * `td` are laid out as blocks while keeping their roles.
       */
      name: 'phone-webkit',
      testMatch: /phone\.spec\.ts/,
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: false,
      },
    },
  ],

  /** Both servers are started for the run and torn down after it. */
  webServer: [
    {
      command: 'npm run mock-api',
      url: 'http://localhost:8787/stations/count',
      reuseExistingServer: !process.env['CI'],
      stdout: 'ignore',
    },
    {
      // The built bundle, not the dev server: see the note in vite.config.ts.
      // Costs a build per run and buys a suite that exercises what ships.
      command: 'npm run build && npm run preview',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env['CI'],
      stdout: 'ignore',
      timeout: 120_000,
    },
  ],
});
