// What you sent shows where you are: a reply to the item open on the desktop takes its talk to its end at once. Once
// Taska has it: what you took back meanwhile is deleted there behind you (unless the organizer or your agent has it
// already: then it says to delete it from Inputs); the box's line says what became of it; it shows up where you are,
// in view and lit up for a moment.

import { inputCode } from '../../model/words'
import { openItemN } from '../../model/route'
import { codeOf, liveN, type ProjectModel } from '../../model/project'
import type { BoxStore } from '../../stores/box'
import type { Outgoing } from '../../model/outgoing'
import type { RouteStore } from '../../stores/route'
import type { UiStore } from '../../stores/ui'
import { newId, type ChangeRunner } from '../changeRunner'
import type { Toasts } from '../page/toasts'
import type { Fields } from '../page/fields'

export interface DeliveredDeps {
  box: BoxStore
  ui: UiStore
  route: RouteStore
  runner: ChangeRunner
  toasts: Toasts
  fields: Fields
  model(slug: string): ProjectModel | null
  slug(): string
  desk(): boolean
}

export class Delivered {
  private readonly d: DeliveredDeps
  constructor(d: DeliveredDeps) {
    this.d = d
  }

  /** Sent to `scope`: the item open on the desktop shows the end of its talk, where the reply is. */
  replied(slug: string, scope: string): void {
    const m = this.d.model(slug)
    const n = openItemN(this.d.route.getState().route)
    if (this.d.desk() && m && n != null && codeOf(m, liveN(m, n)) === scope) requestAnimationFrame(() => this.d.fields.toEnd('talk'))
  }

  sent(o: Outgoing, rid: string): void {
    const d = this.d
    if (rid) d.box.getState().sentAs(o.q, rid)
    if (o.unsent && rid) {
      const m = d.model(o.slug)
      const r = m?.byId.get(rid)
      if (m && r && (r.acked || m.facts.organizer.busy === rid || r.org)) d.toasts.show(`${inputCode(rid)} already reached ${r.org ? 'the organizer' : 'your agent'}; delete it from Inputs`)
      else void d.runner.send({ id: newId(), slug: o.slug, commands: [{ op: 'delete', id: rid }], patches: [], said: `taking back ${rid}`, t: Date.now() })
    }
    const here = o.slug === d.slug()
    if (here) d.ui.getState().setLastSent(o.quiet || o.unsent ? null : { slug: o.slug, rid, q: o.q })
    if (!rid || o.quiet || o.unsent || !here) return
    d.ui.getState().setJustSent(rid)
    setTimeout(() => d.ui.getState().justSent === rid && d.ui.getState().setJustSent(null), 1500)
    const r = d.route.getState().route
    if (!d.desk() && r.page === 'project' && r.tab === 'inputs' && r.place.kind === 'tab') d.ui.getState().setLit(rid)
  }
}
