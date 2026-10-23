// The phone's layout (B496, r749): which screens the project page has on a phone, and when each shows. The desktop has
// its own (DeskLayout); they share the parts (lists, item, document, the box), never the layout.
import { useLayoutEffect } from 'react'
import { D, DR, U, SWIPE, useTick } from '../lib/state'
import { DetailView } from '../components/Detail'
import { InputsView } from '../components/Inputs'
import { ProjectView } from '../components/Settings'
import {
  AppFrame,
  Drawer,
  FilterStrip,
  Foot,
  ItemsView,
  MainHead,
  ProjBar,
  Tabs,
  drawerW,
  setDrawer,
} from '../components/Shell'
import { closeDrawer } from '../lib/nav'

/** Which parts of the phone's project page are hidden now (true = hidden): its one rule, which Storybook's stories
 * follow too (B523). The item page covers the list and its tabs; the input box stays, now adding to that item. */
export function phonePanes() {
  const page = !!D.page,
    inputs = U.tab === 'inputs',
    open = !!U.open && !page,
    under = !open && !page
  const v = {
    mainHead: !under,
    items: !under || inputs,
    inputs: !under || !inputs,
    detail: !open,
    project: !page,
    foot: (page && !U.prefsEdit) || !!(U.editing && U.editing === U.open),
    projBar: true,
    drawer: !DR.open,
    tabs: !under,
  }
  return { v, page, inputs, under }
}

export function PhoneLayout() {
  useTick((s) => s.view + s.side + s.head + s.list + s.project + s.detail)
  const { v } = phonePanes()
  useLayoutEffect(() => {
    setDrawer(DR.open ? drawerW() : 0)
    // B333: a back swipe shows these by hand; when it lands on another item React sees nothing to change, so put them
    // back as this page has them
    if (SWIPE.back) return
    for (const [id, h] of [
      ['itemsView', v.items],
      ['mainHead', v.mainHead],
      ['tabs', v.tabs],
    ] as const) {
      const el = document.getElementById(id)
      if (el && el.hidden !== h) el.hidden = h
    }
  })
  return (
    <>
      <Drawer hidden={v.drawer} over={false} />
      <div
        id="drawerShade"
        hidden={!DR.open}
        onClick={closeDrawer}
        className="fixed top-0 right-0 z-30 h-dvh"
        aria-label="Close projects"
      />
      <AppFrame cls="z-10 mx-auto flex h-full max-w-3xl flex-col bg-white pt-[env(safe-area-inset-top)] md:border-x md:border-zinc-200 dark:bg-zinc-950 md:dark:border-zinc-800">
        <ProjBar hidden={v.projBar} />
        <MainHead hidden={v.mainHead} />
        <Tabs hidden={v.tabs} />
        <FilterStrip />
        <ItemsView hidden={v.items} />
        <InputsView hidden={v.inputs} />
        <DetailView hidden={v.detail} />
        <ProjectView hidden={v.project} />
        <Foot hidden={v.foot} wideCls="" />
      </AppFrame>
    </>
  )
}
