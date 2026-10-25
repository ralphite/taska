// The project's head as the page draws it: on the desktop the bar over the panes (name, tabs, agent) and the list's
// head (search, filters) with the filters' row under it; on the phone the head (menu and name, agent, search) and the
// tabs, with the row of filters set. What it says comes from the page's own headFacts (tabCounts, agentInfo, deskTabs,
// phoneTabs) and filtersSet, with the item list's demo project. Used by the stories of the top bar and the list head.
import { DeskFilters, FilterStrip } from '../features/list/Filters'
import { ListHead, PhoneTabs, ProjectBar } from '../pages/Header'
import { agentInfo, deskTabs, phoneTabs, tabCounts } from '../pages/headFacts'
import { NO_FILTERS, type ListQuery } from '../model/route'
import type { AgentSeen } from '../model/types'
import { filtersSet } from '../model/visible'
import type { Tab } from '../model/words'
import { PROJECT_TONES } from '../ui/tones'
import { T, input, modelOf } from './fixtures'
import { PROJECT } from './listFixtures'

const now = Date.parse(T)
/** Agents as Taska last heard of them. */
export const AGENTS = {
  ready: [{ name: 'claude-code', t: now - 60_000, waiting: true }],
  recent: [{ name: 'codex', t: now - 4 * 60_000, waiting: false }],
  gone: [{ name: 'claude-code', t: now - 2 * 3600_000, waiting: false }],
  none: [],
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
  /** the phone's search is open */
  searching?: boolean
  /** another project needs you (a dot on the phone's menu) */
  otherNeeds?: boolean
  /** the desktop's filters opened */
  filtersOpen?: boolean
}

const no = () => {}
const headOn = { menu: no, agents: no, notSaved: no, search: no, query: no, clear: no, firstResult: no, filters: no }
const filterOn = { set: no, unset: no, reset: no, saveView: no }
const INPUTS = [input({ id: 'r3' }), input({ id: 'r2' }), input({ id: 'r1', acked: true })]

export function headOf(desk: boolean, h: HeadHere = {}) {
  const m = modelOf(PROJECT, INPUTS, { title: 'Shop', agents: h.agents ?? AGENTS.ready, work: h.work ?? true })
  const tab = h.tab ?? 'items'
  const list = { ...NO_FILTERS, ...h.list }
  const counts = tabCounts(m, tab, list, desk)
  const agent = agentInfo(m, h.away ?? 0)
  const set = filtersSet(tab, list)
  if (desk)
    return (
      <div className="grid grid-cols-[420px_minmax(0,1fr)]">
        <ProjectBar title="Shop" tone={PROJECT_TONES[4]} tabs={deskTabs(counts, tab, false)} agent={agent} notSaved={h.notSaved ?? 0} place="col-span-2" on={{ tab: no, agents: no, notSaved: no }} />
        <ListHead phone={false} title="Shop" otherNeeds={false} searching={false} q={list.q} placeholder={tab === 'rules' ? 'Search rules' : 'Search items'} agent={agent} notSaved={h.notSaved ?? 0} filtersSet={set.length > 0} filtersOpen={!!h.filtersOpen} place="col-start-1" on={headOn} />
        <DeskFilters tab={tab} list={list} set={set} open={!!h.filtersOpen} place="col-start-1" hidden={!(h.filtersOpen || set.length)} on={{ ...filterOn, toggle: no }} />
      </div>
    )
  return (
    <div className="flex flex-col">
      <ListHead phone title="Shop" otherNeeds={!!h.otherNeeds} searching={!!h.searching} q={list.q} placeholder="Search title, text or code" agent={agent} notSaved={h.notSaved ?? 0} filtersSet={set.length > 0} filtersOpen={false} place="" on={headOn} />
      <PhoneTabs tabs={phoneTabs(counts, tab)} filtersSet={set.length > 0} showFilter={tab !== 'inputs'} on={{ tab: no, filters: no }} />
      <FilterStrip set={set} hidden={tab === 'inputs' || !set.length} onUnset={no} onReset={no} />
    </div>
  )
}
