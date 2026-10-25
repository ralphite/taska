// The sidebar with the page's data: every project in your order, this one with what this page knows now.

import { Grip } from '../../ui/Grip'
import { NewProjectField } from './NewProjectField'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { useSideProjects } from '../../app/projectLists'
import { usePaneRef } from '../../app/panes'
import { Rail, Sidebar, type SideLinkInfo, type SidebarEvents } from './Sidebar'
import { NEW_DRAFT } from '../../model/draftTarget'

const DEV_LINKS = [
  { label: 'Storybook', href: 'http://localhost:6007/', icon: 'book' as const },
  { label: 'Dashboard', href: '/dev/dashboard', icon: 'chart' as const },
]

export function SidebarContainer({ slug, place, hidden, rail }: { slug: string; place: string; hidden?: boolean; rail?: boolean }) {
  const app = useServices('actions', 'itemDrag', 'nav', 'projects', 'sheets', 'voice')
  const stores = useStores('drag', 'feedback', 'grips', 'route', 'ui')
  const layout = useLayout()
  const drawerFoot = usePaneRef('drawerFoot')
  const { list: listed } = useSideProjects(slug)
  // an item dragged from the list over a project lights it
  const dropOn = useStoreValue(stores.drag, (s) => s.project)
  const list = dropOn && listed ? listed.map((p) => (p.slug === dropOn ? { ...p, drop: true } : p)) : listed
  const route = useStoreValue(stores.route, (s) => s.route)
  // the sidebar's New project, being named (and why it was not made)
  const making = useStoreValue(stores.ui, (s) => s.naming)
  const setMaking = (n: { error: string } | null) => stores.ui.getState().setNaming(n)
  const undo = useStoreValue(stores.feedback, (s) => s.undo.at(-1) ?? null)
  const sideHidden = useStoreValue(stores.ui, (s) => s.sideHidden)
  const composing = route.page === 'project' && (route.place.kind === 'new' || (route.place.kind === 'tab' && route.tab !== 'inputs'))
  // the list beside the pane (Documents, Activity, Deleted) stays lit while what you opened from it shows
  const side = useStoreValue(stores.route, (s) => s.side)
  const base = `/p/${encodeURIComponent(slug)}/`
  const links: SideLinkInfo[] = slug
    ? [
        { key: 'docs', label: 'Documents', icon: 'doc', href: base + 'docs', current: side === 'docs' },
        { key: 'log', label: 'Activity', icon: 'history', href: base + 'log', current: side === 'log' },
        { key: 'deleted', label: 'Deleted', icon: 'trash', href: base + 'deleted', current: side === 'deleted' },
      ]
    : []
  const on: SidebarEvents = {
    newInput: () => app.actions.run('new-input'),
    newVoice: () => {
      // New input, recording at once (again: stop and send)
      if (app.voice.recording()) return void app.voice.finish(true)
      app.nav.newInput()
      void app.voice.start(slug, NEW_DRAFT, null, 'main')
    },
    newProject: () => {
      // from the folded sidebar's rail: the sidebar comes over the page
      if (rail && layout === 'desk') stores.ui.getState().setSideOver(true)
      setMaking({ error: '' })
    },
    hide: () => stores.ui.getState().setSideHidden(!sideHidden),
    settings: () => app.nav.to(base + 'settings'),
    keys: () => app.sheets.open({ kind: 'keys' }),
    undo: () => void undo?.run(),
    order: (names, moved) => void app.projects.order(names, `${list?.find((p) => p.slug === moved)?.title || moved} moved`),
    dragProject: (to) => app.itemDrag.overProject(to),
    projectMenu: (to, x, y) => app.sheets.open({ kind: 'project-menu', slug: to }, { pop: true, focus: false, at: { x, y } }),
    dropProject: () => app.itemDrag.drop(),
    go: (href, e) => {
      if (e.metaKey || e.ctrlKey) return
      e.preventDefault()
      // from the phone's drawer: the place it opens closes it (the same place: only closes it)
      if (layout === 'phone' && stores.route.getState().url === href) app.nav.drawer(false)
      else app.nav.to(href)
    },
  }
  const dev = typeof location !== 'undefined' && /^(localhost|127(\.\d{1,3}){3}|\[::1\])$/.test(location.hostname)
  if (rail) return <Rail projects={list} composing={composing && layout === 'desk'} settingsOpen={route.page === 'project' && route.place.kind === 'settings'} hidden={hidden} on={on} />
  return (
    <Sidebar
      footRef={drawerFoot}
      phone={layout === 'phone'}
      projects={list}
      composing={composing && layout === 'desk'}
      links={links}
      undoLabel={undo?.label ?? null}
      devLinks={dev ? DEV_LINKS : []}
      place={place}
      hidden={hidden}
      newProjectField={
        making ? (
          <NewProjectField
            error={making.error}
            on={{
              create: (title) => {
                if (!title.trim()) return
                void app.projects.create(title.trim()).then((r) => ('name' in r ? app.nav.to(`/p/${r.name}/`) : setMaking({ error: r.error })))
              },
              cancel: () => setMaking(null),
            }}
          />
        ) : undefined
      }
      edge={
        layout === 'desk' ? (
          <Grip
            name="side"
            axis="x"
            place="absolute inset-y-0 right-0 z-10 hidden w-3 translate-x-1/2 lg:block"
            measure={(el) => ({ from: el.parentElement?.getBoundingClientRect().left ?? 0, most: innerWidth })}
            onSize={(px) => stores.grips.getState().size('side', px)}
            onDone={(px) => stores.grips.getState().keep('side', px)}
            onReset={() => stores.grips.getState().keep('side', 0)}
          />
        ) : null
      }
      on={on}
    />
  )
}
