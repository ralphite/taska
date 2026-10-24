// The composition root: the page's services, made once and handed to the components through React context. Each
// piece gets what it needs; nothing reaches for a global. Stories and tests make their own with fakes.

import { Http } from '../api/http'
import { TaskaApi } from '../api/taska'
import { merge, project, type ProjectModel, type ServerCopy } from '../model/project'
import { createChangesStore, keptChanges, type ChangesStore } from '../stores/changes'
import { createDataStore, type DataStore } from '../stores/data'
import { createFeedbackStore, type FeedbackStore } from '../stores/feedback'
import { createOutboxStore, keptOutgoing, type OutboxStore } from '../stores/outbox'
import { createRouteStore, type History, type RouteStore } from '../stores/route'
import { memoryStore, type KeyValueStore } from '../stores/storage'
import { createBoxStore, type BoxStore } from '../stores/box'
import { createDraftsStore, type DraftsStore } from '../stores/drafts'
import { createItemViewStore, type ItemViewStore } from '../stores/itemView'
import { createSearchStore, type SearchStore } from '../stores/search'
import { createSheetStore, type SheetStore } from '../stores/sheet'
import { createUiStore, type UiStore } from '../stores/ui'
import { noCache, type CopyCache } from '../sync/cache'
import { ProjectSync, type Presence } from '../sync/projectSync'
import { ChangeRunner, newId } from './changeRunner'
import { InputActions } from './inputActions'
import { InputSender } from './inputSender'
import { ItemActions } from './itemActions'
import { Navigation } from './navigation'
import { ListHold } from './listHold'
import { Answers } from './answers'
import { Box } from './box'
import { CrossSearch } from './crossSearch'
import { Projects } from './projects'
import { Activity } from './activity'
import { Restores } from './restores'
import { createActivityStore, type ActivityStore } from '../stores/activity'
import { Fields } from './fields'
import { ListOrder } from './listOrder'
import { Moves } from './moves'
import { RowSizes } from './rowSizes'
import { Sheets } from './sheets'
import { Seen } from '../stores/seen'
import { Toasts } from './toasts'

export interface AppEnv {
  http?: Http
  kv: KeyValueStore
  /** this tab's own store (what a reload of this tab keeps) */
  session?: KeyValueStore
  history: History
  presence: Presence
  cache?: CopyCache
  /** the page's layout is the desktop's (the window is 64rem or wider) */
  desk(): boolean
}

export interface App {
  api: TaskaApi
  stores: {
    data: DataStore
    changes: ChangesStore
    outbox: OutboxStore
    feedback: FeedbackStore
    ui: UiStore
    itemView: ItemViewStore
    search: SearchStore
    drafts: DraftsStore
    box: BoxStore
    sheet: SheetStore
    route: RouteStore
    activity: ActivityStore
  }
  toasts: Toasts
  items: ItemActions
  inputs: InputSender
  nav: Navigation
  listHold: ListHold
  seen: Seen
  /** the list's rows give their elements here, for their heights */
  rows: RowSizes
  /** the list's items in the order it shows them, for Previous and Next */
  listOrder: ListOrder
  /** the list's search, in the other projects */
  crossSearch: CrossSearch
  /** answering an agent's question by its choices */
  answers: Answers
  /** the places the keys reach (the search, the box, the talk), given by ref */
  fields: Fields
  /** what you do to something you said */
  inputActions: InputActions
  /** the box: its drafts, files, sending */
  box: Box
  /** what floats over the page: sheets and menus */
  sheets: Sheets
  /** an item going to another project */
  moves: Moves
  desk(): boolean
  runner: ChangeRunner
  /** the project the page shows now, with your pending changes over it */
  model(slug: string): ProjectModel | null
  /** show a project: its copy, then its changes as they come */
  showProject(slug: string): void
  projects: Projects
  activity: Activity
  restores: Restores
  refreshProjects(): Promise<boolean>
  stop(): void
}

export function createApp(env: AppEnv): App {
  const api = new TaskaApi(env.http)
  const kept = Projects.kept(env.kv)
  const data = createDataStore(kept.rows, kept.needs, Date.now())
  const changes = createChangesStore(env.kv)
  const outbox = createOutboxStore(env.kv)
  const feedback = createFeedbackStore(env.kv)
  const ui = createUiStore(env.kv)
  const route = createRouteStore(env.history)
  const unlisten = env.history.listen(() => route.getState().read()) // Back and Forward
  const toasts = new Toasts(feedback)
  const nav = new Navigation(route, env.desk)
  const listHold = new ListHold(ui, env.desk)
  const seen = new Seen(env.kv)
  const rows = new RowSizes()
  const listOrder = new ListOrder()
  const itemView = createItemViewStore(env.kv)
  const search = createSearchStore()
  const activityStore = createActivityStore()
  const drafts = createDraftsStore(env.kv)
  const boxStore = createBoxStore(env.session ?? memoryStore())
  const sheetStore = createSheetStore()
  const sheets = new Sheets(sheetStore, route, env.desk)
  const unsheet = route.subscribe(() => sheets.gone()) // Back closed it
  let sync: ProjectSync | null = null
  let projectsTimer = 0

  const currentSlug = () => {
    const r = route.getState().route
    return r.page === 'project' ? r.slug : ''
  }
  const memo = new Map<string, { copy: ServerCopy; pending: unknown; model: ProjectModel }>()
  const model = (slug: string): ProjectModel | null => {
    const copy = data.getState().copies[slug]
    if (!copy) return null
    const pending = changes.getState().list
    const hit = memo.get(slug)
    if (hit && hit.copy === copy && hit.pending === pending) return hit.model
    const mine = pending.filter((c) => c.slug === slug)
    const m = project(copy, mine.flatMap((c) => c.patches), Math.max(copy.at, ...mine.map((c) => c.t)), mine.flatMap((c) => c.inputPatches || []))
    memo.set(slug, { copy, pending, model: m })
    return m
  }
  const take = (slug: string, a: Parameters<ProjectSync['take']>[0]) => {
    if (sync?.slug === slug) sync.take(a)
    else data.getState().setCopy(slug, merge(data.getState().copies[slug] ?? null, a, Date.now()))
  }
  const stale = (slug: string) => {
    if (sync?.slug === slug) void sync.refresh()
  }
  const runner = new ChangeRunner(api, changes, {
    changes: take,
    stale,
    cursor: (slug) => (sync?.slug === slug ? sync.cursor : null),
    unreachable: () => {},
    refused: (c, why) => toasts.notSaved({ what: c.said || 'a change', why, slug: c.slug }),
  })
  const inputs = new InputSender(api, outbox, {
    cursor: (slug) => (sync?.slug === slug ? sync.cursor : null),
    changes: take,
    stale,
    sent: (o, rid) => {
      // taken back while on its way: once Taska has it, it is deleted there behind you
      if (rid) boxStore.getState().sentAs(o.q, rid)
      if (o.unsent && rid) void runner.send({ id: newId(), slug: o.slug, commands: [{ op: 'delete', id: rid }], patches: [], said: `taking back ${rid}`, t: Date.now() })
      if (o.slug === currentSlug()) ui.getState().setLastSent(o.quiet || o.unsent ? null : { slug: o.slug, rid, q: o.q })
    },
    refused: (_o, why) => toasts.show(why ? `err: ${why}` : 'Not saved', null),
    log: () => {},
  })
  const items = new ItemActions({
    slug: currentSlug,
    model: () => model(currentSlug()),
    runner,
    toasts,
    ui,
    held: () => listHold.started(),
    listKey: () => {
      const r = route.getState().route
      return r.page === 'project' ? JSON.stringify([r.slug, r.tab, r.list]) : ''
    },
    openItem: () => {
      const r = route.getState().route
      if (r.page !== 'project' || r.place.kind !== 'item') return null
      const n = Number(/\d+/.exec(r.place.ref)?.[0])
      return Number.isFinite(n) ? n : null
    },
    desk: env.desk,
    rowHeight: (n) => rows.height(n),
    undoSeq: (n, f) => model(currentSlug())?.facts.undo.find((u) => u.n === n && f in u.f)?.seq ?? null,
    noteWith: () => false,
  })

  const inputActions = new InputActions({
    runner,
    toasts,
    api,
    model,
    refresh: (slug) => stale(slug),
    title: (slug) => data.getState().projects?.find((p) => p.name === slug)?.title || slug,
    go: (url) => route.getState().go(url, true),
  })
  const activity = new Activity({ api, store: activityStore, toasts })
  const restores = new Restores({ runner, toasts, inputs: inputActions, model })
  const projects = new Projects({ api, data, kv: env.kv, home: () => route.getState().route.page === 'home' })
  const refreshProjects = () => projects.refresh()

  const showProject = (slug: string) => {
    if (sync?.slug === slug) return
    sync?.close()
    ui.getState().reset()
    itemView.getState().show(slug)
    boxStore.getState().show(slug)
    drafts.getState().reload(slug)
    sync = new ProjectSync(slug, api, env.cache ?? noCache, {
      copy: (s, copy) => data.getState().setCopy(s, copy),
      reach: (s, away) => {
        const was = data.getState().away[s] || 0
        data.getState().setAway(s, away)
        if (!away && was) {
          runner.back()
          inputs.back()
          activity.back()
        }
      },
      keyNeeded: () => {},
      gone: (s, how) => route.getState().go(`/?${how}=${encodeURIComponent(s)}`, true),
    }, env.presence)
    void sync.start()
  }

  // what did not go out before a reload goes now, in the order it was made
  for (const c of keptChanges(env.kv)) void runner.send(c)
  for (const o of keptOutgoing(env.kv)) outbox.getState().push(o)
  if (outbox.getState().list.length) void inputs.flush()

  projectsTimer = window.setInterval(() => {
    if (!env.presence.hidden()) void refreshProjects()
  }, 20000)
  // coming back to the window: what changed meanwhile, and what failed for want of the server goes now; the network
  // back: the same at once, and what waits to try again tries now, not after its pause
  const unwatch = env.presence.watch({
    back: () => {
      void sync?.refresh()
      void refreshProjects()
      inputs.back()
    },
    online: () => {
      void sync?.refresh()
      inputs.back()
      runner.back()
    },
  })

  return {
    api,
    stores: { data, changes, outbox, feedback, ui, itemView, search, drafts, box: boxStore, sheet: sheetStore, route, activity: activityStore },
    toasts,
    items,
    inputs,
    nav,
    listHold,
    seen,
    rows,
    listOrder,
    crossSearch: new CrossSearch(api, search),
    answers: new Answers({ inputs, view: itemView, outbox }),
    fields: new Fields(),
    inputActions,
    box: new Box({ api, store: boxStore, drafts, outbox, inputs, runner, toasts }),
    sheets,
    moves: new Moves({
      api,
      changes,
      toasts,
      model,
      title: (slug) => data.getState().projects?.find((p) => p.name === slug)?.title || slug,
      go: (url) => route.getState().go(url, true),
      refresh: (slug) => stale(slug),
    }),
    desk: env.desk,
    runner,
    model,
    showProject,
    projects,
    activity,
    restores,
    refreshProjects,
    stop: () => {
      projects.stop()
      sync?.close()
      clearInterval(projectsTimer)
      unwatch()
      unlisten()
      unsheet()
    },
  }
}
