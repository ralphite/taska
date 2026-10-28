// Yadong's requirements on how the input box looks (D29, "The input box", "Details"; T475, D45): each check is named by
// the codes of his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/features/composer/ src/pages/ProjectPageContainer.tsx src/features/item/ItemPage.tsx src/ui/PaneFrame.tsx src/index.css
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'
import { FOOT, TALK, box, duo, foot, talk as talkOf } from '../ui'

/** The box's colour and the colour of the page just beside it (left of it, at its middle). */
const colours = (page: Page) =>
  page.evaluate(() => {
    const box = document.getElementById('composer') as HTMLElement
    const r = box.getBoundingClientRect()
    const solid = (c: string) => c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)
    const bg = (el: Element | null): string => {
      for (let e = el; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor
        if (solid(c)) return c
      }
      return getComputedStyle(document.body).backgroundColor
    }
    const beside = document.elementsFromPoint(Math.max(0, r.left - 6), r.top + 14).find((e) => !box.contains(e)) || null
    return { box: bg(box), page: bg(beside) }
  })

for (const scheme of ['light', 'dark'] as const)
  test(`r469: the box stands apart from the page around it (${scheme})`, async ({ page, request }) => {
    // light: the white box stands on a light grey strip (B536, Yadong's pick 2, #6715)
    await page.emulateMedia({ colorScheme: scheme })
    const p = await project(request, LOOP)
    for (const at of ['', 'T1']) {
      await open(page, p, at)
      const c = await colours(page)
      expect(c.box, `${at || 'New input'}: the box and the page beside it`).not.toBe(c.page)
    }
  })

test('r469 #6715: in light the talk of an item in one column runs down to the strip under the box, no white gap above it (B536)', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'one column with its talk under the item is the desktop\u2019s')
  await page.emulateMedia({ colorScheme: 'light' })
  const p = await project(request, LOOP)
  for (let i = 0; i < 14; i++)
    await p.doAs(`T1 say A long talk, message ${i + 1}, so that it scrolls behind the box.\n`)
  await open(page, p, 'T1')
  const talk = talkOf(page)
  await talk.evaluate((e) => (e.scrollTop = (e.scrollHeight - e.clientHeight) / 2))
  const [t, f] = [await talk.boundingBox(), await foot(page).boundingBox()]
  if (!t || !f) throw new Error('not drawn')
  expect(t.y + t.height, 'the talk ends at the strip, not above it').toBeGreaterThanOrEqual(f.y - 1)
})

test('#6915 r711 r712: in dark the talk of an item in one column runs on under the box as in two columns: its words show above the box, and its end stays clear of it (F478)', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'one column with its talk under the item is the desktop\u2019s')
  await page.emulateMedia({ colorScheme: 'dark' })
  const p = await project(request, LOOP)
  for (let i = 0; i < 14; i++)
    await p.doAs(`T1 say A long talk, message ${i + 1}, so that it scrolls behind the box.\n`)
  await open(page, p, 'T1')
  await expect(duo(page)).toHaveCount(0)
  const talk = talkOf(page)
  await talk.evaluate((e) => (e.scrollTop = (e.scrollHeight - e.clientHeight) / 2))
  const under = await page.evaluate((sel) => {
    const b = (document.getElementById('composer') as HTMLElement).getBoundingClientRect(),
      t = document.querySelector(sel) as HTMLElement
    // just above the box, beside its rounded corner: what is there is the talk, seen through the foot
    return document.elementsFromPoint(b.left + 3, b.top - 2).some((e) => t.contains(e))
  }, TALK)
  expect(under, 'the talk is what shows just above the box').toBe(true)
  await talk.evaluate((e) => (e.scrollTop = e.scrollHeight))
  const gap = await page.evaluate(
    ([t, f]) => {
      const last = document.querySelector(t)?.firstElementChild?.lastElementChild as HTMLElement
      return (document.querySelector(f) as HTMLElement).getBoundingClientRect().top - last.getBoundingClientRect().bottom
    },
    [TALK, FOOT],
  )
  expect(gap, 'at the end the last message is clear above the box').toBeGreaterThanOrEqual(20)
})

test('r514: there is no New rule: the box never offers to write a rule', async ({ page, request }) => {
  const p = await project(request, LOOP)
  for (const at of ['', 'rules', 'T1']) {
    await page.goto(p.url + at)
    await box(page).waitFor()
    await expect(box(page)).not.toHaveAttribute('placeholder', /rule/i)
    await expect(foot(page)).not.toContainText(/new rule/i)
  }
})
