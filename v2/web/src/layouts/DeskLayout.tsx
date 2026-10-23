// The desktop's layout (B496, r749): which panes the project page has on a computer, where each sits and when each
// shows. The phone has its own (PhoneLayout); they share the parts (lists, item, document, the box), never the layout.
import { useLayoutEffect } from 'react'
import { D, OV, U, useTick } from '../lib/state'
import { DetailView } from '../components/Detail'
import { InputsView } from '../components/Inputs'
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
    inputs = U.tab === 'inputs',
    full = D.full && !!U.open && !inputs && !page,
    rail = D.sideHidden, // B496: only you fold the sidebar, never the window's width
    over = rail && D.sideOpen,
    side = !!U.side && !page // T402: Documents, Activity or Deleted in the list column
  const v = {
    mainHead: page || full || side,
    items: page || inputs || full,
    inputs: page || !inputs,
    detail: page,
    project: !page,
    foot: (page && !U.prefsEdit) || !!(U.doc && U.docEdit && !OV.spec) || (side && !U.open && !U.doc),
    deskFilters: page || full || inputs || side || !(D.filters || filtersSet().length),
    grip: page || full,
    rail: !rail || page,
    projBar: page,
    drawer: (rail && !over) || page,
    tabs: true,
  }
  return { v, page, inputs, full, rail, over, side }
}

export function DeskLayout() {
  useTick((s) => s.view + s.side + s.head + s.list + s.project + s.detail)
  const { v, full, over } = deskPanes()
  const wideCls = full ? 'lg:col-start-1 lg:col-span-2' : 'lg:col-start-2'
  useLayoutEffect(() => {
    const shade = document.getElementById('drawerShade'),
      drawer = document.getElementById('drawer')
    if (shade) shade.style.left = over && drawer ? drawer.offsetWidth + 'px' : ''
  })
  return (
    <>
      <Drawer hidden={v.drawer} over={over} />
      <Rail hidden={v.rail} />
      <div
        id="drawerShade"
        hidden={!over}
        onClick={closeDrawer}
        className="fixed top-0 right-0 z-30 h-dvh bg-zinc-900/20 dark:bg-black/50"
        aria-label="Close projects"
      />
      <AppFrame cls="z-10 grid h-full min-w-0 flex-1 grid-cols-[var(--list-w,360px)_minmax(0,1fr)] grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] bg-white pt-[env(safe-area-inset-top)] xl:grid-cols-[var(--list-w,420px)_minmax(0,1fr)] 2xl:grid-cols-[var(--list-w,460px)_minmax(0,1fr)] dark:bg-zinc-950">
        <ProjBar hidden={v.projBar} />
        <MainHead hidden={v.mainHead} />
        <Tabs hidden={v.tabs} />
        <DeskFilters hidden={v.deskFilters} />
        <ItemsView hidden={v.items} />
        <InputsView hidden={v.inputs} />
        <DetailView hidden={v.detail} />
        <ProjectView hidden={v.project} />
        <div
          id="listGrip"
          data-grip="list"
          hidden={v.grip}
          className="group/line relative z-30 col-start-1 row-span-4 row-start-2 block w-3 translate-x-1/2 cursor-col-resize justify-self-end"
        >
          <span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-blue-500 opacity-0 transition-opacity group-hover/line:opacity-100 group-hover/line:delay-150 group-data-drag/line:opacity-100" />
        </div>
        <Foot hidden={v.foot} wideCls={wideCls} />
      </AppFrame>
    </>
  )
}
