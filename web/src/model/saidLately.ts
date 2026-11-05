// What the desktop's New input page lists under the box: what you said lately, newest first, each as the line every
// list of inputs draws (model/became); and what is on its way.

import type { BoxMode } from './boxFoot'
import { inputLine, type InputLine } from './became'
import { newestFirst } from './inputs'
import { outgoingLine, outgoingState, outgoingWaits, type Outgoing } from './outgoing'
import type { ProjectModel } from './project'
import type { Input } from './types'
import { inputMatch } from './visible'

export type SaidInput = InputLine

export interface SaidOutgoing {
  q: string
  text: string
  state: string
  failed: boolean
  net: boolean
  /** Taska is out of reach: it waits */
  waiting: boolean
}

/** What you said that the search finds (`all`) and the rows shown of it (the first `upTo`); `adding`: the inputs a
 * voice note said on their own line is on its way to (F657), transcribing until Taska has it and its words. */
export function saidRows(m: ProjectModel, a: { words: readonly string[]; upTo: number; opened: ReadonlySet<string>; drafts: Readonly<Record<string, string>>; mode: BoxMode; title(slug: string): string; adding?: ReadonlySet<string> }): { all: Input[]; rows: SaidInput[] } {
  const all = newestFirst(m.inputs).filter((r) => inputMatch(r, a.words))
  const writing = a.mode?.kind === 'amend' ? { id: a.mode.id, mode: a.mode.mode } : null
  const rows = all.slice(0, a.upTo).map((r) => {
    const x = inputLine(m, r, { title: a.title, opened: a.opened, drafts: a.drafts, writing })
    return a.adding?.has(r.id) && x.became.k !== 'moved' ? { ...x, became: { k: 'transcribing' as const } } : x
  })
  return { all, rows }
}

/** What is on its way, oldest last (none while searching). */
export const saidOutgoing = (mine: readonly Outgoing[], words: readonly string[], away: number): SaidOutgoing[] =>
  words.length ? [] : [...mine].reverse().map((o) => ({ q: o.q, text: o.text || outgoingLine(o), state: outgoingState(o, away), failed: o.state === 'failed', net: !!o.net, waiting: outgoingWaits(o, away) }))
