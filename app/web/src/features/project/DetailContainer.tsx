// The pane beside the list on the desktop (the whole screen on the phone): an item, a document, or the New input
// page's head.

import { useApp, useLayout } from '../../app/context'
import { useProjectModel, type ProjectRoute } from '../../app/hooks'
import { liveN } from '../../model/project'
import { ItemPane } from '../item/ItemPane'
import { PaneFrame } from '../item/PaneFrame'
import { Icon } from '../../ui/Icon'

export function DetailContainer({ route, place, hidden }: { route: ProjectRoute; place: string; hidden?: boolean }) {
  const app = useApp()
  const layout = useLayout()
  const m = useProjectModel(route.slug)
  const n = route.place.kind === 'item' ? Number(/\d+/.exec(route.place.ref)?.[0]) : null
  const it = m && n ? m.byN.get(liveN(m, n)) : undefined
  const compose = route.place.kind === 'new' || (route.place.kind === 'tab' && route.tab !== 'inputs')
  if (it && m)
    return (
      <PaneFrame place={place} hidden={hidden} desk={layout === 'desk'} onBack={() => app.nav.closeItem()}>
        <ItemPane it={it} model={m} slug={route.slug} />
      </PaneFrame>
    )
  return (
    <PaneFrame
      place={place}
      hidden={hidden}
      desk={layout === 'desk'}
      onBack={() => app.nav.closeItem()}
      head={
        compose ? (
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Icon n="newinput" c="size-[18px] text-blue-600 dark:text-blue-400" />
            New input
          </span>
        ) : null
      }
    >
      {route.place.kind === 'item' && m && !it ? <div className="px-6 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">{route.place.ref.toUpperCase()} is not here.</div> : null}
      {route.place.kind === 'item' && !m ? <div className="px-6 py-16 text-center text-sm text-zinc-400">Loading…</div> : null}
    </PaneFrame>
  )
}
