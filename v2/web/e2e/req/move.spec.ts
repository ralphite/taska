// Yadong's requirements on moving an item to another project (D29, "Lists and items"; R409; T475, D45): each check is
// named by the codes of his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/List.tsx src/components/Shell.tsx src/lib/actions.ts src/lib/data.ts src/lib/outbox.ts server/taska/hub.py
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'

test('r506 r519: an item dragged onto another project in the sidebar leaves the list at once and is there', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'dragging to the sidebar is on the desktop')
  const p = await project(request, LOOP),
    to = await project(request)
  await open(page, p, '?status=every')
  const row = page.locator('#list article[data-n]').filter({ hasText: 'Write the user docs' }).first()
  const target = page.locator(`#drawer a[data-slug="${to.name}"]`)
  await expect(target).toBeVisible()
  // the server answers late: what you see must not wait for it
  let release = () => {}
  const held = new Promise<void>((r) => (release = r))
  await page.route('**/api/move-item**', async (route) => {
    await held
    await route.continue()
  })
  await row.dragTo(target)
  await expect(row).toHaveCount(0, { timeout: 1500 })
  release()
  await expect.poll(async () => to.read('items?status=all'), { timeout: 15000 }).toContain('Write the user docs')
  expect(await p.read('items?status=all')).not.toContain('Write the user docs')
})
