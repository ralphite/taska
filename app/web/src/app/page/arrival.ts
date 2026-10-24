// The address as the browser gives it (the page loaded, Back or Forward): the desktop's New input page puts you in its
// box, as it always has (opened from inside the page, what opens it does that itself); on the phone, a link to an item
// puts the list under it once the item is there, so Back lands on the list.

import type { ProjectModel } from '../../model/project'
import { projectPath } from '../../model/route'
import type { DataStore } from '../../stores/data'
import type { RouteStore } from '../../stores/route'
import type { Fields } from './fields'

export class Arrival {
  readonly stop: () => void
  constructor(d: { route: RouteStore; fields: Fields; data: DataStore; model(slug: string): ProjectModel | null; desk(): boolean }) {
    const arrive = () => {
      const r = d.route.getState().route
      if (!d.desk() || r.page !== 'project' || r.place.kind !== 'new') return
      // the box is there once the page is drawn
      let tries = 0
      const put = () => {
        if (d.fields.get('box')) d.fields.focus('box')
        else if (++tries < 60) requestAnimationFrame(put)
      }
      requestAnimationFrame(put)
    }
    arrive()
    const unroute = d.route.subscribe((s, was) => s.fromBrowser && s.url !== was.url && arrive())
    // the phone opened at an item: the list under it, once its project is here (if you are still on it)
    const at = d.route.getState().route
    let undata = () => {}
    if (!d.desk() && at.page === 'project' && at.place.kind === 'item') {
      const n = Number(/\d+/.exec(at.place.ref)?.[0])
      const settle = () => {
        const r = d.route.getState().route
        const m = d.model(at.slug)
        if (!m) return
        undata()
        if (r.page === 'project' && r.slug === at.slug && r.place.kind === 'item' && m.byN.has(n)) d.route.getState().putUnder(projectPath(r.slug, 'items', { kind: 'tab' }, r.list))
      }
      undata = d.data.subscribe(settle)
      settle()
    }
    this.stop = () => {
      unroute()
      undata()
    }
  }
}
