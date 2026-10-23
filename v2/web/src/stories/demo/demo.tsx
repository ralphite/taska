// T457 (#6481): every demo is data, played by one player (../lib/demo-player.tsx) on the real page and the real Taska
// server. Places to tap are named once here (T) and used by name; an item's row is its code. A folder of demos is
// one file (its title: Storybook reads it as written), a demo a few lines of data there.
import type { StoryObj } from '@storybook/react-vite'
import { DemoPlayer, type Demo, type Place, type Step } from '../lib/demo-player'

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
  // going through what needs you
  goThrough: '[data-act="go-through"]',
  goNext: '[data-act="go-next"]',
  goApprove: { phone: '[data-act="peek-set"][data-v="open"]', desktop: '[data-act="status"][data-v="open"]' },
  goEnd: { phone: '[data-act="close"]', desktop: '[data-act="go-end"]' },
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
/** A step that swipes across a place, this far (px: right when more than 0). */
export const swipe = (say: string, p: Name | Code, by: number): Step => ({ say, swipe: at(p), by })
/** A step that types into the box, or into this field. */
export const write = (say: string, words: string, into?: Name): Step => ({
  say,
  type: words,
  ...(into ? { into: at(into) } : {}),
})
/** An agent's turn: what the line says, and its commands (as agents write to Taska). */
export const agent = (say: string, commands: string): Step => ({ say, agent: commands })

/** Open an item's menu: everything else it can do. */
export const openMenu = tap('Tap ... : everything else you can do with it', 'itemMenu')

/** One demo, as a story. */
export const demo = (d: Demo): StoryObj => ({
  render: (_, { globals }) => <DemoPlayer demo={d} scheme={String(globals.scheme)} />,
})
