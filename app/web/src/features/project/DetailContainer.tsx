// The pane beside the list on the desktop (the whole screen on the phone): an item, a document, or the New input
// page's head.

import { useApp, useLayout } from '../../app/context'
import { usePaneRef } from '../../app/panes'
import { useAway, useProjectModel, type ProjectRoute } from '../../app/hooks'
import { codeOf, liveN } from '../../model/project'
import { Icon } from '../../ui/Icon'
import { ItemActs, ItemHead, ItemNav, Missing, NoSelection } from '../item/ItemPage'
import { ItemPageContainer } from '../item/ItemPageContainer'
import { PaneFrame } from '../item/PaneFrame'

export function DetailContainer({ route, place, hidden, full = false }: { route: ProjectRoute; place: string; hidden?: boolean; full?: boolean }) {
  const app = useApp()
  const layout = useLayout()
  const desk = layout === 'desk'
  const pane = usePaneRef('detail')
  const m = useProjectModel(route.slug)
  const away = useAway(route.slug)
  const n = route.place.kind === 'item' ? Number(/\d+/.exec(route.place.ref)?.[0]) : null
  const it = m && n ? m.byN.get(liveN(m, n)) : undefined
  const compose = route.place.kind === 'new' || (route.place.kind === 'tab' && route.tab !== 'inputs')
  const back = () => app.nav.closeItem()
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
        split
        head={<ItemHead it={it} code={code} />}
        acts={<ItemActs it={it} on={{ set }} />}
        nav={<ItemNav full={full} on={nav} />}
        menu
        onBack={back}
        onMenu={() => {}}
      >
        <ItemPageContainer key={it.n} it={it} m={m} slug={route.slug} tab={route.tab} desk={desk} />
      </PaneFrame>
    )
  }
  if (route.place.kind === 'item')
    return (
      <PaneFrame place={place} hidden={hidden} desk={desk} paneRef={pane} head={<span className="font-mono text-sm font-bold">{route.place.ref.toUpperCase()}</span>} onBack={back}>
        <Missing what={route.place.ref.toUpperCase()} loading={!m} away={away >= 2} />
      </PaneFrame>
    )
  return (
    <PaneFrame
      place={place}
      hidden={hidden}
      desk={desk}
      paneRef={pane}
      onBack={back}
      head={
        compose ? (
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Icon n="newinput" c="size-[18px] text-blue-600 dark:text-blue-400" />
            New input
          </span>
        ) : null
      }
    >
      {compose ? null : <NoSelection side={null} />}
    </PaneFrame>
  )
}
