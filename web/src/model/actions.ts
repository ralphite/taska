// What can be done to an item, and why not: its next step for you, what Done, Won't do and Later do and why they
// cannot (in a few words, said instead); and what a row offers: the desktop's quick actions (shown on hover) and the
// phone's swipes, as (field, value, label).

import { canDone, closed, rowAction } from './items'
import { hasChoices } from './markdown'
import type { Item } from './types'

export type Slot = readonly [field: string, value: string, label: string]

const TYPE_KEY: Record<string, string> = { f: 'feature', b: 'bug', i: 'idea', t: 'task', r: 'rule' }

/** S, P or T was pressed, then `key`: the field it sets and the value (a status by its number in `statuses`, a
 * priority by its digit, a type by its letter); null: the key sets nothing. */
export function armedSet(arm: 's' | 'p' | 't', key: string, statuses: readonly string[]): readonly [field: string, value: string] | null {
  if (arm === 'p') return /^[0-3]$/.test(key) ? ['pri', 'P' + key] : null
  if (arm === 't') return TYPE_KEY[key.toLowerCase()] ? ['type', TYPE_KEY[key.toLowerCase()]] : null
  const v = /^[1-9]$/.test(key) ? statuses[Number(key) - 1] : undefined
  return v ? ['status', v] : null
}

/** What S then a digit counts on the page (a rule: its three statuses). */
export const pageStatuses = (it: Item): readonly string[] => (it.type === 'rule' ? ['proposed', 'open', 'dropped'] : ['proposed', 'open', 'doing', 'review', 'done', 'dropped'])

/** The item's next step for you (A): accept or approve it, or answer what waits on you. */
export type YourStep = { set: readonly [field: 'status', value: string, label: string, said: string] } | { answer: 'choices' | 'words' } | null

export function yourStep(it: Item): YourStep {
  if (it.status === 'review') return { set: ['status', 'done', 'Accept', 'accepted'] }
  if (it.status === 'proposed') return { set: ['status', 'open', 'Approve', 'approved'] }
  if (it.wait) return { answer: it.wait.kind === 'ask' && hasChoices(it.wait.text) ? 'choices' : 'words' }
  return null
}

/** What Done and Won't do set (a rule: active, retired). */
export const doneTo = (it: Item) => (it.type === 'rule' ? 'open' : 'done')
export const dropTo = () => 'dropped'

/** Why a step cannot be taken on this item, in a few words; null: it can. */
export const whyNot = {
  next: (it: Item, code: string) => (yourStep(it) ? null : `Nothing waits on you in ${code}`),
  notYet: (it: Item) => (it.status === 'review' ? null : 'Not yet works on items in review'),
  done: (it: Item, code: string) =>
    it.type === 'rule'
      ? it.status === 'open'
        ? `${code} is active already`
        : null
      : closed(it.status)
        ? `${code} is ${it.status === 'done' ? 'done' : "marked won't do"} already`
        : !canDone(it)
          ? it.status === 'proposed'
            ? `Approve ${code} first (A)`
            : `Accept ${code} first (A)`
          : null,
  drop: (it: Item, code: string) => (it.status === 'dropped' ? (it.type === 'rule' ? `${code} is retired already` : `${code} is marked won't do already`) : null),
  later: (it: Item) => (it.type !== 'rule' && !closed(it.status) ? null : it.type === 'rule' ? 'Rules have no Later' : 'Later works on open items'),
}

/** Swipe right all the way, or the desktop's first action: the step forward you take most. On an item that waits on
 * your answer the step forward is that answer (its pill), never Done. */
export function forward(it: Item | undefined): readonly [string, string, string, string?] | null {
  if (!it || it.archived) return null
  if (it.type === 'rule' && it.status === 'open') return null
  if (it.wait) return ['need', ...rowAction(it)]
  const step = yourStep(it)
  if (step && 'set' in step) return step.set
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
