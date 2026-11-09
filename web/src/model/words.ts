// The words the page uses for Taska's data: item types and their letters, statuses, priorities, agents' names.

import type { ItemType, Status, When } from './types'

export const LETTER: Record<ItemType, string> = { feature: 'F', bug: 'B', idea: 'I', task: 'T' }
export const WORK_TYPES: ItemType[] = ['feature', 'bug', 'idea', 'task']

export const STATUS_WORD: Record<Status, string> = {
  proposed: 'Proposed',
  open: 'Open',
  doing: 'In progress',
  review: 'In review',
  done: 'Done',
  dropped: "Won't do",
}

export const WHEN_WORD: Record<When, string> = { now: 'Now', later: 'Later' }

/** A message's kind, where it says something (progress, most messages, has no tag). */
export const KIND_WORD: Record<string, string> = {
  ask: 'Question',
  withdraw: 'Withdrawn',
  propose: 'Proposal',
  decide: 'Decision',
}

export const AGENT_NAME: Record<string, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  antigravity: 'Antigravity',
  agent: 'Agent',
}
/** An agent's mark where it has no app icon (ui/bits Avatar): one letter of its own (A is any agent's). */
export const AVATAR_LETTER: Record<string, string> = { 'claude-code': 'C', codex: 'X', antigravity: 'V', org: 'O', agent: 'A' }


/** What needs you, by its own name: an agent asks, or something waits for your approval or acceptance. */
export const PLACE_WORD: Record<string, string> = { wait: 'Needs you' }
/** The Status filter: what needs you, then the statuses by their own names (Open: now, not in progress; Later). */
export const STATUS_FILTER_WORD: Record<string, string> = {
  wait: PLACE_WORD.wait,
  open: STATUS_WORD.open,
  doing: STATUS_WORD.doing,
  later: WHEN_WORD.later,
  done: STATUS_WORD.done,
  dropped: STATUS_WORD.dropped,
}
export const ARCHIVE_FILTER_WORD: Record<string, string> = { done: STATUS_WORD.done, dropped: STATUS_WORD.dropped, active: 'Not finished' }
export const SORT_WORDS: [string, string][] = [
  ['all', 'Priority'],
  ['new', 'Newest'],
  ['upd', 'Last updated'],
]

export const TABS = ['items', 'inputs', 'archive', 'rules'] as const
export type Tab = (typeof TABS)[number]
export const TAB_WORD: Record<Tab, string> = { items: 'Items', inputs: 'Inputs', archive: 'Archive', rules: 'Rules' }

/** What a change did, after the item's code: "F12 is done". */
export const DID: Record<string, string> = {
  open: 'is open',
  doing: 'is in progress',
  done: 'is done',
  dropped: "is marked won't do",
  later: 'moved to Later',
  now: 'is back to now',
  review: 'is in review',
  proposed: 'is proposed',
}

/** How many of what needs you show before "Show N more" (on the desktop). */

export function whoName(by: string): string {
  return AGENT_NAME[by] || (by === 'org' ? 'Organizer' : (by || '').charAt(0).toUpperCase() + (by || '').slice(1))
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** An input's number as the page shows it: r315 reads #315 (so it is not taken for rule R315). */
export const inputCode = (id: string | null | undefined) => String(id || '').replace(/^r(\d+)$/, '#$1')


/** A search that found nothing, said one way everywhere. */
export const noMatches = (q: string) => `No matches for “${q.trim()}”`
