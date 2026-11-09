// T711 (Yadong chose "a floating orange bar at the bottom"): while the project's agent session waits on the user, a bar
// floats at the bottom of every project page, just above the box and never on it; Open opens Agents; it goes as soon
// as the session goes on. The session is faked as Claude Code keeps one (a file in the folder this Taska reads).
// guards: src/features/agents/ src/pages/ProjectPageContainer.tsx src/model/agents.ts server/taska/http/ server/taska/infra/agent_sessions.py
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { isDesk, open, project } from './seed'
import { sheetBody } from './ui'

const SID = 'e2e00000-7110-4711-8711-000000000711'

/** This Taska's Claude Code session, as the app writes it: its process (this one, alive), id and status. */
function session(status: 'waiting' | 'busy') {
  const folder = process.env.TASKA_E2E_SESSIONS
  if (!folder) throw new Error('run through tools/e2e.py: it gives the Taska a sessions folder of its own')
  const d = { pid: process.pid, sessionId: SID, name: 'Shop work', cwd: '/tmp', status, ...(status === 'waiting' ? { waitingFor: 'approve Bash: npm test' } : {}) }
  writeFileSync(join(folder, `${process.pid}.json`), JSON.stringify(d))
}

const bar = (page: Page) => page.locator('[data-part="blocked-bar"]')

/** The bar is above the box, apart from it. */
async function aboveBox(page: Page) {
  const b = await bar(page).boundingBox()
  const box = await page.locator('#composer').filter({ visible: true }).first().boundingBox()
  expect(b && box).toBeTruthy()
  if (!b || !box) return
  const apart = b.y + b.height <= box.y || b.y >= box.y + box.height
  expect(apart, `the bar ${JSON.stringify(b)} is on the box ${JSON.stringify(box)}`).toBe(true)
}

test('T711: a blocked session floats a bar above the box on every page; Open opens Agents; it goes when the session goes on', async ({ page, request }) => {
  const p = await project(request, { agent: 'new task P1 now Pick the export format' })
  session('busy')
  expect((await request.get(`${p.url}next?by=claude-code&session=Shop%20work&sid=${SID}`)).ok()).toBe(true)
  await open(page, p)
  await expect(page.getByRole('status').filter({ hasText: 'Blocked' })).toHaveCount(0)
  // the session comes to wait on the user while the page waits for news: within a few seconds, not at its wait's end
  session('waiting')
  await expect(bar(page)).toBeVisible({ timeout: 8000 })
  await expect(bar(page)).not.toContainText('npm test')
  await aboveBox(page)
  await open(page, p, 'T1')
  await expect(bar(page)).toBeVisible()
  await aboveBox(page)
  if (!isDesk(page)) {
    await open(page, p, 'inputs')
    await expect(bar(page)).toBeVisible()
    await aboveBox(page)
  }
  await bar(page).getByRole('button', { name: 'Open Agents' }).click()
  await expect(sheetBody(page).locator('#dlgTitle')).toHaveText('Agents')
  await expect(sheetBody(page)).toContainText('approve Bash: npm test')
  await page.keyboard.press('Escape')
  await expect(sheetBody(page)).toHaveCount(0)
  session('busy')
  await expect(bar(page)).toHaveCount(0, { timeout: 8000 })
})
