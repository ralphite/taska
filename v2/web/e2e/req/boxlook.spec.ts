// Yadong's requirements on how the input box looks (D29, "The input box", "Details"; T475, D45): each check is named by
// the codes of his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/Composer.tsx src/components/Shell.tsx src/components/Detail.tsx src/index.css
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'

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
  const talk = page.locator('#itemTalk')
  await talk.evaluate((e) => (e.scrollTop = (e.scrollHeight - e.clientHeight) / 2))
  const [t, f] = [await talk.boundingBox(), await page.locator('#foot').boundingBox()]
  if (!t || !f) throw new Error('not drawn')
  expect(t.y + t.height, 'the talk ends at the strip, not above it').toBeGreaterThanOrEqual(f.y - 1)
})

test('r514: there is no New rule: the box never offers to write a rule', async ({ page, request }) => {
  const p = await project(request, LOOP)
  for (const at of ['', 'rules', 'T1']) {
    await page.goto(p.url + at)
    await page.locator('#text').waitFor()
    await expect(page.locator('#text')).not.toHaveAttribute('placeholder', /rule/i)
    await expect(page.locator('#foot')).not.toContainText(/new rule/i)
  }
})
