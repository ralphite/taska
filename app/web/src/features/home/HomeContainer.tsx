// The home page with the page's data: the projects as last listed (asked again on coming here), the search across
// every project, a new project, and the note a deleted or unknown project's link brought.

import { useEffect, useMemo, useState } from 'react'
import { useServices, useStores, useStoreValue } from '../../app/context'
import { lastAgent } from '../../model/agents'
import { homeOrder } from '../../model/projects'
import type { Route } from '../../model/route'
import { projectTones, toneOf } from '../../ui/tones'
import { Home, type HomeEvents, type HomeRow } from './Home'

type HomeRoute = Extract<Route, { page: 'home' }>

export function HomeContainer({ route }: { route: HomeRoute }) {
  const app = useServices('crossSearch', 'fields', 'projects')
  const stores = useStores('data', 'route', 'search')
  const projects = useStoreValue(stores.data, (s) => s.projects)
  const needs = useStoreValue(stores.data, (s) => s.needs)
  const at = useStoreValue(stores.data, (s) => s.listedAt)
  const away = useStoreValue(stores.data, (s) => s.listAway)
  const hits = useStoreValue(stores.search, (s) => s.last)
  const [q, setQ] = useState('')
  // the note the link brought stays until closed; the address goes back to plain /
  const [gone, setGone] = useState(() => {
    const name = route.query.get('gone')
    return name ? { name, said: '' } : null
  })
  const [none, setNone] = useState(() => route.query.get('none'))
  const [making, setMaking] = useState<{ error: string } | null>(null)

  useEffect(() => {
    void app.projects.refresh()
    if (route.query.get('gone') || route.query.get('none')) stores.route.getState().go('/', false)
    // once, on coming here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app])

  const rows = useMemo((): HomeRow[] | null => {
    if (!projects) return null
    const tones = projectTones(projects.map((p) => p.name))
    return homeOrder(projects).map((p) => {
      const top = needs.find((x) => x.project === p.name)
      return {
        name: p.name,
        title: p.title || p.name,
        tone: toneOf(tones, p.name),
        open: p.open,
        needs: p.needs,
        agent: lastAgent(p.agents, at),
        next: top ? { code: top.code, title: top.title } : null,
      }
    })
  }, [projects, needs, at])

  const open = (url: string) => stores.route.getState().go(url, true)
  const on: HomeEvents = {
    query: (v) => {
      setQ(v)
      app.crossSearch.want(v.trim(), '', 250)
    },
    restore: async () => {
      if (!gone) return
      const r = await app.projects.restore(gone.name)
      if ('name' in r) open(`/p/${encodeURIComponent(gone.name)}/`)
      else setGone({ ...gone, said: r.error })
    },
    closeGone: () => setGone(null),
    closeNone: () => setNone(null),
    startNew: () => setMaking({ error: '' }),
    cancelNew: () => setMaking(null),
    create: async (title) => {
      const r = await app.projects.create(title)
      if ('name' in r) open(`/p/${r.name}/`)
      else setMaking({ error: r.error })
    },
    open,
  }

  return <Home facts={{ rows, needs: needs.length, away, gone, none, q, hits, making }} on={on} searchRef={app.fields.ref('home')} />
}
