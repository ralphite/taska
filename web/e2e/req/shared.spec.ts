// Shared rules (I779, D134, approved 11-15): a project's rules put a shared rule in by a line `{{编程}}`; the Rules tab
// reads the line as a block that opens its text in place, its name going to that shared rule's page (who uses it
// under it); a name not found is red, read and edited; Insert writes a line at the caret; Settings › Shared rules
// lists them.
// guards: src/features/docs/ src/features/settings/ src/app/docs/ src/model/includes.ts src/pages/SharedRuleContainer.tsx src/pages/SharedRuleFrame.tsx src/pages/ProjectPageContainer.tsx server/taska/domain/includes.py server/taska/services/shared_rules.py server/taska/http/
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { isDesk, open, pageOp, project } from '../seed'

let k = 0
/** A shared rule of the check's own, with its text: -> its name and address. */
async function shared(request: APIRequestContext, md: string) {
  const name = `编程${Date.now().toString(36)}${++k}`
  const r = (await (await request.post('/api/shared-rules', { data: { name } })).json()) as { ok: boolean; slug: string }
  expect(r.ok).toBe(true)
  expect((await pageOp(request, `/p/${encodeURIComponent(r.slug)}/`, { op: 'rules', md })).ok).toBe(true)
  return { name, slug: r.slug }
}

const CODING = '## 测试\n\n- 按风险测，重测试一天最多一次。'
const shown = (page: Page) => page.locator('[data-part="rules"], [data-pane-head]').first()

test('I779 r1378: a line reads as the shared rules it puts in, opened in place; its name goes to its page', async ({ page, request }) => {
  const s = await shared(request, CODING)
  const p = await project(request)
  expect((await p.op({ op: 'rules', md: `{{${s.name}}}\n\n## Own\n\n- Ours only.` })).ok).toBe(true)
  await open(page, p, 'rules')
  await shown(page).waitFor()
  const block = page.locator(`[data-include="${s.name}"]`).filter({ visible: true })
  await expect(block).toContainText(`Shared rules · ${s.name} · 1 project`)
  await expect(page.getByText('按风险测', { exact: false }).filter({ visible: true })).toHaveCount(0)
  await block.getByRole('button', { expanded: false }).click({ position: { x: 14, y: 20 } }) // its arrow (its name goes to its page)
  await expect(block.getByText('按风险测', { exact: false })).toBeVisible()
  await expect(page.getByText('Ours only.').filter({ visible: true })).toBeVisible()
  // the name: that shared rule's page, the Rules tab's, with who uses it under it
  await block.getByRole('button', { name: s.name, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/p/${s.slug}/rules`))
  await expect(page.getByText('按风险测', { exact: false }).filter({ visible: true }).first()).toBeVisible()
  const used = page.locator('[data-part="used-by"]').filter({ visible: true })
  await expect(used).toContainText(p.title)
  await expect(used).toContainText(`{{${s.name}}}`)
  // and back to the list
  await page.getByRole('button', { name: /Back to shared rules/i }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/shared$/)
  await expect(page.getByRole('button', { name: new RegExp(s.name) }).filter({ visible: true })).toContainText('1 project')
})

test('I779 r1378: a name not found is red, read and edited', async ({ page, request }) => {
  const p = await project(request)
  expect((await p.op({ op: 'rules', md: '{{没有这个}}\n\n## Own\n\n- Ours.' })).ok).toBe(true)
  await open(page, p, 'rules')
  await shown(page).waitFor()
  await expect(page.locator('[data-include="没有这个"]').filter({ visible: true })).toContainText('Not found: 没有这个')
  await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click()
  await expect(page.getByText('Not found: 没有这个').filter({ visible: true })).toBeVisible()
  const field = page.locator('textarea').filter({ visible: true }).first()
  await field.fill('## Own\n\n- Ours.')
  await expect(page.getByText('Not found: 没有这个').filter({ visible: true })).toHaveCount(0)
})

test('I779 r1378: Insert shared rules writes a line where the caret is, those in the text ticked', async ({ page, request }) => {
  const s = await shared(request, CODING)
  const p = await project(request)
  expect((await p.op({ op: 'rules', md: '## Own\n\n- Ours.' })).ok).toBe(true)
  await open(page, p, 'rules')
  await shown(page).waitFor()
  await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click()
  const field = page.locator('textarea').filter({ visible: true }).first()
  await field.focus()
  await field.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0))
  await page.getByRole('button', { name: isDesk(page) ? 'Insert shared rules' : 'Shared', exact: true }).filter({ visible: true }).click()
  await page.getByRole('button', { name: new RegExp(`^${s.name}`) }).filter({ visible: true }).first().click()
  await expect(field).toHaveValue(`{{${s.name}}}\n\n## Own\n\n- Ours.`)
})
