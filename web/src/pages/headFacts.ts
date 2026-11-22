// What the project's head says, from the model: how many each tab has, whether
// an agent is around, and the tabs as the desktop's bar and the phone's row list them. Pure: the page and the stories
// both use it.

import { agentLine } from '../model/agents'
import { outOfReach } from '../model/reach'
import { rulesDoc, waitingProposals } from '../model/rules'
import type { ProjectModel } from '../model/project'
import type { ListQuery } from '../model/route'
import { filtered, openCount, tabNumber, visible } from '../model/visible'
import { TABS, type Tab } from '../model/words'
import type { AgentInfo, TabInfo } from './Header'

export function tabCounts(m: ProjectModel, tab: Tab, list: ListQuery, desk: boolean): Record<Tab, string | number> {
  const isFiltered = tab === 'tasks' && filtered(tab, list)
  // the phone's tabs say 1234 as 1k and nothing for none; the desktop's say the number, and Tasks says its 0 too
  const num = (n: number, zero = false) => (desk ? n || (zero ? 0 : '') : tabNumber(n))
  return {
    tasks: num(isFiltered ? visible(m.tasks, 'tasks', list).filter((it) => !it.archived).length : openCount(m.tasks), true),
    inputs: num(m.inputs.filter((r) => !r.acked && r.kind !== 'cancelled').length),
    archive: num(m.tasks.filter((it) => it.archived && !it.mergedInto).length),
    // the rules are one document: the tab says a number only while a proposed change waits on you (I693, r1128)
    rules: num(waitingProposals(rulesDoc(m)).length),
  }
}

/** Whether an agent is around (`away`: how long Taska has not answered). */
export const agentInfo = (m: ProjectModel, away: number): AgentInfo => ({ ...agentLine(m.facts.agents, m.facts.work, m.at), offline: outOfReach(away) })

/** The desktop's bar: Tasks and Rules (Archive is a view of Tasks; Inputs is the New input page); none selected while
 * Settings or a side list shows. */
export const deskTabs = (counts: Record<Tab, string | number> | null, tab: Tab, away: boolean): TabInfo[] =>
  TABS.filter((t) => t !== 'archive' && t !== 'inputs').map((t) => ({ tab: t, count: counts ? counts[t] : '', selected: (tab === t || (t === 'tasks' && tab === 'archive')) && !away }))

/** The phone's row: Tasks, Inputs and Rules. */
export const phoneTabs = (counts: Record<Tab, string | number> | null, tab: Tab): TabInfo[] =>
  TABS.filter((t) => t !== 'archive').map((t) => ({ tab: t, count: counts ? counts[t] : '', selected: tab === t || (t === 'tasks' && tab === 'archive') }))
