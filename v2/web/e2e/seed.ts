// Each test gets a project of its own, filled through the agent interface (the same on the old app and on v2).
import type { APIRequestContext, Page } from '@playwright/test'

let n = 0
export interface Project {
  name: string
  url: string
  /** Send agent commands (the /do grammar), as Claude Code. */
  doAs: (commands: string) => Promise<string>
  /** Read a plain-text view, e.g. 'T1', 'inbox', 'D1'. */
  read: (path: string) => Promise<string>
}
export interface Seed {
  /** What the agent writes first (new items start as proposals). */
  agent?: string
  /** The items the user approves, by code. */
  approve?: string[]
  /** What the agent writes after that. */
  then?: string
}
export async function project(request: APIRequestContext, seed: Seed = {}): Promise<Project> {
  const title = `e2e ${Date.now().toString(36)} ${++n}`
  const r = await request.post('/api/projects', { data: { title } })
  const d = (await r.json()) as { ok: boolean; name: string; error?: string }
  if (!d.ok) throw new Error('project not made: ' + d.error)
  const base = `/p/${encodeURIComponent(d.name)}/`
  const p: Project = {
    name: d.name,
    url: base,
    doAs: async (c) =>
      (await request.post(`${base}do?by=claude-code`, { data: c, headers: { 'Content-Type': 'text/plain' } })).text(),
    read: async (path) => (await request.get(base + path)).text(),
  }
  const agent = async (c?: string) => {
    if (!c) return
    const out = await p.doAs(c)
    if (/^err/m.test(out)) throw new Error('seed: ' + out)
  }
  await agent(seed.agent)
  for (const ref of seed.approve || []) {
    const a = await request.post(`${base}api/op`, { data: { op: 'set', ref, f: { status: 'open' } } })
    if (!((await a.json()) as { ok: boolean }).ok) throw new Error('approve ' + ref)
  }
  await agent(seed.then)
  return p
}
// A project with one item in each place: a question, work to accept, a proposal, the queue, later.
export const LOOP: Seed = {
  agent: `new task P1 now Pick the export format
new bug P0 now Export ignores the filter
new idea P2 now Dark mode for the reports
new task P2 now Write the user docs
new task P3 later Clean up old branches
`,
  approve: ['T1', 'B2', 'T4', 'T5'],
  then: `T1 ask Which format should the export use?
  - ( ) CSV
  - ( ) JSON
B2 done Fixed: the export now uses the active filter
`,
}
export const isDesk = (page: Page) => (page.viewportSize()?.width || 0) >= 1024
export async function open(page: Page, p: Project, path = '') {
  await page.goto(p.url + path)
  await page
    .locator('#list [data-zone], #list [data-act="open"], #inputsView, #detailBody, #projectView')
    .filter({ visible: true })
    .first()
    .waitFor()
}
/** F291 (v2): Items is one tree with preset views on top; the old app shows bands. -> whether this page has the views */
export async function treeList(page: Page) {
  return (await page.locator('#list [data-views]').count()) > 0
}
/** Show what needs you: the Needs you view (v2) or the band at the top (the old app). */
export async function needsView(page: Page) {
  if (await treeList(page)) await page.locator('#list [data-views] [data-v="wait"]').click()
}
