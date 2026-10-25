// What the project's head says, from the model: how many each tab has (under a search: how many it matches), whether
// an agent is around, and the tabs as the desktop's bar and the phone's row list them. Pure: the page and the stories
// both use it.

import { agentLine } from '../model/agents'
import type { ProjectModel } from '../model/project'
import { NO_FILTERS, type ListQuery } from '../model/route'
import { filtered, inputMatch, openCount, searchWords, tabNumber, visible } from '../model/visible'
import { TABS, type Tab } from '../model/words'
import type { AgentInfo, TabInfo } from './Header'

export function tabCounts(m: ProjectModel, tab: Tab, list: ListQuery, desk: boolean): Record<Tab, string | number> {
  const words = searchWords(list.q)
  // under a search each tab says how many it matches (the tab shown with its own settings; Items from another tab
  // counts what is finished too, as its Active view is only Active where it shows)
  const found = (t: Tab) => visible(m.items, t, t === tab ? list : { ...NO_FILTERS, q: list.q, status: t === 'items' ? 'every' : 'all' }).length
  const isFiltered = tab === 'items' && filtered(tab, list)
  // the phone's tabs say 1234 as 1k and nothing for none; the desktop's say the number, and Items says its 0 too
  const num = (n: number, zero = false) => (desk ? n || (zero ? 0 : '') : tabNumber(n))
  return {
    items: words.length ? num(found('items')) : num(isFiltered ? visible(m.items, 'items', list).filter((it) => !it.archived).length : openCount(m.items), true),
    inputs: num(words.length ? m.inputs.filter((r) => inputMatch(r, words)).length : m.inputs.filter((r) => !r.acked).length),
    archive: num(words.length ? found('archive') : m.items.filter((it) => it.archived && !it.mergedInto).length),
    rules: num(words.length ? found('rules') : m.items.filter((it) => it.type === 'rule' && !it.mergedInto && !it.archived && it.status !== 'dropped').length),
  }
}

/** Whether an agent is around (`away`: how long Taska has not answered). */
export const agentInfo = (m: ProjectModel, away: number): AgentInfo => ({ ...agentLine(m.facts.agents, m.facts.work, m.at), offline: away >= 2 })

/** The desktop's bar: Items and Rules (Archive is a view of Items; Inputs is the New input page); none selected while
 * Settings or a side list shows. */
export const deskTabs = (counts: Record<Tab, string | number> | null, tab: Tab, away: boolean): TabInfo[] =>
  TABS.filter((t) => t !== 'archive' && t !== 'inputs').map((t) => ({ tab: t, count: counts ? counts[t] : '', selected: (tab === t || (t === 'items' && tab === 'archive')) && !away }))

/** The phone's row: Items, Inputs and Rules. */
export const phoneTabs = (counts: Record<Tab, string | number> | null, tab: Tab): TabInfo[] =>
  TABS.filter((t) => t !== 'archive').map((t) => ({ tab: t, count: counts ? counts[t] : '', selected: tab === t || (t === 'items' && tab === 'archive') }))
