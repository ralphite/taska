// Yadong's requirements on the input box (D29, "Sending and sync", "The input box"; T475, D45): each check is named by
// the codes of his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/features/composer/ src/app/inputs/ src/app/voice/ src/stores/box.ts src/stores/outbox.ts src/stores/noteVault.ts src/sync/ src/api/ src/worker/
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'
import { box, mic, recording, tab, voiceChip } from '../ui'

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } })

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
  await box(page).fill('Pick up the parcel before six')
  await page.keyboard.press('Shift+Enter')
  await expect(box(page)).toHaveValue('', { timeout: 1000 })
  await page.reload()
  await box(page).waitFor()
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
  await box(page).fill('Half a thought about the export')
  await page.waitForTimeout(600) // a draft is kept as you type
  await page.reload()
  await expect(box(page)).toHaveValue('Half a thought about the export')
  expect(asked).toBe(false)
})

test('r121 r129 r389: Esc ends a recording and sends nothing; leaving while recording asks first', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  await open(page, p)
  const before = await p.read('inbox')
  await mic(page).click()
  await expect(recording(page)).toBeVisible()
  await page.waitForTimeout(800)
  let asked = false
  page.once('dialog', (d) => {
    asked = true
    void d.dismiss() // stay
  })
  const leaving = page.reload({ timeout: 3000 }).catch(() => {}) // stays: the reload is called off
  await expect.poll(() => asked).toBe(true)
  await leaving
  await expect(recording(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(recording(page)).toBeHidden()
  await expect(box(page)).toHaveValue('')
  await page.waitForTimeout(1500)
  expect(await p.read('inbox')).toBe(before)
})

test('r480: a voice note shows play and its length, not the word Voice and no drawn waveform', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await mic(page).click()
  await expect(recording(page)).toBeVisible()
  await page.waitForTimeout(1500)
  await page.keyboard.press('Shift+Enter')
  await expect.poll(async () => p.read('inbox'), { timeout: 15000 }).toMatch(/voice/i)
  if (!isDesk(page)) await tab(page, 'Inputs').click()
  const chip = voiceChip(page)
  await expect(chip).toHaveText(/^\d+:\d\d/)
  const around = chip.locator('xpath=..')
  await expect(around).not.toContainText(/voice/i)
  await expect(around.locator('canvas, [data-wave]')).toHaveCount(0)
})
