// Replies leave questions skipped; a reply on a proposal approves it (T818); replying to finished work sends it back to
// the agent (T607).
// guards: src/features/task/ src/features/docs/ src/ui/Markdown.tsx src/app/actions.ts src/app/docs/ src/model/docTicks.ts server/
import { expect, test } from '@playwright/test'
import { open, project } from './seed'
import { box } from './ui'

test('r637 r140 r349: a question answered by a reply shows Replied; a proposal replied on is approved (T471, T818)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: `new P2 now Pick a colour
new P2 now A proposal
`,
    approve: ['T1'],
    then: `T1 ask Which one?
  - ( ) Red
  - ( ) Blue
`,
  })
  for (const n of [1, 2]) await p.op({ op: 'input', text: 'Let us talk first', scope: n })
  // a question answered by a reply: Replied where Send answer was (r1003)
  await open(page, p, 'T1')
  await expect(page.getByText(/^Replied/).filter({ visible: true }).first()).toBeVisible()
  // a proposal you replied on is approved (T818 r1401): open, its card decided in place
  await open(page, p, 'T2')
  await expect.poll(async () => p.read('T2')).toMatch(/^T2 P\d \w+ open/)
  await expect(page.getByText('Skipped · you replied').filter({ visible: true })).toHaveCount(0)
})

test('choices in a document you were sent to, answered by a reply on the task, show Skipped (T472)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new P2 now Pick a colour\n',
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
  // the question's head says it as the cards do (R3-1 #3)
  await expect(page.getByText('Skipped · you replied', { exact: true }).filter({ visible: true })).toBeVisible()
})

test('T818 r1401: a reply on a proposal approves it; its card stays where it was, Approve greyed and not to be pressed (r1003)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new P2 now A proposal\n',
  })
  await p.op({ op: 'input', text: 'Let us talk first', scope: 1 })
  await expect.poll(async () => p.read('T1')).toMatch(/^T1 P\d \w+ open/)
  await open(page, p, 'T1')
  const approve = page.getByRole('button', { name: /^Approve/ }).filter({ visible: true }).first()
  await expect(approve).toBeVisible()
  await expect(approve).toBeDisabled()
  await expect(page.getByText('Skipped · you replied').filter({ visible: true })).toHaveCount(0)
})

test('T607: replying to finished work resumes it; Accept returns when the agent hands it over again', async ({ page, request }) => {
  const p = await project(request, {
    agent: 'new P2 now Some work\n',
    approve: ['T1'],
    then: 'T1 done Finished: it works.\n',
  })
  await open(page, p, 'T1')
  const accept = page.getByRole('button', { name: /^Accept/ }).filter({ visible: true }).first()
  await expect(accept).toBeVisible()
  await box(page).fill('The sort still needs fixing.')
  await box(page).press('Shift+Enter')
  // back to open: the agent's turn (Yadong r961), no word of its own
  await expect.poll(async () => p.read('T1')).toMatch(/^T1 P\d \w+ open/)
  // the card keeps its buttons where they were, greyed and not to be pressed (r1003, r1007)
  await expect(accept).toBeDisabled()
  await expect(page.getByText('Skipped · you replied', { exact: true }).filter({ visible: true })).toHaveCount(0)
  await p.doAs('T1 done Fixed the sort too.\n')
  await expect(accept).toBeVisible()
  await expect(accept).toBeEnabled()
  await accept.click()
  await expect.poll(async () => p.read('T1')).toMatch(/^T1 P\d \w+ done/)
})
