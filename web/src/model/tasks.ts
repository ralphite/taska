// The page's rules about tasks, as pure functions: what Done applies to, the order agents take the work, where a
// dragged row goes (what a task needs from you is model/needStates). They agree with the server's (domain/rules.py), which the page cannot ask at every
// keystroke: a change you make shows at once, before the server has it.

import type { Input, Task, Message, Status } from './types'
import { CLOSED, NOTES, TASKA, USER_KINDS } from './vocab.gen'
import { ago } from './time'
import { STATUS_WORD } from './words'

export const closed = (s: Status | string) => (CLOSED as readonly string[]).includes(s)

/** The statuses a task can be set to, in the menu's order: [status, word][] */
export const statusChoices = (_it: Task): [string, string][] => Object.entries(STATUS_WORD) as [string, string][]

export const statusWord = (it: Task) => STATUS_WORD[it.status]

/** The user's own words on a task: theirs, or what the organizer filed there from one of their inputs (domain/rules.py
 * user_word). */
export const userWord = (m: Pick<Message, 'by' | 'kind' | 'src'>) => m.by === 'you' || (m.by === 'org' && (USER_KINDS as readonly string[]).includes(m.kind) && !!m.src)

/** Taska's own note to an agent (a diagram that does not draw, T714 r1181): no agent's word, nothing for you to read. */
export const taskaNote = (m: Message) => m.by === TASKA

/** You wrote after an agent's last word on it: an agent should pick it up (domain/rules.py replied; the organizer's
 * own notes and Taska's are neither side's word). */
export function replied(it: Task): boolean {
  let user = false
  for (const x of [...it.thread].reverse()) {
    if (userWord(x)) user = true
    else if (!(NOTES as readonly string[]).includes(x.by)) return user
  }
  return false
}

export const lastAgentMessage = (it: Task) => [...it.thread].reverse().find((m) => !userWord(m) && !taskaNote(m))

/** An hour without news from the agent on work in progress: its row says how long in amber (D115 #30). */
export const QUIET_WORK_MS = 3600e3

/** The latest news on work in progress (D115 #30): the start of what an agent last said there (not the organizer,
 * not a hidden or taken-back message), how long ago, and whether that is over an hour; null when none has spoken. */
export function workNews(it: Task, now: number): { text: string; age: string; quiet: boolean } | null {
  const m = [...it.thread].reverse().find((x) => !userWord(x) && x.by !== 'org' && !taskaNote(x) && x.kind !== 'withdraw' && !x.hidden)
  const text = m ? oneLine(m.text) : ''
  if (!m || !text) return null
  return { text, age: ago(m.t, now, 'short'), quiet: now - Date.parse(m.t) > QUIET_WORK_MS }
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
export const canDone = (it: Task) =>
  !closed(it.status) && it.status !== 'proposed' && it.status !== 'review'

/** In the agents' queue to be done now, by the server's own rule (agent_text/work.py next_work; T728 #4): work to do
 * now, open or in progress, not waiting on you. A proposal or work in review is not in it. */
export const queuedNow = (it: Task) =>
  !it.mergedInto && !it.archived && it.when === 'now' && !it.group && (it.status === 'open' || it.status === 'doing') && !it.wait

/** The order agents take the work: now before later, in progress first; then the user's own order (rank) before
 * priority: what they never placed goes in by priority, just before the first ranked task of a lower priority. */
const bucket = (it: Task) => (it.when !== 'now' ? 2 : 0) + (it.status !== 'doing' ? 1 : 0)

export function queueOrder(tasks: Task[]): Task[] {
  const out: Task[] = []
  for (const b of [0, 1, 2, 3]) {
    const mine = tasks.filter((it) => bucket(it) === b)
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

/** The tasks with open subtasks, at any depth (domain/rules.py open_kids): /next does not hand those out (their
 * subtasks come first). */
export function withOpenKids(tasks: readonly Task[]): Set<number> {
  const byN = new Map(tasks.map((it) => [it.n, it]))
  const out = new Set<number>()
  for (const it of tasks)
    if (!it.mergedInto && !closed(it.status))
      for (let p = it.parent, i = 0; p != null && i < 100; p = byN.get(p)?.parent ?? null, i++) {
        const up = byN.get(p)
        if (!up || up.mergedInto) break
        out.add(p)
      }
  return out
}

/** Waiting in the agents' queue: what /next hands out and no one is on yet: queued now, not in progress, no open
 * subtasks (`kids`: withOpenKids of its project). */
export const waitsInQueue = (it: Task, kids: ReadonlySet<number> = new Set()) => queuedNow(it) && it.status === 'open' && !kids.has(it.n)

/** The tasks your voice note is on while its words are worked out (`inputs` with their notes' words): /next leaves
 * them until the words are in (the server holds such an input at most VOICE_HOLD). */
export const heldTasks = (inputs: readonly Input[]): Set<number> =>
  new Set(inputs.filter((r) => r.files.some((f) => f.voice?.state === 'wait')).flatMap((r) => [r.scope, ...r.touched].filter((n): n is number => n != null)))

/** The task an agent on nothing yet takes next (agent_text/work.py next_work; what is in progress is another
 * session's): work in progress you replied on, resumed; else the queue's head, unless a task you replied on is as
 * urgent (by priority, then the oldest change); tasks your voice note is on wait (`held`). */
export function queueHead(tasks: Task[], held: ReadonlySet<number> = new Set()): number | undefined {
  const live = tasks.filter((it) => !it.mergedInto && !it.archived && !closed(it.status) && !held.has(it.n))
  const yours = live.filter(replied)
  const back = yours.filter((it) => it.status === 'doing').sort((a, b) => a.t1.localeCompare(b.t1))[0]
  if (back) return back.n
  const now = (it: Task) => +(it.when !== 'now')
  const fresh = yours.filter((it) => it.status !== 'doing').sort((a, b) => a.pri.localeCompare(b.pri) || a.t1.localeCompare(b.t1) || now(a) - now(b) || a.n - b.n)[0]
  const kids = withOpenKids(tasks)
  const head = queueOrder(live.filter((it) => waitsInQueue(it, kids)))[0]
  return fresh && (!head || fresh.pri <= head.pri) ? fresh.n : head?.n
}

/** What needs you, the latest change first, the Later ones under the rest. */
export const needsOrder = (a: Task, b: Task) =>
  +(a.when === 'later') - +(b.when === 'later') || (b.t1 > a.t1 ? 1 : b.t1 < a.t1 ? -1 : b.n - a.n)

export const latestFirst = (a: Task, b: Task) => String(b.t1).localeCompare(String(a.t1)) || b.n - a.n

/** The order of a list of work: the queue's order for what is not finished, then the finished, the latest first. */
export const workOrder = (all: Task[]) => [
  ...queueOrder(all.filter((it) => !closed(it.status))),
  ...all.filter((it) => closed(it.status)).sort(latestFirst),
]

export type DropHow = 'before' | 'after' | 'into' | 'out'

/** Two tasks the list puts in order among themselves: both unfinished and in one group of the work order (now or
 * later, in progress or not), whatever their status: in review too (T754, Yadong r1258). */
export const inLine = (a: Task, b: Task) =>
  [a, b].every((it) => !it.mergedInto && !it.archived && !closed(it.status)) && bucket(a) === bucket(b)

/** Where task `n` dragged over row `t` (at `y`, 0 at its top to 1 at its bottom) would go: before or after it in the
 * work order (both in one group of it, and the list shows that order: `ordered`), else under it; over no row, out
 * from under its parent. Null: not there. */
export function dropOn(byN: ReadonlyMap<number, Task>, n: number, t: number | null, y: number, ordered = true): { n?: number; how: DropHow } | null {
  const it = byN.get(n)
  if (!it) return null
  if (t == null) return it.parent ? { how: 'out' } : null
  const to = byN.get(t)
  if (!to || t === n || closed(to.status)) return null
  for (let p = to.parent; p; p = byN.get(p)?.parent ?? null) if (p === n) return null // not under one of its own subtasks
  const line = ordered && inLine(it, to)
  return { n: t, how: line && y < 0.3 ? 'before' : line && y > 0.7 ? 'after' : 'into' }
}

/** The ranks that put task `n` before or after `t` in their group of the work order, whatever the priorities (the
 * priority stays). */
export function ranksFor(tasks: readonly Task[], byN: ReadonlyMap<number, Task>, n: number, t: number, after: boolean): { n: number; rank: number; was: number | null }[] {
  const it = byN.get(n)
  const to = byN.get(t)
  if (!it || !to) return []
  const group = queueOrder(tasks.filter((x) => x.n !== n && inLine(x, to)))
  group.splice(group.indexOf(to) + (after ? 1 : 0), 0, it)
  return group.map((x, i) => ({ n: x.n, rank: i, was: x.rank ?? null })).filter((p) => p.was !== p.rank)
}

/** The project's tags (T855): every tag on its tasks, the most used first, then by name. */
export function projectTags(tasks: readonly Task[]): string[] {
  const count = new Map<string, number>()
  for (const it of tasks) if (!it.mergedInto) for (const t of it.tags) count.set(t, (count.get(t) ?? 0) + 1)
  return [...count.keys()].sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0) || a.localeCompare(b))
}

/** A task's tags with `t` put on, or taken off when it has it. */
export const toggledTag = (tags: readonly string[], t: string) => (tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])

/** The tasks it waits for that are not finished (T857: rules.waits_for), a merged one followed to where it went. */
export function waitsFor(byN: ReadonlyMap<number, Task>, it: Task): Task[] {
  const out: Task[] = []
  for (const n of it.after ?? []) {
    let w = byN.get(n)
    for (let i = 0; w?.mergedInto && i < 50; i++) w = byN.get(w.mergedInto)
    if (w && !closed(w.status) && !out.includes(w)) out.push(w)
  }
  return out
}

/** The unfinished tasks that wait for it (T857: rules.holds_up). */
export const holdsUp = (tasks: readonly Task[], it: Task) => tasks.filter((k) => !k.mergedInto && (k.after ?? []).includes(it.n) && !closed(k.status))
