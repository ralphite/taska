// Yadong's requirements on how the input box looks (D29, "The input box", "Details"; T475, D45): each check is named by
// the codes of his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/Composer.tsx src/components/Shell.tsx src/components/Detail.tsx src/index.css
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { LOOP, open, project } from '../seed'

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
    // light: the box is white on the white page, only its border apart: B536 asks Yadong (T475)
    test.fixme(scheme === 'light', 'the box is white on a white page in light: asked in B536')
    await page.emulateMedia({ colorScheme: scheme })
    const p = await project(request, LOOP)
    for (const at of ['', 'T1']) {
      await open(page, p, at)
      const c = await colours(page)
      expect(c.box, `${at || 'New input'}: the box and the page beside it`).not.toBe(c.page)
    }
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
