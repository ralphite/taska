// Yadong's requirements on subitems (D29, "Lists and items"; T475, D45): each check is named by the codes of his
// inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/List.tsx src/components/Detail.tsx src/components/ui.tsx src/lib/actions.ts src/lib/state.ts src/lib/data.ts
import { expect, test } from '@playwright/test'
import { isDesk, open, project } from '../seed'

test('r760 r733 r734: a subitem the Active view hides is not lost: its parent gets its arrow and a grey line that shows it, the item page marks it Later, and both count the same', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: `new task P1 now Plan the launch
new task P2 now parent=T1 Book the venue
new task P1 now Write the press kit
new task P2 now parent=T3 Draft the release
new task P2 now parent=T3 Collect the quotes
`,
    approve: ['T1', 'T2', 'T3', 'T4', 'T5'],
  })
  // T1's only subitem goes to Later (as the organizer does); one of T3's is finished, the other in Later
  const set = async (ref: string, f: Record<string, string>) => {
    const r = await request.post(`${p.url}api/op`, { data: { op: 'set', ref, f } })
    expect(((await r.json()) as { ok: boolean }).ok).toBe(true)
  }
  await set('T2', { when: 'later' })
  await set('T4', { status: 'done' })
  await set('T5', { when: 'later' })

  await open(page, p) // Active, the view a project opens on
  const row = (n: number) => page.locator(`#list article[data-n="${n}"]`)
  const line = (n: number) => page.locator(`#list [data-act="sub-more"][data-n="${n}"]`)
  // T1 shows 0/1 with nothing of it under it: it has its fold arrow, and the line says what Active hides
  await expect(row(1)).toContainText('0/1')
  await expect(row(2)).toHaveCount(0)
  await expect(page.locator('#list [data-act="fold"][data-n="1"]')).toBeVisible()
  await expect(line(1)).toHaveText('1 more in Later')
  await expect(line(3)).toHaveText('2 more: 1 in Later, 1 finished')
  // the line is a tap target of its own: 44 px on the phone, 40 on the desktop
  const box = await line(1).boundingBox()
  expect(Math.round(box?.height || 0)).toBe(isDesk(page) ? 40 : 44)

  // a tap shows the hidden subitem as a row, marked Later, and the line reads Show fewer; again hides it
  await line(1).click()
  await expect(row(2)).toBeVisible()
  await expect(row(2)).toContainText('Book the venue')
  await expect(row(2)).toContainText('Later')
  await expect(line(1)).toHaveText('Show fewer')
  await expect(row(4)).toHaveCount(0) // another parent's stay as they were
  await line(1).click()
  await expect(row(2)).toHaveCount(0)
  await expect(line(1)).toHaveText('1 more in Later')
  // folding the parent folds its line with it
  await page.locator('#list [data-act="fold"][data-n="1"]').click()
  await expect(line(1)).toHaveCount(0)
  await page.locator('#list [data-act="fold"][data-n="1"]').click()
  await expect(line(1)).toBeVisible()

  // the item page lists the same subitem, marked Later, and counts it the same: 0/1
  await open(page, p, 'T1')
  const sub = page.locator('#itemPage [data-act="goto"][data-n="2"]')
  await expect(sub).toContainText('Book the venue')
  await expect(sub).toContainText('Later')
  await expect(page.locator('#itemPage h2').filter({ hasText: 'Subitems' })).toHaveText('Subitems \u00b7 0/1')
  // T3: its finished one is not marked Later (it is crossed out), its Later one is
  await open(page, p, 'T3')
  await expect(page.locator('#itemPage [data-act="goto"][data-n="5"]')).toContainText('Later')
  await expect(page.locator('#itemPage [data-act="goto"][data-n="4"]')).not.toContainText('Later')
  await expect(page.locator('#itemPage h2').filter({ hasText: 'Subitems' })).toHaveText('Subitems \u00b7 1/2')
  if (isDesk(page)) await expect(row(3)).toContainText('1/2') // the list beside it says the same
})
