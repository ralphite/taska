// What an item needs from you, in one place (T728 #3): every state an item is in towards you (nothing, a question to
// answer, a proposal to approve, finished work to accept, the same once you replied instead, and what you decided),
// in one priority order, and what each place shows in each state: Needs you and its counts, the row's pill and the
// line under its title, the item's status mark, A (and the row's way forward), the card in the item's talk and where
// it goes there. Every place that asks what an item needs from you reads it here; nothing else decides it. The table
// in docs/item-states.md is made from this table (`needPlacesTable`, checked by a test).
//
// The state is worked out from the item (its question waiting, its status, whether you spoke last, what you decided
// and whether the agent has spoken since) by `needOf`, the one place it is. Whether it is on your list is the server's
// rule (domain/rules.py needs_you, the projects' counts): a question to answer, or a proposal or finished work you
// have not replied on, on an item that is not finished, archived or merged. Pure.

import { closed, lastAgentMessage, oneLine } from './items'
import { hasChoices } from './markdown'
import { answerOf, askRowOf } from './talk'
import { ITEM_ACTS, pastOf, type ItemActId } from './itemActs'
import type { Item, Message } from './types'
import { PLACE_WORD, STATUS_WORD } from './words'

/** Where what an item needs from you shows. */
export const NEED_PLACES = {
  list: "Needs you: the list, its counts and the projects' (the server's needs_you)",
  row: "its row in Needs you: the pill, and the line under its title",
  mark: "the item's status mark: Needs you while a question waits",
  key: "A, and the row's way forward (the desktop's first action, the phone's swipe right)",
  card: "the card in the item's talk",
} as const
export type NeedPlace = keyof typeof NEED_PLACES

/** What a decision is on: a proposal (Approve or Won't do) or finished work (Accept or Not yet). */
export type NeedOf = 'proposal' | 'work'

/** A decision's two choices (actions, model/itemActs) and how they are said, on a proposal and on finished work. */
export const DECISION = {
  proposal: { status: 'proposed', yes: { to: 'open', act: 'approve', said: 'approved' }, no: { to: 'dropped', act: 'drop' }, did: 'proposed this' },
  work: { status: 'review', yes: { to: 'done', act: 'accept', said: 'accepted' }, no: { to: 'open', act: 'not-yet' }, did: 'finished this' },
} as const satisfies Record<NeedOf, { status: string; yes: { to: string; act: ItemActId; said: string }; no: { to: string; act: ItemActId }; did: string }>

/** The row's pill in Needs you: what it does (an action, model/itemActs). */
export type NeedAct = 'answer' | 'approve' | 'accept'

/** The card in the item's talk: the question (its choices, or ↓ Answer below; Approve or Accept beside it on a
 * proposal or finished work); a decision's two buttons; Skipped · you replied with Approve or Accept still to press;
 * the decision made, faded in place (r1003); or none of its own (`onQuestion`: Approve or Accept, or what you chose,
 * stays on the card of the question you answered). */
export type NeedCard = 'question' | 'decide' | 'replied' | 'decided' | 'onQuestion'

interface StateDef {
  label: string
  /** on your list (on an item still open, not archived, not merged) */
  listed: boolean
  /** the row's pill */
  row: NeedAct | null
  /** the item's status mark says Needs you */
  mark: boolean
  /** A: answer the question, or take the decision's yes (Approve, Accept) */
  key: 'answer' | 'decide' | null
  card: NeedCard | null
}

/** Every state, in the order they are worked out: the first that holds is the item's. */
export const NEED_STATES = {
  // an agent's question you have not answered (your words on the item or a comment on its documents answer it)
  answer: { label: 'A question to answer', listed: true, row: 'answer', mark: true, key: 'answer', card: 'question' },
  // proposed or in review, and you have not spoken since the agent did
  approve: { label: 'A proposal to approve', listed: true, row: 'approve', mark: false, key: 'decide', card: 'decide' },
  accept: { label: 'Finished work to accept', listed: true, row: 'accept', mark: false, key: 'decide', card: 'decide' },
  // proposed or in review, the agent's latest word a question with choices you answered: its card holds Approve or
  // Accept, where it was
  onAnswer: { label: 'Answered; Approve or Accept on the question', listed: false, row: null, mark: false, key: 'decide', card: 'onQuestion' },
  // proposed or in review, and you replied instead of deciding: off your list, Approve or Accept still to press
  replied: { label: 'You replied instead of deciding', listed: false, row: null, mark: false, key: 'decide', card: 'replied' },
  // you decided, and the agent has not spoken since: the card keeps its place and its buttons, done (r1003)
  decided: { label: 'Decided', listed: false, row: null, mark: false, key: null, card: 'decided' },
  decidedOnAnswer: { label: 'Decided on the question you answered', listed: false, row: null, mark: false, key: null, card: 'onQuestion' },
  none: { label: 'Nothing', listed: false, row: null, mark: false, key: null, card: null },
} as const satisfies Record<string, StateDef>

export type NeedState = keyof typeof NEED_STATES
export const NEED_STATE_LIST = Object.keys(NEED_STATES) as NeedState[]

export type Decided = NonNullable<Item['decided']>

/** What an item needs from you, worked out once. */
export interface Need {
  state: NeedState
  /** what the decision is (or was) on; null: none */
  of: NeedOf | null
  /** the message its card holds: the question, the agent's proposal or report, what you decided on */
  msg: Message | null
  /** beside the question (`question`, `onQuestion`) or Skipped (`replied`): Approve or Accept to press, what you chose, or nothing */
  keep: 'decide' | 'decided' | null
  /** what you decided, while it still shows */
  dec: Decided | null
}

const ofStatus = (s: string): NeedOf | null => (s === 'proposed' ? 'proposal' : s === 'review' ? 'work' : null)

/** Not finished, not archived, not merged: what it needs from you can be on your list. */
const live = (it: Item) => !it.mergedInto && !it.archived && !closed(it.status)

/** Your decision still shows (the agent has not spoken since). */
function stillDecided(it: Item): Decided | null {
  const dec = it.decided
  if (!dec || it.status === dec.from || !ofStatus(dec.from)) return null
  return (lastAgentMessage(it)?.id ?? null) === dec.msg ? dec : null
}

/** The agent's latest word is a question with choices you answered (`going`: an answer to it on its way). */
function answeredLast(it: Item, going?: string | null) {
  const x = lastAgentMessage(it)
  return !!x && x.kind === 'ask' && hasChoices(x.text) && !!answerOf(it.thread, x, going)?.length
}

const choicesAsk = (x: Message | undefined) => !!x && x.kind === 'ask' && hasChoices(x.text)

/** What `it` needs from you (`going`: an answer to its latest question on its way): the one place it is worked out. */
export function needOf(it: Item, going?: string | null): Need {
  const of = ofStatus(it.status)
  const dec = stillDecided(it)
  const need = (state: NeedState, msg: Message | null, o: NeedOf | null = of, keep: Need['keep'] = null): Need => ({ state, of: o, msg, keep, dec })
  if (it.wait) {
    const w = it.wait
    const msg = it.thread.find((x) => x.id === w.id) || ({ ...w, t: '', src: null } as Message)
    return need('answer', msg, of ?? (dec ? ofStatus(dec.from) : null), of ? 'decide' : dec ? 'decided' : null)
  }
  const last = lastAgentMessage(it) || null
  if (of && !it.talked) return need(of === 'proposal' ? 'approve' : 'accept', last)
  if (of && answeredLast(it, going)) return need('onAnswer', null, of, 'decide')
  if (of) return need('replied', last, of, 'decide')
  if (dec) {
    const x = it.thread.find((y) => y.id === dec.msg)
    const o = ofStatus(dec.from)
    if (!choicesAsk(x)) return need('decided', x ?? null, o)
    if (answeredLast(it)) return need('decidedOnAnswer', null, o, 'decided')
  }
  return need('none', null, null)
}

/** On your list of what needs you (and in its counts): the server's needs_you. */
export const needsYou = (it: Item) => live(it) && NEED_STATES[needOf(it).state].listed

/** An item's status as the page shows it: "Needs you" while an agent's question waits on you, else its status. */
export const shownStatus = (it: Item): { s: string; label: string } =>
  live(it) && NEED_STATES[needOf(it).state].mark ? { s: 'wait', label: PLACE_WORD.wait } : { s: it.status, label: STATUS_WORD[it.status] }

/** Its row in Needs you: the pill (what it does, its word) and the line under the title (the question, or what the
 * agent said last); null: it has no row there. */
export function needRow(it: Item): { act: NeedAct; word: string; line: string } | null {
  const n = needOf(it)
  const act = NEED_STATES[n.state].row
  if (!act) return null
  const line = n.state === 'answer' ? it.wait?.text : n.state === 'approve' ? n.msg?.text || it.body : n.msg?.text
  return { act, word: ITEM_ACTS[act].label, line: oneLine(line) }
}

/** A: the item's next step for you: answer what waits (on its first choice, or in the box), or take the decision's
 * yes (the status it sets, the button's word, how it is said done). */
export type YourStep = { set: readonly [field: 'status', value: string, act: ItemActId, said: string] } | { answer: 'choices' | 'words' } | null

export function yourStep(it: Item): YourStep {
  const n = needOf(it)
  const key = NEED_STATES[n.state].key
  if (key === 'answer') return { answer: it.wait && it.wait.kind === 'ask' && hasChoices(it.wait.text) ? 'choices' : 'words' }
  if (key === 'decide' && n.of) {
    const { yes } = DECISION[n.of]
    return { set: ['status', yes.to, yes.act, yes.said] }
  }
  return null
}

/** Where the card goes in the item's talk, and which messages show (`going`: an answer on its way). */
export function talkPlan(it: Item, opts: { going?: string | null } = {}) {
  const n = needOf(it, opts.going)
  const card = NEED_STATES[n.state].card
  // questions in a row are one card, where the last of them is (B749)
  const cardId = card && card !== 'onQuestion' ? (card === 'question' ? askRowOf(it.thread, n.msg?.id)?.at(-1)?.id : null) ?? n.msg?.id ?? null : null
  const thread = it.thread.filter((x) => x.id !== it.wait?.id || x.id === cardId)
  // a card with no message of its own heads the talk once you said something (all of it came after the card)
  const first = cardId == null && !lastAgentMessage(it) && (it.talked || thread.length > 0)
  const at = thread.findIndex((x) => x.id === cardId)
  // the whole talk shows, from its first message (F692: no "Show earlier")
  return { cardId, thread, first, inline: at >= 0 }
}

/** What you chose: its button's action. */
export function chosenAct(d: Decided): ItemActId {
  const x = DECISION[d.from === 'proposed' ? 'proposal' : 'work']
  return d.to === x.yes.to ? x.yes.act : x.no.act
}

/** What you chose, said as done: Approved, Accepted, Declined, Sent back. */
export const decidedWord = (d: Decided) => pastOf(chosenAct(d))

// ---------------------------------------------------------------- the table (docs/item-states.md)

const CARD_CELL: Record<NeedCard, string> = {
  question: 'the question (Approve or Accept beside it)',
  decide: "Won't do · Approve, or Not yet · Accept",
  replied: 'Skipped · you replied, Approve or Accept',
  decided: 'faded in place, what you chose said as done',
  onQuestion: "none: Approve or Accept (or what you chose) on the answered question's card",
}

/** What each place shows in each state, as a Markdown table; —: nothing. */
export function needPlacesTable(): string {
  const cell = (s: NeedState, place: NeedPlace) => {
    const d: StateDef = NEED_STATES[s]
    if (place === 'list') return d.listed ? 'yes' : '—'
    if (place === 'row') return d.row ? ITEM_ACTS[d.row].label : '—'
    if (place === 'mark') return d.mark ? 'Needs you' : '—'
    if (place === 'key') return d.key === 'answer' ? ITEM_ACTS.answer.label : d.key === 'decide' ? (d.row ? ITEM_ACTS[d.row].label : 'Approve / Accept') : '—'
    if (d.card === 'decide') {
      const x = DECISION[s === 'approve' ? 'proposal' : 'work']
      return `${ITEM_ACTS[x.no.act].label} · ${ITEM_ACTS[x.yes.act].label}`
    }
    return d.card ? CARD_CELL[d.card] : '—'
  }
  const places = Object.keys(NEED_PLACES) as NeedPlace[]
  return [
    `| State | ${places.map((p) => NEED_PLACES[p]).join(' | ')} |`,
    `|---|${places.map(() => '---').join('|')}|`,
    ...NEED_STATE_LIST.map((s) => `| ${NEED_STATES[s].label} (\`${s}\`) | ${places.map((p) => cell(s, p)).join(' | ')} |`),
  ].join('\n')
}
