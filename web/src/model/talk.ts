// An item's talk, read for the page: its latest message, what you answered a question with, the versions of something
// you edited, the questions taken back, who read your words, its documents' comments in time (what its card holds
// and where: model/needStates). Pure: from the item (and an answer still on its way, when there is one).

import { taskaNote, userWord } from './items'
import { plainQuote, ticks } from './markdown'
import type { Comment, Doc, Item, Message } from './types'

/** The item's latest message from anyone but the organizer: what you came to read, shown whole. */
export const latestMessage = (it: Item): number | null => it.thread.filter((x) => x.by !== 'org').at(-1)?.id ?? null

/** What you picked in answer to a question: your words after it and before the next question (answered again, the
 * latest answer counts); an answer still on its way counts first, for the latest question. */
export function answerOf(thread: readonly Message[], x: Message, going?: string | null): string[] | null {
  if (x.kind !== 'ask') return null
  if (going != null && thread.filter((m) => m.kind === 'ask').at(-1)?.id === x.id) return ticks(going)
  const rest = thread.slice(thread.indexOf(x) + 1)
  const end = rest.findIndex((m) => m.kind === 'ask')
  const after = (end < 0 ? rest : rest.slice(0, end)).filter(userWord)
  const a = after.filter((m) => /^\s*✓/m.test(m.text)).at(-1) || after[0]
  return a ? ticks(a.text) : null
}

export interface Version {
  /** an edit came after it: it shows quieter, as an earlier version */
  old: boolean
  text: string
  label: string
}

/** An input you edited or added details to: each of its messages as the version it is. */
export function versions(thread: readonly Message[]): Map<number, Version> {
  const by = new Map<string, Message[]>()
  const out = new Map<number, Version>()
  const plain = (t: string) => t.replace(/^r\d+ updated:\n/, '')
  for (const x of thread)
    if (x.by === 'you' && x.src && !x.change) {
      const list = by.get(x.src) || []
      list.push(x)
      by.set(x.src, list)
    }
  for (const list of by.values())
    if (list.length > 1) {
      const info = list.map((x, i) => {
        const text = plain(x.text)
        const prev = i ? plain(list[i - 1].text) : null
        const added = prev !== null && text.startsWith(prev) && text.length > prev.length ? text.slice(prev.length).trim() : null
        return { x, text: added ?? text, label: !i ? '' : added !== null ? 'added details' : 'edited', edit: !!i && added === null }
      })
      info.forEach((v, i) => out.set(v.x.id, { old: info.slice(i + 1).some((w) => w.edit), text: v.text, label: v.label }))
    }
  return out
}

/** The questions an agent took back (a withdraw after them, nothing of yours in between). */
export function withdrawn(thread: readonly Message[]): Set<number> {
  const gone = new Set<number>()
  thread.forEach((x, i) => {
    if (x.kind !== 'withdraw') return
    const q = thread
      .slice(0, i)
      .reverse()
      .find((y) => y.kind === 'ask' || userWord(y))
    if (q && !userWord(q)) gone.add(q.id)
  })
  return gone
}

/** Your latest words, read by agents since and not answered yet: who, and the latest read (ms). */
export function readMark(it: Item): { id: number; names: string[]; t: number } | null {
  const th = it.thread
  const mine = th.findLastIndex((x) => x.by === 'you')
  const theirs = th.findLastIndex((x) => x.by !== 'you' && x.by !== 'org' && !taskaNote(x))
  if (mine < 0 || mine <= theirs || !it.readBy) return null
  const t = Date.parse(th[mine].t)
  const readers = Object.entries(it.readBy)
    .filter(([, ms]) => ms >= t)
    .sort((a, b) => b[1] - a[1])
  return readers.length ? { id: th[mine].id, names: readers.map(([n]) => n), t: readers[0][1] } : null
}

/** A comment on one of the item's documents, as the talk shows it among its messages. */
export interface DocNote {
  c: Comment
  /** the document's number */
  d: number
  /** the part it is on ('doc': the whole document) */
  key: string
  /** the words it is about were changed in the document since */
  changed: boolean
  /** what it is about: the words it quotes, else the start of its part (a table by its columns) */
  about: string
}

/** What a comment quoting no words is on: the start of its part, a table by its columns. */
function partStart(d: Doc, key: string): string {
  const b = d.blocks.find((x) => x.key === key)
  if (!b) return ''
  if (b.kind === 'table') return `Table: ${b.text.split('\n')[0].split('|').map((s) => s.trim()).filter(Boolean).join(' · ')}`
  const words = plainQuote(b.text).replace(/\s+/g, ' ').trim()
  return `“${words.length > 120 ? words.slice(0, 120) + '…' : words}”`
}

/** The comments on the item's documents, in time (one with no time yet is not shown). */
export function docNotes(docs: readonly Doc[]): DocNote[] {
  return docs
    .flatMap((d) => [
      ...d.blocks.flatMap((b) => b.comments.map((c) => ({ c, d, key: b.key, changed: false }))),
      ...(d.whole || []).map((c) => ({ c, d, key: 'doc', changed: false })),
      ...d.detached.flatMap((t) => t.comments.map((c) => ({ c, d, key: t.key, changed: true }))),
    ])
    .filter(({ c }) => c.t)
    .sort((a, b) => a.c.t.localeCompare(b.c.t))
    .map(({ c, d, key, changed }) => ({ c, d: d.d, key, changed, about: c.quote ? `“${plainQuote(c.quote)}”` : key !== 'doc' ? partStart(d, key) : '' }))
}
