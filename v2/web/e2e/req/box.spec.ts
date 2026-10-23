// Yadong's requirements on the input box (D29, "Sending and sync", "The input box"; T475, D45): each check is named by
// the codes of his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/Composer.tsx src/lib/outbox.ts src/lib/drafts.ts src/lib/voice.ts src/lib/audio.ts src/lib/data.ts src/lib/events.ts src/sw.ts
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'

test.use({
  launchOptions: {
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
})

test('r113 r525: Send empties the box at once, and what was sent arrives even with the network gone and the page reloaded', async ({
  page,
  context,
  request,
}) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.reload() // the page is kept by the browser now, as after any visit
  await open(page, p)
  await context.setOffline(true)
  await page.locator('#text').fill('Pick up the parcel before six')
  await page.keyboard.press('Shift+Enter')
  await expect(page.locator('#text')).toHaveValue('', { timeout: 1000 })
  await page.reload()
  await page.locator('#text').waitFor()
  await context.setOffline(false)
  await expect.poll(async () => p.read('inbox'), { timeout: 20000 }).toContain('Pick up the parcel before six')
})

test('r382 r389: words not sent stay in the box after a reload, and leaving is never stopped while not recording', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  await open(page, p)
  let asked = false
  page.on('dialog', (d) => {
    asked = true
    void d.accept()
  })
  await page.locator('#text').fill('Half a thought about the export')
  await page.waitForTimeout(600) // a draft is kept as you type
  await page.reload()
  await expect(page.locator('#text')).toHaveValue('Half a thought about the export')
  expect(asked).toBe(false)
})

test('r121 r129 r389: Esc ends a recording and sends nothing; leaving while recording asks first', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  await open(page, p)
  const before = await p.read('inbox')
  await page.locator('[data-act="mic"]').filter({ visible: true }).first().click()
  await expect(page.locator('#recBar')).toBeVisible()
  await page.waitForTimeout(800)
  let asked = false
  page.once('dialog', (d) => {
    asked = true
    void d.dismiss() // stay
  })
  const leaving = page.reload({ timeout: 3000 }).catch(() => {}) // stays: the reload is called off
  await expect.poll(() => asked).toBe(true)
  await leaving
  await expect(page.locator('#recBar')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#recBar')).toBeHidden()
  await expect(page.locator('#text')).toHaveValue('')
  await page.waitForTimeout(1500)
  expect(await p.read('inbox')).toBe(before)
})

test('r480: a voice note shows play and its length, not the word Voice and no drawn waveform', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.locator('[data-act="mic"]').filter({ visible: true }).first().click()
  await expect(page.locator('#recBar')).toBeVisible()
  await page.waitForTimeout(1500)
  await page.keyboard.press('Shift+Enter')
  await expect.poll(async () => p.read('inbox'), { timeout: 15000 }).toMatch(/voice/i)
  if (!isDesk(page)) await page.locator('[data-act="tab"][data-tab="inputs"]').filter({ visible: true }).first().click()
  const chip = page.locator('button[data-act="play"]').filter({ visible: true }).first()
  await expect(chip.locator('[data-time]')).toHaveText(/^\d+:\d\d/)
  const box = chip.locator('xpath=..')
  await expect(box).not.toContainText(/voice/i)
  await expect(box.locator('canvas, [data-wave]')).toHaveCount(0)
})
