// What the desktop's New input page lists under the box: what you said lately, newest first, by day (each with what
// became of it, the items it made, a draft of yours on it), and what is on its way.

import { dayOf, newestFirst, organizing, SHORT_STANDING, standing, timeOf, type InputStanding } from './inputs'
import { shownStatus } from './items'
import type { BoxMode } from './boxFoot'
import { outgoingLine, outgoingState, type Outgoing } from './outgoing'
import { codeOf, inputDraft, type ProjectModel } from './project'
import type { Input, ItemType } from './types'
import { inputMatch } from './visible'
import { inputCode } from './words'

export interface SaidChip {
  n: number
  code: string
  type: ItemType
  title: string
  status: { s: string; label: string }
}

export interface SaidInput {
  r: Input
  code: string
  time: string
  /** the day's name when this input starts a day */
  day: string | null
  standing: InputStanding
  short: string
  scope: SaidChip | null
  chips: SaidChip[]
  busy: boolean
  draft: 'edit' | 'append' | null
  canUndoSend: boolean
  retry: string | null
  opened: boolean
}

export interface SaidOutgoing {
  q: string
  text: string
  state: string
  failed: boolean
  net: boolean
  canUndo: boolean
}

/** What you said that the search finds (`all`) and the rows shown of it (the first `upTo`). */
export function saidRows(m: ProjectModel, a: { words: readonly string[]; upTo: number; opened: ReadonlySet<string>; justSent: readonly { rid?: string }[]; drafts: Readonly<Record<string, string>>; mode: BoxMode }): { all: Input[]; rows: SaidInput[] } {
  const all = newestFirst(m.inputs).filter((r) => inputMatch(r, a.words))
  const recent = all.slice(0, a.upTo)
  const chip = (n: number): SaidChip | null => {
    const it = m.byN.get(n)
    return it ? { n, code: codeOf(m, n), type: it.type, title: it.title, status: shownStatus(it) } : null
  }
  const rows: SaidInput[] = recent.map((r, k) => {
    const s = standing(r, m.facts.organizer, (slug) => slug)
    return {
      r,
      code: inputCode(r.id),
      time: timeOf(r.t),
      day: k === 0 || dayOf(recent[k - 1].t) !== dayOf(r.t) ? dayOf(r.t) : null,
      standing: s,
      short: SHORT_STANDING[s.label] || s.label,
      scope: r.scope ? chip(r.scope) : null,
      chips: r.moved ? [] : (r.touched.filter((n) => m.byN.has(n) && n !== r.scope).map(chip).filter(Boolean) as SaidChip[]),
      busy: organizing(r, m.facts.organizer),
      draft: inputDraft(r.id, a.drafts, a.mode?.kind === 'amend' ? { id: a.mode.id, mode: a.mode.mode } : null),
      canUndoSend: a.justSent.some((x) => x.rid === r.id),
      retry: !r.acked && m.facts.organizer.on && r.org && (!r.org.ok || r.org.undone) ? (r.org.undone ? 'Organize again' : 'Retry') : null,
      opened: a.opened.has(r.id),
    }
  })
  return { all, rows }
}

/** What is on its way, oldest last (none while searching). */
export const saidOutgoing = (mine: readonly Outgoing[], words: readonly string[], away: number, justSent: readonly { q: string }[]): SaidOutgoing[] =>
  words.length ? [] : [...mine].reverse().map((o) => ({ q: o.q, text: o.text || outgoingLine(o), state: outgoingState(o, away), failed: o.state === 'failed', net: !!o.net, canUndo: justSent.some((x) => x.q === o.q) }))
