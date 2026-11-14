import { defineConfig, devices } from '@playwright/test'

// Yadong's requirements as browser checks (e2e/), run against a running Taska at TASKA_URL: tools/e2e.py starts
// one on a fresh, empty data folder (never ~/.taska) for each spec file in each layout, several at once; in one run the
// checks go one at a time (some count everything their Taska has).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.TASKA_URL || 'http://127.0.0.1:7341',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 15'], viewport: { width: 393, height: 852 }, browserName: 'chromium' } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, browserName: 'chromium' } },
    // Safari's engine on the phone (B786: WebKit moves what scrolls the talk by itself where Chromium does not), for
    // the spec files that name it on their "// layouts:" line (tools/e2e.py). Its page's service worker is kept out:
    // in WebKit the requests it takes never reach a check's page.route
    {
      name: 'phone-webkit',
      use: { ...devices['iPhone 15'], viewport: { width: 393, height: 852 }, browserName: 'webkit', serviceWorkers: 'block' },
    },
  ],
})
