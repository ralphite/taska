// The item list with the page's data: the rows of the list's settings, each with what it shows, and what a tap on
// each part of a row does.

import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { usePaneRef } from '../../app/panes'
import { useProjectModel, type ProjectRoute } from '../../app/hooks'
import { closed, queueHead } from '../../model/items'
import { forward } from '../../model/actions'
import { codeOf, draftCodes, firstSteps, liveN, type ProjectModel } from '../../model/project'
import { NEW_DRAFT } from '../../model/draftTarget'
import { holdKey } from '../../model/route'
import { filtersSet, visible } from '../../model/visible'
import { EmptyList, ItemList, type DrawnRow, type ListEvents } from './ItemList'
import { SelBar } from './SelBar'
import { FiltersButton } from './Filters'
import { drawRows, listViews } from './drawRows'
import { heldRows, listBody, type Row } from './rows'

/** the list marks no words: searching is the search page's and dialog's (r1092, T689 #2) */
const NO_WORDS: string[] = []

export function ItemListContainer({ route }: { route: ProjectRoute }) {
  const app = useServices('fields', 'itemDrag', 'items', 'listHold', 'listOrder', 'media', 'nav', 'seen', 'selection', 'sheets', 'views', 'voice')
  const stores = useStores('box', 'drafts', 'drag', 'route', 'ui', 'views')
  const layout = useLayout()
  const m = useProjectModel(route.slug)
  const ui = useStoreValue(stores.ui, (s) => s)
  const paneRef = usePaneRef('list')
  const fieldRef = app.fields.ref('list')
  const pane = useCallback(
    (el: HTMLDivElement | null) => {
      paneRef(el)
      fieldRef(el)
    },
    [paneRef, fieldRef],
  )
  // the rows of the last drawing that did not hold still (React's way to keep what an earlier drawing had)
  const [kept, setKept] = useState<{ key: string; rows: Row[] } | null>(null)
  const desk = layout === 'desk'
  // the item open, or the one whose document is open
  const docN = route.place.kind === 'doc' ? (m?.docs.find((x) => x.d === (route.place as { d: number }).d)?.n ?? null) : null
  const openN = route.place.kind === 'item' ? Number(/\d+/.exec(route.place.ref)?.[0]) : docN != null && m ? liveN(m, docN) : null
  const listKey = JSON.stringify([route.slug, route.tab, route.list])

  const body = useMemo(
    () => listBody(m, route.tab, route.list, { folded: ui.folded, subMore: ui.subMore, needsAll: ui.needsAll, open: openN, desk }),
    [m, route.tab, route.list, ui.folded, ui.subMore, ui.needsAll, openN, desk],
  )
  // while a row you acted on holds still the list keeps the rows it had
  const heldFor = holdKey(route, desk)
  const holding = ui.held.size > 0 && ui.heldFor === heldFor
  useLayoutEffect(() => {
    // another list, or (the desktop) another item in the pane: the rows held let go, and the list is as it is now
    if (ui.held.size && ui.heldFor !== heldFor) stores.ui.getState().release()
  }, [ui.held, ui.heldFor, heldFor, stores])
  let rows: Row[] = []
  if (body.kind === 'rows') {
    if (holding && kept?.key === listKey && m) rows = heldRows(kept.rows, m, route.tab, route.list, new Map([...ui.held].map(([n, h]) => [n, h.said])))
    else {
      rows = body.rows
      if (kept?.key !== listKey || kept.rows !== rows) setKept({ key: listKey, rows })
    }
  }

  const head = m ? queueHead(m.items) : undefined
  const draftWords = useStoreValue(stores.drafts, (s) => s.bySlug[route.slug])
  const draftFiles = useStoreValue(stores.box, (s) => s.files)
  const drafts = useMemo(() => (m ? draftCodes(m, draftWords || stores.drafts.getState().of(route.slug), draftFiles) : new Set<string>()), [m, draftWords, draftFiles, stores, route.slug])
  useStoreValue(app.seen.rev, (r) => r) // a dot goes once its item is seen
  const seen = app.seen.of(route.slug)
  const drag = useStoreValue(stores.drag, (s) => s)
  const drawn: DrawnRow[] = m
    ? drawRows(m, rows, { slug: route.slug, openN, selected: ui.selected, words: NO_WORDS, desk, drafts, head, seen, drag })
    : []

  // Previous and Next walk the items as the list shows them
  const order = drawn.flatMap((r) => (r.kind === 'item' || r.kind === 'needs' ? [r.it.n] : []))
  const orderKey = order.join(',')
  useLayoutEffect(() => app.listOrder.set(orderKey ? orderKey.split(',').map(Number) : [], openN), [app, orderKey, openN])
  useLayoutEffect(() => {
    // picked rows that left the list are let go
    const sel = stores.ui.getState().selected
    if (!sel.size) return
    const there = new Set(order)
    if ([...sel].some((n) => !there.has(n))) stores.ui.getState().setSelected(new Set([...sel].filter((n) => there.has(n))))
  }, [app, orderKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // the phone's swipe right: the row's way forward (an answer opens its card)
  const swipe = {
    right: (key: string) => {
      const n = Number(key)
      const r = forward(m?.byN.get(n))
      if (!r) return null
      return r[0] === 'need' ? { slide: false, run: () => on.need(n, r[1]) } : { slide: true, run: () => on.act(n, r[0], r[1], r[2]) }
    },
    blocked: () => stores.route.getState().layers.includes('drawer'),
  }
  const on: ListEvents = {
    open: (n, how) => (desk && how && (how.metaKey || how.ctrlKey || how.shiftKey) ? app.selection.pick(n, how.shiftKey) : app.nav.openItem(codeOf(m as ProjectModel, n))),
    act: (n, f, v, _label, from) => {
      // Later asks until when (D115 #21): at its button on the desktop, a sheet on the phone
      if (f === 'when' && v === 'later') return desk && from ? app.sheets.openFrom(from, { kind: 'later', n }, { focus: false }) : app.sheets.open({ kind: 'later', n }, { focus: false })
      void app.items.change(n, f, f === 'archived' ? v === 'true' : v)
    },
    need: (n, action) => {
      const it = m?.byN.get(n)
      if (!it) return
      if (action === 'approve') void app.items.change(n, 'status', 'open')
      else if (action === 'accept') void app.items.change(n, 'status', 'done')
      else app.nav.openItem(codeOf(m as ProjectModel, n))
    },
    reopen: (n) => void app.items.change(n, 'status', 'open'),
    fold: (n) => stores.ui.getState().toggleFold(n),
    goto: (n) => app.nav.openItem(codeOf(m as ProjectModel, n)),
    picture: (_group, f) => app.media.view(route.slug, [f], f),
    view: (value: string) => app.nav.view(value),
    subMore: (n) => stores.ui.getState().toggleSubMore(n),
    needsMore: () => stores.ui.getState().toggleNeedsAll(),
    archiveAll: () => m && app.items.archiveAll(visible(m.items, route.tab, route.list).filter((it) => !it.archived && closed(it.status)).map((it) => it.n)),
    ownView: (i) => app.views.show(i),
    dragStart: (n) => app.itemDrag.start(n),
    dragOver: (n, y) => app.itemDrag.over(n, y),
    drop: () => app.itemDrag.drop(),
    dragEnd: () => app.itemDrag.end(),
    ownMenu: (i, x, y) => app.sheets.open({ kind: 'view-menu', i }, { pop: true, focus: false, at: { x, y } }),
    rename: (i, name) => app.views.rename(i, name),
    renameStop: () => stores.views.getState().setEdit(-1),
  }

  const empty =
    body.kind === 'empty' || (body.kind === 'rows' && body.empty) ? (
      <EmptyList
        why={body.kind === 'empty' ? body.why : (body.empty as string)}
        status={route.list.status}
        organizerOn={!!m?.facts.organizer.on}
        onReset={() => app.nav.setList({ type: 'all', when: 'all', status: 'all', pri: 'all', sort: 'all' })}
        onConnect={() => app.sheets.open({ kind: 'agents' }, { tall: true, wide: true })}
        firstRun={
          m
            ? {
                ...firstSteps(m),
                on: {
                  connect: () => app.sheets.open({ kind: 'agents' }, { tall: true, wide: true }),
                  // the first input said: New input, recording at once
                  say: () => {
                    app.nav.newInput()
                    void app.voice.start(route.slug, NEW_DRAFT, null, 'main')
                  },
                  phone: () => app.nav.to(`/p/${encodeURIComponent(route.slug)}/phone`),
                },
              }
            : null
        }
      />
    ) : null
  const saved = useStoreValue(stores.views, (s) => s)
  const { views, ownViews } = m ? listViews(m, route.tab, route.list, body, saved) : { views: null, ownViews: undefined }
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onPointerEnter={() => app.listHold.enter()}
      onPointerLeave={() => app.listHold.leave()}
    >
      <ItemList
        ref={pane}
        desk={desk}
        openN={openN}
        itemShown={route.place.kind === 'item'}
        listKey={route.tab}
        dragging={drag.n != null ? { out: drag.at?.how === 'out' } : null}
        viewsMore={desk ? { open: ui.viewsOpen, toggle: () => stores.ui.getState().setViewsOpen(!ui.viewsOpen) } : undefined}
        viewsLead={desk ? <FiltersButton set={filtersSet(route.tab, route.list).length > 0} open={ui.deskFilters} onClick={() => stores.ui.getState().setDeskFilters(!ui.deskFilters)} /> : undefined}
        top={ui.selected.size && desk ? <SelBar n={ui.selected.size} on={{ set: (f, v, said) => app.selection.set(f, v, said), clear: () => app.selection.clear() }} /> : undefined}
        swipe={swipe}
        loading={!m}
        views={views}
        ownViews={ownViews}
        rows={drawn}
        empty={body.kind === 'empty' ? empty : body.kind === 'rows' && body.empty ? empty : null}
        on={on}
      />
    </div>
  )
}
