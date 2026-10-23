// Comments on a document, where the Storybook review found them wrong (T529, D80): the buttons on a comment.
// guards: src/components/Doc.tsx src/lib/constants.ts src/components/ui.tsx
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { isDesk, open, project } from './seed'

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
  const sec = page.locator('#docBlocks section[data-key]').filter({ hasText: 'The export keeps' })
  para.key = (await sec.getAttribute('data-key')) || ''
  const r = await request.post(`${p.url}api/op`, {
    data: { op: 'dc', d: 1, key: para.key, quote: para.quote, text: 'Why not all of them?' },
  })
  expect(((await r.json()) as { ok: boolean }).ok).toBe(true)
  const card = page.locator('[data-dc]').filter({ hasText: 'Why not all of them?' }).filter({ visible: true }).first()
  const counts = page.locator('[data-act="doc-thread"]:visible')
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
  const acts = card.locator('[data-act="dc-move"]').locator('xpath=..')
  await expect(acts).toBeVisible()
  const quote = card.getByText(/^\u201cThe export keeps/)
  await expect(quote).toBeVisible()
  const [a, q] = [await acts.boundingBox(), await quote.boundingBox()]
  if (!a || !q) throw new Error('not drawn')
  expect(a.y, 'the buttons start below the quoted words').toBeGreaterThanOrEqual(q.y + q.height - 1)
})
