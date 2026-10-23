// Yadong's requirements on what waits for him (D29, "Agents and talk"; R055; T475, D45): each check is named by the codes
// of his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/List.tsx src/components/Detail.tsx src/components/Talk.tsx src/lib/rows.ts src/lib/views.ts src/lib/state.ts server/taska/store.py server/taska/views.py
import { expect, test } from '@playwright/test'
import { open, project } from '../seed'

test('r68 r326: work an agent is blocked on waits on you: in Needs you, with what it needs and Answer', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new task P1 now Ship the export\nnew task P2 now Still going\n',
    approve: ['T1', 'T2'],
    then: 'T1 doing\nT2 doing\nT1 block I need the export key\n',
  })
  await open(page, p)
  await page.locator('#list [data-views] [data-v="wait"]').click()
  const rows = page.locator('#list [data-act="open"][data-n]').filter({ visible: true })
  await expect(rows.filter({ hasText: 'Ship the export' })).toHaveCount(1)
  await expect(rows.filter({ hasText: 'Still going' })).toHaveCount(0) // only what waits on you
  const row = rows.filter({ hasText: 'Ship the export' }).first()
  await expect(row).toContainText('I need the export key')
  await expect(row.locator('[data-act]').filter({ hasText: 'Answer' }).filter({ visible: true })).toHaveCount(1)
  await open(page, p, 'T1')
  const body = page.locator('#detailBody')
  await expect(
    body
      .getByText(/is blocked and needs you/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible()
  await expect(body.getByText('I need the export key').filter({ visible: true }).first()).toBeVisible()
})
