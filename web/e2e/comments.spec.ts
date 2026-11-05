// Comments on a document, where the Storybook review found them wrong (T529, D80): the buttons on a comment.
// guards: src/features/docs/ src/ui/bits.tsx
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { isDesk, open, project } from './seed'
import { commentCard, docBlock, threadCounts } from './ui'

const LONG = 'The export keeps every column the filter shows, in the order the list shows them, and nothing it hides.'
/** A document whose first paragraph has a comment of yours on some of its words, open, the comment in sight. */
async function commented(page: Page, request: APIRequestContext) {
  const p = await project(request, {
    agent: 'new task P2 now Plan the export\n',
    approve: ['T1'],
    then: `T1 doc The plan\n  ${LONG}\n\n  Second part.\n`,
  })
  const para = { key: '', quote: LONG.slice(0, 80) }
  await open(page, p, 'D1')
  const sec = docBlock(page, 'The export keeps')
  para.key = (await sec.getAttribute('data-key')) || ''
  expect((await p.op({ op: 'dc', d: 1, key: para.key, quote: para.quote, text: 'Why not all of them?' })).ok).toBe(true)
  const card = commentCard(page, 'Why not all of them?')
  const counts = threadCounts(page)
  await expect(card.or(counts).first()).toBeVisible()
  if (!(await card.isVisible()))
    for (const c of await counts.all()) {
      await c.click()
      if (
        await card.waitFor({ timeout: 5000 }).then(
          () => true,
          () => false,
        )
      )
        break
    }
  await expect(card).toBeVisible()
  await card.scrollIntoViewIfNeeded()
  return card
}

test("D80 #16: pointed at, a comment's Edit, Move and Delete cover none of the words it quotes", async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'they float while pointed at on the desktop')
  const card = await commented(page, request)
  await card.hover()
  const acts = card.getByRole('button', { name: 'Move', exact: true }).locator('xpath=..')
  await expect(acts).toBeVisible()
  const quote = card.getByText(/^\u201cThe export keeps/)
  await expect(quote).toBeVisible()
  const [a, q] = [await acts.boundingBox(), await quote.boundingBox()]
  if (!a || !q) throw new Error('not drawn')
  expect(a.y, 'the buttons start below the quoted words').toBeGreaterThanOrEqual(q.y + q.height - 1)
})

test('D115 #40: a thread you resolve folds into the count beside its paragraph; the count opens it again', async ({ page, request }) => {
  const card = await commented(page, request)
  const thread = page.locator('[data-thread]').filter({ has: card })
  await thread.getByRole('button', { name: 'Resolve', exact: true }).click()
  await expect(card).toBeHidden()
  const count = docBlock(page, 'The export keeps').locator(threadCounts(page))
  await expect(count).toHaveText('1')
  await count.click()
  await expect(card).toBeVisible()
  await expect(thread.getByRole('button', { name: 'Reopen', exact: true })).toBeVisible()
  // when it was resolved, left of Reopen (R6-3 #4)
  await expect(thread).toContainText(/Resolved \d\d:\d\d/)
})
