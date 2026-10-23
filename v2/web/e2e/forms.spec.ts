// A form you answer by writing instead of picking says so: Skipped, on every kind of form (B471, T472).
// guards: src/components/Talk.tsx src/components/Detail.tsx src/components/Doc.tsx src/lib/actions.ts src/lib/doctick.ts server/
import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { isDesk, open, project } from './seed'

test('r637 r140 r349: a question, a proposal and finished work answered by a reply show Skipped (B471)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: `new task P2 now Pick a colour
new idea P2 now A proposal
new task P2 now Some work
`,
    approve: ['T1', 'T3'],
    then: `T1 ask Which one?
  - ( ) Red
  - ( ) Blue
T3 done Finished: it works.
`,
  })
  for (const n of [1, 2, 3])
    await request.post(`${p.url}api/op`, { data: { op: 'input', text: 'Let us talk first', scope: n } })
  for (const code of ['T1', 'I2', 'T3']) {
    await open(page, p, code)
    await expect(page.getByText('Skipped · you replied').filter({ visible: true })).toBeVisible()
  }
})

test('choices in a document you were sent to, answered by a reply on the item, show Skipped (T472)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new task P2 now Pick a colour\n',
    approve: ['T1'],
    then: `T1 doc Colour plan
  Colour plan

  - ( ) Red
  - ( ) Blue
T1 ask Pick one in D1 (the colour plan).
`,
  })
  await request.post(`${p.url}api/op`, { data: { op: 'input', text: 'Let us talk first', scope: 1 } })
  await open(page, p, 'D1')
  await expect(page.getByText('Skipped · you replied on T1').filter({ visible: true })).toBeVisible()
  await open(page, p, 'T1')
  await expect(page.getByText('Skipped', { exact: true }).filter({ visible: true })).toBeVisible()
})

/** How light a colour is, 0 (black) to 1 (white); a see-through colour counts as none: -1. */
const light = (css: string) => {
  const [r, g, b, a = 1] = (css.match(/[\d.]+/g) || []).map(Number)
  return a === 0 ? -1 : (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}
const look = (l: Locator) =>
  l.evaluate((el) => {
    const s = getComputedStyle(el)
    return { bg: s.backgroundColor, fg: s.color }
  })

test('r662: replied instead of deciding, Skipped · you replied is the pick; Approve and Accept wait quietly, a button again under the pointer (B485)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new idea P2 now A proposal\nnew task P2 now Some work\n',
    approve: ['T2'],
    then: 'T2 done Finished: it works.\n',
  })
  for (const n of [1, 2])
    await request.post(`${p.url}api/op`, { data: { op: 'input', text: 'Let us talk first', scope: n } })
  for (const [code, label, to] of [
    ['I1', 'Approve', 'open'],
    ['T2', 'Accept', 'done'],
  ]) {
    await open(page, p, code)
    const skipped = page.getByText('Skipped · you replied').filter({ visible: true }).first()
    const btn = page
      .locator(`button[data-act="status"][data-v="${to}"]`)
      .filter({ visible: true, hasText: label })
      .first()
    await expect(skipped).toBeVisible()
    await expect(btn).toBeVisible()
    await page.mouse.move(2, 2)
    const s = await look(skipped),
      b = await look(btn)
    expect(light(s.bg), 'Skipped is filled, as a pick is').toBeGreaterThanOrEqual(0)
    expect(light(b.bg), `${label} has no fill`).toBe(-1)
    expect(light(b.fg), `${label} is quieter than Skipped`).toBeGreaterThan(light(s.fg))
    if (isDesk(page)) {
      await btn.hover()
      await expect.poll(async () => light((await look(btn)).fg)).toBeLessThan(light(b.fg))
    }
    await btn.click()
    await expect.poll(async () => p.read(code)).toMatch(new RegExp(`^${code} \\w+ P\\d \\w+ ${to}`))
  }
})
