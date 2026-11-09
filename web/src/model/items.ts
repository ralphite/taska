// The page's rules about items, as pure functions: what Done applies to, the order agents take the work, where a
// dragged row goes (what an item needs from you is model/needStates). They agree with the server's (domain/rules.py), which the page cannot ask at every
// keystroke: a change you make shows at once, before the server has it.

import type { Input, Item, Message, Status } from './types'
import { CLOSED, NOTES, TASKA, USER_KINDS, WORK_TYPES } from './vocab.gen'
import { STATUS_WORD } from './words'

export const closed = (s: Status | string) => (CLOSED as readonly string[]).includes(s)

/** The statuses an item can be set to, in the menu's order: [status, word][] */
export const statusChoices = (_it: Item): [string, string][] => Object.entries(STATUS_WORD) as [string, string][]

export const statusWord = (it: Item) => STATUS_WORD[it.status]

/** The user's own words on an item: theirs, or what the organizer filed there from one of their inputs (domain/rules.py
 * user_word). */
export const userWord = (m: Pick<Message, 'by' | 'kind' | 'src'>) => m.by === 'you' || (m.by === 'org' && (USER_KINDS as readonly string[]).includes(m.kind) && !!m.src)

/** Taska's own note to an agent (a diagram that does not draw, B714 r1181): no agent's word, nothing for you to read. */
export const taskaNote = (m: Message) => m.by === TASKA

/** You wrote after an agent's last word on it: an agent should pick it up (domain/rules.py replied; the organizer's
 * own notes and Taska's are neither side's word). */
export function replied(it: Item): boolean {
  let user = false
  for (const x of [...it.thread].reverse()) {
    if (userWord(x)) user = true
    else if (!(NOTES as readonly string[]).includes(x.by)) return user
  }
  return false
}

export const lastAgentMessage = (it: Item) => [...it.thread].reverse().find((m) => !userWord(m) && !taskaNote(m))

/** An hour without news from the agent on work in progress: its row says how long in amber (D115 #30). */
export const QUIET_WORK_MS = 3600e3

/** The latest news on work in progress (D115 #30): the start of what an agent last said there (not the organizer,
 * not a hidden or taken-back message), how long ago, and whether that is over an hour; null when none has spoken. */
export function workNews(it: Item, now: number): { text: string; age: string; quiet: boolean } | null {
  const m = [...it.thread].reverse().find((x) => !userWord(x) && x.by !== 'org' && !taskaNote(x) && x.kind !== 'withdraw' && !x.hidden)
  const text = m ? oneLine(m.text) : ''
  if (!m || !text) return null
  const ms = Math.max(0, now - Date.parse(m.t))
  const min = Math.round(ms / 60000)
  const age = min < 1 ? 'now' : min < 60 ? `${min} min` : min < 1440 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} d`
  return { text, age, quiet: ms > QUIET_WORK_MS }
}

/** The first line that says something, without Markdown marks. */
export const oneLine = (t: unknown) =>
  String(t || '')
    .split('\n')
    .map((l) =>
      l
        .replace(/^\s*(#+|>|[-*+]\s+(\(|\[)[ xX]?(\)|\])|[-*+]|\d+[.)])\s*/, '')
        .replace(/[*`]/g, '')
        .trim(),
    )
    .find(Boolean) || ''

/** Done is for open work only: a proposal is approved first, finished work accepted. */
export const canDone = (it: Item) =>
  !closed(it.status) && it.status !== 'proposed' && it.status !== 'review'

/** In the agents' queue to be done now, by the server's own rule (agent_text/work.py next_work; T728 #4): work to do
 * now, open or in progress, not waiting on you. A proposal or work in review is not in it. */
export const queuedNow = (it: Item) =>
  !it.mergedInto && !it.archived && it.when === 'now' && (WORK_TYPES as readonly string[]).includes(it.type) && (it.status === 'open' || it.status === 'doing') && !it.wait

/** The order agents take the work: now before later, in progress first; then the user's own order (rank) before
 * priority: what they never placed goes in by priority, just before the first ranked item of a lower priority. */
export function queueOrder(items: Item[]): Item[] {
  const bucket = (it: Item) => (it.when !== 'now' ? 2 : 0) + (it.status !== 'doing' ? 1 : 0)
  const out: Item[] = []
  for (const b of [0, 1, 2, 3]) {
    const mine = items.filter((it) => bucket(it) === b)
    const ranked = mine.filter((it) => it.rank != null).sort((x, y) => (x.rank as number) - (y.rank as number) || x.n - y.n)
    const rest = mine.filter((it) => it.rank == null).sort((x, y) => x.pri.localeCompare(y.pri) || x.n - y.n)
    let i = 0
    for (const r of ranked) {
      while (i < rest.length && rest[i].pri.localeCompare(r.pri) < 0) out.push(rest[i++])
      out.push(r)
    }
    out.push(...rest.slice(i))
  }
  return out
}

/** The items with open subitems, at any depth (domain/rules.py open_kids): /next does not hand those out (their
 * subitems come first). */
export function withOpenKids(items: readonly Item[]): Set<number> {
  const byN = new Map(items.map((it) => [it.n, it]))
  const out = new Set<number>()
  for (const it of items)
    if (!it.mergedInto && !closed(it.status))
      for (let p = it.parent, i = 0; p != null && i < 100; p = byN.get(p)?.parent ?? null, i++) {
        const up = byN.get(p)
        if (!up || up.mergedInto) break
        out.add(p)
      }
  return out
}

/** Waiting in the agents' queue: what /next hands out and no one is on yet: queued now, not in progress, no open
 * subitems (`kids`: withOpenKids of its project). */
export const waitsInQueue = (it: Item, kids: ReadonlySet<number> = new Set()) => queuedNow(it) && it.status === 'open' && !kids.has(it.n)

/** The items your voice note is on while its words are worked out (`inputs` with their notes' words): /next leaves
 * them until the words are in (the server holds such an input at most VOICE_HOLD). */
export const heldItems = (inputs: readonly Input[]): Set<number> =>
  new Set(inputs.filter((r) => r.files.some((f) => f.voice?.state === 'wait')).flatMap((r) => [r.scope, ...r.touched].filter((n): n is number => n != null)))

/** The item an agent on nothing yet takes next (agent_text/work.py next_work; what is in progress is another
 * session's): work in progress you replied on, resumed; else the queue's head, unless an item you replied on is as
 * urgent (by priority, then the oldest change); items your voice note is on wait (`held`). */
export function queueHead(items: Item[], held: ReadonlySet<number> = new Set()): number | undefined {
  const live = items.filter((it) => !it.mergedInto && !it.archived && !closed(it.status) && !held.has(it.n))
  const yours = live.filter(replied)
  const back = yours.filter((it) => it.status === 'doing').sort((a, b) => a.t1.localeCompare(b.t1))[0]
  if (back) return back.n
  const now = (it: Item) => +(it.when !== 'now')
  const fresh = yours.filter((it) => it.status !== 'doing').sort((a, b) => a.pri.localeCompare(b.pri) || a.t1.localeCompare(b.t1) || now(a) - now(b) || a.n - b.n)[0]
  const kids = withOpenKids(items)
  const head = queueOrder(live.filter((it) => waitsInQueue(it, kids)))[0]
  return fresh && (!head || fresh.pri <= head.pri) ? fresh.n : head?.n
}

/** What needs you, the latest change first, the Later ones under the rest. */
export const needsOrder = (a: Item, b: Item) =>
  +(a.when === 'later') - +(b.when === 'later') || (b.t1 > a.t1 ? 1 : b.t1 < a.t1 ? -1 : b.n - a.n)

export const latestFirst = (a: Item, b: Item) => String(b.t1).localeCompare(String(a.t1)) || b.n - a.n

/** The order of a list of work: the queue's order for what is not finished, then the finished, the latest first. */
export const workOrder = (all: Item[]) => [
  ...queueOrder(all.filter((it) => !closed(it.status))),
  ...all.filter((it) => closed(it.status)).sort(latestFirst),
]

export type DropHow = 'before' | 'after' | 'into' | 'out'

/** Where item `n` dragged over row `t` (at `y`, 0 at its top to 1 at its bottom) would go: before or after it in the
 * queue's order (both in the queue now), else under it; over no row, out from under its parent. Null: not there. */
export function dropOn(byN: ReadonlyMap<number, Item>, n: number, t: number | null, y: number): { n?: number; how: DropHow } | null {
  const it = byN.get(n)
  if (!it) return null
  if (t == null) return it.parent ? { how: 'out' } : null
  const to = byN.get(t)
  if (!to || t === n || closed(to.status)) return null
  for (let p = to.parent; p; p = byN.get(p)?.parent ?? null) if (p === n) return null // not under one of its own subitems
  const line = queuedNow(it) && queuedNow(to)
  return { n: t, how: line && y < 0.3 ? 'before' : line && y > 0.7 ? 'after' : 'into' }
}

/** The ranks that put item `n` before or after `t` in the queue, whatever the priorities (the priority stays). */
export function ranksFor(items: readonly Item[], byN: ReadonlyMap<number, Item>, n: number, t: number, after: boolean): { n: number; rank: number; was: number | null }[] {
  const it = byN.get(n)
  const to = byN.get(t)
  if (!it || !to) return []
  const group = queueOrder(items.filter((x) => queuedNow(x) && x.n !== n))
  group.splice(group.indexOf(to) + (after ? 1 : 0), 0, it)
  return group.map((x, i) => ({ n: x.n, rank: i, was: x.rank ?? null })).filter((p) => p.was !== p.rank)
}
