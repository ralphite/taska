// The page: the home page (every project) at /, a project at /p/<name>/... Going from one to another happens in the
// page; the addresses are the projects' own, so agents' and phone links keep working.

import { useEffect } from 'react'
import { useApp, LayoutProvider, useWindowLayout } from './context'
import { useRoute } from './hooks'
import { HomeContainer } from '../features/home/HomeContainer'
import { ProjectPageContainer } from '../features/project/ProjectPageContainer'
import { SheetContainer } from '../features/sheets/SheetContainer'
import { pageKeys } from './keys'
import { Tooltip } from './Tooltip'
import { PanesProvider } from './panes'

export function App() {
  const app = useApp()
  const route = useRoute()
  const layout = useWindowLayout()
  useEffect(() => {
    // the keys, for the whole page
    const keys = pageKeys(app)
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [app])
  useEffect(() => {
    // the projects for the sidebar (the home page asks for them itself)
    if (app.stores.route.getState().route.page !== 'home') void app.refreshProjects()
  }, [app])
  return (
    <LayoutProvider layout={layout}>
      <PanesProvider>
        <div data-layout={layout} className="@container/frame h-dvh w-full">
          {route.page === 'project' ? <ProjectPageContainer route={route} /> : route.page === 'home' ? <HomeContainer route={route} /> : <div className="p-8 text-sm text-zinc-500">Taska</div>}
        </div>
        <SheetContainer />
        <Tooltip />
      </PanesProvider>
    </LayoutProvider>
  )
}
