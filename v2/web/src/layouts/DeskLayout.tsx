// The desktop's layout (B496, r749): which panes the project page has on a computer, where each sits and when each
// shows. The phone has its own (PhoneLayout); they share the parts (lists, item, document, the box), never the layout.
import { useLayoutEffect } from 'react'
import { D, OV, U, useTick } from '../lib/state'
import { DetailView } from '../components/Detail'
import { ProjectView } from '../components/Settings'
import {
  AppFrame,
  DeskFilters,
  Drawer,
  Foot,
  ItemsView,
  MainHead,
  ProjBar,
  Rail,
  Tabs,
  filtersSet,
} from '../components/Shell'
import { closeDrawer } from '../lib/nav'

/** Which parts of the desktop's project page are hidden now (true = hidden): its one rule, which Storybook's stories
 * follow too (B523). */
export function deskPanes() {
  const page = !!D.page,
    full = D.full && !!U.open && !page,
    rail = D.sideHidden, // B496: only you fold the sidebar, never the window's width
    over = rail && D.sideOpen,
    side = !!U.side && !page // T402: Documents, Activity or Deleted in the list column
  const v = {
    mainHead: page || full || side,
    items: page || full,
    detail: page,
    project: !page,
    foot: (page && !U.prefsEdit) || !!(U.doc && U.docEdit && !OV.spec) || (side && !U.open && !U.doc),
    deskFilters: page || full || side || !(D.filters || filtersSet().length),
    grip: page || full,
    rail: !rail || page,
    projBar: page,
    drawer: (rail && !over) || page,
    tabs: true,
  }
  return { v, page, full, rail, over, side }
}

/** Where each part sits in the desktop's grid: a sidebar beside a frame of two columns (the list's, the pane's) and five
 * rows (the project bar, the list's head, its filters, the list, the foot). Only this layout places them. */
export function deskPlace(full = deskPanes().full) {
  // the pane, and the foot under it, take the list's column too when an item is full width (O)
  const pane = full ? 'col-span-2 col-start-1' : 'col-start-2'
  return {
    projBar: 'col-span-2 col-start-1 row-start-1',
    mainHead: 'col-start-1 row-start-2',
    deskFilters: 'col-start-1 row-start-3',
    items: 'col-start-1 row-span-2 row-start-4',
    project: 'col-span-2 col-start-1 row-span-5 row-start-1',
    // the New input page: the pane is its head, the foot (the box, what you said lately) the rows under it
    detail: `row-span-3 row-start-2 group-data-[compose]/app:row-span-1 ${pane}`,
    // F395, B495: in two columns the foot is the conversation's column only
    foot: `row-start-5 group-data-duo/app:ml-[var(--duo-w,55%)] group-data-duo/app:after:left-1 group-data-[compose]/app:row-span-3 group-data-[compose]/app:row-start-3 ${pane}`,
  }
}

/** The sidebar: beside the frame, or over the page when you open it folded (F173). */
export const sidePlace = (over: boolean) =>
  `z-40 w-[var(--side-w,15rem)] shrink-0 border-r border-zinc-200 bg-zinc-50 2xl:w-[var(--side-w,16rem)] dark:border-zinc-800 ${over ? 'fixed top-0 left-0 shadow-2xl' : 'relative'}`

export function DeskLayout() {
  useTick((s) => s.view + s.side + s.head + s.list + s.project + s.detail)
  const { v, full, over } = deskPanes()
  const at = deskPlace(full)
  useLayoutEffect(() => {
    const shade = document.getElementById('drawerShade'),
      drawer = document.getElementById('drawer')
    if (shade) shade.style.left = over && drawer ? drawer.offsetWidth + 'px' : ''
  })
  return (
    <>
      <Drawer hidden={v.drawer} place={sidePlace(over)} />
      <Rail hidden={v.rail} />
      <div
        id="drawerShade"
        hidden={!over}
        onClick={closeDrawer}
        className="fixed top-0 right-0 z-30 h-dvh bg-zinc-900/20 dark:bg-black/50"
        aria-label="Close projects"
      />
      <AppFrame cls="z-10 grid h-full min-w-0 flex-1 grid-cols-[var(--list-w,360px)_minmax(0,1fr)] grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] bg-white pt-[env(safe-area-inset-top)] xl:grid-cols-[var(--list-w,420px)_minmax(0,1fr)] 2xl:grid-cols-[var(--list-w,460px)_minmax(0,1fr)] dark:bg-zinc-950">
        <ProjBar hidden={v.projBar} place={at.projBar} />
        <MainHead hidden={v.mainHead} place={at.mainHead} />
        <Tabs hidden={v.tabs} />
        <DeskFilters hidden={v.deskFilters} place={at.deskFilters} />
        <ItemsView hidden={v.items} place={at.items} />
        <DetailView hidden={v.detail} place={at.detail} />
        <ProjectView hidden={v.project} place={at.project} />
        <div
          id="listGrip"
          data-grip="list"
          hidden={v.grip}
          className="group/line relative z-30 col-start-1 row-span-4 row-start-2 block w-3 translate-x-1/2 cursor-col-resize justify-self-end"
        >
          <span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-blue-500 opacity-0 transition-opacity group-hover/line:opacity-100 group-hover/line:delay-150 group-data-drag/line:opacity-100" />
        </div>
        <Foot hidden={v.foot} place={at.foot} />
      </AppFrame>
    </>
  )
}
