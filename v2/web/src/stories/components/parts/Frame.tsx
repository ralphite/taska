// T457: the page's frame: the project's bar, the list's head and tabs, the filters, the sidebar, the phone's drawer,
// the rail, the agent pill, and what floats over the page (toast, picture viewer, tip).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'
import {
  DeskFilters,
  Drawer,
  DrawerSettings,
  FailedPill,
  FilterChips,
  FilterDot,
  FilterStrip,
  filtersSet,
  MainHead,
  Pill,
  ProjBar,
  Rail,
  Tabs,
  Tip,
  Toast,
  Viewer,
} from '../../../components/Shell'
import { D, DR, U, byN, model, parseRef } from '../../../lib/state'
import { tipShow } from '../../../lib/events'
import { WorkerMark } from '../../../components/List'
import { FAILED, TOAST } from '../../../lib/toast'
import { VW } from '../../../lib/viewer'
import { Pane, type Setup } from '../../lib/demo'
import { Column } from '../../lib/column'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: [
      'AppFrame', // every component story stands in the page's own frame
      'ProjBar',
      'MainHead',
      'Tabs',
      'FilterStrip',
      'DeskFilters',
      'FilterChips',
      'FilterDot',
      'Pill',
      'FailedPill',
      'SideList',
      'SideLink',
      'StoryLink',
      'SideFoot',
      'DrawerSettings',
      'Drawer',
      'Rail',
      'Toast',
      'Viewer',
      'Tip',
    ],
  },
}
export type Story = StoryObj
const at = (setup: (x: Setup) => void) => ({ taska: { setup } })

// ---------------------------------------------------------------- the heads

/** The project's bar (desktop, over both panes): its name, the agent pill, search. */
export const ProjectBar: Story = {
  render: () => <ProjBar hidden={false} />,
}
/** The list's head: the project (phone) or the search (desktop), the pill. */
export const ListHead: Story = {
  render: () => (
    <Pane w="list">
      <MainHead hidden={false} />
    </Pane>
  ),
}
export const ListHeadSearching: Story = {
  parameters: at(() => {
    U.searching = true
    U.q = '\u5bfc\u51fa'
  }),
  render: ListHead.render,
}
/** Items, Inputs, Archive, Rules, with their counts. */
const tabs = (tab: 'items' | 'inputs' | 'archive' | 'rules'): Story => ({
  parameters: at(() => (U.tab = tab)),
  render: () => (
    <Pane w="list">
      <Tabs hidden={false} />
    </Pane>
  ),
})
export const TabsItems = tabs('items')
export const TabsInputs = tabs('inputs')
export const TabsArchive = tabs('archive')
export const TabsRules = tabs('rules')
/** The filters set, as a strip under the tabs (phone). */
export const FiltersStrip: Story = {
  parameters: at(() => {
    U.type = 'bug'
    U.pri = 'P0'
    U.when = 'now'
  }),
  render: () => (
    <Pane w="list">
      <FilterStrip />
    </Pane>
  ),
}
/** The filters open in place under the list's head (desktop). */
export const FiltersOpen: Story = {
  parameters: at(() => {
    D.filters = true
    U.type = 'bug'
  }),
  render: () => (
    <Pane w="list">
      <DeskFilters hidden={false} />
    </Pane>
  ),
}
export const FilterChipsAndDot: Story = {
  parameters: at(() => {
    U.type = 'bug'
    U.pri = 'P0'
  }),
  render: () => (
    <div className="flex items-center gap-4 p-6">
      <FilterChips set={filtersSet()} />
      <FilterDot />
    </div>
  ),
}

// ---------------------------------------------------------------- the agent pill, what did not save

const pill = (setup?: (x: Setup) => void): Story => ({
  parameters: at((x) => setup?.(x)),
  render: () => (
    <div className="flex items-center gap-3 p-6">
      <Pill />
      <FailedPill />
    </div>
  ),
})
/** An agent is at work. */
export const PillWorking = pill()
/** An agent waits for work. */
export const PillReady = pill(({ S }) => {
  for (const a of S.agents) a.waiting = true
})
/** Work waits and no agent has come for a while. */
export const PillNoAgent = pill(({ S }) => {
  for (const a of S.agents) a.t = Date.now() - 5 * 3600e3
  S.work = true
})
export const PillIdle = pill(({ S }) => {
  for (const a of S.agents) a.t = Date.now() - 26 * 3600e3
  S.work = false
})
export const PillOffline = pill(() => (model.offline = 2))
/** Changes that did not go in: the red count beside the pill. */
export const NotSaved = pill(() => {
  FAILED.push(
    { id: 1, sid: 'a', what: 'T03 done', why: 'Taska said no', at: Date.now(), retry: () => {}, p: '/p/shop/' },
    { id: 2, sid: 'b', what: 'F08 P1', why: 'Taska said no', at: Date.now(), retry: () => {}, p: '/p/shop/' },
  )
})

// ---------------------------------------------------------------- the sidebar, the rail, the phone's drawer

/** The sidebar (desktop: projects, Documents, Activity, Deleted, Storybook, Settings) and the phone's drawer, open. */
export const Sidebar: Story = {
  parameters: at(() => (DR.open = true)),
  render: () => <Drawer hidden={false} over={false} />,
}
export const DrawerFoot: Story = {
  render: () => (
    <div className="w-80 p-3">
      <DrawerSettings />
    </div>
  ),
}
/** The rail: the sidebar folded to icons (desktop, narrower windows). */
export const RailFolded: Story = {
  render: () => <Rail hidden={false} />,
}

// ---------------------------------------------------------------- what floats over the page

/** A toast: at the foot of the phone; in the pane you acted in on the desktop (here the item's). */
const toast = (t: Partial<typeof TOAST>): Story => ({
  parameters: at(({ it }) => {
    U.open = it('F1').n
    Object.assign(TOAST, { shown: true, n: 1, label: 'Undo', act: null, ...t })
  }),
  render: () => (
    <div className="relative h-screen">
      <Column />
      <Toast />
    </div>
  ),
})
export const ToastPlain = toast({ text: 'Copied for your agent' })
export const ToastWithUndo = toast({ text: 'T03 is done', act: () => {} })
export const ToastError = toast({ text: 'Not saved: T03 done: Taska said no', error: true })
export const ToastStays = toast({ text: 'Not saved yet: T03 done. It goes when Taska answers', sticky: true })
export const ToastLong = toast({
  text: 'B36 \u4f18\u60e0\u5238\u548c\u793c\u54c1\u5361\u540c\u65f6\u7528\u65f6\uff0c\u8d2d\u7269\u8f66\u603b\u4ef7\u591a\u51cf\u4e86\u4e00\u6b21\u8fd0\u8d39 moved to Mobile app',
  act: () => {},
  label: 'Open',
})

/** A picture opened from an input. */
export const PictureViewer: Story = {
  parameters: at(({ S }) => {
    const pics = S.inputs.flatMap((r) => r.files).filter((f) => f.mime?.startsWith('image/'))
    Object.assign(VW, { open: true, group: pics.map((f) => f.f), idx: 1, fit: true })
  }),
  render: () => <Viewer />,
}

function TipShown() {
  useEffect(() => {
    // the page's own tip, shown for the agent's mark as pointing at it does (lib/events.ts)
    const el = document.querySelector<HTMLElement>('[data-tip]')
    if (el) tipShow(el, true)
  }, [])
  return (
    <div className="p-10">
      <WorkerMark it={byN.get(parseRef('F1') as number)!} />
      <Tip />
    </div>
  )
}
/** The tip that shows when you point at something (desktop). */
export const PointingTip: Story = { render: () => <TipShown /> }
