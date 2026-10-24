// The page: the home page (every project) at /, a project at /p/<name>/... Going from one to another happens in the
// page; the addresses are the projects' own, so agents' and phone links keep working.

import { useEffect, useLayoutEffect, useState } from 'react'
import { useApp, LayoutProvider, useWindowLayout } from '../app/context'
import { useRoute } from '../app/hooks'
import { HomeContainer } from '../features/home/HomeContainer'
import { ProjectPageContainer } from './ProjectPageContainer'
import { SheetContainer } from './SheetContainer'
import { SelectionBarContainer } from '../features/composer/SelectionBarContainer'
import { ViewerContainer } from '../features/media/ViewerContainer'
import { DashboardContainer } from '../features/dev/DashboardContainer'
import { pageKeys } from '../app/keys'
import { Tooltip } from '../app/Tooltip'
import { PanesProvider } from '../app/panes'
import { refCard } from '../model/refCard'
import type { App as TaskaApp } from '../app/createApp'

/** The home page and the dashboard scroll as a page, on grey; a project is a frame of panes (the body index.html
 * gives, with its pressed and focus looks). */
const PAGE_BODY = 'min-h-dvh bg-zinc-100 text-zinc-900 antialiased dark:bg-zinc-900 dark:text-zinc-100'

/** What a code names in the project shown, as its hover card. */
const cardOf = (app: Pick<TaskaApp, 'model'>, slug: string, ref: string) => {
  const m = app.model(slug)
  return m ? refCard(m, ref) : null
}

export function App() {
  const app = useApp()
  const route = useRoute()
  const layout = useWindowLayout()
  const [projectBody] = useState(() => document.body.className)
  const framed = route.page === 'project'
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('overflow-hidden', framed)
    document.body.className = framed ? projectBody : PAGE_BODY
  }, [framed, projectBody])
  useEffect(() => {
    // the keys, for the whole page
    const keys = pageKeys(app)
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [app])
  useEffect(() => {
    // the projects for the sidebar (the home page asks for them itself)
    if (app.stores.route.getState().route.page !== 'home') void app.refreshProjects()
    void app.views.load() // your own views of the list
  }, [app])
  return (
    <LayoutProvider layout={layout}>
      <PanesProvider>
        <div data-layout={layout} className={`@container/frame w-full ${framed ? 'h-dvh' : 'min-h-dvh'}`}>
          {route.page === 'project' ? <ProjectPageContainer route={route} /> : route.page === 'home' ? <HomeContainer route={route} /> : route.page === 'dev' && route.path === '/dev/dashboard' ? <DashboardContainer /> : <div className="p-8 text-sm text-zinc-500">Taska</div>}
          {/* over the page, in its layout */}
          <SheetContainer />
          {route.page === 'project' ? <SelectionBarContainer route={route} /> : null}
          <ViewerContainer />
          <Tooltip card={(ref) => (route.page === 'project' ? cardOf(app, route.slug, ref) : null)} />
        </div>
      </PanesProvider>
    </LayoutProvider>
  )
}
