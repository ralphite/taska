// The project page: the window's width picks its layout, the desktop's or the phone's, and nothing else does. The
// two never share layout code; they place the same parts.

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useApp, useLayout, useStoreValue } from '../../app/context'
import { useAway, useProjectModel, type ProjectRoute } from '../../app/hooks'
import { agentLine } from '../../model/agents'
import { needsYou } from '../../model/items'
import { filtered, openCount, tabNumber, visible } from '../../model/visible'
import { TABS, type Tab } from '../../model/words'
import { toneOf } from '../../ui/tones'
import { FootContainer } from '../composer/FootContainer'
import { ToastContainer } from '../feedback/ToastContainer'
import { ItemListContainer } from '../list/ItemListContainer'
import { SidebarContainer, useSideProjects } from '../sidebar/SidebarContainer'
import { DetailContainer } from './DetailContainer'
import { ListHead, PhoneTabs, ProjectBar, type AgentInfo, type TabInfo } from './Header'

function useHeadFacts(route: ProjectRoute) {
  const app = useApp()
  const m = useProjectModel(route.slug)
  const away = useAway(route.slug)
  const notSaved = useStoreValue(app.stores.feedback, (s) => s.notSaved.length)
  const rows = useStoreValue(app.stores.data, (s) => s.projects)
  const title = m?.facts.title || rows?.find((p) => p.name === route.slug)?.title || route.slug
  const otherNeeds = (rows || []).some((p) => p.name !== route.slug && p.needs > 0)
  const agent: AgentInfo | null = m ? { ...agentLine(m.facts.agents, m.facts.work), offline: away >= 2 } : null
  const counts = useMemo(() => {
    if (!m) return null
    const isFiltered = route.tab === 'items' && filtered(route.tab, route.list)
    return {
      items: tabNumber(isFiltered ? visible(m.items, 'items', route.list).filter((it) => !it.archived).length : openCount(m.items)),
      inputs: tabNumber(m.inputs.filter((r) => !r.acked).length),
      archive: tabNumber(m.items.filter((it) => it.archived && !it.mergedInto).length),
      rules: tabNumber(m.items.filter((it) => it.type === 'rule' && !it.mergedInto && !it.archived && it.status !== 'dropped').length),
    } as Record<Tab, string | number>
  }, [m, route.tab, route.list])
  return { m, title, agent, counts, notSaved, away, otherNeeds }
}

export function ProjectPage({ route }: { route: ProjectRoute }) {
  const app = useApp()
  const layout = useLayout()
  useEffect(() => app.showProject(route.slug), [app, route.slug])
  useEffect(() => app.nav.normalize(), [app, route, layout])
  const m = useProjectModel(route.slug)
  useEffect(() => {
    const waiting = m ? m.items.filter(needsYou).length : 0
    const sec = route.place.kind === 'settings' ? 'Settings · ' : ''
    document.title = (waiting ? `(${waiting}) ` : '') + sec + (m ? `${m.facts.title} · Taska` : 'Taska')
  }, [m, route.place.kind])
  return (
    <>
      {layout === 'desk' ? <DeskLayout route={route} /> : <PhoneLayout route={route} />}
      <ToastContainer />
    </>
  )
}

function DeskLayout({ route }: { route: ProjectRoute }) {
  const app = useApp()
  const { title, agent, counts, notSaved } = useHeadFacts(route)
  const { tones } = useSideProjects(route.slug)
  const sideHidden = useStoreValue(app.stores.ui, (s) => s.sideHidden)
  const settings = route.place.kind === 'settings'
  const compose = route.place.kind === 'new' || (route.place.kind === 'tab' && route.tab !== 'inputs')
  const [footH, setFootH] = useState(0)
  const tabs: TabInfo[] = TABS.filter((t) => t !== 'archive' && t !== 'inputs').map((t) => ({
    tab: t,
    count: counts ? counts[t] : '',
    selected: (route.tab === t || (t === 'items' && route.tab === 'archive')) && !settings && route.place.kind !== 'side',
  }))
  return (
    <div className="flex h-full w-full">
      {sideHidden ? (
        <SidebarContainer slug={route.slug} place="" rail />
      ) : (
        <SidebarContainer slug={route.slug} place="relative z-40 w-[var(--side-w,15rem)] shrink-0 border-r border-zinc-200 bg-zinc-50 huge:w-[var(--side-w,16rem)] dark:border-zinc-800" />
      )}
      <div
        {...(compose ? { 'data-compose': '' } : {})}
        style={{ '--foot-h': footH + 'px' } as CSSProperties}
        className="group/app relative z-10 grid h-full min-w-0 flex-1 grid-cols-[var(--list-w,360px)_minmax(0,1fr)] grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] bg-white pt-[env(safe-area-inset-top)] wide:grid-cols-[var(--list-w,420px)_minmax(0,1fr)] huge:grid-cols-[var(--list-w,460px)_minmax(0,1fr)] dark:bg-zinc-950"
      >
        <ProjectBar
          title={title}
          tone={toneOf(tones, route.slug)}
          tabs={tabs}
          agent={agent}
          notSaved={notSaved}
          place="col-span-2 col-start-1 row-start-1"
          hidden={settings}
          on={{ tab: (t) => app.nav.tab(t), agents: () => app.nav.to(`/p/${encodeURIComponent(route.slug)}/agents`), notSaved: () => {} }}
        />
        <ListHead
          phone={false}
          title={title}
          otherNeeds={false}
          searching={false}
          q={route.list.q}
          placeholder={route.tab === 'rules' ? 'Search rules' : 'Search items'}
          agent={agent}
          notSaved={notSaved}
          filtersSet={false}
          filtersOpen={false}
          place="col-start-1 row-start-2"
          hidden={settings}
          on={{
            menu: () => {},
            agents: () => {},
            notSaved: () => {},
            search: () => {},
            query: (q) => app.nav.setList({ q }),
            clear: () => app.nav.setList({ q: '' }),
            firstResult: () => {},
            filters: () => {},
          }}
        />
        <section className="col-start-1 row-span-2 row-start-4 flex min-h-0 flex-1 flex-col desk:border-r desk:border-zinc-200 dark:desk:border-zinc-800" hidden={settings}>
          <ItemListContainer route={route} />
        </section>
        <DetailContainer route={route} place={`row-span-3 row-start-2 group-data-[compose]/app:row-span-1 col-start-2`} hidden={settings} />
        <FootContainer
          route={route}
          composePage={compose}
          place="row-start-5 group-data-[compose]/app:row-span-3 group-data-[compose]/app:row-start-3 col-start-2"
          hidden={settings}
          onHeight={setFootH}
        />
      </div>
    </div>
  )
}

function PhoneLayout({ route }: { route: ProjectRoute }) {
  const app = useApp()
  const { title, agent, counts, notSaved, otherNeeds } = useHeadFacts(route)
  const open = route.place.kind === 'item' || route.place.kind === 'doc'
  const settings = route.place.kind === 'settings'
  const under = !open && !settings
  const [footH, setFootH] = useState(0)
  const tabs: TabInfo[] = TABS.filter((t) => t !== 'archive').map((t) => ({
    tab: t,
    count: counts ? counts[t] : '',
    selected: route.tab === t || (t === 'items' && route.tab === 'archive'),
  }))
  return (
    <div style={{ '--foot-h': footH + 'px' } as CSSProperties} className="z-10 mx-auto flex h-full max-w-3xl flex-col bg-white pt-[env(safe-area-inset-top)] dark:bg-zinc-950">
      <ListHead
        phone
        title={title}
        otherNeeds={otherNeeds}
        searching={false}
        q={route.list.q}
        placeholder="Search title, text or code"
        agent={agent}
        notSaved={notSaved}
        filtersSet={false}
        filtersOpen={false}
        place=""
        hidden={!under}
        on={{
          menu: () => {},
          agents: () => {},
          notSaved: () => {},
          search: () => {},
          query: (q) => app.nav.setList({ q }),
          clear: () => app.nav.setList({ q: '' }),
          firstResult: () => {},
          filters: () => {},
        }}
      />
      <PhoneTabs tabs={tabs} filtersSet={false} showFilter={route.tab !== 'inputs'} hidden={!under} on={{ tab: (t) => app.nav.tab(t), filters: () => {} }} />
      <section className="flex min-h-0 flex-1 flex-col" hidden={!under || route.tab === 'inputs'}>
        <ItemListContainer route={route} />
      </section>
      <DetailContainer route={route} place="" hidden={!open} />
      <FootContainer route={route} composePage={false} place="" hidden={settings} onHeight={setFootH} />
    </div>
  )
}
