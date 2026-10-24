// The sidebar with the page's data: every project in your order, this one with what this page knows now.

import { useMemo } from 'react'
import { Grip } from '../../ui/Grip'
import { NewProjectField } from './NewProjectField'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { useProjectModel } from '../../app/hooks'
import { usePaneRef } from '../../app/panes'
import { needsYou } from '../../model/items'
import type { ProjectRow } from '../../model/types'
import { openCount } from '../../model/visible'
import { projectTones, toneOf } from '../../ui/tones'
import { Rail, Sidebar, type SideLinkInfo, type SideProject, type SidebarEvents } from './Sidebar'
import { NEW_DRAFT } from '../../model/draftTarget'

const DEV_LINKS = [
  { label: 'Storybook', href: 'http://localhost:6351/', icon: 'book' as const },
  { label: 'Dashboard', href: '/dev/dashboard', icon: 'chart' as const },
]

type Shown = Omit<ProjectRow, 'open'> & { open: number | string }

const order = (a: Shown, b: Shown) => (a.pos ?? 1e9) - (b.pos ?? 1e9) || (a.title || a.name).localeCompare(b.title || b.name)

/** The projects as the sidebar lists them: this one with this page's counts, the others as last listed. */
export function useSideProjects(slug: string): { list: SideProject[] | null; tones: Map<string, string> } {
  const stores = useStores('data')
  const rows = useStoreValue(stores.data, (s) => s.projects)
  const m = useProjectModel(slug)
  return useMemo(() => {
    const tones = projectTones([slug, ...(rows || []).map((p) => p.name)])
    if (!rows && !slug) return { list: null, tones }
    const seen = (rows || []).find((p) => p.name === slug)
    const here: Shown | null = slug
      ? m
        ? { name: slug, title: m.facts.title, open: openCount(m.items), needs: m.items.filter(needsYou).length, pos: seen?.pos }
        : seen || { name: slug, title: '', open: '…', needs: 0 }
      : null
    const all: Shown[] = [...(here ? [here] : []), ...(rows || []).filter((p) => p.name !== slug)].sort(order)
    return {
      tones,
      list: all.map((p) => ({
        slug: p.name,
        title: p.title || p.name,
        tone: toneOf(tones, p.name),
        needs: p.needs,
        open: p.open,
        current: p.name === slug,
        href: `/p/${encodeURIComponent(p.name)}/`,
      })),
    }
  }, [rows, m, slug])
}

/** The other projects, to move something to: by name, with their colour and open count. */
export function useOtherProjects(slug: string): { slug: string; title: string; tone: string; open: number }[] {
  const stores = useStores('data')
  const rows = useStoreValue(stores.data, (s) => s.projects)
  return useMemo(() => {
    const tones = projectTones([slug, ...(rows || []).map((p) => p.name)])
    return (rows || []).filter((p) => p.name !== slug).map((p) => ({ slug: p.name, title: p.title || p.name, tone: toneOf(tones, p.name), open: p.open }))
  }, [rows, slug])
}

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
