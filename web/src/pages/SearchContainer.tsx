// The phone's search page (F479) with the page's data: where the search is, the project you are in (its rows drawn
// as the list draws them), the projects in the sidebar's order; a result opens over it, and Back comes back to it.

import { useEffect, useMemo } from 'react'
import { useServices, useStores, useStoreValue } from '../app/context'
import { useProjectModel, type ProjectRoute } from '../app/hooks'
import { useSideProjects } from '../app/projectLists'
import { draftCodes } from '../model/project'
import { foundPath, type Found } from '../model/find'
import { toneOf } from '../ui/tones'
import type { RowEvents } from '../features/list/ListRows'
import { SearchPage, type SearchEvents } from './SearchPage'
import { searchView } from './searchView'

export function SearchContainer({ route, hidden }: { route: ProjectRoute; hidden: boolean }) {
  const app = useServices('finder', 'nav', 'seen', 'model')
  const stores = useStores('find', 'drafts', 'box', 'route', 'recent')
  const recent = useStoreValue(stores.recent, (x) => x.list)
  const s = useStoreValue(stores.find, (x) => x)
  const m = useProjectModel(route.slug)
  const { list, tones, icons } = useSideProjects(route.slug)
  const draftWords = useStoreValue(stores.drafts, (x) => x.bySlug[route.slug])
  const draftFiles = useStoreValue(stores.box, (x) => x.files)
  useStoreValue(app.seen.rev, (r) => r)
  // the search closed (Back): the microphone stops, nothing under way goes on (drawn again while it is open, as React
  // does in development, it goes on)
  useEffect(() => () => (stores.route.getState().layers.includes('search') ? undefined : app.finder.quit()), [app, stores])
  const open = (x: Found) => app.nav.fromSearch(foundPath(x))
  const v = useMemo(() => {
    const drafts = m ? draftCodes(m, draftWords || stores.drafts.getState().of(route.slug), draftFiles) : new Set<string>()
    const rowOn = (x: Found): RowEvents => ({
      open: () => open(x),
      goto: () => (x.parentCode ? app.nav.fromSearch(`/p/${encodeURIComponent(x.project)}/${encodeURIComponent(x.parentCode)}`) : open(x)),
      act() {},
      need: () => open(x),
      reopen() {},
      fold() {},
      picture() {},
    })
    return searchView(s, { here: route.slug, m, order: (list ?? []).map((p) => p.slug), tone: (slug) => toneOf(tones, slug), icon: (slug) => icons.get(slug), seen: app.seen.of(route.slug), drafts, on: rowOn, now: m?.at ?? 0, recent, model: (slug) => app.model(slug) })
  }, [s, m, list, tones, icons, route.slug, draftWords, draftFiles, recent]) // eslint-disable-line react-hooks/exhaustive-deps
  const on: SearchEvents = {
    leave: () => app.finder.leave(),
    mic: () => void app.finder.listen(),
    stop: () => void app.finder.stop(),
    discard: () => app.finder.discard(),
    clear: () => app.finder.clear(),
    type: (words) => app.finder.type(words),
    search: () => void app.finder.search(),
    pick: (fk, k, side) => app.finder.pick(fk, k, side),
    kind: (value) => app.finder.kind(value as Parameters<typeof app.finder.kind>[0]),
    open,
  }
  return <SearchPage v={v} on={on} hidden={hidden} />
}
