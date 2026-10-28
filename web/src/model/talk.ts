// An item's talk, read for the page: which message the card that waits on you holds, what you decided, what you
// answered a question with, the versions of something you edited, the questions taken back, who read your words.
// Pure: from the item (and an answer still on its way, when there is one).

import { lastAgentMessage, userWord } from './items'
import { hasChoices, ticks } from './markdown'
import type { Item, Message } from './types'

/** The message the card that waits on you shows: the question, or the agent's report or proposal. */
export const cardMessage = (it: Item): Message | null =>
  it.wait
    ? it.thread.find((x) => x.id === it.wait?.id) || ({ ...it.wait, t: '', src: null } as Message)
    : (it.status === 'review' || it.status === 'proposed') && !it.talked
      ? lastAgentMessage(it) || null
      : null

/** The message the item page's card holds: the card's, and the agent's report or proposal still once you replied
 * instead of deciding (the card stays where it was, and your words follow). */
export const heldMessage = (it: Item): Message | null =>
  cardMessage(it) ?? (it.status === 'review' || it.status === 'proposed' ? lastAgentMessage(it) || null : null)

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

/** The item's latest word from an agent is a question you answered: its card holds the item's Approve/Accept. */
export const answeredLast = (it: Item, going?: string | null) => {
  const x = lastAgentMessage(it)
  return !!x && x.kind === 'ask' && hasChoices(x.text) && !!answerOf(it.thread, x, going)?.length
}

/** What you decided on a proposal or on finished work, while it is still the latest word (the agent has not spoken
 * since); a question with choices you answered keeps its own card instead. */
export function decidedCard(it: Item): { dec: NonNullable<Item['decided']>; x: Message | undefined } | null {
  const dec = it.decided
  if (!dec || it.status === dec.from || it.wait) return null
  if ((lastAgentMessage(it)?.id ?? null) !== dec.msg) return null
  const x = it.thread.find((y) => y.id === dec.msg)
  if (x && x.kind === 'ask' && hasChoices(x.text)) return null
  return { dec, x }
}

/** What you chose, in the words of its button. */
export const chosenWord = (d: NonNullable<Item['decided']>) =>
  d.from === 'proposed' ? (d.to === 'dropped' ? "Won't do" : 'Approve') : d.to === 'done' ? 'Accept' : 'Not yet'

/** Your decision still shows on the item (the agent has not spoken since). */
export const decidedStill = (it: Item) =>
  !!it.decided &&
  it.status !== it.decided.from &&
  (lastAgentMessage(it)?.id ?? null) === it.decided.msg &&
  (it.decided.from === 'proposed' || it.decided.from === 'review')

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

/** The questions and blocks an agent took back (a withdraw after them, nothing of yours in between). */
export function withdrawn(thread: readonly Message[]): Set<number> {
  const gone = new Set<number>()
  thread.forEach((x, i) => {
    if (x.kind !== 'withdraw') return
    const q = thread
      .slice(0, i)
      .reverse()
      .find((y) => y.kind === 'ask' || y.kind === 'block' || userWord(y))
    if (q && !userWord(q)) gone.add(q.id)
  })
  return gone
}

/** Your latest words, read by agents since and not answered yet: who, and the latest read (ms). */
export function readMark(it: Item): { id: number; names: string[]; t: number } | null {
  const th = it.thread
  const mine = th.findLastIndex((x) => x.by === 'you')
  const theirs = th.findLastIndex((x) => x.by !== 'you' && x.by !== 'org')
  if (mine < 0 || mine <= theirs || !it.readBy) return null
  const t = Date.parse(th[mine].t)
  const readers = Object.entries(it.readBy)
    .filter(([, ms]) => ms >= t)
    .sort((a, b) => b[1] - a[1])
  return readers.length ? { id: th[mine].id, names: readers.map(([n]) => n), t: readers[0][1] } : null
}

/** Where the card that waits on you goes in the talk, and how much of the talk shows. */
export function talkPlan(it: Item, opts: { all: boolean; going?: string | null }) {
  const shown = heldMessage(it)
  const decided = decidedCard(it)?.dec.msg ?? null
  const cardId = it.wait?.id ?? (answeredLast(it, opts.going) ? null : shown?.id) ?? decided ?? null
  const thread = it.thread.filter((x) => x.id !== it.wait?.id || x.id === cardId)
  // a card with no message of its own heads the talk once you said something (all of it came after the card)
  const first = cardId == null && !lastAgentMessage(it) && (it.talked || thread.length > 0)
  const at = thread.findIndex((x) => x.id === cardId)
  // the card is never folded away with the earlier messages, or it would come after what came later
  const hidden = opts.all || first ? 0 : Math.max(0, Math.min(thread.length - 8, at < 0 ? thread.length : at))
  return { cardId, thread, first, inline: at >= 0, hidden }
}
