// The projects: listed with what needs you in each, every little while and on coming back; while Taska is out of
// reach on the home page, asked again by itself, more slowly each time, until it answers. Made, renamed, deleted and
// restored by name.

import { Refused } from '../../api/http'
import type { TaskaApi } from '../../api/taska'
import type { KeyValueStore } from '../../stores/storage'
import type { DataStore } from '../../stores/data'
import type { Need, ProjectRow } from '../../model/types'
import type { Toasts } from '../page/toasts'

export interface ProjectsDeps {
  api: TaskaApi
  data: DataStore
  kv: KeyValueStore
  toasts?: Toasts
  /** whether the home page is shown (only there does an unanswered list keep asking) */
  home(): boolean
}

/** What a project change came to: the project's address, or why not. */
export type Made = { name: string; title: string } | { error: string }

export class Projects {
  private readonly d: ProjectsDeps
  private retry = 0
  private wait = 1000
  constructor(d: ProjectsDeps) {
    this.d = d
  }

  /** The projects kept from before, in the order they were listed. */
  static kept(kv: KeyValueStore): { rows: ProjectRow[] | null; needs: Need[] } {
    return { rows: kv.getJson<ProjectRow[]>('taska.projects'), needs: kv.getJson<Need[]>('taska.needs') || [] }
  }

  async refresh(): Promise<boolean> {
    clearTimeout(this.retry)
    try {
      const [rows, needs] = await Promise.all([this.d.api.projects(), this.d.api.needs().catch(() => [] as Need[])])
      rows.sort((a, b) => (b.t || 0) - (a.t || 0))
      this.d.data.getState().setProjects(rows, needs, Date.now())
      this.d.kv.setJson('taska.projects', rows)
      this.d.kv.setJson('taska.needs', needs)
      this.wait = 1000
      return true
    } catch {
      // the list stays as last seen; the home page says Taska is away, and asks again
      if (this.d.home()) {
        this.d.data.getState().setListAway(true)
        this.retry = window.setTimeout(() => void this.refresh(), this.wait)
        this.wait = Math.min(this.wait * 2, 10000)
      }
      return false
    }
  }

  /** The sidebar's projects in your own order: it shows at once and Taska keeps it, with Undo. */
  async order(names: string[], said: string): Promise<void> {
    const rows = this.d.data.getState().projects || []
    const was = [...rows].sort((a, b) => (a.pos ?? 1e9) - (b.pos ?? 1e9)).map((p) => p.name)
    const put = (list: string[]) => {
      const next = (this.d.data.getState().projects || []).map((p) => {
        const i = list.indexOf(p.name)
        const q = { ...p }
        if (i >= 0) q.pos = i
        else delete q.pos
        return q
      })
      this.d.data.getState().setProjects(next, null, this.d.data.getState().listedAt)
      this.d.kv.setJson('taska.projects', next)
    }
    put(names)
    try {
      await this.d.api.orderProjects(names)
    } catch {
      put(was)
      return this.d.toasts?.show('Order not saved', () => this.order(names, said), { error: true, label: 'Retry' })
    }
    this.d.toasts?.show(said, async () => {
      put(was)
      await this.d.api.orderProjects(was).catch(() => {})
    })
  }

  create(title: string): Promise<Made> {
    return this.done(this.d.api.createProject(title), 'Not created')
  }

  restore(name: string): Promise<Made> {
    return this.done(this.d.api.restoreProject(name), 'Not restored')
  }

  rename(name: string, title: string): Promise<Made> {
    return this.done(this.d.api.renameProject(name, title), 'Not renamed')
  }

  remove(name: string): Promise<Made> {
    return this.done(this.d.api.deleteProject(name), 'Not deleted')
  }

  private async done(asked: Promise<{ ok: boolean; name: string; title?: string }>, no: string): Promise<Made> {
    try {
      const d = await asked
      if (!d.ok) return { error: no }
      void this.refresh()
      return { name: d.name, title: d.title || d.name }
    } catch (ex) {
      return { error: ex instanceof Refused ? ex.message || no : 'Connection lost; try again' }
    }
  }

  stop(): void {
    clearTimeout(this.retry)
  }
}
