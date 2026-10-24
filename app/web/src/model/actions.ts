// What a row offers: the desktop's quick actions (shown on hover) and the phone's swipes, as (field, value, label).

import { canDone, closed, rowAction } from './items'
import type { Item } from './types'

export type Slot = readonly [field: string, value: string, label: string]

/** Swipe right all the way, or the desktop's first action: the step forward you take most. On an item that waits on
 * your answer the step forward is that answer (its pill), never Done. */
export function forward(it: Item | undefined): readonly [string, string, string, string?] | null {
  if (!it || it.archived) return null
  if (it.type === 'rule' && it.status === 'open') return null
  if (it.wait) return ['need', ...rowAction(it)]
  if (it.status === 'proposed') return ['status', 'open', 'Approve', 'approved']
  if (it.status === 'review') return ['status', 'done', 'Accept', 'accepted']
  if (closed(it.status)) return ['archived', 'true', 'Archive', 'archived']
  return ['status', 'done', 'Done', 'done']
}

/** The desktop's quick actions, in one order on every row (forward, progress, Won't do, Later), those that do not apply
 * left out. A row waiting on your answer offers only these beside its pill. */
export function deskSlots(it: Item, needs: boolean): (Slot | null)[] {
  const later: Slot = it.when === 'now' ? ['when', 'later', 'Later'] : ['when', 'now', 'Back to now']
  const drop: Slot = ['status', 'dropped', "Won't do"]
  if (it.archived) return [['archived', 'false', 'Unarchive'], null, null, null]
  if (it.wait)
    return [
      null,
      canDone(it) ? ['status', 'done', 'Done'] : null,
      it.status === 'proposed' || ['open', 'doing'].includes(it.status) ? drop : null,
      later,
    ]
  if (it.type === 'rule')
    return it.status === 'proposed'
      ? [needs ? null : ['status', 'open', 'Approve'], null, drop, null]
      : it.status === 'open'
        ? [null, null, ['status', 'dropped', 'Retire'], null]
        : [['archived', 'true', 'Archive'], ['status', 'open', 'Reactivate'], null, null]
  const r = needs ? null : forward(it)
  const fwd: Slot | null = r && r[0] !== 'need' ? [r[0], r[1], r[2]] : null
  const prog: Slot | null = it.status === 'review' ? ['reopen', '', 'Not yet'] : closed(it.status) ? ['status', 'open', 'Reopen'] : null
  return [fwd, prog, ['open', 'doing', 'proposed'].includes(it.status) ? drop : null, closed(it.status) ? null : later]
}

/** Swipe left: the way back. The one you want most sits at the edge, under your finger. */
export function backward(it: Item): Slot[] {
  const later: Slot = it.when === 'now' ? ['when', 'later', 'Later'] : ['when', 'now', 'Back to now']
  const drop: Slot = ['status', 'dropped', "Won't do"]
  const done: Slot[] = it.wait ? [['status', 'done', 'Done']] : []
  if (it.type === 'rule' && !it.archived)
    return it.status === 'proposed' ? [drop] : it.status === 'open' ? [['status', 'dropped', 'Retire']] : [['status', 'open', 'Reactivate']]
  if (it.archived) return [['archived', 'false', 'Unarchive']]
  if (it.status === 'proposed') return [drop, later]
  if (it.status === 'review') return [later, ['status', 'doing', 'Not yet']]
  if (closed(it.status)) return [['status', 'open', 'Reopen']]
  return [drop, later, ...done]
}

/** A quick action's key, colour, icon, as the row and its tip show them. */
export const ACT_KEY: Record<string, string> = {
  Done: 'D',
  Accept: 'A',
  Approve: 'A',
  Archive: 'E',
  Unarchive: 'E',
  Later: 'L',
  'Back to now': 'L',
  "Won't do": 'W',
  'Not yet': 'N',
  Start: 'S then 3',
  Pause: 'S then 2',
  'Back to queue': 'S then 2',
  Reopen: 'S then 2',
  Retire: 'W',
  Reactivate: 'D',
}
