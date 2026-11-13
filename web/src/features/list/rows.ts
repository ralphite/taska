// What the item list shows, as a list of rows to draw: worked out from the project, the list's settings and the
// list's own state (folded parents, held rows). Pure, so it is tested alone and the list component only draws.

import { closed, latestFirst, needsOrder, workOrder } from '../../model/items'
import { needRow, needsYou, type NeedAct } from '../../model/needStates'
import type { ProjectModel } from '../../model/project'
import type { ListQuery } from '../../model/route'
import { rulesDoc, waitingProposals } from '../../model/rules'
import type { Item, RuleProposal } from '../../model/types'
import { filtered, inWorkOrder, visible } from '../../model/visible'
import { STATUS_FILTER_WORD, TAB_WORD, type Tab } from '../../model/words'

export type Row =
  /** `said`: what you just did to it, while the list holds still (it is no longer in the list, or no longer waits on you) */
  | { kind: 'item'; it: Item; depth: number; foldable: boolean; folded: boolean; band: string; said?: string; struck?: boolean }
  | { kind: 'needs'; it: Item; depth: number; said?: string; struck?: boolean; act?: NeedAct }
  | { kind: 'hidden-kids'; parent: number; depth: number; open: boolean; later: number }
  | { kind: 'archive-all'; n: number }
  /** an agent's proposed change to the rules, waiting on you (I693): first in Needs you */
  | { kind: 'proposal'; p: RuleProposal }

export type EmptyWhy = 'no-items' | 'none' | 'nothing-archived' | 'no-match' | 'nothing'

export type ListBody =
  | { kind: 'loading' }
  | { kind: 'empty'; why: EmptyWhy; status: string }
  /** rows to draw; `views`: the views' row above them; `empty`: nothing to show under it, and why */
  | { kind: 'rows'; views: boolean; rows: Row[]; shown: number; empty?: EmptyWhy }

export interface ListState {
  folded: ReadonlySet<number>
  /** parents whose hidden subitems are shown under them */
  subMore: ReadonlySet<number>
  open: number | null
  desk: boolean
}

const MAX_DEPTH = 8

/** The subitems the plain Active view hides (in Later) under each parent it shows; finished ones are not listed (T622). */
function hiddenKids(m: ProjectModel, rows: Item[], list: ListQuery, st: ListState, tab: Tab) {
  const hidden = new Map<number, Item[]>()
  const group = [...rows]
  if (list.status !== 'all' || filtered(tab, list)) return { group, hidden }
  const shown = new Set(rows.map((it) => it.n))
  for (let i = 0; i < group.length; i++) {
    const p = group[i]
    const more = workOrder((m.kids.get(p.n) || []).filter((k) => !shown.has(k.n) && !closed(k.status) && k.when === 'later'))
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

function tree(group: Item[], st: ListState, opts: { needs?: boolean; hidden?: Map<number, Item[]> }): Row[] {
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
        band: '',
      })
    if (st.folded.has(it.n) || d >= MAX_DEPTH) return
    for (const k of group) if (k.parent === it.n) add(k, d + 1)
    if (more) {
      out.push({ kind: 'hidden-kids', parent: it.n, depth: d + 1, open: st.subMore.has(it.n), later: more.length })
    }
  }
  for (const it of group) if (!(it.parent && inGroup.has(it.parent))) add(it, 0)
  return out
}

/** While a row you acted on holds still, the list keeps the rows it had, each showing its item as it is now. A row you
 * acted on that no longer belongs in the list, or no longer waits on you, stays the row it was, its title struck and
 * its button saying what you did: same place, same height, nothing jumps (B699). A Needs-you row someone else
 * answered meanwhile is an ordinary row, where it was. */
/** What you just did to a row: its words, and whether its title is struck (the change closed it; B766). */
export interface HeldMark {
  said: string
  struck: boolean
}

/** A held change's mark: struck only when it closed the item (B766, Yadong r1293 r1294: struck says done, dropped
 * or not needed; approved or sent back it is work to do); a change of another field as before (B699). */
export const heldMark = (h: { said: string; f?: string; v?: unknown }): HeldMark => ({ said: h.said, struck: h.f !== 'status' || closed(String(h.v)) })

export function heldRows(frozen: readonly Row[], m: ProjectModel, tab: Tab, list: ListQuery, held: ReadonlyMap<number, HeldMark>): Row[] {
  const shownNow = new Set(visible(m.items, tab, list).map((it) => it.n))
  // a row made a subitem meanwhile: its new parent folds at once
  const parents = new Set(frozen.flatMap((r) => (r.kind === 'item' || r.kind === 'needs' ? [m.byN.get(r.it.n)?.parent] : [])))
  return frozen.map((r) => {
    if (r.kind !== 'item' && r.kind !== 'needs') return r
    const it = m.byN.get(r.it.n) || r.it
    const mark = held.get(it.n)
    const said = mark?.said
    const struck = !!mark?.struck
    // what you decided shows at once, also before Taska has it and the item still needs you (B766): its button as it was
    if (said != null && r.kind === 'needs') return { ...r, it, said, struck, act: r.act ?? needRow(r.it)?.act }
    if (said != null && !shownNow.has(it.n)) return { ...r, it, said, struck }
    if (r.kind === 'needs' && !needsYou(it)) return { kind: 'item', it, depth: r.depth, foldable: false, folded: false, band: '' }
    return r.kind === 'item' && !r.foldable && parents.has(it.n) ? { ...r, it, foldable: true } : { ...r, it }
  })
}

export function listBody(m: ProjectModel | null, tab: Tab, list: ListQuery, st: ListState): ListBody {
  if (!m) return { kind: 'loading' }
  const rows = visible(m.items, tab, list)
  const done = (r: Row[], views: boolean): ListBody => ({ kind: 'rows', views, rows: r, shown: rows.length })
  const none = !m.items.length
  // a proposed change to the rules waits on you first in Items' own order (and in Needs you), as the items do
  const proposals: Row[] = tab === 'items' && list.sort === 'all' && (list.status === 'all' || list.status === 'wait') && list.type === 'all' && list.pri === 'all' && list.when === 'all' ? waitingProposals(rulesDoc(m)).map((p) => ({ kind: 'proposal', p })) : []
  if (none && proposals.length) return done(proposals, true)
  if (none && tab === 'archive') return { kind: 'empty', why: 'nothing-archived', status: list.status }
  if (none) return { kind: 'empty', why: 'no-items', status: list.status }
  if (tab === 'items' && list.sort === 'all') {
    const ordered = !inWorkOrder(tab, list) ? [...rows].sort(list.status === 'wait' ? needsOrder : latestFirst) : workOrder(rows)
    const { group, hidden } = hiddenKids(m, ordered, list, st, tab)
    const out: Row[] = []
    if ((list.status === 'done' || list.status === 'dropped') && ordered.some((it) => !it.archived && closed(it.status)))
      out.push({ kind: 'archive-all', n: ordered.filter((it) => !it.archived && closed(it.status)).length })
    out.push(...proposals)
    if (!ordered.length) {
      const why = list.type !== 'all' || list.pri !== 'all' ? 'no-match' : 'nothing'
      return { kind: 'rows', views: true, rows: out, shown: 0, ...(out.length ? {} : { empty: why }) }
    }
    out.push(...tree(group, st, { hidden, needs: true }))
    return done(out, true)
  }
  if (!rows.length && filtered(tab, list)) return { kind: 'empty', why: 'no-match', status: list.status }
  // Archive, or Items in another order: the list in that order; what waits on you is the Needs-you row there too
  const out: Row[] = rows.map((it) =>
    needsYou(it) ? { kind: 'needs', it, depth: 0 } : { kind: 'item', it, depth: 0, foldable: false, folded: false, band: '' },
  )
  if (!rows.length) return { kind: 'rows', views: tab === 'archive', rows: [], shown: 0, empty: tab === 'archive' ? 'nothing-archived' : 'none' }
  return done(out, tab === 'archive')
}

/** The preset views of Items, in their order (Active is the one shown first: its value is "all"). */
export const VIEWS: [string, string][] = [
  ['wait', STATUS_FILTER_WORD.wait],
  ['all', 'Active'],
  ['every', 'All'],
  ['archive', TAB_WORD.archive],
  ...(['open', 'later', 'done', 'dropped'] as const).map((v): [string, string] => [v, STATUS_FILTER_WORD[v]]),
]

export interface ViewChip {
  value: string
  label: string
  count: number
  on: boolean
  /** shows the Needs you mark: the Needs you view, with something waiting */
  needs: boolean
}

/** The views' row: each view with what it would show now (the filters set count too). */
export function viewChips(m: ProjectModel, tab: Tab, list: ListQuery): ViewChip[] {
  return VIEWS.map(([value, label]) => {
    if (value === 'archive') {
      const n = visible(m.items, 'archive', tab === 'archive' ? list : { ...list, status: 'all' }).length
      return { value, label, count: n, on: tab === 'archive', needs: false }
    }
    const asItems = tab !== 'items' ? { type: 'all', when: 'all', status: value, pri: 'all', sort: 'all' } : { ...list, status: value }
    // a proposed change to the rules is in Needs you too (I693)
    const n = visible(m.items, 'items', asItems).length + (value === 'wait' && asItems.type === 'all' && asItems.pri === 'all' && asItems.when === 'all' ? waitingProposals(rulesDoc(m)).length : 0)
    return { value, label, count: n, on: tab === 'items' && list.status === value, needs: value === 'wait' && n > 0 }
  })
}
