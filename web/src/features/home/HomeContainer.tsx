// The home page with the page's data: the projects as last listed (asked again on coming here), the search across
// every project, a new project, and the note a deleted or unknown project's link brought.

import { useEffect, useMemo, useState } from 'react'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import type { Route } from '../../model/route'
import { Home, type HomeEvents } from './Home'
import { homeRows } from './homeRows'

type HomeRoute = Extract<Route, { page: 'home' }>

export function HomeContainer({ route }: { route: HomeRoute }) {
  const app = useServices('crossSearch', 'fields', 'finder', 'projects', 'sheets')
  const desk = useLayout() === 'desk'
  const stores = useStores('data', 'route', 'search')
  const projects = useStoreValue(stores.data, (s) => s.projects)
  const needs = useStoreValue(stores.data, (s) => s.needs)
  const at = useStoreValue(stores.data, (s) => s.listedAt)
  const away = useStoreValue(stores.data, (s) => s.listAway)
  const hits = useStoreValue(stores.search, (s) => s.hits)
  const phase = useStoreValue(stores.search, (s) => s.phase)
  const [q, setQ] = useState('')
  // the note the link brought stays until closed; the address goes back to plain /
  const [gone, setGone] = useState(() => {
    const name = route.query.get('gone')
    return name ? { name, said: '' } : null
  })
  const [none, setNone] = useState(() => route.query.get('none'))

  useEffect(() => {
    void app.projects.refresh()
    if (route.query.get('gone') || route.query.get('none')) stores.route.getState().go('/', false)
    // once, on coming here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app])

  const rows = useMemo(() => (projects ? homeRows(projects, needs, at) : null), [projects, needs, at])

  const open = (url: string) => stores.route.getState().go(url, true)
  const on: HomeEvents = {
    query: (v) => {
      setQ(v)
      app.crossSearch.want(v.trim(), '', 250)
    },
    search: () => app.finder.openDesk(),
    restore: async () => {
      if (!gone) return
      const r = await app.projects.restore(gone.name)
      if ('name' in r) open(`/p/${encodeURIComponent(gone.name)}/`)
      else setGone({ ...gone, said: r.error })
    },
    closeGone: () => setGone(null),
    closeNone: () => setNone(null),
    startNew: (from) => (desk ? app.sheets.openFrom(from, { kind: 'new-project' }, { focus: false }) : app.sheets.open({ kind: 'new-project' }, { focus: false })),
    open,
  }

  return <Home facts={{ rows, needs: needs.length, away, gone, none, q, search: { phase, hits } }} on={on} searchRef={app.fields.ref('home')} />
}
