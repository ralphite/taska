// The composition root: the page's services, made once and handed to the components through React context. Each
// piece gets what it needs; nothing reaches for a global. Stories and tests make their own with fakes.

import { Http } from '../api/http'
import { TaskaApi } from '../api/taska'
import { merge, project, type ProjectModel, type ServerCopy } from '../model/project'
import type { ProjectRow } from '../model/types'
import { createChangesStore, keptChanges, type ChangesStore } from '../stores/changes'
import { createDataStore, type DataStore } from '../stores/data'
import { createFeedbackStore, type FeedbackStore } from '../stores/feedback'
import { createOutboxStore, keptOutgoing, type OutboxStore } from '../stores/outbox'
import { createRouteStore, type History, type RouteStore } from '../stores/route'
import type { KeyValueStore } from '../stores/storage'
import { createUiStore, type UiStore } from '../stores/ui'
import { noCache, type CopyCache } from '../sync/cache'
import { ProjectSync, type Presence } from '../sync/projectSync'
import { ChangeRunner } from './changeRunner'
import { InputSender } from './inputSender'
import { ItemActions } from './itemActions'
import { Navigation } from './navigation'
import { ListHold } from './listHold'
import { Seen } from '../stores/seen'
import { Toasts } from './toasts'

export interface AppEnv {
  http?: Http
  kv: KeyValueStore
  history: History
  presence: Presence
  cache?: CopyCache
  /** the page's layout is the desktop's (the window is 64rem or wider) */
  desk(): boolean
  /** the height of the list's row of an item, as drawn now (0: not drawn) */
  rowHeight?(n: number): number
}

export interface App {
  api: TaskaApi
  stores: {
    data: DataStore
    changes: ChangesStore
    outbox: OutboxStore
    feedback: FeedbackStore
    ui: UiStore
    route: RouteStore
  }
  toasts: Toasts
  items: ItemActions
  inputs: InputSender
  nav: Navigation
  listHold: ListHold
  seen: Seen
  desk(): boolean
  runner: ChangeRunner
  /** the project the page shows now, with your pending changes over it */
  model(slug: string): ProjectModel | null
  /** show a project: its copy, then its changes as they come */
  showProject(slug: string): void
  refreshProjects(): Promise<void>
  stop(): void
}

export function createApp(env: AppEnv): App {
  const api = new TaskaApi(env.http)
  const data = createDataStore(env.kv.getJson<ProjectRow[]>('taska.projects'))
  const changes = createChangesStore(env.kv)
  const outbox = createOutboxStore(env.kv)
  const feedback = createFeedbackStore(env.kv)
  const ui = createUiStore(env.kv)
  const route = createRouteStore(env.history)
  const toasts = new Toasts(feedback)
  const nav = new Navigation(route, env.desk)
  const listHold = new ListHold(ui, env.desk)
  const seen = new Seen(env.kv)
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
    const m = project(copy, pending.filter((c) => c.slug === slug).flatMap((c) => c.patches))
    memo.set(slug, { copy, pending, model: m })
    return m
  }
  const take = (slug: string, a: Parameters<ProjectSync['take']>[0]) => {
    if (sync?.slug === slug) sync.take(a)
    else data.getState().setCopy(slug, merge(data.getState().copies[slug] ?? null, a))
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
    sent: () => {},
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
    rowHeight: (n) => env.rowHeight?.(n) ?? 0,
    undoSeq: (n, f) => model(currentSlug())?.facts.undo.find((u) => u.n === n && f in u.f)?.seq ?? null,
    noteWith: () => false,
  })

  const refreshProjects = async () => {
    try {
      const rows = (await api.projects()).sort((a, b) => (b.t || 0) - (a.t || 0))
      data.getState().setProjects(rows)
      env.kv.setJson('taska.projects', rows)
    } catch {
      /* the list stays as last seen */
    }
  }

  const showProject = (slug: string) => {
    if (sync?.slug === slug) return
    sync?.close()
    ui.getState().reset()
    sync = new ProjectSync(slug, api, env.cache ?? noCache, {
      copy: (s, copy) => data.getState().setCopy(s, copy),
      reach: (s, away) => {
        const was = data.getState().away[s] || 0
        data.getState().setAway(s, away)
        if (!away && was) {
          runner.back()
          inputs.back()
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

  return {
    api,
    stores: { data, changes, outbox, feedback, ui, route },
    toasts,
    items,
    inputs,
    nav,
    listHold,
    seen,
    desk: env.desk,
    runner,
    model,
    showProject,
    refreshProjects,
    stop: () => {
      sync?.close()
      clearInterval(projectsTimer)
    },
  }
}
