// The project page: the window's width picks its layout, the desktop's or the phone's, and nothing else does. The
// two never share layout code; they place the same parts.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Grip } from '../ui/Grip'
import { useBackSwipe, useDrawerPull } from './phoneGestures'
import { gripVars } from '../stores/grips'
import { useLayout, useServices, useStores, useStoreValue } from '../app/context'
import { useAway, useProjectModel, type ProjectRoute } from '../app/hooks'
import { usePaneRef } from '../app/panes'
import { blockedAgent } from '../model/agents'
import { needsYou } from '../model/needStates'
import { needsCount } from '../model/rules'
import { filtersSet } from '../model/visible'
import { composing } from '../model/route'
import { toneOf } from '../ui/tones'
import { FootContainer } from '../features/composer/FootContainer'
import { BoxContainer } from '../features/composer/BoxContainer'
import { ToastContainer } from '../features/feedback/ToastContainer'
import { BlockedBar } from '../features/agents/BlockedBar'
import { ItemListContainer } from '../features/list/ItemListContainer'
import { SidebarContainer } from '../features/sidebar/SidebarContainer'
import { useSideProjects } from '../app/projectLists'
import { SideListContainer } from '../features/side/SideListContainer'
import { HelpContainer } from '../features/help/HelpContainer'
import { SettingsContainer } from '../features/settings/SettingsContainer'
import { settingsTitle } from '../features/settings/sectionList'
import { InputsContainer } from '../features/inputs/InputsContainer'
import { SearchContainer } from './SearchContainer'
import { DeskFilters, FilterStrip } from '../features/list/Filters'
import { filterEvents } from '../features/list/FiltersContainer'
import { DetailContainer } from './DetailContainer'
import { RulesContainer } from '../features/docs/RulesContainer'
import { ListHead, PhoneTabs, ProjectBar } from './Header'
import { agentInfo, deskTabs, phoneTabs, tabCounts } from './headFacts'

function useHeadFacts(route: ProjectRoute, desk: boolean) {
  const stores = useStores('data', 'feedback')
  const m = useProjectModel(route.slug)
  const away = useAway(route.slug)
  const notSaved = useStoreValue(stores.feedback, (s) => s.notSaved.length)
  const rows = useStoreValue(stores.data, (s) => s.projects)
  const title = m?.facts.title || rows?.find((p) => p.name === route.slug)?.title || route.slug
  const otherNeeds = (rows || []).some((p) => p.name !== route.slug && p.needs > 0)
  const agent = m ? agentInfo(m, away) : null
  // the agent whose session waits on the user: the bar floating at the bottom says so until it does not (T711)
  const blocked = m ? blockedAgent(m.facts.agents, m.at) : null
  const counts = useMemo(() => (m ? tabCounts(m, route.tab, route.list, desk) : null), [m, route.tab, route.list, desk])
  return { m, title, agent, blocked, counts, notSaved, away, otherNeeds }
}

export function ProjectPageContainer({ route }: { route: ProjectRoute }) {
  const app = useServices('nav', 'showProject')
  const layout = useLayout()
  useEffect(() => app.showProject(route.slug), [app, route.slug])
  useEffect(() => app.nav.normalize(), [app, route, layout])
  const m = useProjectModel(route.slug)
  useEffect(() => {
    const waiting = m ? needsCount(m, needsYou) : 0
    const sec = settingsTitle(route.place, layout === 'desk')
    document.title = (waiting ? `(${waiting}) ` : '') + (sec ? sec + ' · ' : '') + (m ? `${m.facts.title} · Taska` : 'Taska')
  }, [m, route.place, layout])
  return (
    <>
      {layout === 'desk' ? <DeskLayout route={route} /> : <PhoneLayout route={route} />}
      <ToastContainer />
    </>
  )
}

function DeskLayout({ route }: { route: ProjectRoute }) {
  const app = useServices('fields', 'listOrder', 'model', 'nav', 'sheets', 'views')
  const stores = useStores('docView', 'grips', 'route', 'ui')
  const { title, agent, blocked, counts, notSaved } = useHeadFacts(route, true)
  const blockedRef = usePaneRef('blocked')
  const { tones, icons } = useSideProjects(route.slug)
  const sideHidden = useStoreValue(stores.ui, (s) => s.sideHidden)
  const help = route.place.kind === 'help'
  const settings = route.place.kind === 'settings' || help
  const full = useStoreValue(stores.route, (s) => s.full) && route.place.kind === 'item' && !settings
  const shownSide = useStoreValue(stores.route, (s) => s.side)
  // the Rules tab is the rules document over both columns (I693)
  const rulesTab = route.tab === 'rules' && (route.place.kind === 'tab' || route.place.kind === 'rules')
  // a document edited in the pane has no box under it
  const docEditing = useStoreValue(stores.docView, (s) => s.editing && s.newFor == null) && (route.place.kind === 'doc' || rulesTab)
  const side = !!shownSide && !settings
  const grips = useStoreValue(stores.grips, (s) => s.px)
  const duo = useStoreValue(stores.ui, (s) => s.duo)
  const compose = composing(route)
  const filtersOpen = useStoreValue(stores.ui, (s) => s.deskFilters)
  const set = filtersSet(route.tab, route.list)
  // the foot's height and its box's middle (from the foot's top): what scrolls runs on under the box to its middle in
  // dark, where the box floats over the talk, and stops at the foot's top in light, so a scrollbar is never under it (B739)
  const [foot, setFoot] = useState({ h: 0, cut: 0 })
  const onFoot = useCallback((h: number, cut: number) => setFoot((f) => (f.h === h && f.cut === cut ? f : { h, cut })), [])
  const tabs = deskTabs(counts, route.tab, settings || side)
  return (
    <div className="flex h-full w-full" style={gripVars(grips) as CSSProperties}>
      <SidebarContainer slug={route.slug} hidden={sideHidden || settings} place="relative z-40 w-[var(--side-w,15rem)] shrink-0 border-r border-zinc-200 bg-zinc-50 huge:w-[var(--side-w,16rem)] dark:border-zinc-800" />
      <SidebarContainer slug={route.slug} place="" rail hidden={!sideHidden || settings} />
      <div
        {...(compose ? { 'data-compose': '' } : {})}
        {...(duo ? { 'data-duo': '' } : {})}
        style={{ '--foot-h': foot.h + 'px', '--foot-cut': foot.cut + 'px', '--float-h': blocked ? FLOAT_H : undefined } as CSSProperties}
        className="group/app relative z-10 grid [--foot-under:0px] dark:[--foot-under:var(--foot-cut)] h-full min-w-0 flex-1 grid-cols-[var(--list-w,360px)_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-white pt-[env(safe-area-inset-top)] wide:grid-cols-[var(--list-w,420px)_minmax(0,1fr)] huge:grid-cols-[var(--list-w,460px)_minmax(0,1fr)] dark:bg-zinc-950"
      >
        <ProjectBar
          title={title}
          tone={toneOf(tones, route.slug)}
          icon={icons.get(route.slug)}
          tabs={tabs}
          agent={agent}
          notSaved={notSaved}
          place="col-span-2 col-start-1 row-start-1"
          hidden={settings}
          on={{ tab: (t) => app.nav.tab(t), agents: () => app.sheets.open(...AGENTS_SHEET), notSaved: (from) => app.sheets.openFrom(from, { kind: 'not-saved' }, { focus: false }) }}
        />
        {/* two columns under the bar, each laid out by itself: nothing the pane shows moves the list, or the other way
            round (B663) */}
        <div data-part="list-column" hidden={settings || full || rulesTab} className="col-start-1 row-start-2 flex min-h-0 min-w-0 flex-col">
          <DeskFilters
            tab={route.tab}
            list={route.list}
            set={set}
            open={filtersOpen}
            place="shrink-0"
            hidden={side || !(filtersOpen || set.length)}
            on={{ ...filterEvents(app), toggle: () => stores.ui.getState().setDeskFilters(!filtersOpen) }}
          />
          <section data-part="items" className="@container/list flex min-h-0 flex-1 flex-col">
            {shownSide ? <SideListContainer slug={route.slug} side={shownSide} /> : <ItemListContainer route={route} />}
          </section>
        </div>
        {/* the pane over the box; on the New input page the pane is only its bar and the box's page fills the rest. An
            item full width (O) takes the list's column too */}
        <div data-part="pane-column" hidden={settings} className={`row-start-2 flex min-h-0 min-w-0 flex-col ${full || rulesTab ? 'col-span-2 col-start-1' : 'col-start-2'}`}>
          <DetailContainer route={route} place="group-data-[compose]/app:flex-none" hidden={settings} full={full} />
          <FootContainer
            route={route}
            composePage={compose}
            place="group-data-duo/app:ml-[var(--duo-w,55%)] group-data-duo/app:after:left-1 group-data-[compose]/app:min-h-0 group-data-[compose]/app:flex-1"
            hidden={settings || route.place.kind === 'side' || docEditing}
            onHeight={onFoot}
          />
        </div>
        {help ? <HelpContainer route={route} place="col-span-2 col-start-1 row-span-2 row-start-1" /> : null}
        {settings && !help ? <SettingsContainer route={route} place="col-span-2 col-start-1 row-span-2 row-start-1" prefsBox={<BoxContainer route={route} composePage={false} bare />} /> : null}
        {settings || full || rulesTab ? null : (
          // the line between the list and the pane, from under the project's bar to the bottom: one line, drawn here only
          // (B573), dragged sideways like the other lines; grabbed only right of the line, never over the list's scrollbar (B739)
          <Grip
            name="list"
            axis="x"
            place="relative z-30 col-start-1 row-start-2 block w-px justify-self-end bg-zinc-200 after:absolute after:inset-y-0 after:left-0 after:-right-1.5 dark:bg-zinc-800"
            measure={(el) => {
              const from = el.parentElement?.getBoundingClientRect().left ?? 0
              return { from, most: innerWidth - from }
            }}
            onSize={(px) => stores.grips.getState().size('list', px)}
            onDone={(px) => stores.grips.getState().keep('list', px)}
            onReset={() => stores.grips.getState().keep('list', 0)}
          />
        )}
        {/* the session blocked on you: over the pane's column at its bottom, above the box (on the New input page,
            whose box is at its top, at the bottom); over both columns where the pane takes them */}
        <BlockedBar
          by={blocked}
          barRef={blockedRef}
          place={`absolute inset-x-6 z-30 row-start-2 ${ABOVE_FOOT} group-data-[compose]/app:bottom-5 ${settings || full || rulesTab ? 'col-span-2 col-start-1' : 'col-start-2'}`}
          onOpen={() => app.sheets.open(...AGENTS_SHEET)}
        />
      </div>
    </div>
  )
}

/** The Agents sheet, from the head's agent button and the blocked bar's Open. */
const AGENTS_SHEET = [{ kind: 'agents' }, { tall: true, wide: true }] as const

/** The blocked bar's height from the bottom: just above the box (its height, the phone's safe area in it), else above
 * the screen's bottom edge (T711). */
const ABOVE_FOOT = 'bottom-[calc(max(var(--foot-h,0px),env(safe-area-inset-bottom),0.5rem)+0.75rem)]'

/** The room the blocked bar takes over the box (its 4rem and its 0.75rem gap): what scrolls under it ends that much
 * higher, so nothing stays under it (--float-h). */
const FLOAT_H = '4.75rem'

/** The drawer: over the page from the left, the page pushed aside. */
const DRAWER_PLACE = 'fixed top-0 left-0 w-80 max-w-[85vw] bg-zinc-100 pb-[max(1rem,env(safe-area-inset-bottom))]'
const DRAWER_W = 'min(85vw, 320px)'

function PhoneLayout({ route }: { route: ProjectRoute }) {
  const app = useServices('actions', 'fields', 'finder', 'nav', 'sheets', 'views')
  const stores = useStores('box', 'docView', 'route', 'sheet')
  const { title, agent, blocked, counts, notSaved, otherNeeds } = useHeadFacts(route, false)
  const blockedRef = usePaneRef('blocked')
  const layers = useStoreValue(stores.route, (s) => s.layers)
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
  const sheet = useStoreValue(stores.sheet, (s) => !!s.spec)
  const drawerPull = useDrawerPull(drawer && !sheet, () => app.nav.drawer(false))
  const backSwipe = useBackSwipe(route.place.kind === 'item' && !sheet && !drawer, () => app.actions.run('back'))
  const floating = backSwipe.pull
  // Settings' pages (Documents, Activity and Deleted are pages of it on the phone)
  const help = route.place.kind === 'help'
  const settings = route.place.kind === 'settings' || route.place.kind === 'side' || help
  const prefsEditing = useStoreValue(stores.box, (s) => s.mode?.kind === 'prefs')
  // a document on the phone has no box (B643): a part picked has its own Voice and Comment under it; the box comes
  // only to write: that Comment (B498), or an edit (a comment of yours, or the document, whose editor speaks through it)
  const boxMode = useStoreValue(stores.box, (s) => !!s.mode)
  const docEdit = useStoreValue(stores.docView, (s) => s.editing || s.typing)
  const docNoBox = route.place.kind === 'doc' && !boxMode && !docEdit
  // the Rules tab reads the rules document in place of the list (I693); its editor has no box under it
  const rulesTab = route.tab === 'rules' && (route.place.kind === 'tab' || route.place.kind === 'rules')
  const rulesEditing = useStoreValue(stores.docView, (s) => s.editing && s.newFor == null) && rulesTab
  // while the item's page is swiped back, what it was opened from shows underneath it: the list, or the search page
  // (F479), which stays while a result is open, as you left it
  const beneath = (!open && !settings) || !!floating
  const under = beneath && !searching
  const searchShown = beneath && searching
  const phoneSet = filtersSet(route.tab, route.list)
  const [footH, setFootH] = useState(0)
  const tabs = phoneTabs(counts, route.tab)
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const frame: CSSProperties = {
    '--foot-h': footH + 'px',
    '--float-h': blocked ? FLOAT_H : undefined,
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
          title={title}
          otherNeeds={otherNeeds}
          agent={agent}
          notSaved={notSaved}
          hidden={!under}
          on={{
            menu: () => app.nav.drawer(true),
            agents: () => app.sheets.open(...AGENTS_SHEET),
            notSaved: () => app.sheets.open({ kind: 'not-saved' }, { focus: false }),
            search: () => app.finder.open(),
          }}
        />
        <PhoneTabs tabs={tabs} filtersSet={phoneSet.length > 0} showFilter={route.tab !== 'inputs' && route.tab !== 'rules'} hidden={!under} on={{ tab: (t) => app.nav.tab(t), filters: () => app.sheets.open({ kind: 'filters' }, { focus: false }) }} />
        <FilterStrip set={phoneSet} hidden={!under || route.tab === 'inputs' || rulesTab || !phoneSet.length} onUnset={(k) => app.nav.setList({ [k]: 'all' })} onReset={() => filterEvents(app).reset()} />
        <section data-part="items" className="flex min-h-0 flex-1 flex-col" hidden={!under || route.tab === 'inputs' || rulesTab}>
          <ItemListContainer route={route} />
        </section>
        {rulesTab ? <RulesContainer route={route} place="" hidden={!under} footRoom={footH} /> : null}
        <InputsContainer route={route} hidden={!under || route.tab !== 'inputs'} />
        {searching ? <SearchContainer route={route} hidden={!searchShown} /> : null}
        <div
          {...backSwipe.handlers}
          hidden={!open}
          style={floating ? { bottom: footH, transform: floating.dx ? `translateX(${floating.dx}px)` : undefined, transition: floating.anim ? 'transform 180ms ease-out' : 'none' } : undefined}
          className={floating ? 'absolute inset-x-0 top-[env(safe-area-inset-top)] z-20 flex flex-col bg-white shadow-2xl dark:bg-zinc-950' : 'flex min-h-0 flex-1 flex-col'}
        >
          <DetailContainer route={route} place="" hidden={!open} footRoom={footH} />
        </div>
        {help ? <HelpContainer route={route} place="" /> : null}
        {settings && !help ? <SettingsContainer route={route} place="" prefsBox={null} /> : null}
        <FootContainer route={route} composePage={false} place="" hidden={(settings && !prefsEditing) || docNoBox || rulesEditing || (searching && !open)} onHeight={setFootH} />
      </div>
      {/* the session blocked on you: over the page and a document's sheet, just above the box; under the drawer, a
          sheet and the search page, which have their own feet */}
      <BlockedBar
        by={drawer || sheet || (searching && !open) ? null : blocked}
        barRef={blockedRef}
        style={{ '--foot-h': footH + 'px' } as CSSProperties}
        place={`fixed inset-x-4 z-45 ${ABOVE_FOOT}`}
        onOpen={() => app.sheets.open(...AGENTS_SHEET)}
      />
    </>
  )
}
