// A shared rule's page (I779): its address is its own (/p/~<id>/rules) and it is the Rules tab of a project's rules,
// so it reads, comments, edits, keeps its versions and restores them the same way. On the desktop Settings' column of
// sections stays beside it (Shared rules current); on the phone it is a page of Settings, Back to the list. The box
// under it comments on it, as under a project's rules.

import { useState } from 'react'
import { useLayout, useServices, useStores, useStoreValue } from '../app/context'
import type { ProjectRoute } from '../app/hooks'
import { FootContainer } from '../features/composer/FootContainer'
import { RulesContainer } from '../features/docs/RulesContainer'
import { SECTIONS, type SectionKey } from '../features/settings/sectionList'
import { SharedRuleFrame } from './SharedRuleFrame'
import { DeskNav } from '../features/settings/SettingsNav'
import { DetailContainer } from './DetailContainer'

export function SharedRuleContainer({ route }: { route: ProjectRoute }) {
  const app = useServices('nav', 'sharedRules', 'sheets')
  const stores = useStores('data', 'docView', 'settings')
  const desk = useLayout() === 'desk'
  const editing = useStoreValue(stores.docView, (s) => s.editing && s.newFor == null)
  const n = useStoreValue(stores.settings, (s) => s.shared?.length) ?? ''
  const rows = useStoreValue(stores.data, (s) => s.projects)
  const [foot, setFoot] = useState(0)
  const home = app.sharedRules.home()
  const href = (k: SectionKey) => (home ? `/p/${encodeURIComponent(home)}/${SECTIONS[k].path}` : '/')
  const nav = desk ? (
    <DeskNav
      current="shared"
      back={rows?.find((p) => p.name === home)?.title || home || 'Taska'}
      f={{ right: { shared: n } }}
      on={{ open: (k) => app.nav.to(href(k)), back: () => app.nav.to(home ? `/p/${encodeURIComponent(home)}/` : '/'), keys: () => app.sheets.open({ kind: 'keys' }), href }}
    />
  ) : null
  return (
    <SharedRuleFrame desk={desk} nav={nav} foot={foot}>
      {desk ? <DetailContainer route={route} place="" full={false} /> : <RulesContainer route={route} place="" footRoom={foot} />}
      <FootContainer route={route} composePage={false} place="" hidden={editing} onHeight={(h) => setFoot(h)} />
    </SharedRuleFrame>
  )
}
