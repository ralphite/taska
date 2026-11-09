// Every action you take on an item, defined once by its id: its words, its icon, its colour (by what it means; the
// classes of each colour are in ui/tones.ts), its key as a tip names it, and a decision's word once it is made. The
// rows, their swipes, the item page, the decision cards, the selection bar and the keys all read this table.

import type { Status } from './types'
import { STATUS_WORD } from './words'

/** An action's colour, by what it means: done (green), go (blue), stop (red), ask (amber), quiet (grey). */
export type ActTone = 'done' | 'go' | 'stop' | 'ask' | 'quiet'

export interface ItemActDef {
  label: string
  /** its icon (ui/icon-paths.ts) */
  icon: string
  /** its icon on a decision's card, where that differs */
  cardIcon?: string
  tone?: ActTone
  /** its key, as a tip names it (a letter is pressed without Shift) */
  key?: string
  /** a decision's word once it is made: on the decided card and on the row just decided on (D115 #8) */
  past?: string
}

/** S then the status's digit (model/items statusChoices: the statuses in their order). */
const statusKey = (s: Status) => `S then ${Object.keys(STATUS_WORD).indexOf(s) + 1}`

const ACTS = {
  approve: { label: 'Approve', icon: 'thumb', tone: 'go', key: 'A', past: 'Approved' },
  accept: { label: 'Accept', icon: 'done', cardIcon: 'check', tone: 'done', key: 'A', past: 'Accepted' },
  answer: { label: 'Answer', icon: 'ask', tone: 'ask' },
  reply: { label: 'Reply', icon: 'reply', tone: 'quiet' },
  done: { label: 'Done', icon: 'done', tone: 'done', key: 'D' },
  drop: { label: STATUS_WORD.dropped, icon: 'ban', tone: 'stop', key: 'W', past: 'Declined' },
  'not-yet': { label: 'Not yet', icon: 'reopen', tone: 'quiet', key: 'N', past: 'Sent back' },
  reopen: { label: 'Reopen', icon: 'reopen', key: statusKey('open') },
  later: { label: 'Later', icon: 'clock', key: 'L' },
  now: { label: 'Back to now', icon: 'up', key: 'L' },
  archive: { label: 'Archive', icon: 'archive', key: 'E' },
  unarchive: { label: 'Unarchive', icon: 'unarchive', key: 'E' },
} as const satisfies Record<string, ItemActDef>

export type ItemActId = keyof typeof ACTS
export const ITEM_ACTS: Readonly<Record<ItemActId, ItemActDef>> = ACTS

/** An action's words with its key, as its tip says them: "Done · D". */
export const actTip = (id: ItemActId) => {
  const a = ITEM_ACTS[id]
  return a.key ? `${a.label} · ${a.key}` : a.label
}

/** A decision's word once made (Approved, Declined), else its word. */
export const pastOf = (id: ItemActId) => ITEM_ACTS[id].past ?? ITEM_ACTS[id].label
