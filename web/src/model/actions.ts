// What can be done to an item, and why not: its next step for you, what Done, Won't do and Later do and why they
// cannot (in a few words, said instead); and what a row offers: the desktop's quick actions (shown on hover) and the
// phone's swipes, as (field, value, action: model/itemActs); and what S, P or T then a key sets, and says.

import type { ItemActId } from './itemActs'
import { canDone, closed, statusChoices } from './items'
import { yourStep } from './needStates'
import type { Item } from './types'
import { LETTER, WORK_TYPES } from './words'

export type Slot = readonly [field: string, value: string, act: ItemActId]

/** T then a type's letter */
const TYPE_KEY: Record<string, string> = Object.fromEntries(WORK_TYPES.map((t) => [LETTER[t].toLowerCase(), t]))

/** S, P or T was pressed, then `key`: the field it sets and the value (a status by its number in `statuses`, a
 * priority by its digit, a type by its letter); null: the key sets nothing. */
export function armedSet(arm: 's' | 'p' | 't', key: string, statuses: readonly string[]): readonly [field: string, value: string] | null {
  if (arm === 'p') return /^[0-3]$/.test(key) ? ['pri', 'P' + key] : null
  if (arm === 't') return TYPE_KEY[key.toLowerCase()] ? ['type', TYPE_KEY[key.toLowerCase()]] : null
  const v = /^[1-9]$/.test(key) ? statuses[Number(key) - 1] : undefined
  return v ? ['status', v] : null
}

/** What S then a digit counts on the page. */
export const pageStatuses = (it: Item): readonly string[] => statusChoices(it).map(([v]) => v)

/** What S, P or T says it waits for (and a digit pressed alone): the keys that follow, from what they set. */
export function armHint(arm: 's' | 'p' | 't' | null, it: Item): string {
  if (arm === 's') return `Status: 1–${pageStatuses(it).length}`
  if (arm === 'p') return 'Priority: 0–3'
  if (arm === 't') return 'Type: ' + WORK_TYPES.map((t) => LETTER[t]).join(' ')
  return 'First S, P or T: then a digit'
}

/** What Done and Won't do set. */
export const doneTo = (_it: Item) => 'done'
export const dropTo = () => 'dropped'

/** Why a step cannot be taken on this item, in a few words; null: it can. */
export const whyNot = {
  next: (it: Item, code: string) => (yourStep(it) ? null : `Nothing waits on you in ${code}`),
  notYet: (it: Item) => (it.status === 'review' ? null : 'Not yet works on items in review'),
  done: (it: Item, code: string) =>
    closed(it.status)
      ? `${code} is ${it.status === 'done' ? 'done' : "marked won't do"} already`
      : !canDone(it)
        ? it.status === 'proposed'
          ? `Approve ${code} first (A)`
          : `Accept ${code} first (A)`
        : null,
  drop: (it: Item, code: string) => (it.status === 'dropped' ? `${code} is marked won't do already` : null),
  later: (it: Item) => (!closed(it.status) ? null : 'Later works on open items'),
}

/** Swipe right all the way, or the desktop's first action: the step forward you take most, A's (model/needStates). On
 * an item that waits on your answer the step forward is that answer (its pill), never Done. */
export function forward(it: Item | undefined): readonly [field: string, value: string, act: ItemActId, said?: string] | null {
  if (!it || it.archived) return null
  const step = yourStep(it)
  if (step && 'answer' in step) return ['need', 'answer', 'answer']
  if (step) return step.set
  if (closed(it.status)) return ['archived', 'true', 'archive', 'archived']
  return ['status', 'done', 'done', 'done']
}

/** The desktop's quick actions, in one order on every row (forward, progress, Won't do, Later), those that do not apply
 * left out. A row waiting on your answer offers only these beside its pill. */
export function deskSlots(it: Item, needs: boolean): (Slot | null)[] {
  const later: Slot = it.when === 'now' ? ['when', 'later', 'later'] : ['when', 'now', 'now']
  const drop: Slot = ['status', 'dropped', 'drop']
  if (it.archived) return [['archived', 'false', 'unarchive'], null, null, null]
  if (it.wait)
    return [
      null,
      canDone(it) ? ['status', 'done', 'done'] : null,
      it.status === 'proposed' || ['open', 'doing'].includes(it.status) ? drop : null,
      later,
    ]
  const r = needs ? null : forward(it)
  const fwd: Slot | null = r && r[0] !== 'need' ? [r[0], r[1], r[2]] : null
  const prog: Slot | null = it.status === 'review' ? ['reopen', '', 'not-yet'] : closed(it.status) ? ['status', 'open', 'reopen'] : null
  return [fwd, prog, ['open', 'doing', 'proposed'].includes(it.status) ? drop : null, closed(it.status) ? null : later]
}

/** Swipe left: the way back. The one you want most sits at the edge, under your finger. */
export function backward(it: Item): Slot[] {
  const later: Slot = it.when === 'now' ? ['when', 'later', 'later'] : ['when', 'now', 'now']
  const drop: Slot = ['status', 'dropped', 'drop']
  const done: Slot[] = it.wait ? [['status', 'done', 'done']] : []
  if (it.archived) return [['archived', 'false', 'unarchive']]
  if (it.status === 'proposed') return [drop, later]
  if (it.status === 'review') return [later, ['status', 'open', 'not-yet']]
  if (closed(it.status)) return [['status', 'open', 'reopen']]
  return [drop, later, ...done]
}
