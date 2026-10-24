// The page: the home page (every project) at /, a project at /p/<name>/... Going from one to another happens in the
// page; the addresses are the projects' own, so agents' and phone links keep working.

import { useEffect } from 'react'
import { useApp, LayoutProvider, useWindowLayout } from './context'
import { useRoute } from './hooks'
import { ProjectPage } from '../features/project/ProjectPage'
import { Tooltip } from '../ui/Tooltip'
import { PanesProvider } from './panes'

export function App() {
  const app = useApp()
  const route = useRoute()
  const layout = useWindowLayout()
  useEffect(() => {
    const stop = () => app.stores.route.getState().read()
    addEventListener('popstate', stop)
    return () => removeEventListener('popstate', stop)
  }, [app])
  useEffect(() => {
    void app.refreshProjects()
  }, [app])
  return (
    <LayoutProvider layout={layout}>
      <PanesProvider>
        <div className="@container/frame h-dvh w-full">
          {route.page === 'project' ? <ProjectPage route={route} /> : <div className="p-8 text-sm text-zinc-500">Taska</div>}
        </div>
        <Tooltip />
      </PanesProvider>
    </LayoutProvider>
  )
}
