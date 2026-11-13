// What you sent shows where you are: a reply to the item open shows at the end of its talk, which keeps to its end
// when it showed it and is not moved when you had scrolled up to read (B770 r1292: ItemPage, no scroll on sending).
// Once Taska has it: what you took back meanwhile is deleted there behind you (unless the organizer or your agent has it
// already: then it says to delete it from Inputs); the box's line says what became of it; it shows up where you are,
// in view and lit up for a moment.

import { inputCode } from '../../model/words'
import { reached } from '../../model/inputStates'
import type { ProjectModel } from '../../model/project'
import type { BoxStore } from '../../stores/box'
import type { Outgoing } from '../../model/outgoing'
import type { UiStore } from '../../stores/ui'
import type { ChangeRunner } from '../changeRunner'
import type { Toasts } from '../page/toasts'

export interface DeliveredDeps {
  box: BoxStore
  ui: UiStore
  runner: ChangeRunner
  toasts: Toasts
  model(slug: string): ProjectModel | null
  slug(): string
}

export class Delivered {
  private readonly d: DeliveredDeps
  constructor(d: DeliveredDeps) {
    this.d = d
  }

  sent(o: Outgoing, rid: string): void {
    const d = this.d
    if (o.unsent && rid) {
      const m = d.model(o.slug)
      const r = m?.byId.get(rid)
      if (m && r && reached(r, m.facts.organizer)) d.toasts.show(`${inputCode(rid)} already reached ${r.org ? 'the organizer' : 'your agent'}; delete it from Inputs`)
      else void d.runner.change(o.slug, { op: 'delete', id: rid }, `taking back ${rid}`)
    }
    const here = o.slug === d.slug()
    if (here) d.ui.getState().setLastSent(o.quiet || o.unsent ? null : { slug: o.slug, rid })
  }
}
