import { useEffect, useState } from 'react'
// The pane beside the list on the desktop (the whole screen on the phone): an item, a document, or the New input
// page's head.

import { useTwoColumns } from './twoColumns'
import { useLayout, useServices, useStores, useStoreValue } from '../app/context'
import { usePaneRef } from '../app/panes'
import { useAway, useProjectModel, type ProjectRoute } from '../app/hooks'
import { codeOf, liveN } from '../model/project'
import { Icon } from '../ui/Icon'
import { BackTo, ItemActs, ItemHead, ItemNav, Missing, NoSelection } from '../features/item/ItemPage'
import { ItemPageContainer, openItemMenu, openLater } from '../features/item/ItemPageContainer'
import { PaneFrame } from '../ui/PaneFrame'
import { OfflinePill } from './Header'
import { DeletedPickContainer } from '../features/side/SideListContainer'
import { DocPaneContainer, DocSheetContainer } from '../features/docs/DocContainer'
import { composing } from '../model/route'
import { RulesContainer } from '../features/docs/RulesContainer'

export function DetailContainer({ route, place, hidden, full = false, footRoom = 0 }: { route: ProjectRoute; place: string; hidden?: boolean; full?: boolean; footRoom?: number }) {
  const app = useServices('items', 'listOrder', 'nav', 'sheets', 'toasts')
  const stores = useStores('docView', 'route', 'ui')
  const layout = useLayout()
  const desk = layout === 'desk'
  const pane = usePaneRef('detail')
  const m = useProjectModel(route.slug)
  const away = useAway(route.slug)
  const dn = route.place.kind === 'doc' ? route.place.d : null
  const doc = dn != null ? m?.docs.find((x) => x.d === dn) : undefined
  // a document: on the desktop in the pane; on the phone over its item
  const n = route.place.kind === 'item' ? Number(/\d+/.exec(route.place.ref)?.[0]) : doc && !desk ? doc.n : null
  const it = m && n ? m.byN.get(liveN(m, n)) : undefined
  const compose = composing(route)
  const back = () => app.nav.closeItem()
  const from = useStoreValue(stores.route, (s) => s.from)
  // the desktop's two columns, while the pane is wide: the item (or its document) on the left, its talk on the right
  const [body, setBody] = useState<HTMLElement | null>(null)
  // the phone: the item's title scrolled out of sight, the bar says it (D115 R8 #5)
  // (kept by the item whose title it is, so another item opens with its title in the page)
  const [titledRef, setTitledRef] = useState<string | null>(null)
  const itemN = route.place.kind === 'item' ? route.place.ref : ''
  const titled = !!itemN && titledRef === itemN
  // the item's talk, for the pane's button to its end (F716)
  const [talk, setTalk] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const h = !desk && body ? body.querySelector('[data-part=item-title]') : null
    if (!h || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setTitledRef(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0) ? itemN : null), { root: body })
    io.observe(h)
    return () => io.disconnect()
  }, [body, desk, itemN])
  const duo = useStoreValue(stores.ui, (s) => s.duo)
  const editingDoc = useStoreValue(stores.docView, (s) => s.editing)
  const docIt = doc && m ? m.byN.get(liveN(m, doc.n)) : undefined
  useTwoColumns(desk && !hidden ? body : null, desk && !compose && (!!it || (!!doc && !editingDoc && !!docIt)), !!doc && !editingDoc, (on) => stores.ui.getState().setDuo(on))
  // the Rules tab: the rules document (I693), over both columns on the desktop
  if (route.tab === 'rules' && (route.place.kind === 'tab' || route.place.kind === 'rules')) return <RulesContainer route={route} place={place} hidden={hidden} />
  // a document the address names: on the desktop in the pane; on the phone, while it loads or when it is not in the
  // project, in the pane too (one that is there opens over its item, below)
  if (dn != null && (desk || !doc)) {
    if (doc)
      return (
        <DocPaneContainer
          route={route}
          dn={dn}
          place={place}
          hidden={hidden}
          bodyRef={setBody}
          beside={duo && docIt && m ? (view, web) => <ItemPageContainer key={docIt.n} it={docIt} m={m} slug={route.slug} tab={route.tab} desk left={view} bare={web} onTalk={setTalk} /> : undefined}
          talk={talk}
        />
      )
    return (
      <PaneFrame place={place} hidden={hidden} desk={desk} paneRef={pane} head={<span className="font-mono text-sm font-bold">D{dn}</span>} onBack={back}>
        <Missing what={`D${dn}`} loading={!m} away={away >= 2} />
      </PaneFrame>
    )
  }
  if (it && m) {
    const code = codeOf(m, it.n)
    const nav = {
      prev: () => app.nav.step(-1, app.listOrder, (k) => codeOf(m, k), (w) => app.toasts.show(w)),
      next: () => app.nav.step(1, app.listOrder, (k) => codeOf(m, k), (w) => app.toasts.show(w)),
      full: () => app.nav.full(!full),
    }
    const set = (f: 'when' | 'archived' | 'status', v: string | boolean) => {
      if (f === 'archived') {
        void app.items.change(it.n, 'archived', v)
        if (v) back()
      } else void app.items.change(it.n, f, v)
    }
    return (
      <PaneFrame
        place={place}
        hidden={hidden}
        desk={desk}
        paneRef={pane}
        bodyRef={setBody}
        duo={duo && desk}
        split
        // the phone's document over its item hides the talk
        toEnd={doc && !desk ? null : talk}
        head={<ItemHead it={it} code={code} titled={titled} />}
        acts={<ItemActs it={it} on={{ set, later: (from) => openLater(app, desk, it.n, from) }} />}
        nav={<ItemNav full={full} on={nav} />}
        menu
        notice={!desk && away >= 2 ? <OfflinePill /> : null}
        onBack={back}
        onMenu={(from) => openItemMenu(app, desk, it.n, null, from)}
      >
        <ItemPageContainer key={it.n} it={it} m={m} slug={route.slug} tab={route.tab} desk={desk} onTalk={setTalk} />
        {doc && !desk ? <DocSheetContainer slug={route.slug} dn={doc.d} footRoom={footRoom} /> : null}
      </PaneFrame>
    )
  }
  if (route.place.kind === 'item')
    return (
      <PaneFrame place={place} hidden={hidden} desk={desk} paneRef={pane} head={<span className="font-mono text-sm font-bold">{route.place.ref.toUpperCase()}</span>} onBack={back}>
        <Missing what={route.place.ref.toUpperCase()} loading={!m} away={away >= 2} />
      </PaneFrame>
    )
  const side = route.place.kind === 'side' ? route.place.side : null
  // opened from an item or a document: the way back to it
  const fromCode = from && m && /^[A-CE-Z]\d+$/.test(from) ? codeOf(m, Number(from.slice(1))) : from // D89 is a document
  return (
    <PaneFrame
      place={place}
      hidden={hidden}
      desk={desk}
      paneRef={pane}
      onBack={back}
      bar={!side}
      nav={compose && fromCode ? <BackTo label={fromCode} onBack={() => app.nav.composeBack()} /> : null}
      head={
        compose ? (
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Icon n="newinput" c="size-[18px] text-blue-600 dark:text-blue-400" />
            New input
          </span>
        ) : null
      }
    >
      {compose || !side ? null : side === 'deleted' ? <DeletedPickContainer slug={route.slug} /> : <NoSelection side={side} />}
    </PaneFrame>
  )
}
