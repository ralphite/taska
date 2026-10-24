// An item dragged in the list (the desktop, with a mouse): onto a row to go under it, near a row's top or bottom to go
// before or after it in the queue, off every row to stand on its own, onto another project in the sidebar to move
// there (with its subitems).

import { closed, dropOn } from '../model/items'
import { codeOf, type ProjectModel } from '../model/project'
import type { DragStore } from '../stores/drag'
import type { ItemActions } from './itemActions'
import type { Moves } from './moves'

export interface ItemDragDeps {
  store: DragStore
  items: ItemActions
  moves: Moves
  slug(): string
  model(): ProjectModel | null
}

export class ItemDrag {
  private readonly d: ItemDragDeps
  constructor(d: ItemDragDeps) {
    this.d = d
  }

  /** It starts, if it can be dragged (not a rule, not finished). -> its code */
  start(n: number): string | null {
    const m = this.d.model()
    const it = m?.byN.get(n)
    if (!m || !it || it.type === 'rule' || closed(it.status)) return null
    this.d.store.getState().set({ n, at: null, project: null })
    return codeOf(m, n)
  }

  /** Over a row (`t`, at `y` from its top 0 to its bottom 1) or over no row (`t` null). -> it can go there */
  over(t: number | null, y: number): boolean {
    const { n } = this.d.store.getState()
    const m = this.d.model()
    if (n == null || !m) return false
    const at = dropOn(m.byN, n, t, y)
    const was = this.d.store.getState().at
    if (was?.n !== at?.n || was?.how !== at?.how) this.d.store.getState().set({ at, project: null })
    return !!at
  }

  /** Over a project in the sidebar (null: off them). -> it can go there */
  overProject(slug: string | null): boolean {
    const { n, project } = this.d.store.getState()
    const ok = n != null && slug != null && slug !== this.d.slug()
    if ((ok ? slug : null) !== project) this.d.store.getState().set({ project: ok ? slug : null, at: null })
    return ok
  }

  drop(): void {
    const { n, at, project } = this.d.store.getState()
    this.end()
    if (n == null) return
    if (project) return void this.d.moves.item(this.d.slug(), n, project)
    if (!at) return
    if (at.how === 'into') return void this.d.items.change(n, 'parent', at.n)
    if (at.how === 'out') return void this.d.items.change(n, 'parent', null)
    void this.d.items.reorder(n, at.n as number, at.how === 'after')
  }

  end(): void {
    this.d.store.getState().set({ n: null, at: null, project: null })
  }
}
