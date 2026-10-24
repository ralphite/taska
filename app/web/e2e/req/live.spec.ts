// Yadong's requirements on a page keeping up (D29, "Sending and sync"; T475, D45): each check is named by the codes of
// his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/sync/ src/app/project/ src/api/ src/worker/ server/taska/page_api/ server/taska/http/page_routes.py
import { expect, test } from '@playwright/test'
import { LOOP, open, project } from '../seed'
import { view } from '../ui'

test('r4: what an agent writes shows on the open page by itself, no reload', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p, 'T4')
  await page.evaluate(() => ((window as unknown as { still: boolean }).still = true)) // gone if the page reloads
  await p.doAs('T4 say The docs outline is ready\nnew task P2 now Fresh from the agent\n')
  await expect(page.getByText('The docs outline is ready').filter({ visible: true }).first()).toBeVisible({
    timeout: 20000,
  })
  // and the list: on the phone the item is a page of its own, so go back to the list without loading anything
  if (!(await page.locator('#list').isVisible())) await page.goBack()
  await view(page, 'All').click()
  await expect(page.locator('#list').getByText('Fresh from the agent').first()).toBeVisible({ timeout: 20000 })
  expect(await page.evaluate(() => (window as unknown as { still?: boolean }).still)).toBe(true)
})
