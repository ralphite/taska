// Two pages in one: the home page (every project) at /, and a project at /p/<name>/... Going from one to another,
// or from one project to another, happens in the page (lib/switch.ts, T339); the addresses are the projects' own, so
// agents' and phone links keep working.
import { useLayoutEffect, useSyncExternalStore } from 'react'
import { Home } from './pages/Home'
import { ProjectPage } from './components/Shell'
import { bootProject, startProject } from './lib/boot'
import { PAGE, onPage, wireLinks } from './lib/switch'

const HOME_BODY = 'min-h-dvh bg-zinc-100 text-zinc-900 antialiased dark:bg-zinc-900 dark:text-zinc-100'
const PROJECT_BODY = document.body.className // the page's own frame, from index.html
const project = (() => {
  const m = /^\/p\/([^/]+)/.exec(location.pathname)
  return m ? decodeURIComponent(m[1]) : null
})()
if (project) bootProject(project)
wireLinks()

function Project() {
  useLayoutEffect(() => {
    if (PAGE.booted) return // a project shown again: lib/switch.ts brought its data in
    PAGE.booted = true
    void startProject()
  }, [])
  return <ProjectPage />
}
export function App() {
  const home = useSyncExternalStore(onPage, () => PAGE.home)
  useLayoutEffect(() => {
    // the home page scrolls as a page; the project page is a frame of panes
    document.documentElement.classList.toggle('overflow-hidden', !home)
    document.body.className = home ? HOME_BODY : PROJECT_BODY
    if (home) document.title = 'Taska'
  }, [home])
  return home ? <Home /> : <Project />
}
