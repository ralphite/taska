// T457: what every component story stands on: the demo project's state (the same saved answers the Pages stories
// run the real page on, made by v2/tools/story_fixtures.py), put into the page's model the way the page does it, then
// the story's own changes (an item opened, a sheet, a toast...).
import type { Loader } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { ingest } from '../../lib/data'
import { D, DR, OV, R_STATE, U, render, byN, model, parseRef, resetPageState, setProject } from '../../lib/state'
import { FAILED, TOAST } from '../../lib/toast'
import { VW } from '../../lib/viewer'
import { VW_STATE } from '../../lib/views'
import type { Item, ProjectRow, State } from '../../lib/types'

/** What the page would get from Taska: asked the way the page asks, answered in the browser by the stand-in for
 * Taska (.storybook/public/app-shim.js, T518) from the saved answers. */
async function ask<T>(path: string): Promise<T> {
  const r = await fetch(path)
  if (!r.ok) throw new Error(`no ${path} in the story data`)
  return (await r.json()) as T
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
    ask<State>(`/p/${project}/api/state?since=0`),
    ask<ProjectRow[] | { projects: ProjectRow[] }>('/api/projects'),
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
  // ingest() drew once with nothing open, which on the desktop is the New input page; opening something leaves it, as
  // the page's own navigation does (lib/nav.ts)
  if (U.open != null || U.doc || D.page || U.side) D.compose = false
  render() // as the page draws: on the desktop, nothing open is the New input page (lib/state.ts idleCompose)
  Object.assign(window, { __taska: { U, D, OV, model } }) // to look into a story from the browser's console
  return {}
}

/** As much room as the page gives a part: the list column, the item pane, the phone's whole width. Draws nothing. */
export function Pane({
  w = 'list',
  children,
  h,
}: {
  w?: 'list' | 'item' | 'wide' | 'full' | 'sheet'
  children: ReactNode
  h?: string
}) {
  const width = {
    // as wide as the page's columns are (B523: .storybook/same.mjs compares each with the page, pixel for pixel): the
    // sidebar is 15rem (16rem from 2xl), the list 360 / 420 / 460px, the item pane the rest
    list: 'w-full lg:w-[360px] xl:w-[420px] 2xl:w-[460px]',
    item: 'w-full lg:w-[calc(100vw-15rem-360px)] xl:w-[calc(100vw-15rem-420px)] 2xl:w-[calc(100vw-16rem-460px)]',
    // the item at full width (O): the list's room too
    wide: 'w-full lg:w-[calc(100vw-15rem)] 2xl:w-[calc(100vw-16rem)]',
    full: 'w-full',
    sheet: 'w-full max-w-lg',
  }[w]
  return (
    // only the room the page gives the part: no line, colour or frame of its own (B495: nothing drawn that is not the
    // page's)
    <div className={`${width} ${h || ''}`} data-story-pane={w}>
      {children}
    </div>
  )
}
