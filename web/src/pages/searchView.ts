// The phone's search page as it is drawn, from where the search is (stores/find) and the page's data: the box's
// words and what may be misheard in them, the kinds found, the rows by project (an item of the project you are in
// drawn from its model, as the list draws it; another project's from what the search sent). Pure: the container and
// the stories draw the same page from the same data.

import { clock } from '../model/time'
import { codeOf, type ProjectModel } from '../model/project'
import { openDoubts, spotsIn } from '../model/doubts'
import { foundGroups, foundKinds, foundMeta, type Found } from '../model/find'
import type { FindState } from '../stores/find'
import type { Visit } from '../stores/recent'
import { visitFound } from './searchDialogView'
import type { SeenMap } from '../stores/seen'
import { hitLine, rowFacts, rowLook, type DrawWith } from '../features/list/drawRows'
import type { RowEvents, RowFacts } from '../features/list/ListRows'
import type { FoundRowView, SearchView } from './SearchPage'

export type SearchNow = Pick<FindState, 'phase' | 'words' | 'added' | 'heard' | 'answer' | 'kind' | 'typed' | 'ms' | 'levels'>

export interface SearchPlace {
  /** the project you are in, and its model */
  here: string
  m: ProjectModel | null
  /** the projects in the sidebar's order */
  order: readonly string[]
  tone(slug: string): string
  seen: SeenMap
  /** the codes of the items with a draft, in the project you are in */
  drafts: ReadonlySet<string>
  /** a row's events: opening it opens what it found */
  on(x: Found): RowEvents
  /** the time the page tells times against (ms): the model's */
  now: number
  /** the pages you visited last (Recent, as the desktop's search has them), and each project's model */
  recent: readonly Visit[]
  model(slug: string): ProjectModel | null
}

/** A row of another project's item: what the list would show, from what the search sent. */
function otherFacts(x: Found, words: string[]): RowFacts {
  const it = x.item as NonNullable<Found['item']>
  return {
    code: it.code,
    parentCode: x.parentCode ?? null,
    image: null,
    kids: x.kids ?? null,
    openKids: x.kids ? x.kids.all - x.kids.done : 0,
    talk: it.thread.length,
    draft: false,
    next: false,
    unread: false,
    worker: null,
    news: null,
    hitLine: words.length ? hitLine(it, it.code, words) : null,
  }
}

export function searchView(s: SearchNow, p: SearchPlace): SearchView {
  const a = s.answer
  const marks = a?.marks ?? []
  const w: DrawWith = { slug: p.here, openN: null, selected: new Set(), words: marks, desk: false, drafts: p.drafts, head: undefined, seen: p.seen, drag: { n: null, at: null } }
  const row = (x: Found): FoundRowView[] => {
    if (x.kind === 'items' || x.kind === 'rules') {
      const mine = x.project === p.here && p.m && x.n != null ? p.m.byN.get(x.n) : undefined
      // another project's: what the search sent, or (a page visited there) its model's
      const there = !mine && x.n != null ? p.model(x.project)?.byN.get(x.n) : undefined
      const it = mine ?? x.item ?? there
      if (!it) return []
      const facts = mine && p.m ? rowFacts(p.m, mine, w) : otherFacts({ ...x, item: x.item ?? (there && p.model(x.project) ? { ...there, code: codeOf(p.model(x.project) as ProjectModel, there.n) } : undefined) }, marks)
      return [{ kind: 'item', key: x.project + '/' + x.key, found: x, it, facts, look: rowLook(it, w), on: p.on(x) }]
    }
    return [{ kind: 'other', key: x.project + '/' + x.key, found: x, icon: x.kind === 'docs' ? (p.model(x.project)?.docs.find((d) => d.d === x.d)?.fmt === 'html' ? 'web' : 'doc') : 'newinput', code: x.code ?? '', title: x.title ?? '', meta: foundMeta(x, p.now) }]
  }
  const toCheck = s.heard.length ? openDoubts(s.words, s.heard).length : 0
  // nothing asked yet: Recent, by project in the order you visited them, as the desktop's search opens with it
  const recent = !a && !s.words.trim() && (s.phase === 'ready' || s.phase === 'listening') && p.recent.length ? recentGroups(p.recent.map((v) => visitFound(v, p.model))) : null
  return {
    phase: s.phase,
    words: s.words,
    added: s.added,
    typed: s.typed,
    doubts: toCheck ? { spots: spotsIn(s.words, s.heard), toCheck } : null,
    rec: s.phase === 'listening' ? { time: clock(s.ms), levels: s.levels } : null,
    kinds: a
      ? [{ value: 'all', label: 'All', count: a.found.length, on: s.kind === 'all', needs: false }, ...foundKinds(a).map(([k, label, n]) => ({ value: k, label, count: n, on: s.kind === k, needs: false }))]
      : null,
    groups: a ? foundGroups(a, p.here, p.order, s.kind).map((g) => ({ project: g.project, title: g.project === p.here && p.m ? p.m.facts.title : g.title, tone: p.tone(g.project), rows: g.rows.flatMap(row) })) : null,
    recent,
    marks,
  }

  function recentGroups(found: Found[]) {
    const by = new Map<string, Found[]>()
    for (const x of found) by.set(x.project, [...(by.get(x.project) ?? []), x])
    return [...by].map(([project, xs]) => ({ project, title: project === p.here && p.m ? p.m.facts.title : (p.model(project)?.facts.title ?? project), tone: p.tone(project), rows: xs.flatMap(row) })).filter((g) => g.rows.length)
  }
}
