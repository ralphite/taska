import { useState } from 'react'
// The pane beside the list on the desktop (the whole screen on the phone): an item, a document, or the New input
// page's head.

import { useTwoColumns } from './twoColumns'
import { useApp, useLayout, useStoreValue } from '../../app/context'
import { usePaneRef } from '../../app/panes'
import { useAway, useProjectModel, type ProjectRoute } from '../../app/hooks'
import { codeOf, liveN } from '../../model/project'
import { Icon } from '../../ui/Icon'
import { ItemActs, ItemHead, ItemNav, Missing, NoSelection } from '../item/ItemPage'
import { ItemPageContainer, openItemMenu } from '../item/ItemPageContainer'
import { PaneFrame } from '../item/PaneFrame'
import { DeletedPickContainer } from '../side/SideListContainer'
import { DocPaneContainer, DocSheetContainer } from '../docs/DocContainer'

export function DetailContainer({ route, place, hidden, full = false, footRoom = 0 }: { route: ProjectRoute; place: string; hidden?: boolean; full?: boolean; footRoom?: number }) {
  const app = useApp()
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
  const compose = route.place.kind === 'new' || (route.place.kind === 'tab' && route.tab !== 'inputs')
  const back = () => app.nav.closeItem()
  // the desktop's two columns, while the pane is wide: the item (or its document) on the left, its talk on the right
  const [body, setBody] = useState<HTMLElement | null>(null)
  const duo = useStoreValue(app.stores.ui, (s) => s.duo)
  const editingDoc = useStoreValue(app.stores.docView, (s) => s.editing)
  const docIt = doc && m ? m.byN.get(liveN(m, doc.n)) : undefined
  useTwoColumns(desk && !hidden ? body : null, desk && !compose && (!!it || (!!doc && !editingDoc && !!docIt)), !!doc && !editingDoc, (on) => app.stores.ui.getState().setDuo(on))
  if (dn != null && desk) {
    if (doc)
      return (
        <DocPaneContainer
          route={route}
          dn={dn}
          place={place}
          hidden={hidden}
          bodyRef={setBody}
          beside={duo && docIt && m ? (view, web) => <ItemPageContainer key={docIt.n} it={docIt} m={m} slug={route.slug} tab={route.tab} desk left={view} bare={web} /> : undefined}
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
        void app.items.change(it.n, 'archived', v, { note: v ? 'Find it under Archive' : '' })
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
        head={<ItemHead it={it} code={code} />}
        acts={<ItemActs it={it} on={{ set }} />}
        nav={<ItemNav full={full} on={nav} />}
        menu
        onBack={back}
        onMenu={(from) => openItemMenu(app, desk, it.n, null, from)}
      >
        <ItemPageContainer key={it.n} it={it} m={m} slug={route.slug} tab={route.tab} desk={desk} />
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
  return (
    <PaneFrame
      place={place}
      hidden={hidden}
      desk={desk}
      paneRef={pane}
      onBack={back}
      bar={!side}
      head={
        compose ? (
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Icon n="newinput" c="size-[18px] text-blue-600 dark:text-blue-400" />
            New input
          </span>
        ) : null
      }
    >
      {compose ? null : side === 'deleted' ? <DeletedPickContainer slug={route.slug} /> : <NoSelection side={side} />}
    </PaneFrame>
  )
}
