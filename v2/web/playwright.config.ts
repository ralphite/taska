import { defineConfig, devices } from '@playwright/test'

// The end-to-end tests run against a running Taska: TASKA_URL (default the v2 server on 7341). The same
// behaviour tests run against the old app too (TASKA_URL=http://127.0.0.1:<its port>): they are the acceptance
// tests v2 must pass. Only data copies are used, never ~/.taska.
const url = process.env.TASKA_URL || 'http://127.0.0.1:7341'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: url, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'phone',
      use: { ...devices['iPhone 15'], viewport: { width: 393, height: 852 }, browserName: 'chromium' },
    },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, browserName: 'chromium' } },
  ],
})
