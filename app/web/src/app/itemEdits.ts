// An item's editor (I) and its subitem title (⇧A): what you type is kept as you type (leaving them any way but Cancel
// keeps it, and says so), opening them again brings it back; Cancel lets it go, and so does saving it.

import { codeOf, type ProjectModel } from '../model/project'
import type { Item } from '../model/types'
import type { ItemViewStore } from '../stores/itemView'
import type { ItemEditDraft, KeptEditsStore } from '../stores/keptEdits'
import type { RouteStore } from '../stores/route'
import type { Toasts } from './toasts'

export interface ItemEditsDeps {
  view: ItemViewStore
  kept: KeptEditsStore
  route: RouteStore
  toasts: Toasts
  desk(): boolean
  model(): ProjectModel | null
}

export class ItemEdits {
  private readonly d: ItemEditsDeps
  constructor(d: ItemEditsDeps) {
    this.d = d
    // going to another item (or away from items) leaves its editor and its subitem title: kept
    d.route.subscribe((s, was) => {
      const open = (r: typeof s.route) => (r.page === 'project' && r.place.kind === 'item' ? Number(/\d+/.exec(r.place.ref)?.[0]) : null)
      if (open(s.route) === open(was.route)) return
      const v = d.view.getState()
      if (v.editing != null && v.editing !== open(s.route)) this.leave()
      if (v.subFor != null && v.subFor !== open(s.route)) v.setSubFor(null)
    })
  }

  start(n: number): void {
    this.d.view.getState().setEditing(n)
    if (this.d.kept.getState().edits[n]) this.d.toasts.show('Draft restored')
  }

  /** What the editor says now: kept while it differs from the item. */
  typed(it: Item, e: ItemEditDraft): void {
    const changed = e.title !== it.title || e.body !== it.body || e.next !== (it.next || '')
    this.d.kept.getState().setEdit(it.n, changed ? e : null)
  }

  cancel(): void {
    const n = this.d.view.getState().editing
    if (n != null) this.d.kept.getState().setEdit(n, null)
    this.d.view.getState().setEditing(null)
  }

  saved(n: number): void {
    this.d.kept.getState().setEdit(n, null)
    if (this.d.view.getState().editing === n) this.d.view.getState().setEditing(null)
  }

  /** The editor left (Esc, another item): what you typed is kept, and it says so. */
  leave(): void {
    const v = this.d.view.getState()
    const n = v.editing
    if (n == null) return
    v.setEditing(null)
    const m = this.d.model()
    if (m && this.d.kept.getState().edits[n]) this.d.toasts.show(`Your changes to ${codeOf(m, n)} are kept: ${this.d.desk() ? 'press I' : 'Edit'} to go on`)
  }

  subStart(n: number): void {
    this.d.view.getState().setSubFor(n)
    if (this.d.kept.getState().subs[n]) this.d.toasts.show('Draft restored')
  }

  subTyped(n: number, title: string): void {
    this.d.kept.getState().setSub(n, title.trim() || null)
  }

  /** Done adding subitems (Esc): a title you started is kept. */
  subLeave(): void {
    const v = this.d.view.getState()
    const n = v.subFor
    if (n == null) return
    v.setSubFor(null)
    if (this.d.kept.getState().subs[n]) this.d.toasts.show(`Your subitem title is kept: ${this.d.desk() ? '⇧A' : 'Add'} brings it back`)
  }

  subCancel(): void {
    const n = this.d.view.getState().subFor
    if (n != null) this.d.kept.getState().setSub(n, null)
    this.d.view.getState().setSubFor(null)
  }

  subAdded(n: number): void {
    this.d.kept.getState().setSub(n, null)
  }
}
