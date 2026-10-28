// The list's rows as they are drawn: each row of the list's settings with what it shows (its code, picture, subitems,
// talk, draft, whether it is next, new from an agent, who works on it, where a searched word was found) and how it
// looks (open in the pane, picked, dragged). Pure: the container and the stories draw the same rows from the same data.

import { agoShort } from '../../model/agents'
import { closed, excerpt, lastAgentMessage, type DropHow } from '../../model/items'
import { codeOf, filesOf, type ProjectModel } from '../../model/project'
import type { Item, SavedView } from '../../model/types'
import { showsView, visible } from '../../model/visible'
import type { ListQuery } from '../../model/route'
import { QUIET_MS, type Tab } from '../../model/words'
import { unreadSince, type SeenMap } from '../../stores/seen'
import type { DrawnRow } from './ItemList'
import { workerTip, type RowFacts, type RowLook } from './ListRows'
import { viewChips, type ListBody, type Row, type ViewChip } from './rows'
import type { OwnViewChip } from './ViewBar'

/** What the rows are drawn with besides the project: where you are and what you did on the page. */
export interface DrawWith {
  slug: string
  /** the item open in the pane (or the one whose document is open) */
  openN: number | null
  selected: ReadonlySet<number>
  /** the searched words */
  words: string[]
  desk: boolean
  /** the codes of the items that have a draft */
  drafts: ReadonlySet<string>
  /** the first item of the queue */
  head: number | undefined
  seen: SeenMap
  drag: { n: number | null; at: { n?: number; how: DropHow } | null }
  /** a row held still after you acted on it: the height it had */
  heldHeight(n: number): number
}

/** The line a search word was found in, when it is not in the code or title. */
export function hitLine(it: Item, code: string, words: string[], shown = ''): string | null {
  const title = (code + ' ' + it.title + ' ' + shown).toLowerCase()
  const w = words.find((x) => !title.includes(x))
  if (!w) return null
  const text = [it.body, it.next, ...it.thread.map((x) => x.text)].find((t) => (t || '').toLowerCase().includes(w)) || ''
  const at = text.toLowerCase().indexOf(w)
  const from = Math.max(0, at - 12)
  const line = ((from ? '…' : '') + text.slice(from, at + w.length + 80)).replace(/[*`#>]+/g, '').replace(/\s+/g, ' ').trim()
  return line || null
}

export function rowFacts(m: ProjectModel, it: Item, w: DrawWith): RowFacts {
  const code = codeOf(m, it.n)
  const kids = m.kids.get(it.n) || []
  const img = filesOf(m, it).find((f) => (f.mime || '').startsWith('image/'))
  const a = it.agent
  let worker: RowFacts['worker'] = null
  if (a) {
    const t = new Date(a.t).getTime()
    const quiet = m.at - t > QUIET_MS
    const only = (m.facts.agents.find((x) => x.name === a.by)?.sessions || []).filter((x) => m.at - x.t < 3600e3)
    const ses = a.ses || (only.length === 1 ? only[0].name : '')
    worker = { by: a.by, quiet, tip: workerTip(a.by, ses, quiet, agoShort(t, m.at)) }
  }
  return {
    code,
    parentCode: it.parent ? codeOf(m, it.parent) : null,
    image: img ? { f: img.f, src: `/p/${encodeURIComponent(w.slug)}/f/${encodeURIComponent(img.f)}` } : null,
    kids: kids.length ? { done: kids.filter((k) => closed(k.status)).length, all: kids.length } : null,
    openKids: kids.filter((k) => !closed(k.status)).length,
    talk: it.thread.length,
    draft: w.drafts.has(code),
    next: it.n === w.head,
    unread: unreadSince(w.seen, it.n, lastAgentMessage(it)?.t, it.archived),
    worker,
    hitLine: w.words.length ? hitLine(it, code, w.words) : null,
  }
}

export function rowLook(it: Item, w: DrawWith): RowLook {
  const { drag } = w
  return {
    current: it.n === w.openN,
    selected: w.selected.has(it.n),
    words: w.words,
    desk: w.desk,
    ...(drag.n === it.n ? { drag: 'dragging' as const } : drag.at?.n === it.n && drag.at.how !== 'out' ? { drag: drag.at.how } : {}),
  }
}

export function drawRows(m: ProjectModel, rows: Row[], w: DrawWith): DrawnRow[] {
  return rows.map((r, i): DrawnRow => {
    switch (r.kind) {
      case 'item':
        return { kind: 'item', key: 'i' + r.it.n, it: r.it, depth: r.depth, band: r.band, foldable: r.foldable, folded: r.folded, facts: rowFacts(m, r.it, w), look: rowLook(r.it, w) }
      case 'needs': {
        const ex = excerpt(r.it)
        const f = rowFacts(m, r.it, w)
        return { kind: 'needs', key: 'i' + r.it.n, it: r.it, depth: r.depth, facts: { ...f, hitLine: w.words.length ? hitLine(r.it, f.code, w.words, ex) : null }, look: rowLook(r.it, w), excerpt: ex }
      }
      case 'held':
        return { kind: 'held', key: 'i' + r.it.n, it: r.it, code: codeOf(m, r.it.n), said: r.said, height: w.heldHeight(r.it.n) - 1 }
      case 'zone':
        return { kind: 'zone', key: 'z' + r.zone + i, zone: r.zone, label: r.label, n: r.n }
      case 'hidden-kids':
        return { kind: 'hidden-kids', key: 'h' + r.parent, parent: r.parent, depth: r.depth, open: r.open, later: r.later, done: r.done }
      case 'needs-more':
        return { kind: 'needs-more', key: 'needs-more', open: r.open, rest: r.rest }
      case 'archive-all':
        return { kind: 'archive-all', key: 'archive-all', n: r.n }
    }
  })
}

/** The views over the list: the presets (the one that shows is lit) and your own views after them, each with what
 * it would show; none while the list has no views' row. */
export function listViews(m: ProjectModel, tab: Tab, list: ListQuery, body: ListBody, saved: { list: readonly SavedView[]; edit: number }): { views: ViewChip[] | null; ownViews: OwnViewChip[] | undefined } {
  const presets = body.kind === 'rows' && body.views ? viewChips(m, tab, list) : null
  const lit = tab === 'items' ? saved.list.findIndex((v) => showsView(list, v)) : -1
  const views = presets && lit >= 0 ? presets.map((v) => ({ ...v, on: false })) : presets
  const ownViews = views ? saved.list.map((v, i) => ({ name: v.name, count: visible(m.items, 'items', { ...list, ...v }).length, on: i === lit, editing: saved.edit === i })) : undefined
  return { views, ownViews }
}
