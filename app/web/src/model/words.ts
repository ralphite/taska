// The words the page uses for Taska's data: item types and their letters, statuses, priorities, agents' names.

import type { ItemType, Status, When } from './types'

export const LETTER: Record<ItemType, string> = { feature: 'F', bug: 'B', idea: 'I', task: 'T', rule: 'R' }
export const WORK_TYPES: ItemType[] = ['feature', 'bug', 'idea', 'task']

export const STATUS_WORD: Record<Status, string> = {
  proposed: 'Proposed',
  open: 'Open',
  doing: 'In progress',
  review: 'In review',
  done: 'Done',
  dropped: "Won't do",
}
/** A rule's statuses read differently: in force or retired. */
export const RULE_STATUS_WORD: Partial<Record<Status, string>> = { proposed: 'Proposed', open: 'Active', dropped: 'Retired' }
export const WHEN_WORD: Record<When, string> = { now: 'Now', later: 'Later' }

/** A message's kind, where it says something (progress, most messages, has no tag). */
export const KIND_WORD: Record<string, string> = {
  ask: 'Question',
  block: 'Blocked',
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
/** An agent's mark: one letter of its own (A is any agent's). */
export const AVATAR_LETTER: Record<string, string> = { 'claude-code': 'C', codex: 'X', antigravity: 'V', org: 'O', agent: 'A' }

/** Quiet longer than this, another agent may take the item (the server's hold on an item). */
export const QUIET_MS = 30 * 60 * 1000

/** The five places an item can be: it needs you, an agent is on it, it waits in the queue, later, finished. */
export const PLACE_WORD: Record<string, string> = {
  wait: 'Needs you',
  doing: 'In progress',
  queued: 'Queued',
  later: 'Later',
  closed: 'Finished',
}
export const ARCHIVE_FILTER_WORD: Record<string, string> = { done: 'Done', dropped: "Won't do", active: 'Not finished' }
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
export const NEEDS_SHOWN = 5

export function whoName(by: string): string {
  return AGENT_NAME[by] || (by === 'org' ? 'Organizer' : (by || '').charAt(0).toUpperCase() + (by || '').slice(1))
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** An input's number as the page shows it: r315 reads #315 (so it is not taken for rule R315). */
export const inputCode = (id: string | null | undefined) => String(id || '').replace(/^r(\d+)$/, '#$1')
