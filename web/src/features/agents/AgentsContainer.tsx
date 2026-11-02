// The Agents sheet with the page's data: the project open, and its guide, asked for when the sheet opens.

import { useEffect, useMemo } from 'react'
import { useServices, useStores, useStoreValue } from '../../app/context'
import { useProjectModel, useProjectRoute } from '../../app/hooks'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { agentsHelpSheet, agentsSheet } from './Agents'
import { agentsFacts } from './agentsFacts'

export function AgentsSheet(_: { req: Extract<SheetRequest, { kind: 'agents' }> }) {
  const app = useServices('settings', 'sheets')
  const stores = useStores('settings')
  const slug = useProjectRoute()?.slug ?? ''
  const m = useProjectModel(slug)
  const guide = useStoreValue(stores.settings, (s) => (s.guide?.slug === slug ? s.guide.text : null))
  useEffect(() => {
    if (slug) void app.settings.loadGuide(slug)
  }, [app, slug])
  const f = useMemo(() => (m ? agentsFacts(m, guide) : null), [m, guide])
  if (!f) return null
  return <SheetLayout {...agentsSheet(f, { copy: (t) => app.settings.copy(t), help: () => app.sheets.open({ kind: 'agents-help' }) })} />
}

export function AgentsHelpSheet(_: { req: Extract<SheetRequest, { kind: 'agents-help' }> }) {
  return <SheetLayout {...agentsHelpSheet()} />
}
