// What the box writes to here, with the page's data: the project, what the box is in, its role (worked out by the
// model) and its draft's key.

import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { useProjectModel, type ProjectRoute } from '../../app/hooks'
import { boxRole } from '../../model/boxFoot'

export function useBoxHere(route: ProjectRoute) {
  const app = useServices('box')
  const stores = useStores('box', 'docTicks', 'docView')
  const desk = useLayout() === 'desk'
  const m = useProjectModel(route.slug)
  const title = m?.facts.title || route.slug
  const mode = useStoreValue(stores.box, (s) => s.mode)
  const pick = useStoreValue(stores.docView, (s) => s)
  const ticks = useStoreValue(stores.docTicks, (s) => s)
  const role = boxRole(m, route, desk, title, mode, pick, ticks)
  const key = app.box.key(role.scope, mode, role.doc)
  return { m, desk, title, mode, pick, role, key }
}
