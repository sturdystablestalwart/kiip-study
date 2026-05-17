// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  // Issue #210 — wait for at least one Test fixture to exist before any
  // spec runs.  Without this, manual-audit.spec.js silently skipped in
  // CI because its beforeEach finds an empty DB.  globalSetup polls
  // /api/tests until one appears (auto-importer populates from
  // additionalContext/tests/ when ENABLE_AUTO_IMPORT=true).
  globalSetup: require.resolve('./tests/global-setup.js'),
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Issue #192 — within a single shard, run worker-parallel on CI too.
     We previously pinned `workers: 1` defensively but the suite is now
     stable enough to use the runner's full CPU.  Combined with the
     `--shard=N/M` matrix in .github/workflows/ci.yml this gets E2E
     wall-clock well under the 15-min job timeout. */
  workers: process.env.CI ? 2 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Issue #55 — Playwright owns the dev-server lifecycle.  Previously
     CI started servers in shell steps and raced them against the
     runner; if a server failed to come up (port collision, slow
     Mongo), Playwright hit dead endpoints and failures looked like
     product bugs.  Now Playwright waits for each /health (or root URL)
     before any test runs.  reuseExistingServer locally so devs can
     keep `npm start` running between iterations. */
  webServer: [
    {
      command: 'cd server && npm start',
      url: 'http://localhost:5000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
      // Issue #210 — auto-import the additionalContext/tests/ fixtures
      // so /api/tests has data for manual-audit.spec.js (which would
      // otherwise skip every case).  The server env block in
      // .github/workflows/ci.yml also sets this, but webServer-managed
      // local Playwright runs need it too.
      env: { ENABLE_AUTO_IMPORT: 'true' },
    },
    {
      command: 'cd client && npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  /* Test timeout */
  timeout: 30 * 1000,

  /* Expect timeout */
  expect: {
    timeout: 10 * 1000,
  },
});
