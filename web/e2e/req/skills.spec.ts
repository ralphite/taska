// Skills (I821, r1406): "/" at the start of the box lists the skills (shared documents named /name) with what each is
// for; the letters typed narrow it; ↵ puts the skill's name and a space in the box; what is sent with it comes to the
// agents with the skill's text under it. Esc closes the list.
// guards: src/features/composer/ src/model/skills.ts src/app/docs/sharedRules.ts server/taska/domain/skills.py server/taska/agent_text/render.py server/taska/services/shared_rules.py
import { expect, test, type APIRequestContext } from '@playwright/test'
import { open, pageOp, project } from '../seed'
import { box } from '../ui'

/** A skill of the check's own: -> its name. */
async function skill(request: APIRequestContext, md: string) {
  const name = `/qa${Date.now().toString(36)}`
  const r = (await (await request.post('/api/shared-rules', { data: { name } })).json()) as { ok: boolean; slug: string }
  expect(r.ok).toBe(true)
  expect((await pageOp(request, `/p/${encodeURIComponent(r.slug)}/`, { op: 'rules', md })).ok).toBe(true)
  return name
}

test('I821: "/" lists the skills, ↵ takes one, and the agents read its text with the words sent', async ({ page, request }) => {
  const name = await skill(request, '回答问题，只答不做。\n\n- 只回答，不改代码、不改文档、不新建事项。')
  const p = await project(request)
  await open(page, p, '')
  await box(page).click()
  await box(page).pressSequentially(name.slice(0, 4))
  const option = page.getByRole('option', { name: new RegExp(name) }).filter({ visible: true })
  await expect(option).toContainText('回答问题，只答不做。')
  await box(page).pressSequentially(name.slice(4))
  await expect(page.getByRole('option').filter({ visible: true })).toHaveCount(1)
  await box(page).press('Enter')
  await expect(box(page)).toHaveValue(`${name} `)
  await expect(page.getByRole('option').filter({ visible: true })).toHaveCount(0)
  await box(page).pressSequentially('D1 讲了什么？')
  await box(page).press('Shift+Enter')
  await expect.poll(async () => p.read('inbox?by=claude-code')).toContain(`skill ${name} (the user applied it to these words; do as it says):`)
  expect(await p.read('inbox?by=claude-code')).toContain('只回答，不改代码')
})

test('I821: Esc closes the list; other words show none', async ({ page, request }) => {
  const name = await skill(request, 'Answer only.')
  const p = await project(request)
  await open(page, p, '')
  await box(page).click()
  await box(page).pressSequentially(name)
  await expect(page.getByRole('option', { name: new RegExp(name) }).filter({ visible: true })).toBeVisible()
  await box(page).press('Escape')
  await expect(page.getByRole('option').filter({ visible: true })).toHaveCount(0)
  await box(page).fill('what does / do')
  await expect(page.getByRole('option').filter({ visible: true })).toHaveCount(0)
})
