// What the item list shows, as a list of rows to draw: worked out from the project, the list's settings and the
// list's own state (folded parents, held rows). Pure, so it is tested alone and the list component only draws.

import { closed, latestFirst, needsOrder, needsYou, workOrder } from '../../model/items'
import type { ProjectModel } from '../../model/project'
import type { ListQuery } from '../../model/route'
import type { Item } from '../../model/types'
import { filtered, searchWords, visible } from '../../model/visible'
import { NEEDS_SHOWN, type Tab } from '../../model/words'

export type ZoneKind = 'needs' | 'queue' | 'later' | 'done' | 'rules' | 'retired' | 'archived'

export type Row =
  | { kind: 'zone'; zone: ZoneKind; label: string; n: number }
  | { kind: 'item'; it: Item; depth: number; foldable: boolean; folded: boolean; band: string }
  | { kind: 'needs'; it: Item; depth: number }
  | { kind: 'held'; it: Item; said: string }
  | { kind: 'hidden-kids'; parent: number; depth: number; open: boolean; later: number; done: number }
  | { kind: 'needs-more'; open: boolean; rest: number }
  | { kind: 'archive-all'; n: number }

export type EmptyWhy = 'no-items' | 'none' | 'no-rules' | 'nothing-archived' | 'no-match' | 'no-match-rules' | 'nothing'

export type ListBody =
  | { kind: 'loading' }
  | { kind: 'empty'; why: EmptyWhy; status: string }
  /** rows to draw; `views`: the views' row above them; `empty`: nothing to show under it, and why */
  | { kind: 'rows'; views: boolean; rows: Row[]; shown: number; empty?: EmptyWhy }

export interface ListState {
  folded: ReadonlySet<number>
  /** parents whose hidden subitems are shown under them */
  subMore: ReadonlySet<number>
  needsAll: boolean
  open: number | null
  desk: boolean
}

const MAX_DEPTH = 8

/** The subitems the plain Active view hides (in Later, finished) under each parent it shows. */
function hiddenKids(m: ProjectModel, rows: Item[], list: ListQuery, st: ListState, tab: Tab) {
  const hidden = new Map<number, Item[]>()
  const group = [...rows]
  if (list.status !== 'all' || filtered(tab, list)) return { group, hidden }
  const shown = new Set(rows.map((it) => it.n))
  for (let i = 0; i < group.length; i++) {
    const p = group[i]
    const more = workOrder((m.kids.get(p.n) || []).filter((k) => !shown.has(k.n) && (closed(k.status) || k.when === 'later')))
    if (!more.length) continue
    hidden.set(p.n, more)
    if (st.subMore.has(p.n))
      for (const k of more) {
        shown.add(k.n)
        group.push(k)
      }
  }
  return { group, hidden }
}

function tree(group: Item[], st: ListState, opts: { band?: string; needs?: boolean; hidden?: Map<number, Item[]> }): Row[] {
  const inGroup = new Set(group.map((it) => it.n))
  const out: Row[] = []
  const add = (it: Item, d: number) => {
    const more = opts.hidden?.get(it.n)
    if (opts.needs && needsYou(it)) out.push({ kind: 'needs', it, depth: d })
    else
      out.push({
        kind: 'item',
        it,
        depth: d,
        foldable: !!more || group.some((k) => k.parent === it.n),
        folded: st.folded.has(it.n),
        band: opts.band || '',
      })
    if (st.folded.has(it.n) || d >= MAX_DEPTH) return
    for (const k of group) if (k.parent === it.n) add(k, d + 1)
    if (more) {
      const later = more.filter((k) => !closed(k.status)).length
      out.push({ kind: 'hidden-kids', parent: it.n, depth: d + 1, open: st.subMore.has(it.n), later, done: more.length - later })
    }
  }
  for (const it of group) if (!(it.parent && inGroup.has(it.parent))) add(it, 0)
  return out
}

function needsBand(needs: Item[], st: ListState): Row[] {
  if (!needs.length) return []
  const long = st.desk && needs.length > NEEDS_SHOWN + 1
  const cut = long && !st.needsAll && !needs.slice(NEEDS_SHOWN).some((it) => it.n === st.open)
  const out: Row[] = [{ kind: 'zone', zone: 'needs', label: 'Needs you', n: needs.filter(needsYou).length }]
  for (const it of cut ? needs.slice(0, NEEDS_SHOWN) : needs) out.push({ kind: 'needs', it, depth: 0 })
  if (cut) out.push({ kind: 'needs-more', open: false, rest: needs.length - NEEDS_SHOWN })
  else if (long && st.needsAll) out.push({ kind: 'needs-more', open: true, rest: needs.length - NEEDS_SHOWN })
  return out
}

/** While a row you acted on holds still, the list keeps the rows it had, each showing its item as it is now; a row
 * whose item no longer belongs in the list is one quiet line saying what you did, and a Needs-you row no longer
 * waiting on you is an ordinary row, where it was. */
export function heldRows(frozen: readonly Row[], m: ProjectModel, tab: Tab, list: ListQuery, held: ReadonlyMap<number, string>): Row[] {
  const shownNow = new Set(visible(m.items, tab, list).map((it) => it.n))
  // a row made a subitem meanwhile: its new parent folds at once
  const parents = new Set(frozen.flatMap((r) => (r.kind === 'item' || r.kind === 'needs' || r.kind === 'held' ? [m.byN.get(r.it.n)?.parent] : [])))
  return frozen.map((r) => {
    if (r.kind !== 'item' && r.kind !== 'needs' && r.kind !== 'held') return r
    const it = m.byN.get(r.it.n) || r.it
    const said = held.get(it.n)
    if (said != null && !shownNow.has(it.n)) return { kind: 'held', it, said }
    if (r.kind === 'held') return { kind: 'item', it, depth: 0, foldable: false, folded: false, band: '' }
    if (r.kind === 'needs' && !needsYou(it)) return { kind: 'item', it, depth: r.depth, foldable: false, folded: false, band: '' }
    return r.kind === 'item' && !r.foldable && parents.has(it.n) ? { ...r, it, foldable: true } : { ...r, it }
  })
}

export function listBody(m: ProjectModel | null, tab: Tab, list: ListQuery, st: ListState): ListBody {
  if (!m) return { kind: 'loading' }
  const rows = visible(m.items, tab, list)
  const done = (r: Row[], views: boolean): ListBody => ({ kind: 'rows', views, rows: r, shown: rows.length })
  const none = !m.items.length
  if (none && tab === 'rules') return { kind: 'empty', why: 'no-rules', status: list.status }
  if (none && tab === 'archive') return { kind: 'empty', why: 'nothing-archived', status: list.status }
  if (none) return { kind: 'empty', why: 'no-items', status: list.status }
  if (tab === 'items' && list.sort === 'all') {
    const ordered =
      list.status === 'closed' ? [...rows].sort(latestFirst) : list.status === 'wait' ? [...rows].sort(needsOrder) : workOrder(rows)
    const { group, hidden } = hiddenKids(m, ordered, list, st, tab)
    const out: Row[] = []
    if (list.status === 'closed' && ordered.some((it) => !it.archived && closed(it.status)))
      out.push({ kind: 'archive-all', n: ordered.filter((it) => !it.archived && closed(it.status)).length })
    if (!ordered.length) {
      const why = searchWords(list.q).length || list.type !== 'all' || list.pri !== 'all' ? 'no-match' : 'nothing'
      return { kind: 'rows', views: true, rows: out, shown: 0, empty: why }
    }
    out.push(...tree(group, st, { hidden, needs: true }))
    return done(out, true)
  }
  if (!rows.length && filtered(tab, list)) return { kind: 'empty', why: tab === 'rules' ? 'no-match-rules' : 'no-match', status: list.status }
  if (tab === 'rules') {
    if (!rows.length) return { kind: 'empty', why: 'no-rules', status: list.status }
    const wait = rows.filter((it) => it.status === 'proposed' || needsYou(it)).sort(needsOrder)
    const on = rows.filter((it) => it.status === 'open' && !needsYou(it))
    const off = rows.filter((it) => it.status === 'dropped' && !needsYou(it))
    const out: Row[] = needsBand(wait, st)
    const plain = (it: Item, band = ''): Row => ({ kind: 'item', it, depth: 0, foldable: false, folded: false, band })
    if (on.length) out.push({ kind: 'zone', zone: 'rules', label: 'Active', n: on.length }, ...on.map((it) => plain(it)))
    if (off.length) out.push({ kind: 'zone', zone: 'retired', label: 'Retired', n: off.length }, ...off.map((it) => plain(it, 'retired')))
    return done(out, false)
  }
  // Archive, or Items in another order: the list in that order; what waits on you is the Needs-you row there too
  const out: Row[] = rows.map((it) =>
    needsYou(it) ? { kind: 'needs', it, depth: 0 } : { kind: 'item', it, depth: 0, foldable: false, folded: false, band: '' },
  )
  if (!rows.length) return { kind: 'rows', views: tab === 'archive', rows: [], shown: 0, empty: tab === 'archive' ? 'nothing-archived' : 'none' }
  return done(out, tab === 'archive')
}

/** The preset views of Items, in their order (Active is the one shown first: its value is "all"). */
export const VIEWS: [string, string][] = [
  ['wait', 'Needs you'],
  ['all', 'Active'],
  ['every', 'All'],
  ['archive', 'Archive'],
  ['queued', 'Queue'],
  ['later', 'Later'],
  ['closed', 'Finished'],
]

export interface ViewChip {
  value: string
  label: string
  count: number
  on: boolean
  dot: boolean
}

/** The views' row: each view with what it would show now (the search and filters set count too). */
export function viewChips(m: ProjectModel, tab: Tab, list: ListQuery): ViewChip[] {
  return VIEWS.map(([value, label]) => {
    if (value === 'archive') {
      const n = visible(m.items, 'archive', tab === 'archive' ? list : { ...list, status: 'all' }).length
      return { value, label, count: n, on: tab === 'archive', dot: false }
    }
    const asItems = tab !== 'items' ? { q: list.q, type: 'all', when: 'all', status: value, pri: 'all', sort: 'all' } : { ...list, status: value }
    const n = visible(m.items, 'items', asItems).length
    return { value, label, count: n, on: tab === 'items' && list.status === value, dot: value === 'wait' && n > 0 }
  })
}
