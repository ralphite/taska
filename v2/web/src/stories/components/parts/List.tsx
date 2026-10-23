// T457: the item list and its rows, in every state, on the demo project. The list column is as wide as on the page.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { looksOf, place, type Look } from '../../lib/onpage'
import type { Do, Twin } from '../../lib/twin'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: [
      'List',
      'ItemList',
      'Tree',
      'HiddenKids',
      'NeedsBand',
      'ArchiveAllBtn',
      'ViewBar',
      'OwnView',
      'SelBar',
      'ListMore',
      'HeldRow',
      'HitLine',
      'RowActs',
      'SwipeRow',
      'SearchHints',
      'Zone',
      'Soft',
      'Cnt',
      'DraftMark',
      'Empty',
      'CrossHits',
      'WorkerMark',
      'ItemRow',
      'NeedsRow',
      'ItemsView',
    ],
  },
}
export type Story = StoryObj

// B555: each story is the real page at an address, after Yadong's steps there, showing the list column (on the
// phone its whole screen) or one row of it.
const SHOP = '/p/shop/'
const LIST = {
  d: ['#mainHead', '#deskFilters', '#itemsView'],
  p: ['#mainHead', '#tabs', '#filterStrip', '#itemsView', '#foot'],
}
const list = (at = '', steps?: Do[], more?: Partial<Twin>, on?: 'desktop'): Story =>
  place({ at: at.startsWith('/') ? at : SHOP + at, part: LIST, steps, ...more }, on)
const rowOf = (code: string) => `#list article[data-n="${code.replace(/^\D+/, '')}"]`
const open = (code: string) => `#list [data-act="open"][data-n="${code.replace(/^\D+/, '')}"]`

/** Items › Active: what needs you first (amber), then the agents' queue, then Later, then what finished lately. */
export const Active = list()
export const All = list('?status=every')
export const NeedsYou = list('?status=wait')
export const Queue = list('?status=queued')
export const Later = list('?status=later')
export const Finished = list('?status=closed')
export const Archive = list('archive')
export const Rules = list('rules')
/** A search: the words found are marked; words found only inside an item show their line under the title. */
export const Search = list('?q=\u5bfc\u51fa')
export const SearchNothingFound = list('?q=kubernetes')
/** Bugs only, P0. */
export const Filtered = list('?type=bug&pri=P0')
/** One item open: its row is marked (desktop: the list stays beside it). */
export const OneOpen = list('F1', undefined, undefined, 'desktop')
/** Several rows picked with Cmd: the bar acts on all of them (desktop). */
export const Picked = list(
  '',
  ['T3', 'T15', 'T40'].map((c) => ({ click: open(c), hold: 'Meta' as const })),
  { live: false },
  'desktop',
)
/** Subitems folded under their parent. */
export const SubitemsFolded = list(
  '',
  [{ click: '[data-act="fold"][data-n="1"]' }, { click: '[data-act="fold"][data-n="12"]' }],
  {
    live: false,
  },
)
// B532 (r760): T12's only subitem, T13, put in Later (F01's T14 is finished, its T15 open): Active does not show them
const laterT13: Do[] = [
  { click: '#detailView [data-f="when"][title]:not(#dActs *)' },
  { key: 'Escape', on: 'd' }, // the item closes: the list shows itself as it is now, not the line it held for T13
  { click: '#backBtn', on: 'p' },
]
/** Subitems Active hides (in Later, finished): under each parent a grey line says so. */
export const SubitemsHidden = list('T13', laterT13)
/** The grey lines tapped: the hidden subitems show as the All view draws them, and each line reads Show fewer. */
export const SubitemsHiddenShown = list('T13', [
  ...laterT13,
  { click: '[data-act="sub-more"][data-n="12"]' },
  { click: '[data-act="sub-more"][data-n="1"]' },
])
/** A row you just acted on (Done on its row), while the list holds still: one quiet line with Undo (desktop). */
export const JustActedOn = list(
  '',
  [{ point: open('T3') }, { click: `${rowOf('T3')} [data-act="swipe"][data-v="done"]` }],
  undefined,
  'desktop',
)
/** Your own saved view beside the preset ones. */
export const OwnViews = list('', [
  { click: '[data-act="filters"]' },
  { click: '[data-act="set-filter"][data-v="bug"]' },
  { click: '[data-act="set-filter"][data-v="P0"]' },
  { type: 'P0 bugs', into: '#viewName' },
  { click: '[data-act="view-save"]' },
])
export const EmptyProject = list('/p/website/')
export const SmallProject = list('/p/mobile-app/')

// ---------------------------------------------------------------- one row, where the list shows it

const row = (code: string, at = '', more?: Partial<Twin>, on?: 'desktop'): Story =>
  place({ at: at.startsWith('/') ? at : SHOP + at, part: rowOf(code), ...more }, on)
export const RowOpen = row('T3')
export const RowInProgress = row('T43')
/** The agent on it has been quiet a while (T12's, three days): its mark turns amber. */
export const RowInProgressQuiet = row('T12')
/** Finished by the agent, and you replied (B6): an ordinary row, no longer waiting on you. */
export const RowWaitsForReview = row('B6')
export const RowDone = row('B10', '?status=closed')
export const RowWontDo = row('T5', '?status=closed')
export const RowArchived = row('B21', 'archive')
/** A subitem, under its parent (F01's T14, finished: in All). */
export const RowSubitem = row('T14', '?status=every')
export const RowWithPicture = row('B36')
export const RowLater = row('F8', '?status=later')
export const RowRule = row('R16', 'rules')
export const RowLongChineseTitle = row('B25', '?status=closed')
export const RowLongEnglishTitle = row('T24', '?status=closed', {
  words: {
    24: {
      title:
        'Update the shipping rates for Canada and Mexico after the new carrier contract, including the remote areas surcharge',
    },
  },
})
/** New from an agent since you last looked: a blue dot (its agent writes while the list is open). */
export const RowUnread = row('T13', '', {
  steps: [{ agent: 'T13 progress \u538b\u6d4b\u8dd1\u5b8c\u7b2c\u4e00\u8f6e\u4e86\uff0cp95 \u662f 1.8 \u79d2\u3002' }],
})
/** The one open in the pane (desktop). */
export const RowCurrent = row('F1', 'F1', undefined, 'desktop')
/** Picked with Cmd (desktop). */
export const RowPicked = row('T3', '', { steps: [{ click: open('T3'), hold: 'Meta' }], live: false }, 'desktop')
/** The pointer on a row: its buttons show over the end of the title (desktop). */
export const RowHover = row('T3', '', { hover: open('T3') }, 'desktop')
export const RowP0 = row('B2')
export const RowP3 = row('T5', '?status=closed')
/** Something written for it and not sent yet: Draft (written in its box, then back to the list). */
export const RowWithDraft = row('T3', 'T3', {
  steps: [
    { type: '\u9000\u8d27\u653f\u7b56\u5148\u53d1\u7ed9\u6cd5\u52a1\u770b\u4e00\u4e0b', into: '#text' },
    { click: '#backBtn', on: 'p' },
  ],
  live: false,
})

// ---------------------------------------------------------------- a row that waits on you

export const NeedsQuestion = row('T7')
export const NeedsChecklist = row('T9')
export const NeedsBlocked = row('B2')
export const NeedsProposed = row('I4')
/** Finished by the agent, waiting for you to accept (Mobile app's B1). */
export const NeedsReview = row('B1', '/p/mobile-app/')
export const NeedsRuleProposed = row('R17')

/** An agent at work on an item (T43's, a few minutes ago) and one gone quiet (T12's, amber). */
export const AgentMark = looksOf(
  { at: SHOP, part: rowOf('T43') },
  [
    { name: 'At work', part: rowOf('T43') },
    { name: 'Quiet a while', part: rowOf('T12') },
  ],
  'both',
)

// ---------------------------------------------------------------- under the pointer, the keyboard, picked, dragged
// T522 (r731, r762): every look of a row side by side, each the real page with the pointer, a key, a press, a pick or
// a drag on it. T03 where its look does not depend on the list; the open one (T40) and a picked one (T38) as the list
// marks them. The desktop only: the phone has no pointer, and drags nothing (it swipes).
const ROW_BTN = (code: string) => `${open(code)} div > button[data-act]:first-child`
const pick: Do = { click: open('T38'), hold: 'Meta' }
const dragOver = (drop: 'before' | 'into' | 'after'): Look => ({
  name: {
    before: 'The dragged one goes above it',
    into: 'The dragged one goes under it',
    after: 'The dragged one goes below it',
  }[drop],
  part: rowOf('T3'),
  steps: [{ drag: open('T40'), onto: open('T3'), drop }],
})
export const RowLooks: Story = looksOf({ at: SHOP + 'T40', part: rowOf('T3') }, [
  { name: 'As it is' },
  { name: 'Pointer on it: its buttons show', hover: open('T3') },
  { name: 'Pointer on one of its buttons', part: [rowOf('T3'), '#tip'], hover: ROW_BTN('T3') },
  { name: 'Pressed', steps: [{ press: open('T3') }] },
  { name: 'Open in the pane', part: rowOf('T40') },
  { name: 'Open in the pane, pointer on it', part: rowOf('T40'), hover: open('T40') },
  { name: 'Open in the pane, pointer on a button', part: [rowOf('T40'), '#tip'], hover: ROW_BTN('T40') },
  { name: 'Picked (Cmd or Shift)', part: rowOf('T38'), steps: [pick] },
  { name: 'Picked, pointer on it', part: rowOf('T38'), steps: [pick], hover: open('T38') },
  {
    name: 'Picked, pointer on a button',
    steps: [pick],
    hover: ROW_BTN('T38'),
    part: [rowOf('T38'), '#tip'],
  },
  { name: 'Picked, pressed', part: rowOf('T38'), steps: [pick, { press: open('T38') }] },
  { name: 'Pointer on its picture', part: rowOf('B36'), hover: `${open('B36')} button[data-act="view"]` },
  { name: 'Pointer on Hide subitems', part: rowOf('F1'), hover: `${open('F1')} button[data-act="fold"]` },
  { name: 'Keys: Tab on Hide subitems', part: rowOf('F1'), focus: `${open('F1')} button[data-act="fold"]` },
  {
    name: 'Pointer on Part of (its parent)',
    part: rowOf('T15'),
    at: SHOP + '?sort=new',
    hover: `${open('T15')} button[data-act="goto"]`,
  },
  {
    name: 'Keys: Tab on Part of',
    part: rowOf('T15'),
    at: SHOP + '?sort=new',
    focus: `${open('T15')} button[data-act="goto"]`,
  },
  { name: 'Being dragged', part: rowOf('T40'), steps: [{ drag: open('T40'), onto: open('T3'), drop: 'into' }] },
  dragOver('before'),
  dragOver('after'),
  dragOver('into'),
])
const PILL = (code: string) => `${open(code)} button[data-act="row-act"]`
export const NeedsLooks: Story = looksOf({ at: SHOP + 'B2', part: rowOf('I4') }, [
  { name: 'As it is' },
  { name: 'Pointer on it: its buttons show', hover: open('I4') },
  { name: 'Pointer on Approve', hover: PILL('I4') },
  { name: 'Pointer on one of its buttons', part: [rowOf('I4'), '#tip'], hover: ROW_BTN('I4') },
  { name: 'Keys: Tab on Approve', focus: PILL('I4') },
  { name: 'Pressed', steps: [{ press: open('I4') }] },
  { name: 'Approve pressed', hover: PILL('I4'), steps: [{ press: PILL('I4') }] },
  { name: 'Open in the pane', part: rowOf('B2') },
  { name: 'Open in the pane, pointer on it', part: rowOf('B2'), hover: open('B2') },
  { name: 'Picked', part: rowOf('T7'), steps: [{ click: open('T7'), hold: 'Meta' }] },
  { name: 'Picked, pointer on it', part: rowOf('T7'), steps: [{ click: open('T7'), hold: 'Meta' }], hover: open('T7') },
  {
    name: 'Picked, pointer on Answer',
    part: rowOf('T7'),
    steps: [{ click: open('T7'), hold: 'Meta' }],
    hover: PILL('T7'),
  },
  { name: 'Being dragged', steps: [{ drag: open('I4'), onto: open('T3'), drop: 'into' }] },
  { name: 'The dragged one goes under it', steps: [{ drag: open('T3'), onto: open('I4'), drop: 'into' }] },
])
