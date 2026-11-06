// What became of an input, in one set of words for every list of inputs (B629): the items it made or was added to (with
// the organizer's note when it says more than they do), the item it answers, or where it stands (transcribing,
// organizing or waiting to be, couldn't organize, undone, cancelled, left for an agent or waiting for one, handled, moved). And one
// input as a line of those lists draws it: its number, its day and time, what became of it, a draft of yours on it,
// whether it is long. Pure.

import { canSend, dayOf, organizing, timeOf } from './inputs'
import { when } from './time'
import { shownStatus } from './items'
import { codeOf, inputDraft, type ProjectModel } from './project'
import type { Input, ItemType } from './types'
import { transcribing } from './voices'
import { inputCode } from './words'

export interface ItemRef {
  n: number
  code: string
  type: ItemType
  title: string
  status: { s: string; label: string }
}

export type Became =
  | { k: 'transcribing' }
  | { k: 'organizing' }
  /** the organizer is on and will take it, after the ones before it */
  /** `retry`: the organizer is on, so it can try again */
  | { k: 'failed'; why: string; retry: boolean }
  | { k: 'undone'; retry: boolean }
  /** a recording cancelled with Esc, kept: Send sends it after all (B627) */
  | { k: 'cancelled' }
  /** `did`: what was done to each ("Created", "Added to"; "" when nothing says); `note`: what else the organizer said */
  | { k: 'filed'; items: { did: string; item: ItemRef }[]; note: string | null }
  | { k: 'answer'; item: ItemRef }
  /** the organizer had nothing to file, and said why */
  | { k: 'note'; text: string }
  | { k: 'agent' }
  /** no organizer: the agents read it */
  | { k: 'waiting' }
  | { k: 'handled' }
  | { k: 'moved'; to: string; as: string; href: string }

/** The words for each state, the same in every list. */
export const BECAME_WORD = {
  transcribing: 'Transcribing…',
  organizing: 'Organizing…',
  failed: "Couldn't organize",
  undone: 'Undone',
  cancelled: 'Cancelled',
  agent: 'For an agent',
  waiting: 'For an agent',
  handled: 'Handled',
  answer: 'Answer to',
  tryAgain: 'Retry',
  organizeAgain: 'Organize',
  send: 'Send',
  moved: (to: string) => `Moved to ${to}`,
  open: (as: string) => as,
}

export const itemRef = (m: ProjectModel, n: number): ItemRef | null => {
  const it = m.byN.get(n)
  return it ? { n, code: codeOf(m, n), type: it.type, title: it.title, status: shownStatus(it) } : null
}

/** What the organizer's note says was done to each item ("Created B014 · added to F012 and T007"), and what it says
 * besides. */
function readNote(msg: string, codes: Map<string, number>): { did: Map<number, string>; rest: string[] } {
  const did = new Map<number, string>()
  const rest: string[] = []
  for (const part of msg.split(/ · |; /).map((p) => p.trim()).filter(Boolean)) {
    const named = [...part.matchAll(/\b[A-Z]\d+\b/g)].map((x) => codes.get(x[0])).filter((n): n is number => n != null)
    if (!named.length) {
      rest.push(part)
      continue
    }
    const verb = part.replace(/\b[A-Z]\d+\b/g, '').replace(/,|\band\b/g, ' ').replace(/\s+/g, ' ').trim()
    // the organizer's own word for words added to an item, said as the list says it (the approved B629 line)
    const said = /^noted on$/i.test(verb) ? 'Added to' : verb
    for (const n of named) if (!did.has(n)) did.set(n, said ? said[0].toUpperCase() + said.slice(1) : '')
  }
  return { did, rest }
}

/** Why the organizer could not file it, in a few words: its own reason ("B99 not found"), without its plumbing ("No
 * changes needed", "Some commands failed:", "err:"). */
export const shortWhy = (msg: string) =>
  msg
    .split(/ · /)
    .map((p) => p.replace(/^Some commands failed:\s*/i, '').replace(/\berr:\s*/gi, '').trim())
    .filter((p) => p && !/^No changes needed$/i.test(p))
    .join(' · ') || msg

/** The organizer's service refused its key: trying again fails the same way until the key is fixed on the server. */
export const keyRefused = (msg: string) => /\b(401|403)\b|api.?key|unauthori[sz]ed|permission denied/.test(msg.toLowerCase())

/** A failure of the service behind the organizer in plain words (busy, too slow, out of reach, its key and where to
 * fix it); null when the words are Taska's own, plain already. */
export function serviceWhy(msg: string): string | null {
  const m = msg.toLowerCase()
  if (keyRefused(msg)) return 'Gemini key not accepted · check GEMINI_API_KEY on the server'
  if (/\b429\b|rate.?limit|quota|resource.?exhausted/.test(m)) return 'busy for now'
  if (/\b5\d\d\b|overload|unavailable|internal error/.test(m)) return 'busy'
  if (/timed? ?out|deadline/.test(m)) return 'too slow'
  if (/network|connection|unreachable|urlopen|resolve|socket/.test(m)) return 'out of reach'
  return null
}

/** Why the organizer failed, in a few plain words. */
export const failWhy = (msg: string) => serviceWhy(msg) ?? shortWhy(msg)

/** Where an input moved to: the project's title (`title`: a project's title by its name), its number there, its link. */
export const movedOf = (moved: NonNullable<Input['moved']>, title: (slug: string) => string): Extract<Became, { k: 'moved' }> => ({
  k: 'moved',
  to: title(moved.to),
  as: inputCode(moved.as),
  href: `/p/${encodeURIComponent(moved.to)}/`,
})

/** What became of `r`; `title`: a project's title by its name. */
export function becameOf(r: Input, m: ProjectModel, title: (slug: string) => string): Became {
  const organizer = m.facts.organizer
  if (r.moved) return movedOf(r.moved, title)
  if (canSend(r)) return { k: 'cancelled' }
  if (transcribing(r.files)) return { k: 'transcribing' }
  // one word for every input the organizer has not finished: whether it is on it now, next in line or asking Gemini
  // again after a busy answer, it is being organized; no "Queued" to fall back to (B684: it jumped back and forth)
  if (organizing(r, organizer)) return { k: 'organizing' }
  const retry = !r.acked && organizer.on
  if (r.org?.undone) return { k: 'undone', retry }
  if (r.kind === 'answer' && r.scope) {
    const it = itemRef(m, r.scope)
    if (it) return { k: 'answer', item: it }
  }
  // its key refused too: once the key is fixed, Retry is the way to have it organized (nothing asks again by itself)
  if (r.org && !r.org.ok) return { k: 'failed', why: failWhy(r.org.msg), retry }
  // said on an item (its own box): added to it; then what the organizer or an agent did with it
  const ns = [...new Set([...(r.scope ? [r.scope] : []), ...r.touched])]
  const items = ns.map((n) => itemRef(m, n)).filter((x): x is ItemRef => !!x)
  const told = r.org && !r.org.keep ? readNote(r.org.msg, new Map(items.map((it) => [it.code, it.n]))) : { did: new Map<number, string>(), rest: [] }
  // no organizer's word on an item: an agent changed it for this input
  const did = (n: number) => (n === r.scope ? 'Added to' : (told.did.get(n) ?? (r.org ? '' : 'Changed')))
  // the items under the same word together, the words in the order the note says them (so each is said once)
  const msg = (r.org?.msg ?? '').toLowerCase()
  const at = (d: string) => (d && msg.includes(d.toLowerCase()) ? msg.indexOf(d.toLowerCase()) : msg.length + (d ? 0 : 1))
  const filed = items.map((it) => ({ did: did(it.n), item: it })).sort((a, b) => at(a.did) - at(b.did))
  if (items.length) return { k: 'filed', items: filed, note: told.rest.join(' · ') || null }
  if (told.rest.length) return { k: 'note', text: told.rest.join(' · ') }
  if (r.acked) return { k: 'handled' }
  return r.org?.keep ? { k: 'agent' } : { k: 'waiting' }
}

/** A long input shows a few lines and More: about four lines of the narrower list (a Chinese character is as wide as
 * two letters). */
export const isLong = (text: string) => text.split('\n').length > 4 || [...text].reduce((w, c) => w + (c.charCodeAt(0) > 0x2e7f ? 2 : 1), 0) > 180

export interface InputLine {
  r: Input
  code: string
  /** when it was said, as the page says a time (`when`): "14:28", "Yesterday 09:10", "Oct 21 11:30" */
  when: string
  /** its day ("Today", "Yesterday", "Oct 21") and its time ("14:28"), for a list that says each day once over its
   * lines */
  day: string
  time: string
  became: Became
  /** a draft of yours on it, not sent: an edit, or more to add */
  draft: 'edit' | 'append' | null
  long: boolean
  opened: boolean
}

export interface InputLineWith {
  title(slug: string): string
  opened: ReadonlySet<string>
  drafts: Parameters<typeof inputDraft>[1]
  writing: Parameters<typeof inputDraft>[2]
}

export const inputLine = (m: ProjectModel, r: Input, a: InputLineWith): InputLine => ({
  r,
  code: inputCode(r.id),
  when: when(r.t, m.at),
  day: dayOf(r.t, new Date(m.at)),
  time: timeOf(r.t),
  became: becameOf(r, m, a.title),
  draft: inputDraft(r.id, a.drafts, a.writing),
  long: isLong(r.text),
  opened: a.opened.has(r.id),
})
