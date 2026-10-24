// Going places in a project: a tab, an item, a document, the New input page, the lists beside the items, the list's
// search and filters. Changing tab, opening the New input page or an item on the phone are steps Back can undo;
// picking items in the desktop's list, search and filters only rewrite the address.

import { LIST_KEYS, NO_FILTERS, projectPath, type ListQuery, type Place } from '../../model/route'
import { TAB_WORD, type Tab } from '../../model/words'
import type { RouteStore } from '../../stores/route'

export class Navigation {
  private readonly route: RouteStore
  private readonly desk: () => boolean
  /** each tab's own search and filters while this page lives, by project and tab */
  private readonly views = new Map<string, ListQuery>()
  /** Settings: the steps taken in it (Back leaves by as many), and the place it was opened from */
  private settingsSteps = 0
  private from: { tab: Tab; compose: boolean } | null = null
  constructor(route: RouteStore, desk: () => boolean) {
    this.route = route
    this.desk = desk
    route.subscribe((st) => {
      const r = st.route
      if (r.page !== 'project' || this.inSettings(r.place)) return
      this.settingsSteps = 0
      this.from = { tab: r.tab, compose: r.place.kind === 'new' || (r.place.kind === 'tab' && r.tab !== 'inputs') }
    })
  }

  /** Settings' pages (the phone's Documents, Activity and Deleted are pages of it). */
  private inSettings(place: Place): boolean {
    return place.kind === 'settings' || (!this.desk() && place.kind === 'side')
  }

  /** What Settings' way back says: where it was opened from. */
  cameFromLabel(): string {
    const f = this.from
    return !f ? TAB_WORD.items : this.desk() && f.compose ? 'New input' : TAB_WORD[f.tab]
  }

  /** Back from Settings: the desktop leaves it; the phone goes up a level (a section to the index, the index out). */
  settingsBack(): void {
    const r = this.here()
    if (!r) return
    const phoneSection = !this.desk() && (r.place.kind === 'side' || (r.place.kind === 'settings' && r.place.section))
    if (phoneSection) {
      if (this.settingsSteps > 1) {
        this.settingsSteps--
        return this.route.getState().backBy(1)
      }
      return this.go('items', { kind: 'settings', section: null }, NO_FILTERS, false)
    }
    if (this.settingsSteps > 0) {
      const n = this.settingsSteps
      this.settingsSteps = 0
      return this.route.getState().backBy(n)
    }
    this.go(this.from?.tab ?? 'items', this.desk() ? { kind: 'new' } : { kind: 'tab' }, NO_FILTERS, false)
  }

  private here() {
    const r = this.route.getState().route
    return r.page === 'project' ? r : null
  }

  private go(tab: Tab, place: Place, list: ListQuery, push: boolean, from?: string | null) {
    const r = this.here()
    if (!r) return
    // on the phone a step from the search keeps it open: Back comes back to it
    const searching = !this.desk() && this.route.getState().layers.includes('search')
    this.route.getState().go(projectPath(r.slug, tab, place, list), push, push && searching ? ['search'] : undefined, from, place.kind === 'item' || place.kind === 'doc' ? tab : undefined)
  }

  /** The phone's search: open, or closed by Cancel (the search ends: its words go). */
  search(on: boolean): void {
    if (this.desk()) return
    if (on) this.route.getState().openLayer('search')
    else this.route.getState().shutLayer('search', () => this.setList({ q: '' }))
  }

  /** To an input where it is listed (the phone's Inputs, the desktop's New input page), lit up for a moment. */
  goInput(id: string, lit: (id: string | null) => void): void {
    if (this.desk()) this.newInput()
    else this.tab('inputs')
    lit(id)
    setTimeout(() => lit(null), 1600)
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

  /** One of your views: its filters on Items (from Archive too), the search kept. */
  showFilters(f: Omit<ListQuery, 'q'>): void {
    const r = this.here()
    if (!r) return
    const list = { ...r.list, ...f }
    if (r.tab !== 'items') return this.go('items', this.desk() ? { kind: 'new' } : { kind: 'tab' }, list, true)
    this.go('items', r.place, list, false)
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

  /** An item, in place of what shows (no step Back: coming back from its document); `tab`: the list's, when not this. */
  openItemHere(code: string, tab?: Tab): void {
    const r = this.here()
    if (r) this.go(tab ?? (r.tab === 'inputs' ? 'items' : r.tab), { kind: 'item', ref: code }, r.list, false)
  }

  newInput(): void {
    const r = this.here()
    if (!r) return
    // on the desktop, from an item or a document: the page offers the way back to it
    const from = this.desk() ? (r.place.kind === 'item' ? r.place.ref.toUpperCase() : r.place.kind === 'doc' ? `D${r.place.d}` : null) : null
    this.go(r.tab === 'inputs' ? 'items' : r.tab, { kind: 'new' }, r.list, true, from)
  }

  /** Back from the New input page to the item or document it was opened from. -> there was one */
  composeBack(): boolean {
    if (!this.route.getState().from) return false
    this.route.getState().backBy(1)
    return true
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
    // opened from Documents, Activity or Deleted: back to that list
    const side = this.desk() ? this.route.getState().side : null
    this.go(r.tab, side ? { kind: 'side', side } : this.desk() ? { kind: 'new' } : { kind: 'tab' }, r.list, false)
  }

  /** A document: a step Back goes back to where you were. */
  openDoc(d: number, tab?: Tab): void {
    const r = this.here()
    if (!r) return
    this.go(tab ?? (r.tab === 'inputs' ? 'items' : r.tab), { kind: 'doc', d }, r.list, !(r.place.kind === 'doc' && r.place.d === d))
  }

  /** Documents, Activity or Deleted, in the list's column (the desktop). */
  side(side: 'docs' | 'log' | 'deleted'): void {
    const r = this.here()
    if (!r) return
    this.go('items', { kind: 'side', side }, r.list, !(r.place.kind === 'side' && r.place.side === side))
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

  /** Another address of the page (a project, the home page, a section of Settings). */
  to(url: string, push = true): void {
    const was = this.here()
    this.route.getState().go(url, push)
    const now = this.here()
    if (push && now && this.inSettings(now.place) && (!was || this.inSettings(was.place) || now.slug === was.slug)) this.settingsSteps++
  }
}
