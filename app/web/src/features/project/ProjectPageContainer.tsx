// The project page: the window's width picks its layout, the desktop's or the phone's, and nothing else does. The
// two never share layout code; they place the same parts.

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Grip } from '../../ui/Grip'
import { runAction } from '../../app/actions'
import { useBackSwipe, useDrawerPull } from './phoneGestures'
import { gripVars } from '../../stores/grips'
import { useApp, useLayout, useStoreValue } from '../../app/context'
import { useAway, useProjectModel, type ProjectRoute } from '../../app/hooks'
import { agentLine } from '../../model/agents'
import { needsYou } from '../../model/items'
import { NO_FILTERS } from '../../model/route'
import { filtered, filtersSet, inputMatch, openCount, searchWords, tabNumber, visible } from '../../model/visible'
import { TABS, type Tab } from '../../model/words'
import { toneOf } from '../../ui/tones'
import { FootContainer } from '../composer/FootContainer'
import { ToastContainer } from '../feedback/ToastContainer'
import { ItemListContainer } from '../list/ItemListContainer'
import { SidebarContainer, useSideProjects } from '../sidebar/SidebarContainer'
import { SideListContainer } from '../side/SideListContainer'
import { SettingsContainer } from '../settings/SettingsContainer'
import { codeOf } from '../../model/project'
import { InputsContainer } from '../inputs/InputsContainer'
import { DeskFilters, type FilterEvents } from '../list/Filters'
import { DetailContainer } from './DetailContainer'
import { FilterStrip, ListHead, PhoneTabs, ProjectBar, type AgentInfo, type TabInfo } from './Header'

/** What the filters do: set one, take one off, clear them all (and the search), keep them as a view. */
export const filterEvents = (app: ReturnType<typeof useApp>): FilterEvents => ({
  set: (k, v) => app.nav.setList({ [k]: v }),
  unset: (k) => app.nav.setList({ [k]: 'all' }),
  reset: () => app.nav.setList({ q: '', type: 'all', when: 'all', status: 'all', pri: 'all', sort: 'all' }),
  saveView: (name) => app.views.add(name),
})

function useHeadFacts(route: ProjectRoute) {
  const app = useApp()
  const m = useProjectModel(route.slug)
  const away = useAway(route.slug)
  const notSaved = useStoreValue(app.stores.feedback, (s) => s.notSaved.length)
  const rows = useStoreValue(app.stores.data, (s) => s.projects)
  const title = m?.facts.title || rows?.find((p) => p.name === route.slug)?.title || route.slug
  const otherNeeds = (rows || []).some((p) => p.name !== route.slug && p.needs > 0)
  const agent: AgentInfo | null = m ? { ...agentLine(m.facts.agents, m.facts.work, m.at), offline: away >= 2 } : null
  const counts = useMemo(() => {
    if (!m) return null
    const words = searchWords(route.list.q)
    // under a search each tab says how many it matches (the tab shown with its own settings)
    const found = (t: Tab) => visible(m.items, t, t === route.tab ? route.list : { ...NO_FILTERS, q: route.list.q }).length
    const isFiltered = route.tab === 'items' && filtered(route.tab, route.list)
    return {
      items: tabNumber(words.length ? found('items') : isFiltered ? visible(m.items, 'items', route.list).filter((it) => !it.archived).length : openCount(m.items)),
      inputs: tabNumber(words.length ? m.inputs.filter((r) => inputMatch(r, words)).length : m.inputs.filter((r) => !r.acked).length),
      archive: tabNumber(words.length ? found('archive') : m.items.filter((it) => it.archived && !it.mergedInto).length),
      rules: tabNumber(words.length ? found('rules') : m.items.filter((it) => it.type === 'rule' && !it.mergedInto && !it.archived && it.status !== 'dropped').length),
    } as Record<Tab, string | number>
  }, [m, route.tab, route.list])
  return { m, title, agent, counts, notSaved, away, otherNeeds }
}

export function ProjectPageContainer({ route }: { route: ProjectRoute }) {
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
  const full = useStoreValue(app.stores.route, (s) => s.full) && route.place.kind === 'item' && !settings
  const shownSide = useStoreValue(app.stores.route, (s) => s.side)
  // a document edited in the pane has no box under it
  const docEditing = useStoreValue(app.stores.docView, (s) => s.editing && s.newFor == null) && route.place.kind === 'doc'
  const side = !!shownSide && !settings
  const grips = useStoreValue(app.stores.grips, (s) => s.px)
  const duo = useStoreValue(app.stores.ui, (s) => s.duo)
  const compose = route.place.kind === 'new' || (route.place.kind === 'tab' && route.tab !== 'inputs')
  const filtersOpen = useStoreValue(app.stores.ui, (s) => s.deskFilters)
  const set = filtersSet(route.tab, route.list)
  // the pane, and the foot under it, take the list's column too when an item is full width (O)
  const pane = full ? 'col-span-2 col-start-1' : 'col-start-2'
  const [footH, setFootH] = useState(0)
  const tabs: TabInfo[] = TABS.filter((t) => t !== 'archive' && t !== 'inputs').map((t) => ({
    tab: t,
    count: counts ? counts[t] : '',
    selected: (route.tab === t || (t === 'items' && route.tab === 'archive')) && !settings && !side,
  }))
  return (
    <div className="flex h-full w-full" style={gripVars(grips) as CSSProperties}>
      <SidebarContainer slug={route.slug} hidden={sideHidden || settings} place="relative z-40 w-[var(--side-w,15rem)] shrink-0 border-r border-zinc-200 bg-zinc-50 huge:w-[var(--side-w,16rem)] dark:border-zinc-800" />
      <SidebarContainer slug={route.slug} place="" rail hidden={!sideHidden || settings} />
      <div
        {...(compose ? { 'data-compose': '' } : {})}
        {...(duo ? { 'data-duo': '' } : {})}
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
          on={{ tab: (t) => app.nav.tab(t), agents: () => app.nav.to(`/p/${encodeURIComponent(route.slug)}/agents`), notSaved: (from) => app.sheets.openFrom(from, { kind: 'not-saved' }, { focus: false }) }}
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
          filtersSet={set.length > 0}
          filtersOpen={filtersOpen}
          place="col-start-1 row-start-2"
          hidden={settings || full || side}
          searchRef={app.fields.ref('search')}
          on={{
            menu: () => {},
            agents: () => {},
            notSaved: () => {},
            search: () => {},
            query: (q) => app.nav.setList({ q }),
            clear: () => app.nav.setList({ q: '' }),
            firstResult: () => app.nav.first(app.listOrder, (n) => codeOf(app.model(route.slug) ?? { byN: new Map(), width: 0 }, n)),
            filters: () => app.stores.ui.getState().setDeskFilters(!filtersOpen),
          }}
        />
        <DeskFilters
          tab={route.tab}
          list={route.list}
          set={set}
          open={filtersOpen}
          place="col-start-1 row-start-3"
          hidden={settings || full || side || !(filtersOpen || set.length)}
          on={{ ...filterEvents(app), toggle: () => app.stores.ui.getState().setDeskFilters(!filtersOpen) }}
        />
        <section className="col-start-1 row-span-2 row-start-4 flex min-h-0 flex-1 flex-col lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800" hidden={settings || full}>
          {shownSide ? <SideListContainer slug={route.slug} side={shownSide} /> : <ItemListContainer route={route} />}
        </section>
        <DetailContainer route={route} place={`row-span-3 row-start-2 group-data-[compose]/app:row-span-1 ${pane}`} hidden={settings} full={full} />
        {settings ? <SettingsContainer route={route} place="col-span-2 col-start-1 row-span-5 row-start-1" /> : null}
        {settings || full ? null : (
          <Grip
            axis="x"
            place="relative z-30 col-start-1 row-span-4 row-start-2 block w-3 translate-x-1/2 justify-self-end"
            measure={(el) => {
              const from = el.parentElement?.getBoundingClientRect().left ?? 0
              return { from, most: innerWidth - from }
            }}
            onSize={(px) => app.stores.grips.getState().size('list', px)}
            onDone={(px) => app.stores.grips.getState().keep('list', px)}
            onReset={() => app.stores.grips.getState().keep('list', 0)}
          />
        )}
        <FootContainer
          route={route}
          composePage={compose}
          place={`row-start-5 group-data-duo/app:ml-[var(--duo-w,55%)] group-data-duo/app:after:left-1 group-data-[compose]/app:row-span-3 group-data-[compose]/app:row-start-3 ${pane}`}
          hidden={settings || route.place.kind === 'side' || docEditing}
          onHeight={setFootH}
        />
      </div>
    </div>
  )
}

/** The drawer: over the page from the left, the page pushed aside. */
const DRAWER_PLACE = 'fixed top-0 left-0 w-80 max-w-[85vw] bg-zinc-100 pb-[max(1rem,env(safe-area-inset-bottom))]'
const DRAWER_W = 'min(85vw, 320px)'

function PhoneLayout({ route }: { route: ProjectRoute }) {
  const app = useApp()
  const { title, agent, counts, notSaved, otherNeeds } = useHeadFacts(route)
  const layers = useStoreValue(app.stores.route, (s) => s.layers)
  const searching = layers.includes('search')
  const drawer = layers.includes('drawer')
  // the drawer stays drawn while the page slides back over it
  const [was, setWas] = useState(drawer)
  const [closing, setClosing] = useState(false)
  if (was !== drawer) {
    setWas(drawer)
    setClosing(!drawer)
  }
  useEffect(() => {
    if (!closing) return
    const t = window.setTimeout(() => setClosing(false), 240)
    return () => clearTimeout(t)
  }, [closing])
  const open = route.place.kind === 'item' || route.place.kind === 'doc'
  const sheet = useStoreValue(app.stores.sheet, (s) => !!s.spec)
  const drawerPull = useDrawerPull(drawer && !sheet, () => app.nav.drawer(false))
  const backSwipe = useBackSwipe(route.place.kind === 'item' && !sheet && !drawer, () => runAction(app, 'back'))
  const floating = backSwipe.pull
  // Settings' pages (Documents, Activity and Deleted are pages of it on the phone)
  const settings = route.place.kind === 'settings' || route.place.kind === 'side'
  const prefsEditing = useStoreValue(app.stores.box, (s) => s.mode?.kind === 'prefs')
  // while the item's page is swiped back, the list shows underneath it
  const under = (!open && !settings) || !!floating
  const phoneSet = filtersSet(route.tab, route.list)
  const [footH, setFootH] = useState(0)
  const tabs: TabInfo[] = TABS.filter((t) => t !== 'archive').map((t) => ({
    tab: t,
    count: counts ? counts[t] : '',
    selected: route.tab === t || (t === 'items' && route.tab === 'archive'),
  }))
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const frame: CSSProperties = {
    '--foot-h': footH + 'px',
    transition: reduce || drawerPull.pull != null ? 'none' : 'transform 220ms ease-out',
    ...(drawerPull.pull != null ? { transform: `translateX(${drawerPull.pull}px)` } : drawer ? { transform: `translateX(${DRAWER_W})` } : {}),
  } as unknown as CSSProperties
  return (
    <>
      <div {...drawerPull.handlers}>
        <SidebarContainer slug={route.slug} place={DRAWER_PLACE} hidden={!drawer && !closing} />
        <div hidden={!drawer} onClick={() => app.nav.drawer(false)} style={{ left: drawerPull.pull != null ? drawerPull.pull + 'px' : DRAWER_W }} className="fixed top-0 right-0 z-30 h-dvh" aria-label="Close projects" />
      </div>
      <div
        style={frame}
        className={`group/app relative z-10 mx-auto flex h-full max-w-3xl flex-col bg-white pt-[env(safe-area-inset-top)] md:border-x md:border-zinc-200 dark:bg-zinc-950 md:dark:border-zinc-800 ${drawer || drawerPull.pull ? 'overflow-hidden rounded-l-3xl shadow-2xl' : ''}`}
      >
        <ListHead
          phone
          title={title}
          otherNeeds={otherNeeds}
          searching={searching}
          q={route.list.q}
          placeholder="Search title, text or code"
          agent={agent}
          notSaved={notSaved}
          filtersSet={phoneSet.length > 0}
          filtersOpen={false}
          place=""
          hidden={!under}
          searchRef={app.fields.ref('search')}
          on={{
            menu: () => app.nav.drawer(true),
            agents: () => app.nav.to(`/p/${encodeURIComponent(route.slug)}/agents`),
            notSaved: () => app.sheets.open({ kind: 'not-saved' }, { focus: false }),
            search: (on) => app.nav.search(on),
            query: (q) => app.nav.setList({ q }),
            clear: () => app.nav.setList({ q: '' }),
            firstResult: () => {},
            filters: () => {},
          }}
        />
        <PhoneTabs tabs={tabs} filtersSet={phoneSet.length > 0} showFilter={route.tab !== 'inputs'} hidden={!under} on={{ tab: (t) => app.nav.tab(t), filters: () => app.sheets.open({ kind: 'filters' }, { focus: false }) }} />
        <FilterStrip set={phoneSet} hidden={!under || route.tab === 'inputs' || !phoneSet.length} onUnset={(k) => app.nav.setList({ [k]: 'all' })} onReset={() => filterEvents(app).reset()} />
        <section className="flex min-h-0 flex-1 flex-col" hidden={!under || route.tab === 'inputs'}>
          <ItemListContainer route={route} />
        </section>
        <InputsContainer route={route} hidden={!under || route.tab !== 'inputs'} />
        <div
          {...backSwipe.handlers}
          hidden={!open}
          style={floating ? { bottom: footH, transform: floating.dx ? `translateX(${floating.dx}px)` : undefined, transition: floating.anim ? 'transform 180ms ease-out' : 'none' } : undefined}
          className={floating ? 'absolute inset-x-0 top-[env(safe-area-inset-top)] z-20 flex flex-col bg-white shadow-2xl dark:bg-zinc-950' : 'flex min-h-0 flex-1 flex-col'}
        >
          <DetailContainer route={route} place="" hidden={!open} footRoom={footH} />
        </div>
        {settings ? <SettingsContainer route={route} place="" /> : null}
        <FootContainer route={route} composePage={false} place="" hidden={settings && !prefsEditing} onHeight={setFootH} />
      </div>
    </>
  )
}
