// Yadong's requirements on an item's talk (D29, "Lists and items"; T475, D45): each check is named by the codes of his
// inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/Talk.tsx src/components/Detail.tsx src/lib/actions.ts
import { expect, test, type Locator } from '@playwright/test'
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

test('r368: a code in a message is a link to its item, and pointing at it shows the item', async ({
  page,
  request,
}) => {
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

// B507: how far down the talk a thing is drawn
const top = async (l: Locator) => (await l.boundingBox())?.y ?? NaN

test('r693: a card you replied on instead of deciding stays where it was, updated, and your reply comes after it; a card nothing came after is still last (B507)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: `new idea P2 now Proposed with no words
new task P2 now Some work
new idea P2 now A proposal
new task P2 now Still waits
`,
    approve: ['T2', 'T4'],
    then: 'I3 propose Do it this way.\nT2 done Finished: it works.\nT4 say Started.\n',
  })
  for (const n of [1, 2, 3])
    await request.post(`${p.url}api/op`, { data: { op: 'input', text: 'Let us talk first', scope: n } })
  await request.post(`${p.url}api/op`, { data: { op: 'input', text: 'Go ahead', scope: 4 } })
  await p.doAs('T4 done Finished too.\n')
  const talk = page.locator('#itemTalk').filter({ visible: true })
  const card = (text: string) => talk.locator('section').filter({ hasText: text }).first()
  const words = (text: string) => talk.getByText(text, { exact: true }).first()
  const above = (a: Locator, b: Locator, what: string) =>
    expect.poll(async () => (await top(a)) < (await top(b)), what).toBe(true)
  // a proposal and finished work: the card, updated, where it was; your reply after it
  for (const [code, said] of [
    ['I3', 'Do it this way.'],
    ['T2', 'Finished: it works.'],
  ]) {
    await open(page, p, code)
    await expect(card('Skipped · you replied')).toBeVisible()
    await expect(words('Let us talk first')).toBeAttached()
    await above(card('Skipped · you replied'), words('Let us talk first'), `${code}: the card above your reply`)
    await above(words(said), words('Let us talk first'), `${code}: what the agent said above your reply`)
  }
  // an agent's item with no words of its own: its card heads the talk, before your reply; deciding keeps it there
  await open(page, p, 'I1')
  await expect(card('Skipped · you replied')).toBeVisible()
  await above(card('Skipped · you replied'), words('Let us talk first'), 'I1: the card above your reply')
  await card('Skipped · you replied').locator('button[data-act="status"][data-v="open"]').click()
  await expect.poll(async () => p.read('I1')).toMatch(/^I0*1 \w+ P\d \w+ open/)
  await expect(card('proposed this').getByText('Approve')).toBeVisible()
  await above(card('proposed this'), words('Let us talk first'), 'I1 approved: the card above your reply')
  // nothing said after it: the card still waits, last, after all that came before it
  await open(page, p, 'T4')
  const waits = card('Finished too.')
  await expect(waits.locator('button[data-act="status"][data-v="done"]')).toBeVisible()
  for (const before of ['Started.', 'Go ahead']) await above(words(before), waits, `T4: ${before} above the card`)
})
