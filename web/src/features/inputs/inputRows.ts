// The Inputs tab's rows: each input as the line every list of inputs draws (model/became), newest first, the one gone
// to lit; and what is still on its way, the latest first. Pure: the container and the stories draw the same rows from
// the same data.

import { inputLine, type InputLineWith } from '../../model/became'
import { newestFirst } from '../../model/inputs'
import type { ProjectModel } from '../../model/project'
import { outgoingFacts, type Outgoing, type OutgoingFacts } from '../../model/outgoing'
import type { InputFacts } from './InputsView'

/** What the rows are drawn with besides the project. */
export interface InputRowsWith extends InputLineWith {
  lit: string | null
  litStill: boolean
  /** how many to draw, newest first (more come as the list scrolls to its end, B645); the one gone to is always
   * among them */
  upTo: number
}

/** The rows drawn, and how many inputs there are in all. */
export function inputRows(m: ProjectModel, a: InputRowsWith): { rows: InputFacts[]; total: number } {
  const all = newestFirst(m.inputs)
  const list = all.slice(0, Math.max(a.upTo, all.findIndex((r) => r.id === a.lit) + 1 + 10))
  const rows = list.map((r): InputFacts => ({ ...inputLine(m, r, a), lit: a.lit === r.id ? (a.litStill ? 'still' : 'shown') : undefined }))
  return { rows, total: all.length }
}

/** What this project's outbox still has on its way, the latest first, as the Inputs page shows each (`away`: how sure
 * the page is that Taska is out of reach). */
export const outgoingRows = (outbox: readonly Outgoing[], slug: string, away: number): OutgoingFacts[] =>
  outbox
    .filter((o) => o.slug === slug)
    .reverse()
    .flatMap((o) => outgoingFacts(o, away, 'inputs') ?? [])
