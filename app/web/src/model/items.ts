// The page's rules about items, as pure functions: what needs you, what an item's state shows as, its next action,
// the order agents take the work. They agree with the server's (domain/rules.py), which the page cannot ask at every
// keystroke: a change you make shows at once, before the server has it.

import type { Item, Message, Status } from './types'
import { PLACE_WORD, RULE_STATUS_WORD, STATUS_WORD } from './words'

export const closed = (s: Status | string) => s === 'done' || s === 'dropped'

/** Waits on the user: an agent asks or is blocked, or it waits for approval or acceptance and the user has not
 * replied since. Archived items are off the list, so off the counts too. */
export const needsYou = (it: Item) =>
  !it.mergedInto &&
  !it.archived &&
  !closed(it.status) &&
  (!!it.wait || ((it.status === 'proposed' || it.status === 'review') && !it.talked))

const asksYou = (it: Item) => needsYou(it) && !!it.wait

/** The statuses an item can be set to, in the menu's order (a rule is proposed only while it is): [status, word][] */
export const statusChoices = (it: Item): [string, string][] =>
  it.type === 'rule' ? (Object.entries(RULE_STATUS_WORD) as [string, string][]).filter(([v]) => v !== 'proposed' || it.status === 'proposed') : (Object.entries(STATUS_WORD) as [string, string][])

export const statusWord = (it: Item) =>
  (it.type === 'rule' ? RULE_STATUS_WORD[it.status] : STATUS_WORD[it.status]) || STATUS_WORD[it.status]

/** An item's status as the page shows it: "Needs you" while an agent's question or block waits on you. */
export const shownStatus = (it: Item): { s: string; label: string } =>
  asksYou(it) ? { s: 'wait', label: PLACE_WORD.wait } : { s: it.status, label: statusWord(it) }

/** The user's own words on an item: theirs, or what the organizer filed there from one of their inputs. */
export const userWord = (m: Message) =>
  m.by === 'you' || (m.by === 'org' && ['say', 'decide', 'propose'].includes(m.kind) && !!m.src)

export const lastAgentMessage = (it: Item) => [...it.thread].reverse().find((m) => !userWord(m))

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

/** What a row that waits on you says in its second line: the question, or what the agent said last. */
export const excerpt = (it: Item) =>
  oneLine(it.wait ? it.wait.text : it.status === 'review' ? lastAgentMessage(it)?.text : lastAgentMessage(it)?.text || it.body)

export type NeedAction = 'answer' | 'approve' | 'accept'
export const rowAction = (it: Item): [NeedAction, string] =>
  it.wait ? ['answer', 'Answer'] : it.status === 'proposed' ? ['approve', 'Approve'] : ['accept', 'Accept']

/** Done is for open work only: a proposal is approved first, finished work accepted. */
export const canDone = (it: Item) =>
  it.type !== 'rule' && !closed(it.status) && it.status !== 'proposed' && it.status !== 'review'

/** In the agents' queue: not waiting on you, not finished, not archived, not a rule. */
export const inQueue = (it: Item) => !it.mergedInto && !it.archived && it.type !== 'rule' && !needsYou(it) && !closed(it.status)

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

/** The item an agent takes next. */
export const queueHead = (items: Item[]) =>
  queueOrder(items.filter((it) => inQueue(it) && it.when === 'now' && it.status !== 'doing'))[0]?.n

/** What needs you, the latest change first, the Later ones under the rest. */
export const needsOrder = (a: Item, b: Item) =>
  +(a.when === 'later') - +(b.when === 'later') || (b.t1 > a.t1 ? 1 : b.t1 < a.t1 ? -1 : b.n - a.n)

export const latestFirst = (a: Item, b: Item) => String(b.t1).localeCompare(String(a.t1)) || b.n - a.n

/** The order of a list of work: the queue's order for what is not finished, then the finished, the latest first. */
export const workOrder = (all: Item[]) => [
  ...queueOrder(all.filter((it) => !closed(it.status))),
  ...all.filter((it) => closed(it.status)).sort(latestFirst),
]

/** In the agents' queue to be done now. */
export const queuedNow = (it: Item) => inQueue(it) && it.when === 'now'

export type DropHow = 'before' | 'after' | 'into' | 'out'

/** Where item `n` dragged over row `t` (at `y`, 0 at its top to 1 at its bottom) would go: before or after it in the
 * queue's order (both in the queue now), else under it; over no row, out from under its parent. Null: not there. */
export function dropOn(byN: ReadonlyMap<number, Item>, n: number, t: number | null, y: number): { n?: number; how: DropHow } | null {
  const it = byN.get(n)
  if (!it) return null
  if (t == null) return it.parent ? { how: 'out' } : null
  const to = byN.get(t)
  if (!to || t === n || to.type === 'rule' || closed(to.status)) return null
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
