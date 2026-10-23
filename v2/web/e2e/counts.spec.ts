// What needs you is one number wherever it is shown: the project's badge in the sidebar, the Needs you view (its chip
// and its rows), the home table and its total, the phone's project list, and what the server tells the other pages
// (B482, R483: "this inconsistency must never happen").
// guards: src/components/Shell.tsx src/components/List.tsx src/components/SideList.tsx src/components/Sheets.tsx src/pages/Home.tsx src/lib/views.ts src/lib/data.ts src/lib/actions.ts server/taska/hub.py server/taska/store.py server/taska/views.py
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { isDesk, open, project } from './seed'
import type { Project } from './seed'

const server = async (request: APIRequestContext, p: Project) => {
  const list = (await (await request.get('/api/projects')).json()) as { name: string; needs: number }[]
  const needs = (await (await request.get('/api/needs')).json()) as { project: string }[]
  return {
    projects: list.find((x) => x.name === p.name)?.needs,
    needs: needs.filter((x) => x.project === p.name).length,
  }
}

test('r659 R483: the sidebar badge, the Needs you view and the server count the same items (B482)', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the sidebar is on the desktop')
  const p = await project(request, {
    agent: `new task P1 now Pick a format
new idea P2 now A proposal
new task P2 now Finished work
new task P2 now Asked, then archived
new rule P2 now Keep commits small
new task P2 now Asked, then done
`,
    approve: ['T1', 'T3', 'T4', 'R5', 'T6'],
    then: `T1 ask Which format?
T3 done Works now.
T4 ask Still needed?
R5 ask Does this cover documents too?
T6 ask Anything else?
`,
  })
  // archived while it asks: off the list, so off every count (it was still in the badge); finished while it asks: too
  await request.post(`${p.url}api/op`, { data: { op: 'set', ref: 'T4', f: { archived: true } } })
  await request.post(`${p.url}api/op`, { data: { op: 'set', ref: 'T6', f: { status: 'done' } } })
  await open(page, p)
  const badge = page.locator(`a[data-slug="${p.name}"] [title$="need you"]`),
    view = page.locator('#list [data-views][data-v="wait"] .font-mono')
  // T1 asks, I2 is proposed, T3 is in review, the rule R5 asks: 4
  await expect(view).toHaveText('4')
  await expect(badge).toHaveText('4')
  expect(await server(request, p)).toEqual({ projects: 4, needs: 4 })
  // archived while the page is open: all of them go down together
  await request.post(`${p.url}api/op`, { data: { op: 'set', ref: 'T1', f: { archived: true } } })
  await expect(view).toHaveText('3')
  await expect(badge).toHaveText('3')
  expect(await server(request, p)).toEqual({ projects: 3, needs: 3 })
})

/** Every place this page shows what needs you in project p says n, and its Needs you view holds n rows. Each waits for
 * the page to show it (a slow machine draws late), and a different number there fails it. */
async function showsEverywhere(page: Page, p: Project, n: number) {
  await expect(page.locator('#list [data-views][data-v="wait"] .font-mono'), 'the Needs you view').toHaveText(String(n))
  if (isDesk(page))
    await expect(page.locator(`a[data-slug="${p.name}"] [title$="need you"]`), 'the sidebar').toHaveText(String(n))
  else {
    await page.locator('#projBtn').click()
    // its badge alone (the title before it may end in digits too)
    const row = page.locator(`a[data-slug="${p.name}"]`).filter({ visible: true }).first()
    await expect(row.locator('span.rounded-full', { hasText: /need you$/ }), 'the project list').toHaveText(
      `${n} need you`,
    )
    await page.keyboard.press('Escape')
  }
  await page.locator('#list [data-views] [data-v="wait"]').click()
  await expect(page.locator('#list [data-views] [data-v="wait"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#list [data-act="open"][data-n]').filter({ visible: true }), 'its rows').toHaveCount(n)
}

test('r659 R483: one number everywhere, on the desktop and the phone, the home table and its total included', async ({
  page,
  request,
}) => {
  // what counts: an ask (T1), a block (T2), a proposal (I3), finished work (T4), a rule asked about (R5), a subitem
  // asking under an item still open (T7); what does not: a proposal you replied on (I8), an ask you answered (T9), an
  // ask on dropped work (T10), a proposal merged away (I11 into I3)
  const p = await project(request, {
    agent: `new task P1 now Pick a format
new bug P1 now Export fails
new idea P2 now A proposal
new task P2 now Finished work
new rule P2 now Keep commits small
new task P2 now The parent
new task P2 now parent=T6 A subitem asking
new idea P2 now A proposal you replied on
new task P2 now An ask you answered
new task P2 now Asked, then dropped
new idea P2 now The same proposal again
`,
    approve: ['T1', 'B2', 'T4', 'R5', 'T6', 'T7', 'T9', 'T10'],
    then: `T1 ask Which format?
B2 block I need the export key
T4 done Works now.
R5 ask Does this cover documents too?
T7 ask Which venue?
T9 ask Still needed?
T10 ask Keep it?
I11 merge I3
`,
  })
  for (const n of [8, 9])
    await request.post(`${p.url}api/op`, { data: { op: 'input', text: 'Let us talk first', scope: n } })
  await request.post(`${p.url}api/op`, { data: { op: 'set', ref: 'T10', f: { status: 'dropped' } } })
  expect(await server(request, p)).toEqual({ projects: 6, needs: 6 })
  await open(page, p)
  await showsEverywhere(page, p, 6)
  // the home table: this project's number, and the total is the sum of the rows
  await page.goto('/')
  const row = page.locator(`a[href="${p.url}"]`).filter({ visible: true }).first()
  await expect(row.locator('.rounded-full').filter({ hasText: /^\d+$/ })).toHaveText('6')
  const list = (await (await request.get('/api/projects')).json()) as { needs: number }[]
  const sum = list.reduce((a, x) => a + x.needs, 0)
  if (isDesk(page))
    await expect(page.locator('#sum')).toContainText(sum ? new RegExp(`(^|\\D)${sum} need you`) : 'nothing needs you')
  expect((await (await request.get('/api/needs')).json()).length).toBe(sum)
})
