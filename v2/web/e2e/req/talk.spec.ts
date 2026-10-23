// Yadong's requirements on an item's talk (D29, "Lists and items"; T475, D45): each check is named by the codes of his
// inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/Talk.tsx src/components/Detail.tsx src/lib/actions.ts
import { expect, test } from '@playwright/test'
import { isDesk, open, project } from '../seed'

const lines = (n: number, what: string) => Array.from({ length: n }, (_, i) => `  ${what} line ${i + 1}`).join('\n')

test('r479: the latest message is open in full up to 50 lines; longer, it is cut with a way to show it all', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new task P1 now Notes from the call\n',
    approve: ['T1'],
    then: `T1 say Here is what we agreed\n${lines(39, 'Agreed')}\n`,
  })
  await open(page, p, 'T1')
  const talk = page.locator('#detailBody')
  await expect(talk.getByText('Agreed line 39')).toBeVisible()
  await expect(talk.locator('button[data-act="more-msg"]')).toHaveCount(0)
  await p.doAs(`T1 say And the long list\n${lines(60, 'Long')}\n`)
  await expect(talk.getByText(/And the long list/)).toBeAttached()
  await expect(talk.locator('button[data-act="more-msg"]').filter({ visible: true }).last()).toHaveText(
    /Show (all|more)/,
  )
})

test('r368: a code in a message is a link to its item, and pointing at it shows the item', async ({ page, request }) => {
  const p = await project(request, {
    agent: 'new task P1 now Notes from the call\nnew bug P0 now Export ignores the filter\n',
    approve: ['T1', 'B2'],
    then: 'T1 say The export bug is B2, fixed next\n',
  })
  await open(page, p, 'T1')
  const code = page.locator('#detailBody [data-ref="B2"]').filter({ visible: true }).first()
  await expect(code).toBeVisible()
  if (isDesk(page)) {
    await code.hover()
    await expect(page.locator('#tip[data-card]')).toContainText('Export ignores the filter')
  }
  await code.click()
  await expect(page).toHaveURL(/\/B0*2(\?|$)/)
})
