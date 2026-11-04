// The Inputs tab's rows: each input as the line every list of inputs draws (model/became), newest first, the one gone
// to lit; and what is still on its way, the latest first. Pure: the container and the stories draw the same rows from
// the same data.

import { inputLine, type InputLineWith } from '../../model/became'
import { newestFirst } from '../../model/inputs'
import type { ProjectModel } from '../../model/project'
import { inputMatch } from '../../model/visible'
import { outgoingLine, outgoingState, outgoingWaits, showsOnItsWay, type Outgoing } from '../../model/outgoing'
import type { InputFacts, OutgoingRow } from './InputsView'

/** What the rows are drawn with besides the project. */
export interface InputRowsWith extends InputLineWith {
  words: string[]
  lit: string | null
  litStill: boolean
  /** how many to draw, newest first (more come as the list scrolls to its end, B645); the one gone to is always
   * among them */
  upTo: number
}

/** The rows drawn, and how many inputs match in all. */
export function inputRows(m: ProjectModel, a: InputRowsWith): { rows: InputFacts[]; total: number } {
  const all = newestFirst(m.inputs).filter((r) => inputMatch(r, a.words))
  const list = all.slice(0, Math.max(a.upTo, all.findIndex((r) => r.id === a.lit) + 1 + 10))
  const rows = list.map((r): InputFacts => ({ ...inputLine(m, r, a), lit: a.lit === r.id ? (a.litStill ? 'still' : 'shown') : undefined }))
  return { rows, total: all.length }
}

/** What this project's outbox still has on its way, the latest first, and where each is (`away`: how long Taska has
 * not answered). */
export const outgoingRows = (outbox: readonly Outgoing[], slug: string, away: number): OutgoingRow[] =>
  outbox
    .filter((o) => o.slug === slug && showsOnItsWay(o))
    .reverse()
    .map((o) => ({ q: o.q, text: o.text || outgoingLine(o), state: outgoingState(o, away), bad: o.state === 'failed' && !o.net, waiting: outgoingWaits(o, away), failed: o.state === 'failed', scope: o.scope, previews: o.files.flatMap((f) => (f.preview ? [f.preview] : [])) }))
