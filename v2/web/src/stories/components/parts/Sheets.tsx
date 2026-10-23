// T457: every sheet and menu, opened where the page opens it (R509): a sheet from the bottom on the phone; on the
// desktop a menu under the button it came from (B358), at the pointer for a right-click, or a dialog in the middle.
// B555: each story is the real page, opened by Yadong's click, key or right-click there: the menu with what it was
// opened from on the desktop, the whole screen with the sheet over it on the phone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { place } from '../../lib/onpage'
import type { Do, Twin } from '../../lib/twin'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: [
      'Dialog',
      'CloseX',
      'SegCtl',
      'StatIcon',
      'ItemHeadLine',
      'FilterControls',
      'Switcher',
      'Palette',
      'Picker',
      'MoveInputBody',
      'Armed',
    ],
  },
}
export type Story = StoryObj

const SHOP = '/p/shop/'
const DLG = '#dlg'
/** The page at `ref` after these steps, the menu or sheet they open: on the desktop with what it came from (`from`),
 * on the phone the whole screen under the sheet. */
const opens = (ref: string, steps: Do[], from: string | string[], more: Partial<Twin> = {}, on?: 'desktop'): Story =>
  place({ at: SHOP + ref, steps, part: { d: [from, DLG].flat(), p: '#overlay' }, live: false, ...more }, on)
const open = (code: string) => `#list [data-act="open"][data-n="${code.replace(/^\D+/, '')}"]`

// ---------------------------------------------------------------- the item's menu (its ⋯, its chips)

const MENU: Do = { click: '#itemMenuBtn' }
/** An item's menu from its ⋯: a sheet of tiles and its type, priority and status on the phone, a menu with each
 * action's key under the button on the desktop. */
const itemMenu = (ref: string, more: Do[] = [], x: Partial<Twin> = {}) => opens(ref, [MENU, ...more], '#dHead', x)
export const ItemInProgress = itemMenu('F1')
/** Done, Won't do: Archive, no Later. */
export const ItemDone = itemMenu('B10')
/** For later: Back to now. */
export const ItemLater = itemMenu('F8')
/** A subitem: Put under… says where it is now. */
export const Subitem = itemMenu('T15')
/** Archived: Unarchive. */
export const ItemArchived = itemMenu('B21')
/** A rule: no priority, no Later, no New doc, Add subitem or Put under (on the phone as on the desktop). */
export const Rule = itemMenu('R16')
/** A chip in the item's head opens just its choices: under it on the desktop, a sheet of them on the phone (B358). */
const CHIP = (arm: string) => `#detailBody [data-act="item-menu"][data-arm="${arm}"]`
const chip = (arm: string, more: Do[] = []) => opens('F1', [{ click: CHIP(arm) }, ...more], '#detailBody')
export const Status = chip('s')
export const Priority = chip('p')
export const Type = chip('t')
/** Delete asks again, in its own words: a second click within 3 seconds deletes (a picture of those 3 seconds). */
export const DeleteAsks = itemMenu('F1', [{ click: '#dlgBody [data-act="item-delete"]' }], { still: true })
/** A right-click on a row opens that item and its menu at the pointer (desktop). */
export const RightClickOnARow = opens('', [{ menu: open('F1') }], '#itemsView', {}, 'desktop')

// ---------------------------------------------------------------- other menus

/** A message's ⋯ in the item's talk (the pointer brings it on the desktop). */
const LAST_SAY = '#itemTalk [data-mid="259"]'
export const MessageMenu = opens(
  'F1',
  [{ point: LAST_SAY, on: 'd' }, { click: `${LAST_SAY} [data-act="msg-menu"]` }],
  LAST_SAY,
)
/** The ⋯ of what you said, in the item's talk: a note said aloud, put with F01 (Edit, Add more, Move to, Put with). */
const SAID = '#itemTalk [data-mid="40"]'
const saidMore: Do = { click: `${SAID} [data-act="input-more"][data-id="r4"]` }
export const InputMenu = opens('F1', [saidMore], SAID)
/** A project's menu, right-clicked in the sidebar (desktop): this project's, and another one's. */
const projMenu = (slug: string) => opens('', [{ menu: `#drawerList a[data-slug="${slug}"]` }], '#drawer', {}, 'desktop')
export const ProjectMenu = projMenu('shop')
export const OtherProjectMenu = projMenu('mobile-app')
/** One of your views (saved from Filters), right-clicked (held on the phone): rename, update, delete. */
export const ViewMenu = opens(
  '',
  [
    { click: '[data-act="filters"]' },
    { click: '[data-act="set-filter"][data-v="bug"]' },
    { click: '[data-act="set-filter"][data-v="P0"]' },
    { type: 'P0 bugs', into: '#viewName' },
    { click: '[data-act="view-save"]' },
    { click: '#dlgBody [data-act="close"], #overlay [data-act="close"]', on: 'p' },
    { menu: '[data-act="view-use"][data-i="0"]' },
  ],
  '#itemsView',
)

// ---------------------------------------------------------------- move and pick

/** Put under…, from the item's menu: the items to put it under, the one it is under marked; No parent. */
const reparent: Do = { click: '#dlgBody [data-act="reparent"]' }
export const MoveItem = itemMenu('T15', [reparent])
/** Nothing matches what was typed. */
export const MoveItemNothingMatches = itemMenu('T15', [reparent, { type: 'zzzz', into: '#dlgBody input' }])
/** Move to project…, from the item's menu. */
export const MoveToProject = itemMenu('B36', [{ click: '#dlgBody [data-act="item-move-proj"]' }])
/** Put with another item…, from the ⋯ of what you said. */
const pick = (what: string): Do => ({ click: `#dlgBody [data-act="input-pick"][data-pick="${what}"]` })
export const PickAnItem = opens('F1', [saidMore, pick('rescope-pick')], SAID)
/** Move to…, from the ⋯ of what you said: what moves with it, and what stays. */
export const MoveInput = opens('F1', [saidMore, pick('move-input')], SAID)
/** A document's comment, moved to another part of it (or the whole document): Move on your comment in the
 * conclusion's open thread (D1). */
export const MoveComment = opens(
  'D1',
  [
    {
      click:
        '#docBlocks > section:nth-child(2) [data-act="doc-thread"], [data-act="doc-thread"][data-key^="d7291783ec#"]',
    },
    { point: '[data-dc="23"]', on: 'd' },
    { click: '[data-act="dc-move"][data-id="23"]' },
  ],
  '#detailView',
)

// ---------------------------------------------------------------- the keys (desktop)

const keys = (ref: string, steps: Do[]) => opens(ref, steps, [], {}, 'desktop')
const PALETTE: Do = { key: 'Meta+k' }
/** Go to or do (Cmd-K), on the list: the page's commands, each with its keys. */
export const CommandPalette = keys('', [PALETTE])
/** With an item open: its own commands first, each naming it. */
export const CommandPaletteOnAnItem = keys('F1', [PALETTE])
/** Words typed: the commands and the items they find. */
export const CommandPaletteFinding = keys('', [PALETTE, { type: 'csv', into: '#cpFilter' }])
export const CommandPaletteNothingMatches = keys('', [PALETTE, { type: 'zzzz', into: '#cpFilter' }])
/** G P: another project, by typing. */
const SWITCH: Do[] = [{ key: 'g' }, { key: 'p' }]
export const SwitchProject = keys('', SWITCH)
export const SwitchProjectNothingMatches = keys('', [...SWITCH, { type: 'zzzz', into: '#projFilter' }])
/** ?: every key. */
export const Keys = keys('', [{ key: 'Shift+?' }])

// ---------------------------------------------------------------- under the pointer, from the keys, pressed
// T522 (r731, r762): a row of a menu under the pointer, from Tab, pressed, once the menu is open. The desktop only
// for the pointer.
const ROW2 = '#dlgBody button[data-act]:nth-of-type(2)'
/** The item's menu, the pointer on its second row. */
export const ItemMenuPointed = itemMenu('F1', [], { hover: ROW2 })
/** The item's menu, Tab on its second row. */
export const ItemMenuKeys = itemMenu('F1', [], { focus: ROW2 })
/** The item's menu, its second row pressed. */
export const ItemMenuPressed = itemMenu('F1', [{ press: ROW2 }])
/** The status's choices, the pointer on one not picked. */
export const StatusPointed = opens('F1', [{ click: CHIP('s') }], '#detailBody', {
  hover: '#dlgBody [aria-pressed="false"]',
})
/** The status's choices, the pointer on the one picked (ticked). */
export const StatusPointedOnPicked = opens('F1', [{ click: CHIP('s') }], '#detailBody', {
  hover: '#dlgBody [aria-pressed="true"]',
})
/** Cmd-K: the row the arrow keys are on, and the pointer on another. */
export const CommandPalettePointed = opens('', [PALETTE], [], { hover: '#dlgBody [aria-selected="false"]' }, 'desktop')
/** G P: the project the arrow keys are on, and the pointer on another. */
export const SwitchProjectPointed = opens('', SWITCH, [], { hover: '#dlgBody [aria-selected="false"]' }, 'desktop')

// ---------------------------------------------------------------- sheets

/** Filters (phone; the desktop has them over the list): one set, so Clear all shows. */
export const Filters = place(
  { at: SHOP + '?type=bug', steps: [{ click: '#filterBtn' }], part: '#overlay', live: false },
  'phone',
)
/** Answer on a row opens its card above the box (phone). */
export const Peek = place(
  { at: SHOP, steps: [{ click: `${open('T7')} button[data-act="row-act"]` }], part: '#overlay', live: false },
  'phone',
)
/** Where an item came from: what you said that made it (its chip in the item's head). */
export const Sources = opens('F1', [{ click: '#detailBody [data-act="sources"]' }], '#detailBody')
/** A voice note's words as said (the ⋯ of what you said, Original words), beside the note on the desktop: before
 * they were tidied. */
export const AsSaid = opens('F1', [saidMore, { click: '#dlgBody [data-act="as-said"]' }], SAID, { live: true })
/** The versions of what you said, after you changed it (Edit on #3, new words, Save; then its edited link). */
const R3 = '#itemTalk [data-mid="19"]'
export const InputHistory = opens(
  'F1',
  [
    { click: '[data-act="more"][data-n="1"]' },
    { click: `${R3} [data-act="input-more"][data-id="r3"]` },
    pick('input-edit'),
    { type: '\u5217\u7684\u987a\u5e8f\u548c\u5c4f\u5e55\u4e0a\u4e00\u6837\u3002', into: '#text' },
    { click: '#sendBtn[data-act="send"]' },
    { wait: 1000 },
    { click: `${R3} [data-act="input-history"]` },
  ],
  R3,
  { live: true },
)
/** Changes that did not go in, from the red count on the bar: each to retry or let go, what it was as a link to where
 * it belongs (B527). Taska said no to them: their items were deleted meanwhile. */
const refused = (codes: string[]): Do[] => [
  ...codes.flatMap((c): Do[] => [
    { click: open(c) },
    { click: '#dActs [data-act="status"][data-v="done"]', on: 'd' },
    { click: '#detailBody [data-arm="s"]', on: 'p' },
    { click: '#dlgBody [data-v="done"]', on: 'p' },
    { click: '#backBtn', on: 'p' },
  ]),
  { click: '[data-act="failed-open"]' },
]
const notSaved = (codes: string[]) =>
  place({
    at: SHOP,
    steps: refused(codes),
    net: { '^/p/shop/api/op': 'no' },
    part: { d: ['#projBar', DLG], p: '#overlay' },
  })
export const NotSaved = notSaved(['T3', 'T15'])
/** One change: no Clear all or Retry all under it. */
export const NotSavedOne = notSaved(['T3'])
/** Taska's key, asked for when Taska does not know this browser (from outside this computer's network). */
export const SignIn = place({ at: SHOP, net: { '^/p/shop/api/state': 401 }, part: { d: DLG, p: '#overlay' } })
