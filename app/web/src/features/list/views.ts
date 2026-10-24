// Your own views of the item list: the filters you set (type, when, status, priority, sort) with a name. A view sits
// after Active, All… in the view row and is the same in every project. Saved, renamed, given the filters shown now
// or deleted: it changes at once and Taska keeps it, with Undo.

import { Refused } from '../../api/http'
import type { TaskaApi } from '../../api/taska'
import type { ListQuery } from '../../model/route'
import type { SavedView } from '../../model/types'
import type { ViewsStore } from '../../stores/views'
import type { Navigation } from '../../app/page/navigation'
import type { Toasts } from '../../app/page/toasts'

export interface ViewsDeps {
  api: TaskaApi
  store: ViewsStore
  nav: Navigation
  toasts: Toasts
  /** the list's filters now */
  list(): ListQuery | null
}

const tidy = (name: string) => name.split(/\s+/).join(' ').trim()

export class SavedViews {
  private readonly d: ViewsDeps
  constructor(d: ViewsDeps) {
    this.d = d
  }

  async load(): Promise<void> {
    try {
      this.d.store.getState().set(await this.d.api.views())
    } catch {
      /* no views this time: the row shows the presets */
    }
  }

  private async save(list: SavedView[], said: string, undo = true): Promise<void> {
    const was = [...this.d.store.getState().list]
    this.d.store.getState().set(list)
    try {
      const d = await this.d.api.setViews(list)
      this.d.store.getState().set(d.views || list)
      this.d.toasts.show(said, undo ? () => this.save(was, 'Put back', false) : null)
    } catch (ex) {
      this.d.store.getState().set(was)
      this.d.toasts.show(`View not saved: ${ex instanceof Refused ? ex.message || 'Not saved' : 'Connection lost; try again'}`, null, { error: true })
    }
  }

  /** It shows (on Archive the list goes back to Items: your views show items). */
  show(i: number): void {
    const v = this.d.store.getState().list[i]
    if (v) this.d.nav.showFilters({ type: v.type, when: v.when, status: v.status, pri: v.pri, sort: v.sort })
  }

  /** The filters shown now, as a new view. */
  add(name: string): void {
    name = tidy(name)
    const list = this.d.store.getState().list
    const now = this.d.list()
    if (!name) return this.d.toasts.show('Name the view first', null, { error: true })
    if (list.some((v) => v.name.toLowerCase() === name.toLowerCase())) return this.d.toasts.show(`View “${name}” already exists`, null, { error: true })
    if (!now) return
    void this.save([...list, { name, type: now.type, when: now.when, status: now.status, pri: now.pri, sort: now.sort }], `Saved the view ${name}`)
  }

  rename(i: number, name: string): void {
    this.d.store.getState().setEdit(-1)
    const list = this.d.store.getState().list
    const v = list[i]
    name = tidy(name)
    if (!v || !name || name === v.name) return
    if (list.some((o, j) => j !== i && o.name.toLowerCase() === name.toLowerCase())) return this.d.toasts.show(`View “${name}” already exists`, null, { error: true })
    void this.save(
      list.map((o, j) => (j === i ? { ...o, name } : o)),
      `Renamed to ${name}`,
    )
  }

  /** It shows the filters shown now. */
  update(i: number): void {
    const list = this.d.store.getState().list
    const v = list[i]
    const now = this.d.list()
    if (v && now)
      void this.save(
        list.map((o, j) => (j === i ? { ...o, type: now.type, when: now.when, status: now.status, pri: now.pri, sort: now.sort } : o)),
        `${v.name} now shows these filters`,
      )
  }

  remove(i: number): void {
    const list = this.d.store.getState().list
    const v = list[i]
    if (v)
      void this.save(
        list.filter((_, j) => j !== i),
        `Deleted the view ${v.name}`,
      )
  }
}
