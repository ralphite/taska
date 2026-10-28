// Replies leave questions and proposals skipped; replying to finished work sends it back to the agent (B607).
// guards: src/features/item/ src/features/docs/ src/ui/Markdown.tsx src/app/actions.ts src/app/docs/ src/model/docTicks.ts server/
import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { isDesk, open, project } from './seed'
import { box } from './ui'

test('r637 r140 r349: a question and a proposal answered by a reply show Skipped (B471)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: `new task P2 now Pick a colour
new idea P2 now A proposal
`,
    approve: ['T1'],
    then: `T1 ask Which one?
  - ( ) Red
  - ( ) Blue
`,
  })
  for (const n of [1, 2]) await p.op({ op: 'input', text: 'Let us talk first', scope: n })
  for (const code of ['T1', 'I2']) {
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
  await p.op({ op: 'input', text: 'Let us talk first', scope: 1 })
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

test('r662: a reply leaves a proposal skipped; Approve waits quietly, a button again under the pointer (B485)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new idea P2 now A proposal\n',
  })
  await p.op({ op: 'input', text: 'Let us talk first', scope: 1 })
  await open(page, p, 'I1')
  const skipped = page.getByText('Skipped · you replied').filter({ visible: true }).first()
  const approve = page.getByRole('button', { name: /^Approve/ }).filter({ visible: true, hasText: 'Approve' }).first()
  await expect(skipped).toBeVisible()
  await expect(approve).toBeVisible()
  await page.mouse.move(2, 2)
  const s = await look(skipped),
    b = await look(approve)
  expect(light(s.bg), 'Skipped is filled, as a pick is').toBeGreaterThanOrEqual(0)
  expect(light(b.bg), 'Approve has no fill').toBe(-1)
  expect(light(b.fg), 'Approve is quieter than Skipped').toBeGreaterThan(light(s.fg))
  if (isDesk(page)) {
    await approve.hover()
    await expect.poll(async () => light((await look(approve)).fg)).toBeLessThan(light(b.fg))
  }
  await approve.click()
  await expect.poll(async () => p.read('I1')).toMatch(/^I1 \w+ P\d \w+ open/)

})

test('B607: replying to finished work resumes it; Accept returns when the agent hands it over again', async ({ page, request }) => {
  const p = await project(request, {
    agent: 'new task P2 now Some work\n',
    approve: ['T1'],
    then: 'T1 done Finished: it works.\n',
  })
  await open(page, p, 'T1')
  const accept = page.getByRole('button', { name: /^Accept/ }).filter({ visible: true }).first()
  await expect(accept).toBeVisible()
  await box(page).fill('The sort still needs fixing.')
  await box(page).press('Shift+Enter')
  await expect.poll(async () => p.read('T1')).toMatch(/^T1 \w+ P\d \w+ doing/)
  await expect(page.getByText("Your agent's turn", { exact: true }).filter({ visible: true }).first()).toBeVisible()
  await expect(accept).toBeHidden()
  await expect(page.getByText('Skipped · you replied', { exact: true }).filter({ visible: true })).toHaveCount(0)
  await p.doAs('T1 done Fixed the sort too.\n')
  await expect(accept).toBeVisible()
  await accept.click()
  await expect.poll(async () => p.read('T1')).toMatch(/^T1 \w+ P\d \w+ done/)
})
