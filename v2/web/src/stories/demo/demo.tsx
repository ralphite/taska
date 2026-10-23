// T457 (#6481): every demo is data, played by one player (../lib/demo-player.tsx) on the real page and the real Taska
// server. Places to tap are named once here (T) and used by name; an item's row is its code. A folder of demos is
// one file (its title: Storybook reads it as written), a demo a few lines of data there.
import type { StoryObj } from '@storybook/react-vite'
import { DemoPlayer, type Demo, type Place, type Step } from '../lib/demo-player'

/** The places demos tap, each named once. */
export const T = {
  // the item list
  needsYou: '[data-act="set-filter"][data-v="wait"]',
  active: '[data-act="set-filter"][data-v="all"]',
  rowApprove: '[data-act="row-act"][data-v="approve"]',
  // an item: its decision buttons, its question's choices
  approve: '[data-act="status"][data-v="open"]',
  wontDo: '[data-act="status"][data-v="dropped"]',
  accept: '[data-act="status"][data-v="done"]',
  modifyDecision: '[data-act="decided-modify"]',
  notYet: '[data-act="reopen"]',
  choice: '[data-act="choice"]',
  sendAnswer: '[data-act="choice-send"]',
  modifyAnswer: '[data-act="ask-modify"]',
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
/** A step that types into the box. */
export const write = (say: string, words: string): Step => ({ say, type: words })
/** An agent's turn: what the line says, and its commands (as agents write to Taska). */
export const agent = (say: string, commands: string): Step => ({ say, agent: commands })

/** One demo, as a story. */
export const demo = (d: Demo): StoryObj => ({
  render: (_, { globals }) => <DemoPlayer demo={d} scheme={String(globals.scheme)} />,
})
