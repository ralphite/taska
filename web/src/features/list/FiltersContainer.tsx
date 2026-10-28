// The phone's filters sheet with the page's data: the list's filters, and how many items they leave.

import { useServices } from '../../app/context'
import { useProjectModel, useProjectRoute } from '../../app/hooks'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { filtersSheet, type FilterEvents } from './Filters'
import { filterFacts } from './filterFacts'
import type { App } from '../../app/createApp'

/** What the filters do: set one, take one off, clear them all (and the search), keep them as a view. */
export const filterEvents = (app: Pick<App, 'nav' | 'views'>): FilterEvents => ({
  set: (k, v) => app.nav.setList({ [k]: v }),
  unset: (k) => app.nav.setList({ [k]: 'all' }),
  reset: () => app.nav.setList({ q: '', type: 'all', when: 'all', status: 'all', pri: 'all', sort: 'all' }),
  saveView: (name) => app.views.add(name),
})

export function FiltersSheet(_: { req: Extract<SheetRequest, { kind: 'filters' }> }) {
  const app = useServices('nav', 'sheets', 'views')
  const route = useProjectRoute()
  const m = useProjectModel(route?.slug ?? '')
  if (!m || !route) return null
  const facts = filterFacts(m, route.tab, route.list)
  return <SheetLayout {...filtersSheet(facts, { ...filterEvents(app), close: () => app.sheets.close() })} />
}
