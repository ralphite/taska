// What the foot of the project page says, worked out from the project and where you are: what the box writes to now
// (its line on top, its placeholder, what Send says, what a comment from it goes to) and the line over the box about
// what you sent last. Pure, so it is tested alone and the containers only connect it.

import { becameOf, type Became } from './became'
import { INPUT_STATES, actsIn, becameText, showsIn, type InputAct } from './inputStates'
import { allComments, docTarget, type DocTarget } from './docs'
import { ticksNotSent, type TickState } from './docTicks'
import { draftName, draftTarget } from './draftTarget'
import { oneLine } from './items'
import { plainQuote } from './markdown'
import { codeOf, liveN, type ProjectModel } from './project'
import type { Route } from './route'
import type { Input } from './types'
import { vcCount } from './voiceComments'
import { inputCode, plural } from './words'
import { outgoingLine, type Outgoing } from './outgoing'
import { outgoingIn, showsOnItsWay, type OutShow } from './outgoingStates'
import { docName, placeDoc } from './rules'

/** a button at the line's right */
export type BoxRight =
  /** an x: stop what the box is in (`act: 'stop'`), let go of what is picked in the document, or let go of the
   * comments written in the box (`act: 'discard'`, Undo brings them back) */
  | { kind: 'x'; label: string; act: 'stop' | 'unpick' | 'discard' }
  /** choices ticked in the document: Send choices, and an x that clears them */
  | { kind: 'ticks' }
  /** the phone's document: reply to its item instead */
  | { kind: 'to-item'; code: string }

/** The line on top of the box: what it writes to, when that needs saying. */
export interface BoxLine {
  icon: 'pencil' | 'reply' | 'comment' | 'check' | 'plus' | 'newinput' | 'mic'
  label: string
  detail?: string
  /** the detail shows only in a box wide enough */
  wideOnly?: boolean
  right?: BoxRight
  /** a line with a button of its own drops its icon in a narrow box, so its words are whole */
  tight?: boolean
}

/** What a comment from the box goes to: what is picked in the document, or (the phone) the whole document. */
export type DocAim = { d: number; target: DocTarget } | null

/** What the box is in: an edit of something you said or details added to it, a correction of a voice note's words,
 * an edit of a comment of yours, the transcription preferences (none: it writes what it writes to). */
export type BoxMode =
  | { kind: 'amend'; id: string; mode: 'edit' | 'append'; v: number; /** its words when the edit began */ base?: string }
  /** words of a voice note's input being corrected (`v`: the input's version); `bySel`: started from a selection */
  | { kind: 'correct'; id: string; wrong: string; v: number; bySel?: boolean }
  /** a comment of yours on a document, being edited */
  | { kind: 'comment'; d: number; id: number; was: string }
  /** the transcription preferences, being edited (every project's) */
  | { kind: 'prefs'; was: string }
  | null

export interface BoxRole {
  aim: DocAim
  /** the item it replies on */
  scope: string | null
  /** the document whose box it is */
  doc: number | null
  line: BoxLine | null
  /** choices ticked in the document that wait while something else is picked: their own line, over it (D83 #4) */
  waiting?: BoxLine
  placeholder: string
  send: string
}

type ProjectPlace = Extract<Route, { page: 'project' }>

const stop = (label: string): BoxRight => ({ kind: 'x', label, act: 'stop' })

/** What the box writes to now: the open item, a document's comment or reply, what it is in (an edit, a correction,
 * the preferences), or a new input. */
export function boxRole(m: ProjectModel | null, route: ProjectPlace, desk: boolean, title: string, mode: BoxMode, pick: Parameters<typeof docTarget>[1], ticks: TickState): BoxRole {
  // the item open, or the one whose document is open (nothing picked in it, the box replies on the item)
  const place = route.place
  const dn = placeDoc(route, m)
  const docOf = dn != null ? m?.docs.find((x) => x.d === dn) : undefined
  const open = place.kind === 'item' ? m?.byN.get(Number(/\d+/.exec(place.ref)?.[0])) : docOf && m ? m.byN.get(liveN(m, docOf.n)) : undefined
  const none = { aim: null as DocAim }
  if (mode?.kind === 'prefs') {
    const line: BoxLine = { icon: 'pencil', label: 'Edit transcription preferences', detail: '· all projects', right: stop('Stop editing') }
    return { ...none, scope: null, doc: null, line, placeholder: 'How should voice notes be transcribed?', send: 'Save' }
  }
  if (mode?.kind === 'correct') {
    // the line says before and after as you type (shownLine adds what you typed)
    const line: BoxLine = { icon: 'pencil', label: `Correct “${mode.wrong}”`, detail: `in ${inputCode(mode.id)} · all projects`, right: stop('Stop correcting') }
    return { ...none, scope: null, doc: null, line, placeholder: 'Write…', send: 'Save' }
  }
  if (mode?.kind === 'comment') {
    // what it is about (its words are in the box)
    const dc = m?.docs.find((x) => x.d === mode.d)
    const cm = dc ? allComments(dc).find((c) => c.id === mode.id) : undefined
    const about = oneLine(plainQuote(cm?.quote || (cm && dc?.blocks.find((b) => b.key === cm.key)?.text) || ''))
    const line: BoxLine = { icon: 'pencil', label: `Edit comment on D${mode.d}`, detail: about ? `“${about.slice(0, 120)}”` : '', right: stop('Stop editing') }
    return { ...none, scope: null, doc: null, line, placeholder: 'Write…', send: 'Save' }
  }
  const dt = docOf && !mode ? docTarget(docOf, pick) : null
  const waiting = docOf && !mode ? ticksNotSent(ticks, docOf) : ''
  const ticksLine = (d: number): BoxLine => ({ icon: 'check', label: waiting, detail: `· D${d}`, wideOnly: true, tight: true, right: { kind: 'ticks' } })
  if (docOf && dt) {
    const line: BoxLine = {
      icon: dt.reply ? 'reply' : 'comment',
      label: `${dt.reply ? 'Reply in' : 'Comment on'} ${docOf.kind === 'rules' && /^p\d+$/.test(dt.key) ? 'the proposal' : docName(docOf)}`,
      detail: (dt.many || 0) > 1 ? `· ${dt.many} paragraphs` : dt.quote ? `“${plainQuote(dt.quote).slice(0, 120)}”` : '',
      right: { kind: 'x', label: 'Cancel · Esc', act: 'unpick' },
    }
    return { aim: { d: docOf.d, target: dt }, scope: null, doc: docOf.d, line, ...(waiting ? { waiting: ticksLine(docOf.d) } : {}), placeholder: 'Write…', send: dt.reply ? 'Reply' : 'Comment' }
  }
  if (docOf && waiting) {
    // choices ticked in the document wait; they go only with this line's Send choices
    const line = ticksLine(docOf.d)
    const host = m ? liveN(m, docOf.n) : null
    const reply = desk && host != null && m ? codeOf(m, host) : null
    return reply
      ? { ...none, scope: reply, doc: docOf.d, line, placeholder: `Reply to ${reply}…`, send: 'Send' }
      : { aim: { d: docOf.d, target: { key: 'doc', quote: '' } }, scope: null, doc: docOf.d, line, placeholder: `Comment on D${docOf.d}…`, send: 'Comment' }
  }
  if (docOf && !mode && docOf.kind === 'rules') {
    // the rules, nothing picked: the box comments on them, desktop and phone alike (F706, r1145, r1146)
    return { aim: { d: docOf.d, target: { key: 'doc', quote: '' } }, scope: null, doc: docOf.d, line: null, placeholder: 'Comment on the rules…', send: 'Comment' }
  }
  if (docOf && !desk && !mode) {
    // the phone, nothing picked: a comment on the whole document (Reply to its item instead)
    const host = m ? liveN(m, docOf.n) : null
    const line: BoxLine = { icon: 'comment', label: `Comment on D${docOf.d}`, detail: '· or tap a part', ...(host != null && m?.byN.has(host) ? { right: { kind: 'to-item', code: codeOf(m, host) } } : {}) }
    return { aim: { d: docOf.d, target: { key: 'doc', quote: '' } }, scope: null, doc: docOf.d, line, placeholder: `Comment on D${docOf.d}…`, send: 'Comment' }
  }
  if (mode?.kind === 'amend' && m?.byId.has(mode.id)) {
    const r = m.byId.get(mode.id) as Input
    const edit = mode.mode === 'edit'
    const said = oneLine(r.text)
    const line: BoxLine = {
      icon: edit ? 'pencil' : 'plus',
      label: `${edit ? 'Edit' : 'Add to'} ${inputCode(mode.id)}`,
      // editing: its words are in the box; adding to it: what it said
      detail: edit ? '' : said ? `“${said.slice(0, 120)}”` : '',
      right: stop(edit ? 'Stop editing' : 'Stop adding'),
    }
    return { ...none, scope: open && m ? codeOf(m, open.n) : null, doc: null, line, placeholder: 'Write…', send: 'Save' }
  }
  // a document open, nothing picked (the desktop): a reply to its item, written in the document's own draft
  if (open && m) return { ...none, scope: codeOf(m, open.n), doc: docOf ? docOf.d : null, line: null, placeholder: `Reply to ${codeOf(m, open.n)}…`, send: 'Send' }
  // a new input: no line, the New input page's head says what it is (Yadong, r583 and r1092: that line is gone)
  return { ...none, scope: null, doc: null, line: null, placeholder: m ? `Write to ${title}…` : 'Write anything…', send: 'Send' }
}

/** Whether the box shows a recording (its time and level, and where it goes when that is another draft): not one
 * whose own strip is in sight, where the box stays as it was and the page under it never moves (B498): a voice
 * comment from the bar on a selection or about a document in view, or more said into an input from its row in the
 * list under the box (the desktop's New input page, B720). `list`: that list is shown; `key`: the box's own draft. */
export function boxShowsRecording(rec: { key: string; about?: { d: number | null; bar: boolean } | null }, here: { place: ProjectPlace['place']; list: boolean; key: string }): boolean {
  const a = rec.about
  if (a && (a.bar || (here.place.kind === 'doc' && here.place.d === a.d))) return false
  const t = draftTarget(rec.key)
  return !(here.list && t.kind === 'amend' && t.mode === 'append' && rec.key !== here.key)
}

/** What the box shows with what it holds: voice comments in a document's box (Send posts each beside its paragraph),
 * the correction as you type it, or a recording made for another draft. -> the line, the placeholder, what Send
 * says, how many voice comments wait, and whether files can be added (not to a corrected word, the transcription
 * preferences or a comment being edited) */
export function shownBox(role: BoxRole, a: { mode: BoxMode; text: string; key: string; recordingFor: string | null }): { line: BoxLine | null; waiting: BoxLine | null; placeholder: string; send: string; voiceComments: number; attach: boolean } {
  const vcN = role.doc != null && !a.mode ? vcCount(a.text) : 0
  const told = vcN
    ? { line: { icon: 'comment', label: `${plural(vcN, 'comment')} on D${role.doc} not sent`, detail: '', right: { kind: 'x', label: vcN > 1 ? 'Discard the comments' : 'Discard the comment', act: 'discard' } } as BoxLine, placeholder: role.aim ? 'Write…' : 'Add to the comments…', send: vcN > 1 ? `Post ${vcN} comments` : 'Post comment' }
    : role
  const line: BoxLine | null =
    a.recordingFor != null && a.recordingFor !== a.key
        ? { icon: 'mic', label: `Recording for ${draftName(a.recordingFor)}`, detail: '' }
        : told.line
  return { line, waiting: a.mode ? null : (role.waiting ?? null), placeholder: told.placeholder, send: told.send, voiceComments: vcN, attach: !a.mode || a.mode.kind === 'amend' }
}

/** The line over the box: what you sent is on its way (`q`: the one it names, which its × cancels), or what became of
 * the last one you sent from here. */
export type FeedbackLine =
  /** on its way: where it is and what can be done, as model/outgoingStates says for the line; `more`: how many more
   * are on their way after it */
  | { kind: 'going'; q: string; text: string; more: number; show: OutShow }
  /** what became of it: its words and what can be done, as model/inputStates says for the line */
  | { kind: 'became'; b: Became; text: string; acts: InputAct[] }

/** `mine`: what this project has on its way, oldest first; `away`: how sure the page is that Taska is out of reach;
 * `title`: a project's title by its name; `others`: there is another project to move it to. `final`: the input it
 * names, once it ended up somewhere (the line lets it go after a while). */
export function feedbackLine(a: { m: ProjectModel | null; desk: boolean; scope: string | null; mine: Outgoing[]; away: number; lastSent: string | null; others: boolean; title(slug: string): string }): { line: FeedbackLine; final?: string } | null {
  // the phone's only (T689, r576): on the desktop each input is in the New input page's list; in an item, in its talk
  if (a.desk || a.scope) return null
  const going = a.mine.filter((o) => showsOnItsWay(o))
  const first = going[0]
  const show = first ? outgoingIn(first, a.away, 'line') : null
  if (first && show) return { line: { kind: 'going', q: first.q, text: outgoingLine(first), more: going.length - 1, show } }
  const r = a.lastSent && a.m ? a.m.byId.get(a.lastSent) : undefined
  if (!r || !a.m || r.scope) return null
  const b = becameOf(r, a.m, a.title)
  if (!showsIn(b, 'line')) return null
  return { line: { kind: 'became', b, text: becameText(b, 'line'), acts: actsIn(b, 'line', { others: a.others }) }, final: INPUT_STATES[b.k].settled ? r.id : undefined }
}
