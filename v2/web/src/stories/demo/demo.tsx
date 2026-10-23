// T457 (#6481): every demo is data, played by one player (../lib/demo-player.tsx) on the real page and the real Taska
// server. Places to tap are named once here (T) and used by name; an item's row is its code. A folder of demos is
// one file (its title: Storybook reads it as written), a demo a few lines of data there.
import type { StoryObj } from '@storybook/react-vite'
import { DemoPlayer, type Demo, type Place, type Step } from '../lib/demo-player'
import { W } from './words'

const DONE = '[data-act="status"][data-v="done"]' // an item's Done, or Accept when it waits for you to accept

/** The places demos tap, each named once. */
export const T = {
  // the item list: its views, search, filters, a row
  needsYou: '[data-act="set-filter"][data-v="wait"]',
  active: '[data-act="set-filter"][data-v="all"]',
  all: '[data-act="set-filter"][data-v="every"]',
  queue: '[data-act="set-filter"][data-v="queued"]',
  laterView: '[data-act="set-filter"][data-v="later"]',
  finished: '[data-act="set-filter"][data-v="closed"]',
  archiveTab: '[data-act="tab"][data-tab="archive"]',
  search: { phone: '[data-act="search"]', desktop: '#q' },
  searchField: '#q',
  searchInputs: '[data-act="search-in"]',
  filters: '[data-act="filters"]',
  bugs: '[data-act="set-filter"][data-v="bug"]',
  p0: '[data-act="set-filter"][data-v="P0"]',
  newest: '[data-act="set-filter"][data-v="new"]',
  viewName: '#viewName',
  viewSave: '[data-act="view-save"]',
  fold: '[data-act="fold"]',
  rowApprove: '[data-act="row-act"][data-v="approve"]',
  selLater: '[data-act="sel-do"][data-v=\'"later"\']',
  // an item: its decision buttons, its question's choices
  approve: '[data-act="status"][data-v="open"]',
  wontDo: '[data-act="status"][data-v="dropped"]',
  accept: DONE,
  done: { phone: '[data-act="set-field"][data-v="done"]', desktop: DONE },
  modifyDecision: '[data-act="decided-modify"]',
  notYet: '[data-act="reopen"]',
  choice: '[data-act="choice"]',
  sendAnswer: '[data-act="choice-send"]',
  modifyAnswer: '[data-act="ask-modify"]',
  // an item's own buttons, its fields, its menu
  later: '[data-act="swipe"][data-f="when"]',
  archive: { phone: '#dlgBody [data-act="archive"]', desktop: '#detailView [data-act="archive"]' }, // or Unarchive
  statusPill: '[data-act="item-menu"][data-arm="s"]',
  priorityPill: '[data-act="item-menu"][data-arm="p"]',
  typePill: '[data-act="item-menu"][data-arm="t"]',
  inProgress: '[data-act="set-field"][data-v="doing"]',
  dropped: '[data-act="set-field"][data-v="dropped"]',
  p1: '[data-act="set-field"][data-v="P1"]',
  bug: '[data-act="set-field"][data-v="bug"]',
  itemMenu: ['[data-act="item-menu"]', 'Item actions'],
  edit: '#dlgBody [data-act="edit"]',
  editBody: '#eBody',
  editSave: '[data-act="edit-save"]',
  addSubitem: '#dlgBody [data-act="sub-new"]',
  subTitle: '#subTitle',
  subAdd: '[data-act="sub-add"]',
  putUnder: '#dlgBody [data-act="reparent"]',
  under: '[data-act="move-to"]',
  doNext: '#dlgBody [data-act="do-next"]',
  moveItem: '#dlgBody [data-act="item-move-proj"]',
  itemTo: '[data-act="item-move-to"]',
  deleteItem: '#dlgBody [data-act="item-delete"]',
  back: '[data-act="back"]',
  // on an item's page: where its words came from, its links, pictures, voice notes, messages
  sources: '#detailView [data-act="sources"]',
  closeSheet: '#dlgClose',
  link: '#detailView [data-act="goto"]',
  docLink: '[data-act="docs-go"]',
  picture: '[data-act="view"]',
  zoom: '[data-act="v-zoom"]',
  closePicture: '[data-act="v-close"]',
  play: '[data-act="play"]',
  showMore: '[data-act="more-msg"]',
  messageMenu: '[data-act="msg-menu"]',
  hideMessage: '[data-act="msg-hide"]',
  // a document: open it, pick a paragraph, its comment threads, its form, editing it
  docOpen: '[data-act="doc-open"]',
  paragraph: '[data-act="doc-pick"]',
  thread: '[data-act="doc-thread"]',
  replyToComment: '[data-act="doc-reply"]',
  resolve: '[data-act="doc-resolve"]',
  editComment: '[data-act="dc-edit"]',
  deleteComment: '[data-act="dc-delete"]',
  tick: '[data-act="doc-tick"]',
  docEdit: '[data-act="doc-edit"]',
  docText: '#docMd',
  docSave: '[data-act="doc-done"]',
  docMove: '[data-act="doc-move"]',
  docTo: '[data-act="doc-move-to"]',
  moveComment: '[data-act="dc-move"]',
  commentTo: '[data-act="dc-move-to"]',
  wholeDoc: '[data-act="doc-whole"]',
  tickAgain: '[data-act="doc-tick-edit"]',
  sendChoices: '[data-act="doc-ticks-send"]', // B524: the box's line sends the ticks, never its round button
  docBack: { phone: '[data-act="close"]', desktop: '[data-act="doc-close"]' },
  docDelete: '[data-act="doc-delete"]',
  // voice: what may be misheard, a word put right
  doubt: '[data-act="doubt-pick"]',
  sentWords: '[data-voice]',
  fixWord: '[data-act="vc-fix"]',
  // projects: the drawer (the phone) or the sidebar, the home page, a new one
  drawer: '#projBtn',
  mobileApp: '#drawerList a[href="/p/mobile-app/"]',
  home: '#homeLink',
  newProject: '[data-act="new-project"]',
  projectName: '#npName',
  createProject: '[data-act="np-create"]',
  // settings and the side lists (Documents, Activity, Deleted)
  settings: ['[data-act="project"]', 'Settings'],
  section: '[data-act="psec"]',
  copy: '[data-act="copy-text"]',
  projectMore: '[data-act="p-more"]',
  rename: { phone: ['[data-act="p-rename"]', 1], desktop: ['[data-act="p-rename"]', 3] },
  renameField: '#pRename',
  deleteProject: { phone: ['[data-act="p-delete"]', 1], desktop: ['[data-act="p-delete"]', 3] },
  restoreProject: '[data-act="p-restore"]',
  spellingField: '#fixWord',
  spellingAdd: '[data-act="fix-add"]',
  undoChange: '[data-act="revert"]',
  restoreInput: '[data-act="input-restore"]',
  // agents
  agentInfo: '[data-act="agent-info"]',
  // the desktop's command palette
  paletteField: '#cpFilter',
  // the box
  send: '[data-act="send"]',
  mic: '[data-act="mic"]',
  recSend: '[data-act="rec-send"]',
  recStop: '[data-act="rec-stop"]',
  recCancel: '[data-act="rec-cancel"]',
  // what you said (the phone's Inputs tab; the desktop's New input page), and an input's menu
  inputsTab: '[data-act="tab"][data-tab="inputs"]',
  inputMore: '[data-act="input-more"]',
  inputEdit: '[data-act="input-pick"][data-pick="input-edit"]',
  inputAddMore: '[data-act="input-pick"][data-pick="input-append"]',
  inputDelete: '[data-act="input-pick"][data-pick="input-delete"]',
  inputWithItem: '[data-act="input-pick"][data-pick="rescope-pick"]',
  inputMove: '[data-act="input-pick"][data-pick="move-input"]',
  withItem: '[data-act="rescope-to"]',
  toProject: '[data-act="move-input-to"]',
  // an item's page, and its talk (what scrolls on the phone: the whole page)
  itemPage: '#detailView',
  talk: { phone: '#detailBody', desktop: '#itemTalk' },
  // the line at the bottom that says what happened
  toastUndo: ['#toast [data-toast]', 'Undo'],
} satisfies Record<string, Place>
export type Name = keyof typeof T
type Code = `${'F' | 'B' | 'I' | 'T' | 'R'}${number}`

/** A place by its name; its n-th one (1 = the first) or the one showing these words; an item's row by its code. */
export const at = (p: Name | Code, which?: number | string): Place =>
  p in T ? (which ? [T[p as Name] as string, which] : T[p as Name]) : `#list [data-act="open"][data-n="${p.slice(1)}"]`

/** A step that taps: what it says, and where. */
export const tap = (say: string, p: Name | Code, which?: number | string): Step => ({ say, tap: at(p, which) })
/** A step only the phone or only the desktop has (the phone's tabs, the desktop's keys). */
export const only = (on: 'phone' | 'desktop', s: Step): Step => ({ ...s, on })
/** A step that drags one place onto another (the desktop's mouse). */
export const drag = (
  say: string,
  p: Name | Code,
  onto: Name | Code,
  drop: Step['drop'],
  which?: number | string,
): Step => only('desktop', { say, tap: at(p), onto: at(onto, which), drop })
/** A step that swipes across a place, this far (px: right when more than 0). */
export const swipe = (say: string, p: Name | Code, by: number): Step => ({ say, swipe: at(p), by })
/** Select these words in a place, as a finger drags over them. */
export const select = (say: string, words: string, p: Name, which?: number): Step => ({
  say,
  select: words,
  into: at(p, which),
})
/** Scroll a place to its end, to see what came in below. */
export const scroll = (say: string, p: Name): Step => ({ say, scroll: at(p) })
/** A step that types into the box, or into this field. */
export const write = (say: string, words: string, into?: Name): Step => ({
  say,
  type: words,
  ...(into ? { into: at(into) } : {}),
})
/** An agent's turn: what the line says, and its commands (as agents write to Taska). */
export const agent = (say: string, commands: string): Step => ({ say, agent: commands })
/** What the microphone says in a voice demo: these words, spoken (story_fixtures.py --said makes the sound). */
export const said = (k: keyof typeof W) => ({ clip: k, words: W[k] })

/** Steps many demos share, each said once. */
export const send = tap('Tap Send', 'send')
export const sendVoice = tap('Tap Send: it goes as soon as its words are in', 'recSend')
export const undo: Step = { ...tap('Tap Undo, while it is there', 'toastUndo'), soon: true }
export const needsYou = tap('Tap Needs you: only what waits on you', 'needsYou')
export const whatCameIn = scroll('Scroll down: what just came in', 'talk')
/** Tap the mic and speak for a while: the real recorder hears the demo's sentence. */
export const speak = (say = 'Speak: the waves follow your voice'): Step[] => [
  tap('Tap the mic', 'mic'),
  { say, speak: 5 },
]
/** The phone's menu (projects, settings, the side lists): the desktop has them in its sidebar. */
export const menu = only('phone', tap('Tap the menu: projects, settings, side lists', 'drawer'))
/** An item's menu: everything else it can do. */
export const openMenu = tap('Tap ... : everything else you can do with it', 'itemMenu')
/** The demo project's items that demos open, each once. */
export const open = {
  task: tap('Tap a task to open it', 'T3'),
  feature: tap('Tap a feature to open it', 'F1'),
  proposal: tap('Tap the idea the agent proposed', 'I4'),
  finished: tap('Tap the bug the agent finished: it waits for you to accept', 'B6'),
  question: tap('Tap the question the agent asked', 'T7'),
  checklist: tap('Tap the question with a list to tick', 'T9'),
  stuck: tap('Tap the bug where the agent is stuck', 'B2'),
  screenshot: tap('Tap a bug with a screenshot', 'B36'),
}

/** One demo, as a story. */
export const demo = (d: Demo): StoryObj => ({
  render: (_, { globals }) => <DemoPlayer demo={d} scheme={String(globals.scheme)} />,
})
