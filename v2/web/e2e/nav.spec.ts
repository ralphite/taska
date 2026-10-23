// Going to a project from the sidebar opens the project itself, never a place inside it (B324, B463).
// guards: src/components/Shell.tsx src/components/SideList.tsx src/lib/nav.ts src/lib/url.ts src/lib/events.ts src/lib/switch.ts src/lib/boot.ts src/pages/
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'

for (const was of ['agents', 'T1', 'rules']) {
  test(`r623 r309: a project opens as itself from the sidebar, even after its ${was} was open (B463)`, async ({
    page,
    request,
  }) => {
    const p = await project(request, LOOP),
      other = await project(request, LOOP)
    await page.goto(p.url + was)
    await page.waitForURL(new RegExp(was + '$'))
    await open(page, other)
    if (!isDesk(page)) await page.locator('#projBtn').click()
    const link = page.locator(`a[href="${p.url}"]`).filter({ visible: true }).first()
    await link.waitFor()
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${p.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(new)?$`))
  })
}

test('r309 B324: a project opens as itself from the home table, though it has something waiting on you', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP) // T1 asks: the home row once led into it
  await page.goto('/')
  await page.locator(`a[href="${p.url}"]`).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(new RegExp(`${p.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(new)?$`))
  if (isDesk(page)) await expect(page.locator('#composeHead')).toBeVisible()
  else await expect(page.locator('#list [data-act="open"][data-n]').first()).toBeVisible()
  await expect(page.locator('#detailBody')).toBeHidden()
})

test('r97 r115 r295 r454: the New input page has the box in the middle and all you said below it', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the phone opens a project on its list; its inputs are a tab')
  const p = await project(request, LOOP)
  for (const text of ['First thought about the export', 'Second thought about the docs'])
    await request.post(`${p.url}api/op`, { data: { op: 'input', text } })
  await open(page, p)
  const head = page.locator('#composeHead'),
    box = page.locator('#composer'),
    said = page.locator('#composeList')
  await expect(head).toContainText(p.name.replace(/-/g, ' ')) // the project's title
  await expect(said).toContainText('First thought about the export')
  await expect(said).toContainText('Second thought about the docs')
  const [h, b, s, pane] = await Promise.all([head, box, said, page.locator('#foot')].map((l) => l.boundingBox()))
  if (!h || !b || !s || !pane) throw new Error('not laid out')
  // the box sits in the middle of its pane, under the project's name, with what you said under it
  expect(Math.abs(b.x + b.width / 2 - (pane.x + pane.width / 2))).toBeLessThan(24)
  expect(h.y + h.height).toBeLessThanOrEqual(b.y + 1)
  expect(b.y + b.height).toBeLessThanOrEqual(s.y + 1)
})
