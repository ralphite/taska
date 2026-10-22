// The box keeps its height while you record, whatever else the page draws meanwhile (B481).
import { expect, test } from '@playwright/test'
import { LOOP, project } from './seed'

test.use({
  launchOptions: {
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
})

test('a pasted link keeps the box still while you record and agents write (B481)', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await page.goto(p.url + 'new')
  const box = page.locator('#composer'),
    height = async () => Math.round((await box.boundingBox())?.height || 0)
  // on the desktop it fits the box's whole width, but not beside its buttons
  await page.locator('#text').fill('http://localhost:8088/screenshot/2bc31034eb91e7e6ce3bd81f29dbaab7.png ')
  const before = await height()
  await page.locator('#composer [data-act="mic"]').filter({ visible: true }).first().click()
  await expect(page.locator('#recBar')).toBeVisible()
  const seen = new Set<number>()
  for (let i = 1; i <= 4; i++) {
    await p.doAs(`T4 progress step ${i}`) // each write reaches the page and draws it again
    await page.waitForTimeout(800)
    seen.add(await height())
  }
  expect([...seen]).toEqual([before])
  await page.locator('#composer [data-act="rec-cancel"]').click()
})
