// The phone's filters sheet with the page's data: the list's filters, and how many items they leave.

import { useApp } from '../../app/context'
import { useProjectModel, useProjectRoute } from '../../app/hooks'
import { closed } from '../../model/items'
import { filtered, visible } from '../../model/visible'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { filterEvents } from '../project/ProjectPageContainer'
import { filtersSheet } from './Filters'

export function FiltersSheet(_: { req: Extract<SheetRequest, { kind: 'filters' }> }) {
  const app = useApp()
  const route = useProjectRoute()
  const m = useProjectModel(route?.slug ?? '')
  if (!m || !route) return null
  const rows = visible(m.items, route.tab, route.list)
  const facts = { tab: route.tab, list: route.list, filtered: filtered(route.tab, route.list), shown: rows.length, open: rows.filter((it) => !closed(it.status) && !it.archived).length }
  return <SheetLayout {...filtersSheet(facts, { ...filterEvents(app), close: () => app.sheets.close() })} />
}
