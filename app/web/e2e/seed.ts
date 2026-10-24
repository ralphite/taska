// Each check gets a project of its own, filled through the agent interface (the same on the old version and on
// the rewrite), and changed as you would from the page. The checks find things by what you see: roles, names,
// words; so the same check runs on both versions (app/tools/e2e.py --against).
import type { APIRequestContext, Page } from '@playwright/test'

let n = 0
let id = 0
export interface Project {
  name: string
  /** its title, as the page shows it */
  title: string
  url: string
  /** Send agent commands (the /do grammar), as Claude Code. */
  doAs: (commands: string) => Promise<string>
  /** Read a plain-text view, e.g. 'T1', 'inbox', 'D1'. */
  read: (path: string) => Promise<string>
  /** A change from the page, as you make it (input, set, dc...): -> whether Taska took it, and its answer lines. */
  op: (command: Record<string, unknown>) => Promise<{ ok: boolean; res: string[] }>
}
export interface Seed {
  /** What the agent writes first (new items start as proposals). */
  agent?: string
  /** The items the user approves, by code. */
  approve?: string[]
  /** What the agent writes after that. */
  then?: string
}
/** A change sent as the page sends it: the rewrite takes commands (api/commands), the old version one op (api/op). */
export async function pageOp(request: APIRequestContext, base: string, command: Record<string, unknown>) {
  const r = await request.post(`${base}api/commands`, { data: { id: `e2e-${process.pid}-${Date.now().toString(36)}-${++id}`, commands: [command] } })
  if (r.status() !== 404) {
    const d = (await r.json()) as { ok: boolean; results?: string[] }
    return { ok: d.ok, res: d.results || [] }
  }
  const d = (await (await request.post(`${base}api/op`, { data: command })).json()) as { ok: boolean; res?: string[] }
  return { ok: d.ok, res: d.res || [] }
}
export async function project(request: APIRequestContext, seed: Seed = {}): Promise<Project> {
  const title = `e2e ${Date.now().toString(36)} ${++n}`
  const r = await request.post('/api/projects', { data: { title } })
  const d = (await r.json()) as { ok: boolean; name: string; error?: string }
  if (!d.ok) throw new Error('project not made: ' + d.error)
  const base = `/p/${encodeURIComponent(d.name)}/`
  const p: Project = {
    name: d.name,
    title,
    url: base,
    doAs: async (c) =>
      (await request.post(`${base}do?by=claude-code`, { data: c, headers: { 'Content-Type': 'text/plain' } })).text(),
    read: async (path) => (await request.get(base + path)).text(),
    op: (command) => pageOp(request, base, command),
  }
  const agent = async (c?: string) => {
    if (!c) return
    const out = await p.doAs(c)
    if (/^err/m.test(out)) throw new Error('seed: ' + out)
  }
  await agent(seed.agent)
  for (const ref of seed.approve || []) if (!(await p.op({ op: 'set', ref, f: { status: 'open' } })).ok) throw new Error('approve ' + ref)
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
/** The page at a path of the project, once it is drawn: its list, its box, or the item or document it opens. */
export async function open(page: Page, p: Project, path = '') {
  await page.goto(p.url + path)
  await drawn(page)
}
export async function drawn(page: Page) {
  await page.locator('#list article[data-n], #list [data-zone], #composer textarea').filter({ visible: true }).first().waitFor()
}
