// Every story of a Storybook folder (T582 #5, pilot: Components/Item list) opened on the running Storybook: it draws,
// the console says no error, and it looks exactly like its saved picture (storyshots/pictures). A change that alters
// another story's look fails here; when the change is meant, save the pictures again with --update-snapshots.
import { expect, test } from '@playwright/test'

const FOLDER = process.env.STORY_FOLDER || 'Components/Item list'
const BASE = process.env.STORYBOOK_URL || 'http://localhost:6007'

type Entry = { id: string; title: string; name: string; type: string }
const index = (await (await fetch(`${BASE}/index.json`)).json()) as { entries: Record<string, Entry> }
const stories = Object.values(index.entries).filter((e) => e.type === 'story' && (e.title === FOLDER || e.title.startsWith(FOLDER + '/')))

for (const s of stories) {
  test(`${s.title} › ${s.name}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.goto(`${BASE}/iframe.html?id=${s.id}&viewMode=story`)
    await expect(page.locator('#storybook-root > *').first()).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    expect(errors, 'console errors').toEqual([])
    await expect(page).toHaveScreenshot(`${s.id}.png`, { fullPage: true, animations: 'disabled', caret: 'hide' })
  })
}
