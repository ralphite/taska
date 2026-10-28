// What an input's menu and its Move sheet show, from the model: Undo of what the organizer did, Move (when there is
// another project and it is not being organized), History, what it is with, a file's Take off asking, what Delete also
// deletes; and for Move, its words and what else moves with it. Pure: the container and the stories both use it.

import { canUndoFiling, organizing } from '../../model/inputs'
import { codeOf, type ProjectModel } from '../../model/project'
import type { Input } from '../../model/types'
import { inputCode } from '../../model/words'
import type { InputMenuFacts } from './InputSheets'

export function inputMenuFacts(m: ProjectModel, r: Input, otherProjects: number, asked: Readonly<Record<string, number>>): InputMenuFacts {
  const code = (n: number) => codeOf(m, n)
  return {
    r,
    tidy: true,
    undo: canUndoFiling(r) ? { tip: `${inputCode(r.id)}: ${r.filing?.what || ''}` } : null,
    move: otherProjects > 0 && !organizing(r, m.facts.organizer),
    history: !!r.history?.length,
    scope: r.scope ? code(r.scope) : null,
    asking: r.files.find((f) => asked[`unfile ${r.id} ${f.f}`])?.f ?? null,
    deleteTip:
      `Delete ${inputCode(r.id)}` +
      (r.deletion?.go.length ? ` and ${r.deletion.go.map(code).join(', ')}` : '') +
      (r.deletion?.keep.length ? `; ${r.deletion.keep.map(([n, why]) => `${code(n)} stays: ${why}`).join('; ')}` : ''),
  }
}

/** What Move says about it: its code and words, the items it made (they move too), whether the organizer made them,
 * and the item it was said on. */
export function inputMoveFacts(m: ProjectModel, r: Input) {
  const made = r.touched.filter((n) => n !== r.scope && m.byN.has(n) && !m.byN.get(n)?.archived)
  return {
    code: inputCode(r.id),
    words: r.text || `${r.files.length} file${r.files.length === 1 ? '' : 's'}`,
    made: made.map((n) => `${codeOf(m, n)} ${m.byN.get(n)?.title}`),
    byOrganizer: !!(r.org && r.org.ok && !r.org.undone && !r.org.keep),
    scope: r.scope && m.byN.has(r.scope) ? codeOf(m, r.scope) : null,
  }
}
