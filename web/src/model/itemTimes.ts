// When an item was made and when it last changed, as its page says them (F704 r1157): one quiet line under its chips
// ("Nov 3 by Organizer · Updated 2h ago"), and both times in full (the phone's sheet, the desktop's tip). `t0` is when
// it was made, `by` who made it (you, the organizer or an agent; not always known); `t1` its last change of any kind
// (a field, a message, a document, a merge). Told against `now` (ms), the model's time.

import type { Item } from './types'
import { ago, dateOf, timeOf, when } from './time'
import { whoName } from './words'

export interface ItemTimes {
  /** the line's first part: the day it was made, and who made it ("Nov 3 by Organizer") */
  made: string
  /** the line's second part ("Updated 2h ago"); none when it has not changed since */
  updated: string | null
  /** both in full: the sheet's rows and the tip's lines */
  created: { at: string; by: string }
  last: string | null
  tip: string
}

const ofYear = (d: Date, now: number) => d.getFullYear() === new Date(now).getFullYear()

/** How long ago, within the week ("2h ago"); further back, its day. */
const since = (t: string, now: number) => (now - Date.parse(t) < 7 * 864e5 ? ago(t, now, 'ago') : dateOf(t, now))

/** The page's time words, today's said as such ("Today 14:38") and another year's with its time. */
const exact = (t: string, now: number) => {
  const w = when(t, now)
  if (/^\d/.test(w)) return `Today ${w}`
  return ofYear(new Date(t), now) ? w : `${w} ${timeOf(t)}`
}

const byWho = (by: string | null) => (!by ? '' : by === 'you' ? 'by you' : `by ${whoName(by)}`)

export function itemTimes(it: Pick<Item, 't0' | 't1' | 'by'>, now: number): ItemTimes {
  const by = byWho(it.by)
  // changed within its first minute (the organizer filing it): not an update of its own
  const changed = !!it.t1 && Date.parse(it.t1) - Date.parse(it.t0) >= 60e3
  const created = { at: exact(it.t0, now), by }
  const last = changed ? exact(it.t1, now) : null
  return {
    made: [dateOf(it.t0, now), by].filter(Boolean).join(' '),
    updated: changed ? `Updated ${since(it.t1, now)}` : null,
    created,
    last,
    tip: [['Created', created.at, by].filter(Boolean).join(' '), last ? `Updated ${last}` : ''].filter(Boolean).join('\n'),
  }
}
