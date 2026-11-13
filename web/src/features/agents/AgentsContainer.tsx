// The Agents sheet with the page's data: the project open, and its guide, asked for when the sheet opens; an item it
// names opens in place of the sheet.

import { useEffect, useMemo } from 'react'
import { useServices, useStores, useStoreValue } from '../../app/context'
import { useProjectModel, useProjectRoute } from '../../app/hooks'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { agentsSheet } from './Agents'
import { agentsFacts } from './agentsFacts'

export function AgentsSheet(_: { req: Extract<SheetRequest, { kind: 'agents' }> }) {
  const app = useServices('nav', 'settings', 'sheets')
  const stores = useStores('settings')
  const slug = useProjectRoute()?.slug ?? ''
  const m = useProjectModel(slug)
  const guide = useStoreValue(stores.settings, (s) => (s.guide?.slug === slug ? s.guide.text : null))
  useEffect(() => {
    if (slug) void app.settings.loadGuide(slug)
  }, [app, slug])
  const f = useMemo(() => (m ? agentsFacts(m, guide) : null), [m, guide])
  if (!f) return null
  return (
    <SheetLayout
      {...agentsSheet(f, {
        copy: (t) => app.settings.copy(t),
        help: () => app.sheets.close(() => app.nav.to(`/p/${encodeURIComponent(slug)}/help/connect`)),
        open: (code) => app.sheets.close(() => app.nav.openItem(code)),
      })}
    />
  )
}
