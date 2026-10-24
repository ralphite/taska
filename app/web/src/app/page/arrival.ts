// The address as the browser gives it (the page loaded, Back or Forward): the New input page puts you in its box, as it
// always has (opened from inside the page, what opens it does that itself); on the phone, a link to an item puts the
// list under it once the item is there, so Back lands on the list. A project's plain address, reached again in this
// tab, opens the list's view you left it in (Archive or Inputs; kept as the page is left, "taska.tab.<project>").

import type { ProjectModel } from '../../model/project'
import { projectPath } from '../../model/route'
import type { DataStore } from '../../stores/data'
import type { RouteStore } from '../../stores/route'
import type { KeyValueStore } from '../../stores/storage'
import type { Fields } from './fields'

export class Arrival {
  readonly stop: () => void
  constructor(d: { route: RouteStore; fields: Fields; data: DataStore; model(slug: string): ProjectModel | null; desk(): boolean; session: KeyValueStore }) {
    const start = d.route.getState()
    if (start.route.page === 'project' && start.url === `/p/${encodeURIComponent(start.route.slug)}/`) {
      const t = d.session.get('taska.tab.' + start.route.slug)
      if (t === 'archive' || t === 'inputs') start.go(`/p/${encodeURIComponent(start.route.slug)}/${t}`, false)
    }
    const left = () => {
      const r = d.route.getState().route
      if (r.page === 'project') d.session.set('taska.tab.' + r.slug, r.tab)
    }
    if (typeof window !== 'undefined') window.addEventListener('pagehide', left)
    const arrive = () => {
      const r = d.route.getState().route
      // the New input page (on the phone too), or on the desktop the old address of Inputs, which is that page now
      if (r.page !== 'project' || !(r.place.kind === 'new' || (d.desk() && r.place.kind === 'tab' && r.tab === 'inputs'))) return
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
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', left)
    }
  }
}
