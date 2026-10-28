import { defineConfig, devices } from '@playwright/test'

// Yadong's requirements as browser checks (e2e/), run against a running Taska at TASKA_URL: tools/e2e.py starts
// one on a fresh, empty data folder (never ~/.taska) and runs them, one page at a time.
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
  ],
})
