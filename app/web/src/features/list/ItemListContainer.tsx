// The item list with the page's data: the rows of the list's settings, each with what it shows, and what a tap on
// each part of a row does.

import { useMemo, useRef } from 'react'
import { useApp, useLayout, useStoreValue } from '../../app/context'
import { usePaneRef } from '../../app/panes'
import { useProjectModel, type ProjectRoute } from '../../app/hooks'
import { agoShort } from '../../model/agents'
import { closed, excerpt, lastAgentMessage, queueHead } from '../../model/items'
import { codeOf, type ProjectModel } from '../../model/project'
import type { FileRef, Item } from '../../model/types'
import { searchWords } from '../../model/visible'
import { QUIET_MS } from '../../model/words'
import { unreadSince } from '../../stores/seen'
import { EmptyList, ItemList, type DrawnRow, type ListEvents } from './ItemList'
import type { RowFacts, RowLook } from './ListRows'
import { workerTip } from './ListRows'
import { heldRows, listBody, viewChips, type Row } from './rows'

/** An item's own files: those of the inputs it was made from (a reply keeps its files to itself). */
function filesOf(m: ProjectModel, it: Item): FileRef[] {
  const replies = new Set(it.thread.filter((x) => x.by === 'you' && x.src).map((x) => x.src))
  const seen = new Set<string>()
  const out: FileRef[] = []
  for (const rid of it.srcs)
    if (!replies.has(rid))
      for (const f of m.byId.get(rid)?.files || [])
        if (!seen.has(f.f)) {
          seen.add(f.f)
          out.push(f)
        }
  return out
}

/** The line a search word was found in, when it is not in the code or title. */
function hitLine(it: Item, code: string, words: string[], shown = ''): string | null {
  const title = (code + ' ' + it.title + ' ' + shown).toLowerCase()
  const w = words.find((x) => !title.includes(x))
  if (!w) return null
  const text = [it.body, it.next, ...it.thread.map((x) => x.text)].find((t) => (t || '').toLowerCase().includes(w)) || ''
  const at = text.toLowerCase().indexOf(w)
  const from = Math.max(0, at - 12)
  const line = ((from ? '…' : '') + text.slice(from, at + w.length + 80)).replace(/[*`#>]+/g, '').replace(/\s+/g, ' ').trim()
  return line || null
}

export function ItemListContainer({ route }: { route: ProjectRoute }) {
  const app = useApp()
  const layout = useLayout()
  const m = useProjectModel(route.slug)
  const ui = useStoreValue(app.stores.ui, (s) => s)
  const pane = usePaneRef('list')
  const frozen = useRef<{ key: string; rows: Row[] } | null>(null)
  const desk = layout === 'desk'
  const openN = route.place.kind === 'item' ? Number(/\d+/.exec(route.place.ref)?.[0]) : null
  const listKey = JSON.stringify([route.slug, route.tab, route.list])
  const words = useMemo(() => searchWords(route.list.q), [route.list.q])

  const body = useMemo(
    () => listBody(m, route.tab, route.list, { folded: ui.folded, subMore: ui.subMore, needsAll: ui.needsAll, open: openN, desk }),
    [m, route.tab, route.list, ui.folded, ui.subMore, ui.needsAll, openN, desk],
  )
  // while a row you acted on holds still the list keeps the rows it had
  const holding = ui.held.size > 0 && ui.heldFor === listKey
  let rows: Row[] = []
  if (body.kind === 'rows') {
    if (holding && frozen.current?.key === listKey && m) rows = heldRows(frozen.current.rows, m, route.tab, route.list, new Map([...ui.held].map(([n, h]) => [n, h.said])))
    else {
      rows = body.rows
      frozen.current = { key: listKey, rows }
    }
  }

  const head = m ? queueHead(m.items) : undefined
  const seen = app.seen.of(route.slug)
  const facts = (it: Item): RowFacts => {
    const mm = m as ProjectModel
    const code = codeOf(mm, it.n)
    const kids = mm.kids.get(it.n) || []
    const img = filesOf(mm, it).find((f) => (f.mime || '').startsWith('image/'))
    const a = it.agent
    let worker: RowFacts['worker'] = null
    if (a) {
      const t = new Date(a.t).getTime()
      const quiet = Date.now() - t > QUIET_MS
      const only = (mm.facts.agents.find((x) => x.name === a.by)?.sessions || []).filter((x) => Date.now() - x.t < 3600e3)
      const ses = a.ses || (only.length === 1 ? only[0].name : '')
      worker = { by: a.by, quiet, tip: workerTip(a.by, ses, quiet, agoShort(t)) }
    }
    return {
      code,
      parentCode: it.parent ? codeOf(mm, it.parent) : null,
      image: img ? { f: img.f, src: `/p/${encodeURIComponent(route.slug)}/f/${encodeURIComponent(img.f)}` } : null,
      kids: kids.length ? { done: kids.filter((k) => closed(k.status)).length, all: kids.length } : null,
      openKids: kids.filter((k) => !closed(k.status)).length,
      talk: it.thread.length,
      draft: false,
      next: it.n === head,
      unread: unreadSince(seen, it.n, lastAgentMessage(it)?.t, it.archived),
      worker,
      hitLine: words.length ? hitLine(it, code, words) : null,
    }
  }
  const look = (it: Item): RowLook => ({ current: it.n === openN, selected: ui.selected.has(it.n), words, desk })
  const drawn: DrawnRow[] = rows.map((r, i): DrawnRow => {
    switch (r.kind) {
      case 'item':
        return { kind: 'item', key: 'i' + r.it.n, it: r.it, depth: r.depth, band: r.band, foldable: r.foldable, folded: r.folded, facts: facts(r.it), look: look(r.it) }
      case 'needs': {
        const ex = excerpt(r.it)
        const f = facts(r.it)
        return { kind: 'needs', key: 'i' + r.it.n, it: r.it, depth: r.depth, facts: { ...f, hitLine: words.length ? hitLine(r.it, f.code, words, ex) : null }, look: look(r.it), excerpt: ex }
      }
      case 'held':
        return { kind: 'held', key: 'i' + r.it.n, it: r.it, code: codeOf(m as ProjectModel, r.it.n), said: r.said, height: (ui.held.get(r.it.n)?.height || 0) - 1 }
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

  const on: ListEvents = {
    open: (n) => app.nav.openItem(codeOf(m as ProjectModel, n)),
    act: (n, f, v) => void app.items.change(n, f, f === 'archived' ? v === 'true' : v),
    need: (n, action) => {
      const it = m?.byN.get(n)
      if (!it) return
      if (action === 'approve') void app.items.change(n, 'status', 'open')
      else if (action === 'accept') void app.items.change(n, 'status', 'done')
      else app.nav.openItem(codeOf(m as ProjectModel, n))
    },
    reopen: (n) => void app.items.change(n, 'status', 'doing'),
    fold: (n) => app.stores.ui.getState().toggleFold(n),
    goto: (n) => app.nav.openItem(codeOf(m as ProjectModel, n)),
    picture: () => {},
    view: (value: string) => app.nav.view(value),
    subMore: (n) => app.stores.ui.getState().toggleSubMore(n),
    needsMore: () => app.stores.ui.getState().toggleNeedsAll(),
    archiveAll: () => {},
    ownView: () => {},
  }

  const empty =
    body.kind === 'empty' || (body.kind === 'rows' && body.empty) ? (
      <EmptyList
        why={body.kind === 'empty' ? body.why : (body.empty as string)}
        status={route.list.status}
        organizerOn={!!m?.facts.organizer.on}
        onReset={() => app.nav.setList({ q: '', type: 'all', when: 'all', status: 'all', pri: 'all', sort: 'all' })}
        onConnect={() => app.nav.to(`/p/${encodeURIComponent(route.slug)}/agents`)}
      />
    ) : null
  const views = m && (body.kind === 'rows' && body.views) ? viewChips(m, route.tab, route.list) : null
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onPointerEnter={() => app.listHold.enter()}
      onPointerLeave={() => app.listHold.leave()}
    >
      <ItemList ref={pane} loading={!m} views={views} rows={drawn} empty={body.kind === 'empty' ? empty : body.kind === 'rows' && body.empty ? empty : null} on={on} />
    </div>
  )
}
