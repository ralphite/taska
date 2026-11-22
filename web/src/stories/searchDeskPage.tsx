// The desktop's search (T479) in its stories: the page around it (stories/searchDesk.tsx), each part the page's own
// component with the demo projects Shop and Home (searchFixtures.ts): the sidebar with its Search button (or the rail
// with its magnifier), the project's bar, the list (its filter at the end of the views' row), the task open in its
// pane, the box under it; and a task's preview, drawn as its page draws it.
import type { ReactNode } from 'react'
import { sideProjects } from '../app/sideProjects'
import { Composer } from '../features/composer/Composer'
import { TaskPage } from '../features/task/TaskPage'
import { Rail, Sidebar, type SidebarEvents } from '../features/sidebar/Sidebar'
import { SIDE_KEYS, sideLinks } from '../features/sidebar/sideLinks'
import { boxRole, shownBox } from '../model/boxFoot'
import type { Found } from '../model/find'
import { codeOf, type ProjectModel } from '../model/project'
import { NO_FILTERS, parseRoute } from '../model/route'
import { latestMessage } from '../model/talk'
import type { Task, ProjectRow } from '../model/types'
import { ProjectBar } from '../pages/Header'
import { agentInfo, deskTabs, tabCounts } from '../pages/headFacts'
import { toneOf } from '../ui/tones'
import { pageOf, type PageOpts } from './taskPage'
import { taskFacts, noTaskEvents, talkEnv, talkFacts } from './taskFixtures'
import { listOf, type Holding } from './listFixtures'
import { D1, HOME, SHOP } from './searchFixtures'
import { sideOn } from './sideFixtures'

/** The projects in the sidebar, as Taska last listed them: Shop (you are in it), Home, and one more. */
const ROWS: ProjectRow[] = [
  { name: 'shop', title: 'Shop', open: 0, needs: 0, pos: 0 },
  { name: 'home', title: 'Home', open: 1, needs: 0, pos: 1 },
  { name: 'notes', title: '读书笔记', open: 2, needs: 1, pos: 2 },
]
export const TONES = sideProjects(ROWS, SHOP, 'shop').tones
export const modelFor = (slug: string): ProjectModel => (slug === 'home' ? HOME : SHOP)
export const titleOf = (slug: string) => modelFor(slug).facts.title

/** The task a row found is or opens. */
export const taskOf = (x: Found): Task | undefined => (x.n == null ? undefined : (modelFor(x.project).byN.get(x.n) ?? (x.task as Task | undefined)))

// ---------------------------------------------------------------- the preview

/** A task's preview beside the search's list, as its page draws it (read only). */
export function previewOf(x: Found): ReactNode {
  const m = modelFor(x.project)
  const it = taskOf(x)
  if (!it) return null
  return <TaskPage it={it} f={taskFacts(m, it)} env={talkEnv(m, true, { latest: latestMessage(it) })} facts={talkFacts(m)} on={noTaskEvents} readOnly />
}

// ---------------------------------------------------------------- the page

/** The box at the foot, as the page draws it: a reply to the task open (`n`), else a new input; the desktop's under
 * the pane, the phone's at the screen's foot. */
export function PageBox({ m, n, desk = true }: { m: ProjectModel; n: number | null; desk?: boolean }) {
  const route = parseRoute(`/p/shop/${n == null ? '' : codeOf(m, n)}`, '')
  if (route.page !== 'project') throw new Error('not a project')
  const role = boxRole(m, route, false, m.facts.title, null, { reply: null, quote: null, sel: new Set() }, { mine: {}, going: {}, open: new Set() })
  const shown = shownBox(role, { mode: null, text: '', key: 'here', recordingFor: null })
  return (
    <footer className={`relative z-20 shrink-0 border-t border-zinc-200 bg-zinc-50 pt-3 dark:border-transparent dark:bg-transparent dark:pt-1 ${desk ? 'px-8 pb-5' : 'px-3 pb-5'}`}>
      <Composer line={shown.line} waiting={shown.waiting} placeholder={shown.placeholder} sendWord={shown.send} text="" desk={desk} composePage={false} micTip="Voice note · ⌥V" on={{ text() {}, send() {}, attach() {}, mic() {} }} />
    </footer>
  )
}

/** The desktop's project page: the sidebar (or its rail), the project's bar, the list, the task open in its pane.
 * `model`: the project's data in place of the demo's; `onAgents`: what the agent pill opens; `float`: what floats
 * just above the box (the blocked bar, T711); `list`, `page`: what a prototype holds for the list and the task open. */
export function DeskPage({ slug, n, rail, onSearch, model, onAgents, float, list, page }: { slug: string; n: number; rail: boolean; onSearch(): void; model?: ProjectModel; onAgents?(): void; float?: ReactNode; list?: Holding; page?: PageOpts }) {
  const m = model ?? modelFor(slug)
  const projects = sideProjects(ROWS, m, slug).list
  const sOn: SidebarEvents = { ...sideOn, search: onSearch }
  const it = m.byN.get(n) as Task
  return (
    <div className="flex h-full">
      {rail ? (
        <Rail keys={SIDE_KEYS} projects={projects} links={sideLinks(slug, null)} composing={false} settingsOpen={false} on={sOn} />
      ) : (
        <Sidebar phone={false} keys={SIDE_KEYS} projects={projects} composing={false} links={sideLinks(slug, null)} place="w-60 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800" on={sOn} />
      )}
      <div className="grid h-full min-w-0 flex-1 grid-cols-[360px_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-white wide:grid-cols-[420px_minmax(0,1fr)] dark:bg-zinc-950">
        <ProjectBar
          title={m.facts.title}
          tone={toneOf(TONES, slug)}
          tabs={deskTabs(tabCounts(m, 'tasks', NO_FILTERS, true), 'tasks', false)}
          agent={agentInfo(m, 0)}
          notSaved={0}
          place="col-span-2"
          on={{ tab() {}, agents: onAgents ?? (() => {}), notSaved() {} }}
        />
        <section className="flex min-h-0 flex-col border-r border-zinc-200 dark:border-zinc-800">{listOf(m.tasks, 'tasks', {}, true, { open: n, ...list })}</section>
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="min-h-0 flex-1">{pageOf(it, true, { docs: n === 1 && slug === 'shop' && !model ? [D1] : [], ...page })}</div>
          <div className="relative">
            {float}
            <PageBox m={m} n={n} />
          </div>
        </div>
      </div>
    </div>
  )
}
