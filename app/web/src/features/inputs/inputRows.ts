// The Inputs tab's rows: each input with where it stands and what became of it (what it made or changed, a note, Retry,
// where it moved), newest first by day, and what is still on its way, the latest first. Pure: the container and the
// stories draw the same rows from the same data.

import { dayOf, newestFirst, standing } from '../../model/inputs'
import { codeOf, inputDraft, type ProjectModel } from '../../model/project'
import { when } from '../../model/time'
import { inputMatch } from '../../model/visible'
import { inputCode } from '../../model/words'
import { outgoingLine, outgoingState, showsOnItsWay, type Outgoing } from '../../model/outgoing'
import type { InputFacts, OutgoingRow } from './InputsView'

/** What the rows are drawn with besides the project. */
export interface InputRowsWith {
  words: string[]
  /** a project's title by its name */
  title(slug: string): string
  opened: ReadonlySet<string>
  drafts: Parameters<typeof inputDraft>[1]
  writing: Parameters<typeof inputDraft>[2]
  lit: string | null
  litStill: boolean
}

export function inputRows(m: ProjectModel, a: InputRowsWith): InputFacts[] {
  const list = newestFirst(m.inputs).filter((r) => inputMatch(r, a.words))
  let day = ''
  return list.map((r): InputFacts => {
    const d = dayOf(r.t, new Date(m.at))
    const startsDay = d !== day
    day = d
    const st = standing(r, m.facts.organizer, a.title)
    // the chips say what was done with their items ("Created B224"); the note keeps only what no chip says
    const shown = r.moved ? [] : r.touched.filter((n) => m.byN.has(n) && n !== r.scope)
    const did: Record<number, string> = {}
    const rest: string[] = []
    for (const part of (r.org?.msg || '').split(' · ').map((p) => p.trim()).filter(Boolean)) {
      const mm = /^(.+?) ([A-Z]\d+)$/.exec(part)
      const n = mm ? Number(/\d+/.exec(mm[2])?.[0]) : null
      if (mm && n && shown.includes(n)) did[n] ||= mm[1]
      else rest.push(part)
    }
    const org = !r.moved && r.org && !(r.acked && r.org.keep)
    const told = (p: string) => p.toLowerCase() === st.label.toLowerCase() || (/^Left for your/.test(p) && /^Left for your/.test(st.label))
    const left = rest.filter((p) => !told(p))
    const note = org && left.length ? left.join(' · ') : null
    const scope = r.scope ? m.byN.get(r.scope) : undefined
    return {
      r,
      code: inputCode(r.id),
      time: when(r.t, m.at),
      day: startsDay ? d : null,
      standing: st,
      scope: scope ? { n: scope.n, code: codeOf(m, scope.n), title: scope.title } : null,
      chips: shown.map((n) => {
        const it = m.byN.get(n)!
        return { n, code: codeOf(m, n), type: it.type, title: it.title, did: did[n] || '' }
      }),
      note,
      noteBad: !r.org?.ok,
      spark: !!org && !note && shown.some((n) => did[n]),
      retry: !r.acked && m.facts.organizer.on && r.org && (!r.org.ok || r.org.undone) ? (r.org.undone ? 'Organize again' : 'Retry') : null,
      moved: r.moved ? { href: `/p/${encodeURIComponent(r.moved.to)}/`, label: `Open ${a.title(r.moved.to)} · ${inputCode(r.moved.as)}` } : null,
      lit: a.lit === r.id ? (a.litStill ? 'still' : 'shown') : undefined,
      draft: inputDraft(r.id, a.drafts, a.writing),
      long: r.text.length > 160 || r.text.split('\n').length > 4,
      opened: a.opened.has(r.id),
    }
  })
}

/** What this project's outbox still has on its way, the latest first, and where each is (`away`: how long Taska has
 * not answered). */
export const outgoingRows = (outbox: readonly Outgoing[], slug: string, away: number): OutgoingRow[] =>
  outbox
    .filter((o) => o.slug === slug && showsOnItsWay(o))
    .reverse()
    .map((o) => ({ q: o.q, text: o.text || outgoingLine(o), state: outgoingState(o, away), bad: o.state === 'failed' && !o.net, scope: o.scope, previews: o.files.flatMap((f) => (f.preview ? [f.preview] : [])) }))
