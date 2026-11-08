// What became of an input (B629), worked out once from what Taska sent of it and the organizer's facts: its state of
// model/inputStates (which says the words, the tone and what can be done in every place) with what that state names:
// the items it made or was added to (with the organizer's note when it says more than they do), the item it answers,
// why it failed, where it went. And one input as a line of the lists draws it: its number, its day and time, what
// became of it, a draft of yours on it, whether it is long. Pure.

import { dayOf, timeOf } from './inputs'
import { when } from './time'
import { shownStatus } from './items'
import { codeOf, inputDraft, type ProjectModel } from './project'
import type { Input, ItemType } from './types'
import { sentNotes } from './voiceStates'
import { inputCode } from './words'

export interface ItemRef {
  n: number
  code: string
  type: ItemType
  title: string
  status: { s: string; label: string }
}

/** What became of an input: its state (`k`, one of model/inputStates) and what that state names. */
export type Became =
  /** its voice notes' words still to come (model/voiceStates says how each place shows it), or more said into it on
   * its way (`adding`) */
  | { k: 'transcribing'; state: 'sentTranscribing' | 'sentFastWords' | 'adding' }
  | { k: 'organizing' }
  /** `why`: in a few plain words, `raw`: as the organizer said it; `retry`: the organizer is on, so asking it again can
   * help */
  | { k: 'failed'; why: string; raw: string; retry: boolean }
  | { k: 'undone'; retry: boolean }
  | { k: 'cancelled' }
  /** `did`: what was done to each ("Created", "Added to"; "" when nothing says); `note`: what else the organizer said;
   * `undo`: Taska would take back what the organizer filed */
  | { k: 'filed'; items: { did: string; item: ItemRef }[]; note: string | null; undo: boolean }
  | { k: 'answer'; item: ItemRef; undo: boolean }
  /** the organizer had nothing to file, and said why */
  | { k: 'note'; text: string }
  /** left for an agent by the organizer, or no organizer: the agents read it */
  | { k: 'agent' }
  | { k: 'handled' }
  | { k: 'moved'; to: string; as: string; href: string }

export const itemRef = (m: ProjectModel, n: number): ItemRef | null => {
  const it = m.byN.get(n)
  return it ? { n, code: codeOf(m, n), type: it.type, title: it.title, status: shownStatus(it) } : null
}

/** The items an input said in an item made (B714 #10594), as "→ Created B713" under your words there: those it is the
 * first source of and that were made after it was said, not the item it was said in. */
export const madeFrom = (r: Input, m: ProjectModel): ItemRef[] =>
  r.touched
    .filter((n) => n !== r.scope)
    .flatMap((n) => {
      const it = m.byN.get(n)
      const ref = it && it.srcs[0] === r.id && Date.parse(it.t0) >= Date.parse(r.t) ? itemRef(m, n) : null
      return ref ? [ref] : []
    })

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

/** A failure of the service behind the organizer in plain words (busy, too slow, out of reach, its key and where to
 * fix it); null when the words are Taska's own, plain already. Only words: whether it goes away by itself is Taska's
 * to say (`org.again`, server domain/input_states.transient). */
function serviceWhy(msg: string): string | null {
  const m = msg.toLowerCase()
  if (/\b(401|403)\b|api.?key|unauthori[sz]ed|permission denied/.test(m)) return 'Gemini key not accepted · check GEMINI_API_KEY on the server'
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

/** Taska would take back what the organizer filed for it (the server's filing-undo allows it): the organizer's own
 * filing, as it left it (`filing.can`). */
const canUndo = (r: Input) => !!r.org && r.org.ok && !r.org.undone && !!r.touched.length && (!r.org.keep || (!!r.history?.length && !!r.org.changed)) && !!r.filing?.can

/** What became of `r`, the one place it is worked out; `title`: a project's title by its name. */
export function becameOf(r: Input, m: ProjectModel, title: (slug: string) => string): Became {
  const organizer = m.facts.organizer
  if (r.moved) return movedOf(r.moved, title)
  if (r.kind === 'cancelled') return { k: 'cancelled' }
  const hearing = sentNotes(r.files)
  if (hearing) return { k: 'transcribing', state: hearing }
  // one word for every input the organizer has not finished: whether it is on it now, next in line or asking its
  // service again after a busy answer (Taska says so: `again`), it is being organized; no "Queued" (B684) to fall
  // back to: it jumped back and forth
  const next = !r.acked && organizer.on && (!r.org || (!r.org.ok && !!r.org.again))
  if (organizer.busy.includes(r.id) || next) return { k: 'organizing' }
  const retry = !r.acked && organizer.on
  if (r.org?.undone) return { k: 'undone', retry }
  if (r.kind === 'answer' && r.scope) {
    const it = itemRef(m, r.scope)
    if (it) return { k: 'answer', item: it, undo: canUndo(r) }
  }
  // its key refused too: once the key is fixed, Retry is the way to have it organized (nothing asks again by itself)
  if (r.org && !r.org.ok) return { k: 'failed', why: failWhy(r.org.msg), raw: r.org.msg, retry }
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
  if (items.length) return { k: 'filed', items: filed, note: told.rest.join(' · ') || null, undo: canUndo(r) }
  if (told.rest.length) return { k: 'note', text: told.rest.join(' · ') }
  return r.acked ? { k: 'handled' } : { k: 'agent' }
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
