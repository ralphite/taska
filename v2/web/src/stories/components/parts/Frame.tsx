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
import { ItemRow, NeedsRow, WorkerMark } from '../../../components/List'
import { FAILED, TOAST } from '../../../lib/toast'
import { VW } from '../../../lib/viewer'
import { Pane, type Setup } from '../../lib/demo'
import { Column, drawerPlace } from '../../lib/column'
import { looks, tipOn } from '../../lib/states'

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
  render: () => (
    <Pane w="wide">
      <ProjBar hidden={false} />
    </Pane>
  ),
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
  render: () => <Drawer hidden={false} place={drawerPlace()} />,
}
export const DrawerFoot: Story = {
  render: () => (
    <div className="w-80 p-3">
      <DrawerSettings />
    </div>
  ),
}
/** The rail: the sidebar folded to icons (desktop, once you fold it with [ or its button; never by the width, B496). */
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

// ---------------------------------------------------------------- every tip, shown
// T522 (r731, #6209): the page's one tip (lib/events.ts tipShow), shown for each kind of place that has one, as
// pointing at it shows it: its words, its key, its side (to the right in the sidebar and the rail, under the heads).
const rowOf = (ref: string) => () => (
  <Pane w="list">
    <div id="list" className="lg:mr-px">
      <ItemRow it={byN.get(parseRef(ref) as number)!} group={[...byN.values()]} />
    </div>
  </Pane>
)
const needOf = (ref: string) => () => (
  <Pane w="list">
    <div id="list" className="lg:mr-px">
      <NeedsRow it={byN.get(parseRef(ref) as number)!} />
    </div>
  </Pane>
)
/** A row's button, the pointer on the row: what it does and its key. */
export const TipRowButton: Story = {
  ...tipOn(rowOf('T3'), '[data-act="open"] div > button[data-act]:first-child'),
  parameters: { platform: 'desktop', pseudo: { hover: ['[data-act="open"]'] } },
  globals: { pseudo: { hover: ['[data-act="open"]'] } },
}
/** The one action of a row that waits on you, and its key. */
export const TipNeedsPill: Story = tipOn(needOf('I4'), 'button[data-act="row-act"]')
/** A row's count of comments: what it counts. */
export const TipRowCount: Story = tipOn(rowOf('T3'), '[data-act="open"] span[title]')
/** How many need you, in a project of the sidebar (to its right). */
export const TipSidebarNeeds: Story = tipOn(
  () => <Drawer hidden={false} place={drawerPlace()} />,
  '#drawerList span[title]',
)
/** Hide the sidebar and its key. */
export const TipHideSidebar: Story = tipOn(() => <Drawer hidden={false} place={drawerPlace()} />, '#sideBtn')
/** A project of the rail: its name (to its right). */
export const TipRailProject: Story = tipOn(() => <Rail hidden={false} />, 'a[data-slug="mobile-app"]')
/** Settings in the rail and its keys. */
export const TipRailSettings: Story = tipOn(() => <Rail hidden={false} />, '#rail [data-act="project"]')
/** Filters over the list (under it, as in a head) and its key. */
export const TipFilters: Story = tipOn(
  () => (
    <Pane w="list">
      <MainHead hidden={false} />
    </Pane>
  ),
  '#deskFilterBtn',
)
/** The status chip of an item and its key. */
export const TipStatusChip: Story = tipOn(() => <Column />, '[data-arm="s"]', {
  taska: { setup: ({ it }: Setup) => (U.open = it('F1').n) },
})
/** All actions (⋯) of an item and its key. */
export const TipAllActions: Story = tipOn(() => <Column />, '#itemMenuBtn', {
  taska: { setup: ({ it }: Setup) => (U.open = it('F1').n) },
})

// ---------------------------------------------------------------- under the pointer, the keyboard, pressed, dragged
// T522 (r731, r762): every look of the sidebar, the rail and the heads side by side, each drawn without a pointer or a
// key (../../lib/states.tsx). The shop is the project open; the mobile app is another one in the sidebar.
const OTHER = 'a[data-slug="mobile-app"]',
  CUR = 'a[aria-current="page"][data-slug]',
  NEW_INPUT = 'div:has(> #newInputBtn)'
const side = () => <Drawer hidden={false} place={drawerPlace()} />
export const SidebarLooks: Story = looks(
  [
    { name: 'As it is (New input open)', draw: side },
    { name: 'Pointer on another project', draw: side, hover: [OTHER] },
    { name: 'Pointer on the project open', draw: side, hover: [CUR] },
    { name: 'Keys: Tab on a project', draw: side, focus: [OTHER] },
    { name: 'A project pressed', draw: side, pressed: [OTHER] },
    { name: 'A project dragged into a new place', draw: side, marks: [[OTHER, 'data-dragging', '']] },
    { name: 'An item dragged onto a project', draw: side, marks: [[OTHER, 'data-drop', '']] },
    { name: 'Pointer on New input: its mic shows', draw: side, hover: [NEW_INPUT, '#newInputBtn'] },
    {
      name: 'New input not open, pointer on it',
      draw: side,
      hover: [NEW_INPUT, '#newInputBtn'],
      marks: [['#newInputBtn', 'aria-pressed', 'false']],
    },
    { name: 'Pointer on the mic of New input', draw: side, hover: [NEW_INPUT, '[data-act="new-voice"]'] },
    { name: 'Pointer on New project', draw: side, hover: ['#drawerNew'] },
    { name: 'Pointer on Hide the sidebar', draw: side, hover: ['#sideBtn'] },
    { name: 'Pointer on Documents', draw: side, hover: ['#sideFoot [data-sec="docs"]'] },
    { name: 'Pointer on Settings', draw: side, hover: ['#sideFoot [data-act="project"]'] },
    { name: 'Keys: Tab on Keyboard shortcuts', draw: side, focus: ['#sideFoot [data-act="keys"]'] },
    { name: 'Pointer on its edge: drag to widen', draw: side, hover: ['[data-grip="side"]'] },
    { name: 'Its edge dragged', draw: side, marks: [['[data-grip="side"]', 'data-drag', '']] },
  ],
  { w: 'w-60' },
)
/** Documents open from the sidebar: its link marked, and under the pointer. */
export const SidebarSideOpenLooks: Story = looks(
  [
    { name: 'Documents open', draw: side },
    { name: 'Documents open, pointer on it', draw: side, hover: ['#sideFoot [data-sec="docs"]'] },
    { name: 'Pointer on Activity', draw: side, hover: ['#sideFoot [data-sec="log"]'] },
  ],
  { w: 'w-60', setup: () => (U.side = 'docs') },
)
const rail = () => <Rail hidden={false} />
export const RailLooks: Story = looks(
  [
    { name: 'As it is', draw: rail },
    { name: 'Pointer on a project', draw: rail, hover: [OTHER] },
    { name: 'Pointer on the project open', draw: rail, hover: [CUR] },
    { name: 'Pointer on New input (open)', draw: rail, hover: ['[data-act="new-input"][aria-pressed]'] },
    { name: 'Pointer on Show the sidebar', draw: rail, hover: ['[data-act="side"]'] },
    { name: 'Pointer on Settings', draw: rail, hover: ['[data-act="project"]'] },
    { name: 'Keys: Tab on Settings', draw: rail, focus: ['[data-act="project"]'] },
    { name: 'Settings pressed', draw: rail, pressed: ['[data-act="project"]'] },
  ],
  { w: 'w-44' },
)
const bar = () => (
  <Pane w="wide">
    <ProjBar hidden={false} />
  </Pane>
)
const TAB_ON = '[role="tab"][aria-selected="true"]',
  TAB_OFF = '[role="tab"][data-tab="inputs"]',
  DESK_OFF = '[role="tab"][data-tab="rules"]'
export const ProjectBarLooks: Story = looks(
  [
    { name: 'As it is', draw: bar },
    { name: 'Pointer on a tab', draw: bar, hover: [DESK_OFF] },
    { name: 'Pointer on the tab open', draw: bar, hover: [TAB_ON] },
    { name: 'Keys: Tab on a tab', draw: bar, focus: [DESK_OFF] },
    { name: 'A tab pressed', draw: bar, pressed: [DESK_OFF] },
    { name: 'Pointer on the agent', draw: bar, hover: ['[data-act="agent-info"]'] },
  ],
  { w: 'w-full' },
)
const head = () => (
  <Pane w="list">
    <MainHead hidden={false} />
  </Pane>
)
export const ListHeadLooks: Story = looks(
  [
    { name: 'As it is, words searched', draw: head },
    { name: 'Pointer on Filters', draw: head, hover: ['#deskFilterBtn'] },
    { name: 'Filters open', draw: head, marks: [['#deskFilterBtn', 'aria-expanded', 'true']] },
    { name: 'Keys: Tab on Filters', draw: head, focus: ['#deskFilterBtn'] },
    { name: 'In the search box', draw: head, within: ['label:has(#q)'] },
    { name: 'Pointer on Clear', draw: head, hover: ['#qX'] },
  ],
  { setup: () => (U.q = '导出') },
)
const phoneTabs = () => (
  <Pane w="full">
    <Tabs hidden={false} />
  </Pane>
)
export const TabsLooks: Story = looks(
  [
    { name: 'As it is', draw: phoneTabs },
    { name: 'A tab pressed', draw: phoneTabs, pressed: [TAB_OFF] },
    { name: 'The tab open, pressed', draw: phoneTabs, pressed: [TAB_ON] },
    { name: 'Filters pressed', draw: phoneTabs, pressed: ['#filterBtn'] },
  ],
  { w: 'w-[345px]', platform: 'phone' },
)
