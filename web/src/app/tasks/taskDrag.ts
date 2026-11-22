// A task dragged in the list (the desktop, with a mouse): onto a row to go under it, near a row's top or bottom to go
// before or after it in the list's order (work in review too, B754), off every row to stand on its own, onto another
// project in the sidebar to move there (with its subtasks).

import { closed, dropOn } from '../../model/tasks'
import { codeOf, type ProjectModel } from '../../model/project'
import type { DragStore } from '../../stores/drag'
import type { TaskActions } from './taskActions'
import type { Moves } from './moves'

export interface TaskDragDeps {
  store: DragStore
  tasks: TaskActions
  moves: Moves
  slug(): string
  model(): ProjectModel | null
  /** the list shows the work order: rows can be put before or after one another */
  ordered(): boolean
}

export class TaskDrag {
  private readonly d: TaskDragDeps
  constructor(d: TaskDragDeps) {
    this.d = d
  }

  /** It starts, if it can be dragged (not finished). -> its code */
  start(n: number): string | null {
    const m = this.d.model()
    const it = m?.byN.get(n)
    if (!m || !it || closed(it.status)) return null
    this.d.store.getState().set({ n, at: null, project: null })
    return codeOf(m, n)
  }

  /** Over a row (`t`, at `y` from its top 0 to its bottom 1) or over no row (`t` null). -> it can go there */
  over(t: number | null, y: number): boolean {
    const { n } = this.d.store.getState()
    const m = this.d.model()
    if (n == null || !m) return false
    const at = dropOn(m.byN, n, t, y, this.d.ordered())
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
    if (project) return void this.d.moves.task(this.d.slug(), n, project)
    if (!at) return
    if (at.how === 'into') return void this.d.tasks.change(n, 'parent', at.n)
    if (at.how === 'out') return void this.d.tasks.change(n, 'parent', null)
    void this.d.tasks.reorder(n, at.n as number, at.how === 'after')
  }

  end(): void {
    this.d.store.getState().set({ n: null, at: null, project: null })
  }
}
