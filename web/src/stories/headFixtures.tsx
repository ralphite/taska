// The project's head as the page draws it: on the desktop the bar over the panes (name, tabs, agent) with the
// filters' row under it; on the phone the head (menu and name, agent, search) and the
// tabs, with the row of filters set. What it says comes from the page's own headFacts (tabCounts, agentInfo, deskTabs,
// phoneTabs) and filtersSet, with the item list's demo project. Used by the stories of the top bar and the list head.
import { useState } from 'react'
import { DeskFilters, FilterStrip, type FilterEvents } from '../features/list/Filters'
import { ListHead, PhoneTabs, ProjectBar, type AgentInfo } from '../pages/Header'
import { agentInfo, deskTabs, phoneTabs, tabCounts } from '../pages/headFacts'
import { NO_FILTERS, type ListKey, type ListQuery } from '../model/route'
import type { AgentSeen } from '../model/types'
import { filtersSet } from '../model/visible'
import type { Tab } from '../model/words'
import { PROJECT_TONES } from '../ui/tones'
import { T, input, modelOf } from './fixtures'
import { PROJECT } from './listFixtures'
import { acts } from './acts'

const now = Date.parse(T)
/** Agents as Taska last heard of them. */
export const AGENTS = {
  ready: [{ name: 'claude-code', t: now - 60_000, waiting: true }],
  recent: [{ name: 'codex', t: now - 4 * 60_000, waiting: false }],
  gone: [{ name: 'claude-code', t: now - 2 * 3600_000, waiting: false }],
  none: [],
  /** a Claude Code session waits on the user (T711): it asks to run a command */
  blocked: [
    {
      name: 'claude-code',
      t: now - 6 * 60_000,
      waiting: false,
      session: 'Export keeps the filter',
      sessions: [{ name: 'Export keeps the filter', t: now - 6 * 60_000 }],
      blocked: [{ session: 'Export keeps the filter', waitingFor: 'approve Bash: npm --prefix web run check', since: now - 2 * 60_000 }],
    },
  ],
} satisfies Record<string, AgentSeen[]>

export interface HeadHere {
  tab?: Tab
  list?: Partial<ListQuery>
  agents?: AgentSeen[]
  /** work waits for an agent */
  work?: boolean
  /** how long Taska has not answered */
  away?: number
  notSaved?: number
  /** another project needs you (the Needs you mark on the phone's menu) */
  otherNeeds?: boolean
  /** the desktop's filters opened */
  filtersOpen?: boolean
  /** the project's data not come yet: tabs without counts, no agent pill */
  loading?: boolean
  /** Settings or a side list open: no tab selected */
  awayTab?: boolean
  /** the phone's menu and Search pressed */
  pressed?: boolean
  /** what a proposal changes in the agent pill (T711) */
  pill?: Partial<AgentInfo>
  /** the agent pill opens what the story shows (the page's Agents sheet); else its click shows in the Actions panel */
  onAgents?(): void
}

const INPUTS = [input({ id: 'r3' }), input({ id: 'r2' }), input({ id: 'r1', acked: true })]
const on = acts('Head', ['menu', 'agents', 'notSaved', 'search', 'filters', 'saveView'] as const, { agents: 'Agents › Who works here', notSaved: 'Sheets › Not saved, sign in', search: 'Search on the phone', filters: 'Sheets › Filters on the phone' })

/** The head with what the page holds for it (the route's tab and filters, the phone's search, the desktop's filters
 * open): a tab opens, the filters set and take off, the phone's search types and clears (T662). The agents, Not saved,
 * the phone's menu and its Search and Filters sheets show in the Actions panel. */
export const headOf = (desk: boolean, h: HeadHere = {}) => <LiveHead desk={desk} h={h} />

function LiveHead({ desk, h }: { desk: boolean; h: HeadHere }) {
  const m = modelOf(PROJECT, INPUTS, { title: 'Shop', agents: h.agents ?? AGENTS.ready, work: h.work ?? true })
  const [tab, setTab] = useState<Tab>(h.tab ?? 'items')
  const [awayTab, setAwayTab] = useState(!!h.awayTab)
  const [list, setList] = useState<ListQuery>({ ...NO_FILTERS, ...h.list })
  const [filtersOpen, setFiltersOpen] = useState(!!h.filtersOpen)
  const counts = h.loading ? null : tabCounts(m, tab, list, desk)
  const agent = h.loading ? null : { ...agentInfo(m, h.away ?? 0), ...h.pill }
  const set = filtersSet(tab, list)
  const toTab = (t: Tab) => {
    setTab(t)
    setAwayTab(false)
  }
  // the page's filterEvents (nav.setList)
  const filterOn: FilterEvents = {
    set: (k, v) => setList({ ...list, [k]: v }),
    unset: (k) => setList({ ...list, [k]: NO_FILTERS[k] }),
    reset: () => setList({ ...list, type: 'all', when: 'all', status: 'all', pri: 'all', sort: 'all' }),
    saveView: on.saveView,
  }
  if (desk)
    return (
      <div className="grid grid-cols-[420px_minmax(0,1fr)]">
        <ProjectBar title="Shop" tone={PROJECT_TONES[4]} tabs={deskTabs(counts, tab, awayTab)} agent={agent} notSaved={h.notSaved ?? 0} place="col-span-2" on={{ tab: toTab, agents: h.onAgents ?? on.agents, notSaved: on.notSaved }} />
        <DeskFilters tab={tab} list={list} set={set} open={filtersOpen} place="col-start-1" hidden={!(filtersOpen || set.length)} on={{ ...filterOn, toggle: () => setFiltersOpen(!filtersOpen) }} />
      </div>
    )
  return (
    <div className="flex flex-col">
      <ListHead
        title="Shop"
        pressed={!!h.pressed}
        otherNeeds={!!h.otherNeeds}
        agent={agent}
        notSaved={h.notSaved ?? 0}
        on={{
          menu: on.menu,
          agents: h.onAgents ?? on.agents,
          notSaved: on.notSaved,
          // Search opens the phone's search (its own stories)
          search: on.search,
        }}
      />
      <PhoneTabs tabs={phoneTabs(counts, tab)} filtersSet={set.length > 0} showFilter={tab !== 'inputs'} on={{ tab: toTab, filters: on.filters }} />
      <FilterStrip set={set} hidden={tab === 'inputs' || !set.length} onUnset={(k) => filterOn.unset(k as ListKey)} onReset={filterOn.reset} />
    </div>
  )
}
