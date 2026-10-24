// Choices in a document are a form you fill in place: a tap ticks one on the page, and the ticks wait until you send
// them (they go into the document, and the item hears which ones you ticked). A sent form shows as sent until you
// choose to change it. Each paragraph is told apart by which one it is ("key~0"), as paragraphs can share words.

import { blockKeys } from './docs'
import { CHOICE } from './markdown'
import type { Block, Doc } from './types'
import { plural } from './words'

export const isTicked = (l: string) => /^\s*[-*+]\s+[([][xX][)\]]/.test(l)
export const TICKED_LINE = /^\s*[-*+]\s+[([][xX][)\]]/m

/** One paragraph of choices with its i-th choice ticked or unticked (one of "( )" choices at a time; "All" ticks or
 * unticks its whole list, and is ticked exactly when every other choice of it is). null: there is no such choice. */
export function tickedBlock(block: string, i: number): string | null {
  const ls = block.split('\n')
  const k = ls.flatMap((l, j) => (CHOICE.test(l) ? [j] : []))[i]
  if (k == null) return null
  const multi = ls[k].match(CHOICE)?.[1] === '['
  const mark = (l: string, on: boolean) => l.replace(/^(\s*[-*+]\s+)[([][ xX]?[)\]]/, (_, p: string) => p + (multi ? (on ? '[x]' : '[ ]') : on ? '(x)' : '( )'))
  // the list it is in: the choice lines next to it (words above another list make two lists in one paragraph)
  let a = k
  let z = k
  while (a > 0 && CHOICE.test(ls[a - 1])) a--
  while (z < ls.length - 1 && CHOICE.test(ls[z + 1])) z++
  const mine = (j: number) => j >= a && j <= z
  const isAll = (l: string) => multi && /^(全部|All\b)/i.test(l.replace(CHOICE, '').trim())
  const on = !isTicked(ls[k])
  const all = isAll(ls[k])
  const next = ls.map((l, j) => (j === k || (all && mine(j)) ? mark(l, on) : !multi && mine(j) ? mark(l, false) : l))
  const allAt = multi && !all ? next.findIndex((l, j) => mine(j) && CHOICE.test(l) && isAll(l)) : -1
  if (allAt >= 0) next[allAt] = mark(next[allAt], next.every((l, j) => j === allAt || !mine(j) || !CHOICE.test(l) || isTicked(l)))
  return next.join('\n')
}

/** What you ticked and did not send yet, per document and paragraph; and what was sent and is not in it yet. */
export interface TickState {
  mine: Readonly<Record<number, Readonly<Record<string, string>>>>
  going: Readonly<Record<number, Readonly<Record<string, string>>>>
  /** sent forms opened to change again: "d k" */
  open: ReadonlySet<string>
}

/** A paragraph's words as you ticked them (its own when nothing waits; what was sent while it is on its way). */
export function tickText(t: TickState, d: number, k: string, text: string): string {
  const mine = t.mine[d]?.[k]
  if (mine != null) return mine
  const going = t.going[d]?.[k]
  return going ?? text
}

/** The paragraphs whose ticks wait to be sent (and are still in the document), with the heading they are under. */
export function ticksOf(t: TickState, doc: Doc | undefined): { b: Block; k: string; now: string; head: string }[] {
  if (!doc) return []
  const mine = t.mine[doc.d] || {}
  const keys = blockKeys(doc)
  let head = ''
  return doc.blocks.flatMap((b, i) => {
    if (b.kind === 'heading' && i > 0) head = b.text.replace(/^#+\s*/, '')
    const k = keys[i]
    return mine[k] != null && mine[k] !== b.text ? [{ b, k, now: mine[k], head }] : []
  })
}

/** What you chose, one line each, with the part of the document it is in. */
export const tickWords = (t: TickState, doc: Doc) =>
  ticksOf(t, doc).flatMap(({ now, head }) => now.split('\n').flatMap((l) => (isTicked(l) ? ['✓ ' + l.replace(CHOICE, '') + (head ? ` (${head})` : '')] : [])))

/** "2 choices not sent" while ticks wait, else ''. */
export const ticksNotSent = (t: TickState, doc: Doc | undefined) => (doc && ticksOf(t, doc).length ? `${plural(tickWords(t, doc).length, 'choice')} not sent` : '')
