// The desktop's folded sidebar opened over the page (New project from its rail): going anywhere closes it.

import type { RouteStore } from '../../stores/route'
import type { UiStore } from '../../stores/ui'

export class SideOver {
  readonly stop: () => void
  constructor(route: RouteStore, ui: UiStore) {
    this.stop = route.subscribe((s, was) => {
      if (s.url !== was.url && ui.getState().sideOver) ui.getState().setSideOver(false)
    })
  }
}
