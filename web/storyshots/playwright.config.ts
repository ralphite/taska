import { defineConfig } from '@playwright/test'

// Storybook's pictures (T582 #5): npx playwright test -c storyshots [--update-snapshots]
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  workers: 2,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/pictures/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixels: 0 } },
  use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, browserName: 'chromium', colorScheme: 'light' },
})
