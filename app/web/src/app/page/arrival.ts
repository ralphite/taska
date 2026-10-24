// The address as the browser gives it (the page loaded, Back or Forward): the desktop's New input page puts you in its
// box, as it always has. Opened from inside the page, what opens it does that itself.

import type { RouteStore } from '../../stores/route'
import type { Fields } from './fields'

export class Arrival {
  readonly stop: () => void
  constructor(d: { route: RouteStore; fields: Fields; desk(): boolean }) {
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
    this.stop = d.route.subscribe((s, was) => s.fromBrowser && s.url !== was.url && arrive())
  }
}
