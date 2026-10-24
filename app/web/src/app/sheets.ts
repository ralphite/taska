// Opening and closing what floats over the page. On the phone one step Back closes it (its step in the history goes
// when its own button closes it). A menu opened from a button sits under it on the desktop; one opened by a
// right-click, at the pointer. An ask is confirmed by a second click within 3 seconds.

import type { RouteStore } from '../stores/route'
import type { SheetPlace, SheetRequest, SheetStore } from '../stores/sheet'

export class Sheets {
  private readonly store: SheetStore
  private readonly route: RouteStore
  private readonly desk: () => boolean
  private readonly told = new Set<(req: SheetRequest) => void>()
  readonly stop: () => void
  constructor(store: SheetStore, route: RouteStore, desk: () => boolean) {
    this.store = store
    this.route = route
    this.desk = desk
    this.stop = route.subscribe(() => this.gone())
  }

  /** Back closed a sheet: `fn` hears which. -> how to stop */
  onGone(fn: (req: SheetRequest) => void): () => void {
    this.told.add(fn)
    return () => this.told.delete(fn)
  }

  open(req: SheetRequest, place: SheetPlace = {}): void {
    if (!this.store.getState().spec && !this.desk()) this.route.getState().openLayer('sheet')
    this.store.getState().open({ focus: true, ...place, req })
  }

  /** A desktop menu under the element it came from. */
  openFrom(el: Element | null, req: SheetRequest, place: SheetPlace = {}): void {
    const r = el?.getBoundingClientRect()
    this.open(req, { ...place, pop: true, at: r ? { x: r.right, y: r.bottom + 4, right: true, top: r.top, left: r.left } : null })
  }

  /** What is open now, if it is of this kind. */
  shown<K extends SheetRequest['kind']>(kind: K): Extract<SheetRequest, { kind: K }> | null {
    const req = this.store.getState().spec?.req
    return req?.kind === kind ? (req as Extract<SheetRequest, { kind: K }>) : null
  }

  /** `then`: once its step in the history has gone (somewhere to go from it) */
  close(then?: () => void): void {
    const was = this.store.getState().spec
    this.store.getState().close()
    if (was && !this.desk()) this.route.getState().shutLayer('sheet', then)
    else then?.()
  }

  /** Back closed it (its step in the history went). */
  private gone(): void {
    const spec = this.store.getState().spec
    if (!spec || this.route.getState().layers.includes('sheet') || this.desk()) return
    this.store.getState().close()
    for (const fn of this.told) fn(spec.req)
  }

  /** -> true on the second click within 3 seconds; the first one asks. */
  confirm(key: string): boolean {
    const now = Date.now()
    const t = this.store.getState().asked[key]
    if (t && now - t < 3000) {
      this.store.getState().forget(key)
      return true
    }
    this.store.getState().ask(key, now)
    setTimeout(() => this.store.getState().forget(key, now), 3000)
    return false
  }
}
