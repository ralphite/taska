// What needs you is one number wherever it is shown: the project's badge in the sidebar, the Needs you view, and what
// the server tells the other pages (B482).
// guards: src/components/Shell.tsx src/components/List.tsx src/components/SideList.tsx src/lib/views.ts src/lib/data.ts server/taska/hub.py server/taska/store.py server/taska/views.py
import { expect, test } from '@playwright/test'
import { isDesk, open, project } from './seed'

test('the sidebar badge, the Needs you view and the server count the same items (B482)', async ({
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
  const server = async () =>
    ((await (await request.get('/api/projects')).json()) as { name: string; needs: number }[]).find(
      (x) => x.name === p.name,
    )?.needs
  // T1 asks, I2 is proposed, T3 is in review, the rule R5 asks: 4
  await expect(view).toHaveText('4')
  await expect(badge).toHaveText('4')
  expect(await server()).toBe(4)
  // archived while the page is open: all three go down together
  await request.post(`${p.url}api/op`, { data: { op: 'set', ref: 'T1', f: { archived: true } } })
  await expect(view).toHaveText('3')
  await expect(badge).toHaveText('3')
  expect(await server()).toBe(3)
})
