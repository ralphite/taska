// The phone's search (F479): what the server found in every project (/api/find), and how the page puts it: grouped
// by project (the one you are in first, then the others in the sidebar's order), closest first in each, a kind chip
// showing only that kind. Pure.

import { when } from './time'
import type { Item } from './types'

export type FindPhase =
  /** nothing to search yet: the box waits for you to speak or type */
  | 'ready'
  | 'listening'
  /** writing out what you said, after you stopped */
  | 'writing'
  /** searching: the first time (nothing yet), or again (the results before it, faded) */
  | 'searching'
  | 'found'
  | 'nothing'
  /** you stopped, but there were no words in it */
  | 'unheard'
  | 'nomic'
  /** Taska out of reach: it keeps trying */
  | 'offline'

export type FindKind = 'items' | 'inputs' | 'rules' | 'docs'
export const FIND_KINDS: readonly (readonly [FindKind, string])[] = [
  ['items', 'Items'],
  ['inputs', 'Inputs'],
  ['rules', 'Rules'],
  ['docs', 'Documents'],
]

/** One thing found, in its project: an item or a rule (as the list has it), an input, a document. */
export interface Found {
  project: string
  kind: FindKind
  /** its key in the project: i3, r8, d1 */
  key: string
  /** the item it is or opens (a document's, what an input became); null: none */
  n: number | null
  item?: Item
  parentCode?: string | null
  kids?: { done: number; all: number } | null
  /** an input or a document: its code (#8, D1) and words */
  code?: string
  title?: string
  /** an input: when it was said, and the item it became */
  t?: string
  became?: string | null
  /** a document: its number and its item's code */
  d?: number
  on?: string
}

export interface FindAnswer {
  q: string
  /** found by what the words mean, or by the words alone */
  by: 'meaning' | 'words'
  /** the words to mark where they are found */
  marks: string[]
  found: Found[]
  /** each project's title */
  titles: Record<string, string>
}

export interface FoundGroup {
  project: string
  title: string
  rows: Found[]
}

/** What it found by project: `here` first, then the others in `order` (the sidebar's), the rest after them; one
 * kind only, or all. */
export function foundGroups(a: FindAnswer, here: string, order: readonly string[], kind: FindKind | 'all'): FoundGroup[] {
  const shown = a.found.filter((x) => kind === 'all' || x.kind === kind)
  const names = [...new Set([here, ...order, ...shown.map((x) => x.project)])]
  return names.flatMap((p) => {
    const rows = shown.filter((x) => x.project === p)
    return rows.length ? [{ project: p, title: a.titles[p] || p, rows }] : []
  })
}

/** The kinds it found, each with how many (only those it found). */
export const foundKinds = (a: FindAnswer): [FindKind, string, number][] =>
  FIND_KINDS.map(([k, label]) => [k, label, a.found.filter((x) => x.kind === k).length] as [FindKind, string, number]).filter(([, , n]) => n > 0)

/** The line under an input or a document: "Oct 23 · became F001", "Today 09:12", "On F001". */
export function foundMeta(x: Found, now: number): string {
  if (x.kind === 'docs') return x.on ? `On ${x.on}` : ''
  const t = when(x.t, now)
  const day = /^\d\d:\d\d$/.test(t) ? `Today ${t}` : t
  return [day, x.became ? `became ${x.became}` : ''].filter(Boolean).join(' · ')
}

/** The address a result opens: an item its page, a document its own, an input the item it became (none: the inputs
 * with its words). */
export function foundPath(x: Found): string {
  const base = `/p/${encodeURIComponent(x.project)}/`
  if (x.kind === 'docs' && x.d != null) return base + `D${x.d}`
  if (x.kind === 'inputs') return x.became ? base + encodeURIComponent(x.became) : base + 'inputs?q=' + encodeURIComponent((x.title || '').slice(0, 60))
  return base + encodeURIComponent(x.item?.code || String(x.n))
}

/** More words said after the ones in the box: put at their end, joined as a sentence goes on ("…, only on the
 * phone"; in Chinese with "，"). -> the words, and what was added (to light). */
export function saidMore(words: string, more: string): { words: string; added: string } {
  const said = more.trim().replace(/[.。]+$/, '')
  if (!words.trim()) return { words: said, added: '' }
  if (!said) return { words, added: '' }
  const was = words.replace(/[\s.。!?！？,，]+$/, '')
  const cjk = /[\u3400-\u9fff]/.test(said[0] || '')
  const next = !cjk && /^[A-Z][a-z]/.test(said) ? said[0].toLowerCase() + said.slice(1) : said
  const added = (cjk ? '，' : ', ') + next
  return { words: was + added, added }
}

/** The words of a voice note as the box takes them: without a full stop at the end. */
export const heardWords = (tr: string) => tr.trim().replace(/[.。]+$/, '')
