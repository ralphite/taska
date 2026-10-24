// Going places in a project: a tab, an item, the New input page, the list's search and filters. Changing tab,
// opening the New input page or an item on the phone are steps Back can undo; picking items in the desktop's list,
// search and filters only rewrite the address.

import { LIST_KEYS, NO_FILTERS, projectPath, type ListQuery, type Place } from '../model/route'
import type { Tab } from '../model/words'
import type { RouteStore } from '../stores/route'

export class Navigation {
  private readonly route: RouteStore
  private readonly desk: () => boolean
  constructor(route: RouteStore, desk: () => boolean) {
    this.route = route
    this.desk = desk
  }

  private here() {
    const r = this.route.getState().route
    return r.page === 'project' ? r : null
  }

  private go(tab: Tab, place: Place, list: ListQuery, push: boolean) {
    const r = this.here()
    if (!r) return
    this.route.getState().go(projectPath(r.slug, tab, place, list), push)
  }

  /** The address as this layout has it: the desktop has no Inputs tab and shows New input when nothing is open; the
   * phone has no New input page. */
  normalize(): void {
    const r = this.here()
    if (!r) return
    if (this.desk()) {
      if (r.place.kind === 'tab' && (r.tab === 'items' || r.tab === 'inputs')) this.go('items', { kind: 'new' }, r.list, false)
    } else if (r.place.kind === 'new') this.go('items', { kind: 'tab' }, r.list, false)
  }

  tab(t: Tab): void {
    const r = this.here()
    if (!r) return
    const list = t === r.tab ? r.list : { ...NO_FILTERS, q: r.list.q }
    const place: Place = this.desk() && t !== 'inputs' ? { kind: 'new' } : { kind: 'tab' }
    this.go(t, place, list, true)
  }

  setList(patch: Partial<ListQuery>): void {
    const r = this.here()
    if (!r) return
    const list = { ...r.list }
    for (const k of LIST_KEYS) if (k in patch) list[k] = patch[k] ?? NO_FILTERS[k]
    this.go(r.tab, r.place, list, false)
  }

  /** The Items view: on Archive it goes back to Items. */
  view(value: string): void {
    const r = this.here()
    if (!r) return
    if (value === 'archive') return this.go('archive', this.desk() ? { kind: 'new' } : { kind: 'tab' }, { ...r.list, status: 'all' }, true)
    const list = { ...r.list, status: value }
    if (r.tab !== 'items') return this.go('items', this.desk() ? { kind: 'new' } : { kind: 'tab' }, { ...list, type: 'all', when: 'all', pri: 'all', sort: 'all' }, true)
    this.go('items', r.place, list, false)
  }

  openItem(code: string): void {
    const r = this.here()
    if (!r) return
    this.go(r.tab === 'inputs' ? 'items' : r.tab, { kind: 'item', ref: code }, r.list, !this.desk())
  }

  newInput(): void {
    const r = this.here()
    if (!r) return
    this.go(r.tab === 'inputs' ? 'items' : r.tab, { kind: 'new' }, r.list, true)
  }

  closeItem(): void {
    const r = this.here()
    if (!r) return
    this.go(r.tab, this.desk() ? { kind: 'new' } : { kind: 'tab' }, r.list, false)
  }

  /** Another address of the page (a project, the home page). */
  to(url: string, push = true): void {
    this.route.getState().go(url, push)
  }
}
