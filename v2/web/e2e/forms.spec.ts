// A form you answer by writing instead of picking says so: Skipped, on every kind of form (B471, T472).
// guards: src/components/Talk.tsx src/components/Detail.tsx src/components/Doc.tsx src/lib/actions.ts src/lib/doctick.ts server/
import { expect, test } from '@playwright/test'
import { open, project } from './seed'

test('r637 r140 r349: a question, a proposal and finished work answered by a reply show Skipped (B471)', async ({ page, request }) => {
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
