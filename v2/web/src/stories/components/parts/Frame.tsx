// T457: the page's frame: the project's bar, the list's head and tabs, the filters, the sidebar, the phone's drawer,
// the rail, the agent pill, and what floats over the page (toast, picture viewer, tip).
// B555: each story is the real page at an address, after Yadong's steps there, showing that part of it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { looksOf, place } from '../../lib/onpage'
import type { Do, Twin } from '../../lib/twin'

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

const SHOP = '/p/shop/'
const at = (path = '') => (path.startsWith('/') ? path : SHOP + path)
const open = (code: string) => `#list [data-act="open"][data-n="${code.replace(/^\D+/, '')}"]`
const rowOf = (code: string) => `#list article[data-n="${code.replace(/^\D+/, '')}"]`
/** Done on the open item: its button in the pane's head on the desktop; its status chip, then Done, on the phone. */
const DONE: Do[] = [
  { click: '#dActs [data-act="status"][data-v="done"]', on: 'd' },
  { click: '#detailBody [data-arm="s"]', on: 'p' },
  { click: '#dlgBody [data-v="done"]', on: 'p' },
]
/** The phone's drawer, opened from the project's name; the desktop's sidebar is always there. */
const drawer: Do = { click: '#projBtn', on: 'p' }
/** The sidebar folded to icons: its own button (or [). */
const fold: Do = { click: '#sideBtn' }

// ---------------------------------------------------------------- the heads

/** The project's bar (desktop, over both panes): its name, the tabs, the agent pill. */
export const ProjectBar = place({ at: SHOP, part: '#projBar' }, 'desktop')
/** The list's head: the project (phone) or the search (desktop), the pill. */
export const ListHead = place({ at: SHOP, part: '#mainHead' })
export const ListHeadSearching = place({ at: at('?q=\u5bfc\u51fa'), part: '#mainHead' })
/** Items, Inputs, Archive, Rules, with their counts: under the head on the phone, in the project's bar on the desktop. */
const tabs = (path: string, on?: 'phone'): Story => place({ at: at(path), part: { d: '#projBar', p: '#tabs' } }, on)
export const TabsItems = tabs('')
/** Inputs (the phone: on the desktop /inputs is the New input page, and the bar has no Inputs tab). */
export const TabsInputs = tabs('inputs', 'phone')
export const TabsArchive = tabs('archive')
export const TabsRules = tabs('rules')
/** The filters set, as a strip under the tabs (phone). */
export const FiltersStrip = place({ at: at('?type=bug&pri=P0&when=now'), part: '#filterStrip' }, 'phone')
/** The filters open in place under the list's head (desktop). */
export const FiltersOpen = place(
  { at: at('?type=bug'), steps: [{ click: '#deskFilterBtn' }], live: false, part: ['#mainHead', '#deskFilters'] },
  'desktop',
)
/** Two filters set: their chips, and the dot on the Filters button. */
export const FilterChipsAndDot = place({
  at: at('?type=bug&pri=P0'),
  part: { d: ['#mainHead', '#deskFilters'], p: ['#tabs', '#filterStrip'] },
})

// ---------------------------------------------------------------- the agent pill, what did not save

const PILL = { d: '#deskAgent', p: '#mainHead' }
/** An agent was here a moment ago (the demo's Codex). */
export const PillWorking = place({ at: SHOP, part: PILL })
/** No agent has come to the project yet (Website). */
export const PillIdle = place({ at: '/p/website/', part: PILL })
/** Taska out of reach: the pill says so while the page tries again. */
export const PillOffline = place({ at: SHOP, steps: [{ online: false }, { wait: 4000 }], part: PILL })
// two changes Taska said no to (their items deleted meanwhile): T03 and T15 marked done
const refused = (codes: string[]): Do[] =>
  codes.flatMap((c): Do[] => [{ click: open(c) }, ...DONE, { click: '#backBtn', on: 'p' }])
const OP = { '^/p/shop/api/op': 'no' as const }
/** Changes that did not go in: the red count beside the pill. */
export const NotSaved = place({ at: SHOP, net: OP, steps: refused(['T3', 'T15']), part: PILL, still: true })

// ---------------------------------------------------------------- the sidebar, the rail, the phone's drawer

/** The sidebar (desktop: projects, Dev, Documents, Activity, Deleted, Settings) and the phone's drawer, open. */
export const Sidebar = place({ at: SHOP, steps: [drawer], live: false, part: '#drawer' })
/** The foot of the phone's drawer: Settings and the rest. */
export const DrawerFoot = place({ at: SHOP, steps: [drawer], live: false, part: '#drawerSettings' }, 'phone')
/** The rail: the sidebar folded to icons (desktop, once you fold it with [ or its button; never by the width, B496). */
export const RailFolded = place({ at: SHOP, steps: [fold], live: false, part: '#rail' }, 'desktop')

// ---------------------------------------------------------------- what floats over the page

/** A toast: at the foot of the phone; in the pane you acted in on the desktop. A picture of its moment: it would go
 * after a few seconds. */
const toast = (ref: string, steps: Do[], more: Partial<Twin> = {}): Story =>
  place({ at: at(ref), steps, part: '#toast', still: true, ...more })
/** Copy for agent, from the item's menu: Copied. */
export const ToastPlain = toast('F1', [{ click: '#itemMenuBtn' }, { click: '#dlgBody [data-act="copy"]' }], {
  live: false,
})
/** Done on an item: what happened, and Undo. */
export const ToastWithUndo = toast('T3', DONE)
/** Taska said no (the item was deleted meanwhile): red, why. */
export const ToastError = toast('T3', DONE, { net: OP })
/** A long line: B36 moved to Mobile app, with Open. */
export const ToastLong = toast('B36', [
  { click: '#itemMenuBtn' },
  { click: '#dlgBody [data-act="item-move-proj"]' },
  { click: '#dlgBody [data-act="item-move-to"][data-to="mobile-app"]' },
])

/** A picture opened from a row (B36's screenshot). */
export const PictureViewer = place({
  at: SHOP,
  steps: [{ click: `${open('B36')} button[data-act="view"]` }],
  live: false,
  part: '#viewer',
})

/** The tip that shows when you point at something (desktop): the agent's mark on F01's row. */
export const PointingTip = place(
  { at: SHOP, part: [rowOf('F1'), '#tip'], hover: `${rowOf('F1')} [data-tip]` },
  'desktop',
)

// ---------------------------------------------------------------- every tip, shown
// T522 (r731, #6209): the page's one tip, shown for each kind of place that has one, as pointing at it shows it: its
// words, its key, its side (to the right in the sidebar and the rail, under the heads). The desktop only.
const tip = (part: string | string[], hover: string, more: Partial<Twin> = {}): Story =>
  place({ at: SHOP, part: [part, '#tip'].flat(), hover, ...more }, 'desktop')
/** A row's button, the pointer on the row: what it does and its key. */
export const TipRowButton = tip(rowOf('T3'), `${open('T3')} div > button[data-act]:first-child`)
/** The one action of a row that waits on you, and its key. */
export const TipNeedsPill = tip(rowOf('I4'), `${open('I4')} button[data-act="row-act"]`)
/** A row's count of comments: what it counts. */
export const TipRowCount = tip(rowOf('T13'), `${open('T13')} span[title]`)
/** How many need you, in a project of the sidebar (to its right). */
export const TipSidebarNeeds = tip('#drawer', '#drawerList a[data-slug="shop"] span[title]')
/** Hide the sidebar and its key. */
export const TipHideSidebar = tip('#drawer', '#sideBtn')
/** A project of the rail: its name (to its right). */
export const TipRailProject = tip('#rail', '#rail a[data-slug="mobile-app"]', { steps: [fold], live: false })
/** Settings in the rail and its keys. */
export const TipRailSettings = tip('#rail', '#rail [data-act="project"]', { steps: [fold], live: false })
/** Filters over the list (under it, as in a head) and its key. */
export const TipFilters = tip('#mainHead', '#deskFilterBtn')
/** The status chip of an item and its key. */
export const TipStatusChip = tip('#detailBody', '#detailBody [data-arm="s"]', { at: at('F1') })
/** All actions (⋯) of an item and its key. */
export const TipAllActions = tip('#dHead', '#itemMenuBtn', { at: at('F1') })

// ---------------------------------------------------------------- under the pointer, the keyboard, pressed, dragged
// T522 (r731, r762): every look of the sidebar, the rail and the heads side by side, each the real page with the
// pointer, a key, a press or a drag on it. The shop is the project open; the mobile app is another one in the sidebar.
const OTHER = '#drawer a[data-slug="mobile-app"]',
  CUR = '#drawer a[aria-current="page"][data-slug]',
  NEW_INPUT = '#newInputBtn'
export const SidebarLooks: Story = looksOf({ at: SHOP, part: '#drawer' }, [
  { name: 'As it is (New input open)' },
  { name: 'Pointer on another project', hover: OTHER },
  { name: 'Pointer on the project open', hover: CUR },
  { name: 'Keys: Tab on a project', focus: OTHER },
  { name: 'A project pressed', steps: [{ press: OTHER }] },
  { name: 'A project dragged into a new place', steps: [{ press: OTHER, to: '#drawer a[data-slug="website"]' }] },
  { name: 'An item dragged onto a project', steps: [{ drag: open('T3'), onto: OTHER, drop: 'into' }] },
  { name: 'Pointer on New input: its mic shows', hover: NEW_INPUT },
  { name: 'New input not open, pointer on it', at: at('T3'), hover: NEW_INPUT },
  { name: 'Pointer on the mic of New input', hover: '#drawer [data-act="new-voice"]' },
  { name: 'Pointer on New project', hover: '#drawerNew' },
  { name: 'Pointer on Hide the sidebar', hover: '#sideBtn' },
  { name: 'Pointer on Documents', hover: '#sideFoot [data-sec="docs"]' },
  { name: 'Pointer on Settings', hover: '#sideFoot [data-act="project"]' },
  { name: 'Keys: Tab on Keyboard shortcuts', focus: '#sideFoot [data-act="keys"]' },
  { name: 'Pointer on its edge: drag to widen', hover: '[data-grip="side"]' },
  { name: 'Its edge dragged', steps: [{ press: '[data-grip="side"]' }] },
])
/** Documents open from the sidebar: its link marked, and under the pointer. */
export const SidebarSideOpenLooks: Story = looksOf({ at: at('docs'), part: '#drawer' }, [
  { name: 'Documents open' },
  { name: 'Documents open, pointer on it', hover: '#sideFoot [data-sec="docs"]' },
  { name: 'Pointer on Activity', hover: '#sideFoot [data-sec="log"]' },
])
export const RailLooks: Story = looksOf({ at: SHOP, steps: [fold], part: '#rail' }, [
  { name: 'As it is' },
  { name: 'Pointer on a project', hover: '#rail a[data-slug="mobile-app"]' },
  { name: 'Pointer on the project open', hover: '#rail a[aria-current="page"][data-slug]' },
  { name: 'Pointer on New input (open)', hover: '#rail [data-act="new-input"][aria-pressed]' },
  { name: 'Pointer on Show the sidebar', hover: '#rail [data-act="side"]' },
  { name: 'Pointer on Settings', hover: '#rail [data-act="project"]' },
  { name: 'Keys: Tab on Settings', focus: '#rail [data-act="project"]' },
  { name: 'Settings pressed', steps: [{ press: '#rail [data-act="project"]' }] },
])
const TAB_ON = '[role="tab"][aria-selected="true"]',
  DESK_OFF = '#projBar [role="tab"][data-tab="rules"]'
export const ProjectBarLooks: Story = looksOf({ at: SHOP, part: '#projBar' }, [
  { name: 'As it is' },
  { name: 'Pointer on a tab', hover: DESK_OFF },
  { name: 'Pointer on the tab open', hover: `#projBar ${TAB_ON}` },
  { name: 'Keys: Tab on a tab', focus: DESK_OFF },
  { name: 'A tab pressed', steps: [{ press: DESK_OFF }] },
  { name: 'Pointer on the agent', part: ['#projBar', '#tip'], hover: '[data-act="agent-info"]' },
])
export const ListHeadLooks: Story = looksOf({ at: at('?q=\u5bfc\u51fa'), part: '#mainHead' }, [
  { name: 'As it is, words searched' },
  { name: 'Pointer on Filters', part: ['#mainHead', '#tip'], hover: '#deskFilterBtn' },
  { name: 'Filters open', steps: [{ click: '#deskFilterBtn' }] },
  { name: 'Keys: Tab on Filters', focus: '#deskFilterBtn' },
  { name: 'In the search box', steps: [{ click: '#q' }] },
  { name: 'Pointer on Clear', hover: '#qX' },
])
const PHONE_OFF = '#tabs [role="tab"][data-tab="inputs"]'
export const TabsLooks: Story = looksOf(
  { at: SHOP, part: '#tabs' },
  [
    { name: 'As it is' },
    { name: 'A tab pressed', steps: [{ press: PHONE_OFF }] },
    { name: 'The tab open, pressed', steps: [{ press: `#tabs ${TAB_ON}` }] },
    { name: 'Filters pressed', steps: [{ press: '#filterBtn' }] },
  ],
  'phone',
)
