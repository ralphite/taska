// T457: what every component story stands on: the demo project's state (the same saved answers the Pages stories
// run the real page on, made by v2/tools/story_fixtures.py), put into the page's model the way the page does it, then
// the story's own changes (an item opened, a sheet, a toast...). Times move on with the clock, as on the Pages.
import type { Loader } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { ingest } from '../../lib/data'
import {
  D,
  DR,
  OV,
  R_STATE,
  U,
  bump,
  desk,
  useArea,
  byN,
  model,
  parseRef,
  resetPageState,
  setProject,
} from '../../lib/state'
import { FAILED, TOAST } from '../../lib/toast'
import { VW } from '../../lib/viewer'
import { VW_STATE } from '../../lib/views'
import type { Item, ProjectRow, State } from '../../lib/types'

const FX = './fixtures/'
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/
const TIME_KEYS = new Set(['t', 'at', 't0', 't1', 'next', 'seen'])
function move(x: unknown, d: number, k = ''): unknown {
  if (typeof x === 'string') return ISO.test(x) ? new Date(Date.parse(x) + d).toISOString() : x
  if (typeof x === 'number' && TIME_KEYS.has(k)) {
    if (x > 1.5e12 && x < 2.5e12) return x + d
    if (x > 1.5e9 && x < 2.5e9) return x + d / 1000
    return x
  }
  if (Array.isArray(x)) return x.map((v) => move(v, d, k))
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([kk, v]) => [kk, move(v, d, kk)]))
  return x
}
const cache = new Map<string, Promise<unknown>>()
/** A saved answer of the demo, its times moved to now. */
export function fixture<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    const p = Promise.all([
      fetch(FX + name).then((r) => {
        if (!r.ok) throw new Error(`no ${name} in the story data`)
        return r.json()
      }),
      fetch(FX + 'meta.json')
        .then((r) => r.json())
        .catch(() => ({ now: Date.now() })),
    ]).then(([j, m]) => move(j, Date.now() - (m as { now: number }).now))
    p.catch(() => cache.delete(name))
    cache.set(name, p)
  }
  return cache.get(name)!.then((j) => structuredClone(j) as T)
}

export interface Setup {
  S: State
  /** an item of the demo by its code (F1, B2...) */
  it: (ref: string) => Item
}
export interface TaskaParams {
  project?: 'shop' | 'mobile-app' | 'website'
  /** what the story changes before it draws: U, D, OV, the state itself */
  setup?: (x: Setup) => void
}
declare module '@storybook/react-vite' {
  interface Parameters {
    taska?: TaskaParams
  }
}

/** Every story: a fresh page model with the demo project in it, then the story's changes. */
export const taskaLoader: Loader = async ({ parameters }) => {
  const p = (parameters.taska || {}) as TaskaParams
  const project = p.project || 'shop'
  const [S, projects] = await Promise.all([
    fixture<State>(`p__${project}__api__state.json`),
    fixture<ProjectRow[] | { projects: ProjectRow[] }>('api__projects.json'),
  ])
  resetPageState()
  OV.spec = null
  OV.popXY = null
  Object.assign(TOAST, { text: '', act: null, shown: false, error: false, sticky: false })
  DR.open = false
  Object.assign(R_STATE, { rec: null, levels: [], t0: 0 })
  FAILED.length = 0
  Object.assign(VW, { open: false, group: [], idx: 0, fit: true })
  model.offline = 0
  VW_STATE.list = []
  VW_STATE.edit = -1
  DR.list = Array.isArray(projects) ? projects : projects.projects
  D.page = null
  D.section = null
  setProject(project)
  ingest(S)
  p.setup?.({
    S: model.S,
    it: (ref) => {
      const it = byN.get(parseRef(ref) as number)
      if (!it) throw new Error(`no ${ref} in the demo`)
      return it
    },
  })
  bump()
  Object.assign(window, { __taska: { U, D, OV, model } }) // to look into a story from the browser's console
  return {}
}

/** A pane as wide as the page gives it: the list column, the item pane, the phone's whole width. */
export function Pane({
  w = 'list',
  children,
  h,
}: {
  w?: 'list' | 'item' | 'full' | 'sheet'
  children: ReactNode
  h?: string
}) {
  const width = {
    // at 1440 the sidebar takes 16rem and the list 420px; the item pane has the rest
    list: 'w-full lg:w-[360px] xl:w-[420px]',
    item: 'w-full lg:w-[calc(100vw-4rem-360px)] xl:w-[calc(100vw-16rem-420px)]',
    full: 'w-full',
    sheet: 'w-full max-w-lg',
  }[w]
  return (
    <div className={`${width} ${h || ''} border-zinc-200 lg:border-r dark:border-zinc-800`} data-story-pane={w}>
      {children}
    </div>
  )
}

/** What the parts ask Taska (the log, the projects, the home page's lists): the saved answers, as on the Pages. A
 * change is answered "ok" and changes nothing. The demo's pictures and voice notes: the page asks
 * /p/<project>/f/<file>; here they are among the saved answers. */
export function serveFiles() {
  const real = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href)
    const p = u.pathname
    if (u.origin !== location.origin || !/^\/(api|p)\//.test(p)) return real(input, init)
    const json = (o: unknown, status = 200) =>
      new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } })
    if (/\/api\/poll$/.test(p)) return new Promise<Response>(() => {}) // nothing changes while you look
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (method !== 'GET') return json({ ok: true, res: ['ok'], rev: 1 })
    const name = p.replace(/^\/|\/$/g, '').replace(/\//g, '__')
    try {
      return json(await fixture(name + '.json'))
    } catch {
      const r = await real(FX + name + '.txt')
      return r.ok ? r : json({ ok: false, error: 'not in the story data' }, 404)
    }
  }
  const fix = (el: Element) => {
    for (const a of ['src', 'href', 'poster']) {
      const v = el.getAttribute(a),
        m = v && /^\/p\/([^/]+)\/f\/([^?#]+)/.exec(v)
      if (m) el.setAttribute(a, `${FX}p__${m[1]}__f__${decodeURIComponent(m[2])}`)
    }
  }
  const all = (root: ParentNode) => root.querySelectorAll('[src^="/p/"], [href*="/f/"], [poster^="/p/"]').forEach(fix)
  all(document)
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'attributes') fix(m.target as Element)
      else m.addedNodes.forEach((n) => n instanceof Element && (fix(n), all(n)))
    }
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'href', 'poster'],
  })
}

/** A part the page shows only on the phone or only on the desktop: on the other, a line says so. */
export function Only({ on, children }: { on: 'phone' | 'desktop'; children: ReactNode }) {
  useArea('view')
  if ((on === 'phone') === !desk()) return <>{children}</>
  return (
    <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
      The page shows this on the {on} only: pick {on === 'phone' ? 'iPhone 393x852' : 'Desktop 1440x900'} in the
      toolbar.
    </p>
  )
}
