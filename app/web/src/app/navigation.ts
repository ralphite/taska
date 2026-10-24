// Going places in a project: a tab, an item, the New input page, the list's search and filters. Changing tab,
// opening the New input page or an item on the phone are steps Back can undo; picking items in the desktop's list,
// search and filters only rewrite the address.

import { LIST_KEYS, NO_FILTERS, projectPath, type ListQuery, type Place } from '../model/route'
import type { Tab } from '../model/words'
import type { RouteStore } from '../stores/route'

export class Navigation {
  private readonly route: RouteStore
  private readonly desk: () => boolean
  /** each tab's own search and filters while this page lives, by project and tab */
  private readonly views = new Map<string, ListQuery>()
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
    // on the phone a step from the search keeps it open: Back comes back to it
    const searching = !this.desk() && this.route.getState().layers.includes('search')
    this.route.getState().go(projectPath(r.slug, tab, place, list), push, push && searching ? ['search'] : undefined)
  }

  /** The phone's search: open, or closed by Cancel (the search ends: its words go). */
  search(on: boolean): void {
    if (this.desk()) return
    if (on) this.route.getState().openLayer('search')
    else this.route.getState().shutLayer('search', () => this.setList({ q: '' }))
  }

  /** The phone's drawer of projects. */
  drawer(on: boolean): void {
    if (this.desk()) return
    if (on) this.route.getState().openLayer('drawer')
    else this.route.getState().shutLayer('drawer')
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

  /** Each tab keeps its own search and filters; words in the search go along. Archive is a view of Items: the same
   * filters but its status. On the desktop what you said is under New input. */
  tab(t: Tab): void {
    const r = this.here()
    if (!r) return
    if (t === 'inputs' && this.desk()) return this.newInput()
    let list = r.list
    if (t !== r.tab) {
      this.views.set(r.slug + '/' + r.tab, r.list)
      const v = this.views.get(r.slug + '/' + t) ?? NO_FILTERS
      const views = (x: string) => x === 'items' || x === 'archive'
      list = { ...NO_FILTERS }
      for (const k of LIST_KEYS) list[k] = views(t) && views(r.tab) && k !== 'status' ? r.list[k] : v[k]
      if (r.list.q.trim()) list.q = r.list.q
    }
    const place: Place = this.desk() && t !== 'inputs' ? { kind: 'new' } : { kind: 'tab' }
    const away = t !== r.tab || (this.desk() && (r.place.kind === 'settings' || r.place.kind === 'new'))
    this.go(t, place, list, away)
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

  /** Each item you open is a step Back goes back to; `tab`: the tab it is in, when the list's is not. */
  openItem(code: string, tab?: Tab): void {
    const r = this.here()
    if (!r) return
    const fresh = !(r.place.kind === 'item' && r.place.ref.toLowerCase() === code.toLowerCase())
    this.go(tab ?? (r.tab === 'inputs' ? 'items' : r.tab), { kind: 'item', ref: code }, r.list, fresh)
  }

  newInput(): void {
    const r = this.here()
    if (!r) return
    this.go(r.tab === 'inputs' ? 'items' : r.tab, { kind: 'new' }, r.list, true)
  }

  /** The open item full width (O), or back to the list. */
  full(on: boolean): void {
    const r = this.here()
    if (!this.desk() || !r || (on && r.place.kind !== 'item')) return
    this.route.getState().setFull(on)
  }

  closeItem(): void {
    const r = this.here()
    if (!r) return
    if (this.route.getState().full) this.route.getState().setFull(false, true)
    this.go(r.tab, this.desk() ? { kind: 'new' } : { kind: 'tab' }, r.list, false)
  }

  /** The item one step on in the list (Previous, Next); `say` tells when there is none that way. */
  step(dir: 1 | -1, order: { step(open: number | null, dir: 1 | -1): number | 'first' | 'last' | null }, code: (n: number) => string, say: (words: string) => void): void {
    const r = this.here()
    if (!r) return
    const open = r.place.kind === 'item' ? Number(/\d+/.exec(r.place.ref)?.[0]) : null
    const to = order.step(open, dir)
    if (to === 'first' || to === 'last') say(to === 'first' ? 'Already first item' : 'Already last item')
    else if (to != null) this.openItem(code(to))
  }

  /** From the search: the list's first item. */
  first(order: { step(open: number | null, dir: 1 | -1): number | 'first' | 'last' | null }, code: (n: number) => string): void {
    const to = order.step(null, 1)
    if (typeof to === 'number') this.openItem(code(to))
  }

  /** Another address of the page (a project, the home page). */
  to(url: string, push = true): void {
    this.route.getState().go(url, push)
  }
}
