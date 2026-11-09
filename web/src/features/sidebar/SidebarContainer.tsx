// The sidebar with the page's data: every project in your order, this one with what this page knows now.

import { Grip } from '../../ui/Grip'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { useSideProjects } from '../../app/projectLists'
import { usePaneRef } from '../../app/panes'
import { Rail, Sidebar, type SidebarEvents } from './Sidebar'
import { SIDE_KEYS, sideLinks } from './sideLinks'
import { NEW_DRAFT } from '../../model/draftTarget'
import { composing } from '../../model/route'

const DEV_LINKS = [
  { label: 'Storybook', href: 'http://localhost:6007/', icon: 'book' as const },
  { label: 'Dashboard', href: '/dev/dashboard', icon: 'chart' as const },
]

/** New project, opened once made (D115 #7) */
const NEW_PROJECT = { kind: 'new-project' } as const

export function SidebarContainer({ slug, place, hidden, rail }: { slug: string; place: string; hidden?: boolean; rail?: boolean }) {
  const app = useServices('actions', 'finder', 'itemDrag', 'nav', 'projects', 'sheets', 'voice')
  const stores = useStores('data', 'drag', 'feedback', 'grips', 'route', 'ui')
  const layout = useLayout()
  const drawerFoot = usePaneRef('drawerFoot')
  const { list: listed } = useSideProjects(slug)
  // an item dragged from the list over a project lights it
  const dropOn = useStoreValue(stores.drag, (s) => s.project)
  const list = dropOn && listed ? listed.map((p) => (p.slug === dropOn ? { ...p, drop: true } : p)) : listed
  const route = useStoreValue(stores.route, (s) => s.route)
  const undo = useStoreValue(stores.feedback, (s) => s.undo.at(-1) ?? null)
  const sideHidden = useStoreValue(stores.ui, (s) => s.sideHidden)
  const composingNow = route.page === 'project' && composing(route)
  // the list beside the pane (Documents, Activity, Deleted) stays lit while what you opened from it shows
  const side = useStoreValue(stores.route, (s) => s.side)
  const base = `/p/${encodeURIComponent(slug)}/`
  const links = sideLinks(slug, side)
  const on: SidebarEvents = {
    newInput: () => app.actions.run('new-input'),
    search: () => app.finder.openDesk(),
    newVoice: () => {
      // New input, recording at once (again: stop and send)
      if (app.voice.recording()) return void app.voice.finish(true)
      app.nav.newInput()
      void app.voice.start(slug, NEW_DRAFT, null, 'main')
    },
    newProject: (from, beside) => (layout === 'desk' ? app.sheets.openFrom(from, NEW_PROJECT, { focus: false }, beside) : app.sheets.open(NEW_PROJECT, { focus: false })),
    hide: () => stores.ui.getState().setSideHidden(!sideHidden),
    settings: () => app.nav.to(base + 'settings'),
    help: () => app.nav.to(base + 'help'),
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
  // the tools for making Taska: from its source only, opened on this computer; never in a release (B740)
  const fromSource = useStoreValue(stores.data, (s) => s.dev)
  const dev = fromSource && typeof location !== 'undefined' && /^(localhost|127(\.\d{1,3}){3}|\[::1\])$/.test(location.hostname)
  if (rail) return <Rail keys={SIDE_KEYS} projects={list} links={links} composing={composingNow && layout === 'desk'} settingsOpen={route.page === 'project' && route.place.kind === 'settings'} hidden={hidden} on={on} />
  return (
    <Sidebar
      keys={SIDE_KEYS}
      footRef={drawerFoot}
      phone={layout === 'phone'}
      projects={list}
      composing={composingNow && layout === 'desk'}
      links={links}
      undoLabel={undo?.label ?? null}
      devLinks={dev ? DEV_LINKS : []}
      place={place}
      hidden={hidden}
      edge={
        layout === 'desk' ? (
          // the edge to drag, wholly outside the sidebar: never over its scrollbar (B739)
          <Grip
            name="side"
            axis="x"
            place="absolute inset-y-0 left-full z-10 hidden w-1.5 lg:block"
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
