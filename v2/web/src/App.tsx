// Two pages: the home page (every project) at /, and a project at /p/<name>/... Switching from one project to another
// happens in the page (lib/switch.ts, T339); the address is always the project's own, so agents' and phone links work.
import { useLayoutEffect } from 'react'
import { Home } from './pages/Home'
import { ProjectPage } from './components/Shell'
import { bootProject, startProject } from './lib/boot'

const HOME_BODY = 'min-h-dvh bg-zinc-100 text-zinc-900 antialiased dark:bg-zinc-900 dark:text-zinc-100'
const project = (() => {
  const m = /^\/p\/([^/]+)/.exec(location.pathname)
  return m ? decodeURIComponent(m[1]) : null
})()
if (project) bootProject(project)

function Project() {
  useLayoutEffect(() => {
    void startProject()
  }, [])
  return <ProjectPage />
}
export function App() {
  useLayoutEffect(() => {
    if (!project) {
      // the home page scrolls as a page; the project page is a frame of panes
      document.documentElement.classList.remove('overflow-hidden')
      document.body.className = HOME_BODY
    }
  }, [])
  return project ? <Project /> : <Home />
}
