// Several rows picked on the desktop: Cmd-click picks one more (or lets it go), Shift-click every row from the last one
// picked; the open item counts as picked when you start. The bar over the list changes them all at once, with Undo.

import { codeOf, type ProjectModel } from '../../model/project'
import { field, type Command } from '../../model/commands'
import { plural } from '../../model/words'
import type { UiStore } from '../../stores/ui'
import type { ChangeRunner } from '../changeRunner'
import type { ListOrder } from './listOrder'
import type { Toasts } from '../page/toasts'

export interface SelectionDeps {
  ui: UiStore
  order: ListOrder
  runner: ChangeRunner
  toasts: Toasts
  slug(): string
  model(): ProjectModel | null
  /** the item open now */
  open(): number | null
}

export class Selection {
  private readonly d: SelectionDeps
  private from: number | null = null
  constructor(d: SelectionDeps) {
    this.d = d
  }

  pick(n: number, range: boolean): void {
    const rows = this.d.order.rows()
    const sel = new Set(this.d.ui.getState().selected)
    const open = this.d.open()
    if (!sel.size && open != null && rows.includes(open)) {
      sel.add(open)
      this.from = open
    }
    const a = rows.indexOf(this.from ?? -1)
    const b = rows.indexOf(n)
    if (range && a >= 0 && b >= 0) for (const k of rows.slice(Math.min(a, b), Math.max(a, b) + 1)) sel.add(k)
    else if (sel.has(n)) sel.delete(n)
    else sel.add(n)
    this.from = n
    this.d.ui.getState().setSelected(sel)
  }

  clear(): void {
    this.from = null
    this.d.ui.getState().setSelected(new Set())
  }

  /** Every picked row given `f` = `v` ("3 items are done"), with Undo. */
  set(f: string, v: unknown, said: string): void {
    const m = this.d.model()
    const ns = [...this.d.ui.getState().selected].filter((n) => m?.byN.has(n) && (m.byN.get(n) as unknown as Record<string, unknown>)[f] !== v)
    this.clear()
    if (!m || !ns.length) return this.d.toasts.show('Nothing to change')
    const before = new Map(ns.map((n) => [n, (m.byN.get(n) as unknown as Record<string, unknown>)[f]]))
    const send = (to: (n: number) => unknown) =>
      this.d.runner.change(
        this.d.slug(),
        ns.map((n): Command => ({ op: 'set', ref: codeOf(m, n), f: field(f, to(n)) })),
        `changing ${plural(ns.length, 'item')}`,
      )
    this.d.toasts.show(`${plural(ns.length, 'item')} ${said}`, async () => {
      this.d.toasts.show(`Put back ${plural(ns.length, 'item')}`)
      return send((n) => before.get(n))
    })
    void send(() => v)
  }
}
