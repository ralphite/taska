// What the phone's Filters sheet says, from the model: the tab and the filters set, whether any is set, and how many
// rows the list shows now (how many of them open). Pure: the container and the stories both use it.

import { closed } from '../../model/items'
import type { ProjectModel } from '../../model/project'
import type { ListQuery } from '../../model/route'
import { filtered, visible } from '../../model/visible'
import type { Tab } from '../../model/words'

export function filterFacts(m: ProjectModel, tab: Tab, list: ListQuery) {
  const rows = visible(m.items, tab, list)
  return { tab, list, filtered: filtered(tab, list), shown: rows.length, open: rows.filter((it) => !closed(it.status) && !it.archived).length }
}
