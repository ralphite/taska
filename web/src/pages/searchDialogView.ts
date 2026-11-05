// The desktop's search dialog as it is drawn (F479), from where the search is (stores/find) and the page's data: the
// field's words (as typed, or as said: lit, or with a word to check), the kinds and filters, one list of rows best
// first (each with its project as a path), Recent while nothing is typed, the Actions its words name, the
// highlighted row. Pure: the container and the stories draw the same dialog from the same data.

import type { ActionId } from '../app/actions'
import type { FindStatus } from '../stores/find'
import type { Visit } from '../stores/recent'
import { openDoubts, spotsIn, type Spot } from '../model/doubts'
import { FIND_KINDS, type FindPhase, type Found } from '../model/find'
import { closed, shownStatus } from '../model/items'
import { codeOf, type ProjectModel } from '../model/project'
import { clock } from '../model/time'
import type { Item, ItemType } from '../model/types'
import type { ViewChip } from '../features/list/rows'
import type { SearchNow } from './searchView'

export type DialogNow = SearchNow & { project: string | null; status: FindStatus | null; sel: number; replace: boolean }

/** A row it found (or one you opened lately). */
export interface FoundLine {
  key: string
  found: Found
  /** what its mark is: an item's state, a document, an input */
  mark: { kind: 'item'; s: string; label: string; type: ItemType } | { kind: 'doc' } | { kind: 'input' }
  code: string
  title: string
  /** where it is: its project, and the item it is under or on */
  path: string
  project: string
  projectTitle: string
  tone: string
}

/** An action its words name (the table's, done as its key does). */
export interface ActionLine {
  id: ActionId
  label: string
  /** the open item's code, for what acts on it */
  sub: string
  keys: string
}

export type DialogLine = FoundLine | ActionLine
export const isFound = (l: DialogLine | null | undefined): l is FoundLine => !!l && 'found' in l

export interface SearchDialogView {
  phase: FindPhase
  words: string
  /** the words just said, lit at their end */
  added: string
  /** the words are being typed: the field shows them (else as said) */
  typing: boolean
  /** what is said next takes the words' place */
  replace: boolean
  spots: readonly Spot[] | null
  rec: { time: string; levels: readonly number[] } | null
  /** the kinds it found, with their counts (none found yet: null) */
  kinds: ViewChip[] | null
  project: string | null
  projects: { slug: string; title: string; tone: string }[]
  status: FindStatus | null
  /** nothing typed: what you opened lately */
  recent: FoundLine[]
  results: FoundLine[]
  actions: ActionLine[]
  sel: number
  /** the highlighted row */
  lit: DialogLine | null
  marks: readonly string[]
  /** searching again: what it found before shows, faded */
  faded: boolean
  /** nothing to list: what it is doing, or why not */
  middle: FindPhase | null
}

export interface DialogPlace {
  /** the project you are in ('': the home page) */
  here: string
  model(slug: string): ProjectModel | null
  title(slug: string): string
  tone(slug: string): string
  /** the projects in the sidebar's order */
  projects: readonly string[]
  recent: readonly Visit[]
  /** the actions the words may name (none on the home page) */
  actions: readonly { id: ActionId; label: string; keys: string; item: boolean }[]
  /** the item open in the pane, for the actions on it */
  openCode: string | null
}

/** The item a row found is or opens, as the page has it (another project's: as the search sent it). */
export function itemOf(x: Found, p: Pick<DialogPlace, 'model'>): Item | undefined {
  if (x.n == null) return undefined
  return p.model(x.project)?.byN.get(x.n) ?? x.item
}

export function lineOf(x: Found, p: DialogPlace): FoundLine {
  const m = p.model(x.project)
  const base = { key: x.project + '/' + x.key, found: x, project: x.project, projectTitle: p.title(x.project), tone: p.tone(x.project) }
  const it = itemOf(x, p)
  if ((x.kind === 'items' || x.kind === 'rules') && it) {
    const code = x.item?.code ?? (m ? codeOf(m, it.n) : String(it.n))
    const under = it.parent && m ? codeOf(m, it.parent) : (x.parentCode ?? '')
    return { ...base, mark: { kind: 'item', ...shownStatus(it), type: it.type }, code, title: it.title, path: [base.projectTitle, under].filter(Boolean).join(' / ') }
  }
  const on = x.kind === 'docs' ? x.on : x.became
  return { ...base, mark: { kind: x.kind === 'docs' ? 'doc' : 'input' }, code: x.code ?? '', title: x.title ?? '', path: [base.projectTitle, on].filter(Boolean).join(' / ') }
}

/** A visit as a row: from the project's data when it is here (its words now), else as it was opened. */
/** A page you visited, as a search finds it (Recent: the desktop's dialog and the phone's page). */
export function visitFound(v: Visit, model: (slug: string) => ProjectModel | null): Found {
  const m = model(v.project)
  if (v.kind === 'docs') {
    const d = m?.docs.find((x) => x.d === v.d)
    return { project: v.project, kind: 'docs', key: 'd' + v.d, n: v.n, d: v.d, code: 'D' + v.d, title: d?.title ?? v.title, on: v.on }
  }
  const it = m?.byN.get(v.n)
  const item = it ?? ({ n: v.n, title: v.title, type: v.type ?? 'feature', status: v.status ?? 'open' } as Item)
  return { project: v.project, kind: item.type === 'rule' ? 'rules' : 'items', key: 'i' + v.n, n: v.n, item: it ? undefined : { ...item, code: v.code } }
}

/** The actions whose words start as the words do (three at most). */
function actionsFor(words: string, p: DialogPlace): ActionLine[] {
  const q = words.trim().toLowerCase()
  if (q.length < 3) return []
  return p.actions
    .filter((a) => (!a.item || p.openCode) && (a.label.toLowerCase().startsWith(q) || a.label.toLowerCase().split(/[^a-z']+/).some((w) => w.startsWith(q))))
    .slice(0, 3)
    .map((a) => ({ id: a.id, label: a.label.replace(/…$/, ''), sub: a.item ? (p.openCode ?? '') : '', keys: a.keys }))
}

export function searchDialogView(s: DialogNow, p: DialogPlace): SearchDialogView {
  const a = s.answer
  const busy = s.phase === 'listening' || s.phase === 'writing'
  const typed = !!s.words.trim()
  const status = (x: Found) => {
    const it = itemOf(x, p)
    return (x.kind === 'items' || x.kind === 'rules') && !!it && closed(it.status) === (s.status === 'finished')
  }
  const narrowed = a ? a.found.filter((x) => (s.project === null || x.project === s.project) && (s.status === null || status(x))) : []
  const results = typed && a ? narrowed.filter((x) => s.kind === 'all' || x.kind === s.kind).map((x) => lineOf(x, p)) : []
  const recent = !typed && (s.phase === 'ready' || busy) ? p.recent.map((v) => lineOf(visitFound(v, p.model), p)) : []
  const actions = s.typed && !busy && s.kind === 'all' && !s.project && !s.status ? actionsFor(s.words, p) : []
  const rows: DialogLine[] = [...recent, ...results, ...actions]
  const sel = Math.min(s.sel, Math.max(0, rows.length - 1))
  const toCheck = !s.typed && s.heard.length ? openDoubts(s.words, s.heard).length : 0
  const kinds: ViewChip[] | null = a
    ? [
        { value: 'all', label: 'All', count: narrowed.length, on: s.kind === 'all', needs: false },
        ...FIND_KINDS.map(([k, label]) => ({ value: k, label, count: narrowed.filter((x) => x.kind === k).length, on: s.kind === k, needs: false })).filter((c) => c.count || c.on),
      ]
    : null
  return {
    phase: s.phase,
    words: s.words,
    added: s.typed ? '' : s.added,
    typing: s.typed || (!toCheck && !s.added),
    replace: s.replace,
    spots: toCheck ? spotsIn(s.words, s.heard) : null,
    rec: s.phase === 'listening' ? { time: clock(s.ms), levels: s.levels } : null,
    kinds,
    project: s.project,
    projects: p.projects.map((slug) => ({ slug, title: p.title(slug), tone: p.tone(slug) })),
    status: s.status,
    recent,
    results,
    actions,
    sel,
    lit: rows[sel] ?? null,
    marks: a?.marks ?? [],
    faded: s.phase === 'searching' && !!a,
    middle: busy || rows.length ? null : s.phase === 'found' ? 'nothing' : s.phase === 'ready' ? null : s.phase,
  }
}
