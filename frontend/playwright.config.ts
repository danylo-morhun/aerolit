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
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env['CI'],
      stdout: 'ignore',
    },
  ],
});
