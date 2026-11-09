// The page's own part, made together: its errors sent to Taska, the player and picture viewer, the key that arms a
// field, where the page arrives (Back and Forward), Mermaid diagrams, asking before leaving while something is being
// said, and what a reload now would lose.

import { goingUp } from '../../model/fileStates'
import { inFlight } from '../../model/outgoingStates'
import { stillComing } from '../../model/voiceStates'
import type { Core } from '../core'
import { Arrival } from './arrival'
import { Diagrams } from './diagrams'
import { KeyArm } from './keyArm'
import { LeaveGuard } from './leaveGuard'
import { Media } from './media'
import { PageErrors } from './pageErrors'

export function makePage(c: Core) {
  const { s } = c
  const pageErrors = new PageErrors({ api: c.api, slug: c.slug })
  const media = new Media({ api: c.api, store: s.media, route: s.route, sheets: c.sheets, toasts: c.toasts, desk: c.desk, kept: (sl, f) => c.model(sl)?.voices.get(f) ?? null })
  // something being said into the page now: a voice note, a dictation, or search listening (T728 #6: one rule)
  const sayingNow = () => c.recording() || !!s.dictation.getState().rec || s.find.getState().phase === 'listening'
  // what a reload now would lose: something being said, or words and files still on their way (an update waits for
  // it to end; T728 #6: dictation's notes waiting for words and search's listening were missed)
  const busy = () =>
    sayingNow() ||
    s.dictation.getState().waiting.length > 0 ||
    s.find.getState().phase === 'writing' ||
    Object.values(s.box.getState().files).some((fs) => fs.some(stillComing)) ||
    s.outbox.getState().list.some((o) => inFlight(o) || o.files.some(goingUp))
  // leaving while something is being said asks first
  const leaveGuard = new LeaveGuard(sayingNow)
  const arrival = new Arrival({ route: s.route, fields: c.fields, data: s.data, model: c.model, desk: c.desk, session: c.session })
  return { pageErrors, media, keyArm: new KeyArm(), busy, leaveGuard, arrival, diagrams: new Diagrams((sl, f) => c.api.diagramFailed(sl, f)) }
}
