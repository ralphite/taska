// The project open in the page: shown, it starts afresh (what you looked at and picked in the last one goes; its own
// drafts, files, ticks and kept notes come back) and is kept up to date with Taska (its copy, from the cache first,
// then what changed). Coming back to the window brings what changed meanwhile; the network back, what waits goes now.

import type { TaskaApi } from '../api/taska'
import { merge, type ProjectModel, type ServerCopy } from '../model/project'
import { routeSlug } from '../model/route'
import type { ViewAnswer } from '../model/types'
import type { BoxStore } from '../stores/box'
import type { DataStore } from '../stores/data'
import type { DocTicksStore } from '../stores/docTicks'
import type { DraftsStore } from '../stores/drafts'
import type { ItemViewStore } from '../stores/itemView'
import type { KeptEditsStore } from '../stores/keptEdits'
import type { RouteStore } from '../stores/route'
import type { UiStore } from '../stores/ui'
import type { CopyCache } from '../sync/cache'
import { ProjectSync, type Presence } from '../sync/projectSync'
import type { KeptNotes } from './keptNotes'
import type { Notices } from './notices'
import type { PictureSizes } from './pictureSizes'

export interface ProjectSessionDeps {
  api: TaskaApi
  data: DataStore
  route: RouteStore
  cache: CopyCache
  presence: Presence
  model(slug: string): ProjectModel | null
  /** what starts afresh with each project */
  fresh: { ui: UiStore; itemView: ItemViewStore; keptEdits: KeptEditsStore; docTicks: DocTicksStore; box: BoxStore; drafts: DraftsStore; pictureSizes: PictureSizes; keptNotes: KeptNotes; notices: Notices }
  /** Taska's code is newer than this page's */
  server(s: ServerCopy['server']): void
  /** what waits for Taska goes now: when the window is back, when Taska answers again, when the network is back */
  back: { window(): void; reached(): void; online(): void }
  keyNeeded(): void
  projects(): Promise<boolean>
}

export class ProjectSession {
  private sync: ProjectSync | null = null
  private readonly d: ProjectSessionDeps
  private readonly timer: number
  private readonly unwatch: () => void
  constructor(d: ProjectSessionDeps) {
    this.d = d
    // the projects listed again now and then (their counts, what needs you there)
    this.timer = window.setInterval(() => {
      if (!d.presence.hidden()) void d.projects()
    }, 20000)
    this.unwatch = d.presence.watch({
      back: () => {
        void this.sync?.refresh()
        void d.projects()
        d.back.window()
      },
      online: () => {
        void this.sync?.refresh()
        d.back.online()
      },
    })
  }

  /** the project shown in the page (none: '') */
  slug(): string {
    return routeSlug(this.d.route.getState().route)
  }

  /** where its copy is up to (to ask Taska what changed since) */
  cursor(slug: string): string | null {
    return this.sync?.slug === slug ? this.sync.cursor : null
  }

  /** what an answer of Taska's brought: into the project's copy */
  take(slug: string, a: ViewAnswer): void {
    if (this.sync?.slug === slug) this.sync.take(a)
    else this.d.data.getState().setCopy(slug, merge(this.d.data.getState().copies[slug] ?? null, a, Date.now()))
  }

  /** Taska has it, the answer had nothing: the project loaded again */
  stale(slug: string): void {
    if (this.sync?.slug === slug) void this.sync.refresh()
  }

  async refresh(slug?: string): Promise<void> {
    if (this.sync && (slug == null || this.sync.slug === slug)) await this.sync.refresh()
  }

  show(slug: string): void {
    if (this.sync?.slug === slug) return
    this.sync?.close()
    const f = this.d.fresh
    f.ui.getState().reset()
    f.itemView.getState().show(slug)
    f.keptEdits.getState().show(slug)
    f.docTicks.getState().show(slug)
    void f.pictureSizes.load(slug)
    f.box.getState().show(slug)
    f.keptNotes.reset()
    f.notices.fresh()
    f.drafts.getState().reload(slug)
    this.sync = new ProjectSync(
      slug,
      this.d.api,
      this.d.cache,
      {
        copy: (s, copy, fresh) => {
          this.d.data.getState().setCopy(s, copy)
          const m = fresh ? this.d.model(s) : null
          if (m) void f.keptNotes.restore(s, m) // what this browser kept that did not go out comes back
          if (fresh) this.d.server(copy.server) // new code for Taska, or for this page
          if (m) f.notices.items(s, m) // what newly needs you here
        },
        reach: (s, away) => {
          const was = this.d.data.getState().away[s] || 0
          this.d.data.getState().setAway(s, away)
          if (!away && was) this.d.back.reached()
        },
        keyNeeded: () => this.d.keyNeeded(),
        gone: (s, how) => this.d.route.getState().go(`/?${how}=${encodeURIComponent(s)}`, true),
      },
      this.d.presence,
    )
    void this.sync.start()
  }

  stop(): void {
    this.sync?.close()
    clearInterval(this.timer)
    this.unwatch()
  }
}
