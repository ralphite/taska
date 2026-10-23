// Going to a project from the sidebar opens the project itself, never a place inside it (B324, B463).
// guards: src/components/Shell.tsx src/components/SideList.tsx src/lib/nav.ts src/lib/url.ts src/lib/events.ts src/lib/switch.ts src/lib/boot.ts src/pages/ src/components/Detail.tsx src/layouts/
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
  // the box sits in the middle of its pane, under the project's name, with what you said under it (polled: a slow
  // machine lays the page out late)
  await expect
    .poll(async () => {
      const [h, b, s, pane] = await Promise.all([head, box, said, page.locator('#foot')].map((l) => l.boundingBox()))
      if (!h || !b || !s || !pane) return 'not laid out'
      return {
        middle: Math.abs(b.x + b.width / 2 - (pane.x + pane.width / 2)) < 24,
        nameAbove: h.y + h.height <= b.y + 1,
        saidBelow: b.y + b.height <= s.y + 1,
      }
    })
    .toEqual({ middle: true, nameAbove: true, saidBelow: true })
})

test('r454: the list under the New input box is everything you said, more loading as you scroll down', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the phone opens a project on its list; its inputs are a tab')
  const p = await project(request, LOOP)
  for (let i = 1; i <= 75; i++)
    await request.post(`${p.url}api/op`, { data: { op: 'input', text: `Thought number ${i} of many` } })
  await open(page, p)
  const said = page.locator('#composeList')
  await expect(said).toContainText('Thought number 75 of many') // the newest first
  await expect(said).not.toContainText('Thought number 1 of many') // not all drawn at once
  // scrolling down brings the rest, to the very first
  await expect
    .poll(
      async () => {
        await page.locator('#foot').evaluate((el) => el.scrollTo(0, el.scrollHeight))
        return (await said.innerText()).includes('Thought number 1 of many')
      },
      { timeout: 20000 },
    )
    .toBe(true)
})

test("D77 #1 #2, D82 #1-3: an item's address reloaded says Loading in its place until the data comes, then shows the item; an item or a document not in the project says so, and the address keeps it", async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  let hold = true
  await page.route('**/api/state**', async (r) => {
    while (hold) await new Promise((ok) => setTimeout(ok, 100))
    await r.continue()
  })
  await page.goto(p.url + 'T4')
  await expect(page.locator('[data-missing="loading"]').filter({ visible: true })).toHaveText('Loading T4\u2026')
  hold = false
  await expect(page.locator('#detailBody h1')).toHaveText('Write the user docs')
  await page.unroute('**/api/state**')
  for (const what of ['T99', 'D99']) {
    await page.goto(p.url + what)
    await expect(page.locator('[data-missing="none"]').filter({ visible: true })).toHaveText(
      `${what} is not in this project`,
    )
    await expect(page).toHaveURL(new RegExp(`/${what}$`))
  }
})
