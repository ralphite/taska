// What you can do in a project, each defined once: its words, its keys, when it can be done here (or why not, in a
// few words, said instead) and what it does. The keys (keys.ts), the command palette, the keys sheet and the item's
// menu all read this table, so a key, a palette row and a menu row always do the same thing.

import { closed } from '../model/items'
import { visible } from '../model/visible'
import { choiceMulti } from '../model/markdown'
import { doneTo, dropTo, whyNot, yourStep } from '../model/actions'
import { codeOf, liveN, type ProjectModel } from '../model/project'
import type { Item } from '../model/types'
import type { Tab } from '../model/words'
import { copyText, forAgent } from './clipboard'
import type { App } from './createApp'
import type { ProjectRoute } from './hooks'

/** Where an action is done: the project shown, its model, the open item. */
export interface Here {
  r: ProjectRoute
  m: ProjectModel | null
  it: Item | undefined
  code: string
  /** the key that asked for it (Shift-Space scrolls back) */
  shift?: boolean
}
type OnItem = Here & { m: ProjectModel; it: Item }

interface PageAction {
  label: string
  /** the keys, as the keyboard names them; a space between keys pressed one after the other */
  keys?: string
  /** in the command palette, with these words when they differ */
  palette?: string | true
  why?(app: App, h: Here): string | null
  /** false: nothing to do after all (the key goes on as a key) */
  run(app: App, h: Here): void | boolean
}
interface ItemAction {
  item: true
  /** said when no item is open (default: how to open one; '': nothing) */
  none?: string
  label: string
  keys?: string
  palette?: string | true
  why?(app: App, h: OnItem): string | null
  run(app: App, h: OnItem): void | boolean
}
type Action = PageAction | ItemAction

const item = (a: Omit<ItemAction, 'item'>): ItemAction => ({ ...a, item: true })
const page = (a: PageAction): PageAction => a
const set = (app: App, h: OnItem, f: string, v: unknown, o: { said?: string; note?: string } = {}) => void app.items.change(h.it.n, f, v, o)
const arm = (k: 's' | 'p' | 't', hint: string) => (app: App, h: OnItem) => {
  app.keyArm.set(k, h.it.n)
  app.toasts.show(hint)
}
const tab = (t: Tab): PageAction['run'] => (app) => app.nav.tab(t)

export const ACTIONS = {
  // the item
  next: item({
    label: 'Accept or approve',
    keys: 'a',
    palette: true,
    why: (_, h) => whyNot.next(h.it, h.code),
    run: (app, h) => {
      const step = yourStep(h.it)
      if (!step) return
      if ('set' in step) return set(app, h, step.set[0], step.set[1])
      if (step.answer === 'words') app.fields.focus('box')
    },
  }),
  reply: item({ label: 'Reply', keys: 'r', palette: true, run: (app) => app.fields.focus('box') }),
  'not-yet': item({ label: 'Not yet', keys: 'n', palette: true, why: (_, h) => whyNot.notYet(h.it), run: (app, h) => set(app, h, 'status', 'doing', { said: 'is back in progress' }) }),
  done: item({ label: 'Done', keys: 'd', palette: true, why: (_, h) => whyNot.done(h.it, h.code), run: (app, h) => set(app, h, 'status', doneTo(h.it)) }),
  later: item({ label: 'Later', keys: 'l', palette: 'Later or back to now', why: (_, h) => whyNot.later(h.it), run: (app, h) => set(app, h, 'when', h.it.when === 'now' ? 'later' : 'now') }),
  archive: item({
    label: 'Archive',
    keys: 'e',
    palette: true,
    run: (app, h) => {
      const on = !h.it.archived
      set(app, h, 'archived', on, { note: on ? 'Find it under Archive' : '' })
      if (on && h.r.place.kind === 'item') app.nav.closeItem()
    },
  }),
  drop: item({ label: "Won't do", keys: 'w', palette: true, why: (_, h) => whyNot.drop(h.it, h.code), run: (app, h) => set(app, h, 'status', dropTo()) }),
  edit: item({ label: 'Edit', keys: 'i', palette: true, run: (app, h) => app.stores.itemView.getState().setEditing(h.it.n) }),
  status: item({ label: 'Status…', keys: 's', palette: true, run: arm('s', 'Status: 1–6') }),
  priority: item({ label: 'Priority…', keys: 'p', palette: true, run: arm('p', 'Priority: 0–3') }),
  type: item({ label: 'Type…', keys: 't', palette: true, run: arm('t', 'Type: F B I T R') }),
  'put-under': item({ label: 'Put under…', keys: 'm', palette: true, run: (app, h) => app.sheets.open({ kind: 'item-move-parent', n: h.it.n }, { pop: true, focus: false }) }),
  'add-sub': item({ label: 'Add subitem', keys: 'A', palette: true, run: (app, h) => app.stores.itemView.getState().setSubFor(h.it.n) }),
  'new-doc': item({ label: 'New doc', keys: 'D', palette: true, run: (app, h) => app.docs.create(h.it.n) }),
  copy: item({ label: 'Copy for agent', keys: 'C', palette: true, run: (app, h) => void copyText(forAgent(h.it, h.code, h.m.facts.base)).then(() => app.toasts.show('Copied')) }),
  full: item({ none: 'First pick an item: J or a click', label: 'Full width', keys: 'o', palette: true, run: (app) => app.nav.full(!app.stores.route.getState().full) }),
  menu: item({ label: 'All actions', keys: '.', run: (app, h) => app.sheets.open({ kind: 'item-menu', n: h.it.n, arm: null }, { pop: true, focus: false }) }),
  'send-answer': item({ none: '', label: 'Send the answer', keys: 'Meta+Enter', run: (app, h) => app.answers.send(h.m, h.r.slug, h.it) }),
  scroll: item({
    none: '',
    label: 'Scroll the item',
    keys: ' ',
    run: (app, h) => {
      const talk = app.fields.get('talk')
      if (!talk) return false
      talk.scrollBy({ top: (h.shift ? -0.8 : 0.8) * talk.clientHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    },
  }),
  // the page
  'new-input': page({
    label: 'New input',
    keys: 'c',
    palette: true,
    run: (app) => {
      // always a fresh new input, written in the box
      app.box.stop()
      if (app.stores.route.getState().full) app.stores.route.getState().setFull(false, true)
      app.nav.newInput()
      requestAnimationFrame(() => app.fields.focus('box'))
    },
  }),
  search: page({
    label: 'Search',
    keys: '/',
    palette: true,
    run: (app) => {
      // the phone's search is a layer over the page
      if (!app.desk() && !app.stores.route.getState().layers.includes('search')) return app.nav.search(true)
      if (!app.desk()) return app.fields.focus('search')
      requestAnimationFrame(() => app.fields.focus('search'))
    },
  }),
  filters: page({ label: 'Filters', keys: 'f', palette: true, run: (app) => app.stores.ui.getState().setDeskFilters(!app.stores.ui.getState().deskFilters) }),
  voice: page({
    label: 'Record voice input',
    keys: 'V',
    palette: true,
    // a new input by voice; again: it stops and is sent
    run: (app, h) => {
      if (app.voice.recording()) return void app.voice.finish(true)
      runAction(app, 'new-input', h)
      requestAnimationFrame(() => void app.voice.start(h.r.slug, 'new', null, 'main'))
    },
  }),
  'voice-note': page({
    label: 'Voice note',
    keys: 'v',
    // into the box as it is now (the open item's reply); again: it stops into the box
    run: (app, h) => {
      if (app.voice.recording()) return void app.voice.finish(false)
      const { key, scope } = app.stores.box.getState().shown
      void app.voice.start(h.r.slug, key, scope, 'main')
    },
  }),
  items: page({ label: 'Items', keys: 'g i', palette: true, run: tab('items') }),
  inputs: page({ label: 'Inputs', keys: 'g n', palette: true, run: tab('inputs') }),
  'archive-all': page({
    label: 'Archive every finished item',
    keys: 'E',
    why: (_, h) => (h.m && h.r.tab !== 'archive' ? null : 'Nothing finished to archive here'),
    run: (app, h) => {
      if (h.m) app.items.archiveAll(visible(h.m.items, h.r.tab, h.r.list).filter((it) => !it.archived && closed(it.status)).map((it) => it.n))
    },
  }),
  'archive-tab': page({ label: 'Archive', keys: 'g a', palette: true, run: tab('archive') }),
  rules: page({ label: 'Rules', keys: 'g r', palette: true, run: tab('rules') }),
  'switch-project': page({ label: 'Switch project', keys: 'g p', palette: true, run: (app) => app.sheets.open({ kind: 'switch-project' }, { focus: false }) }),
  settings: page({ label: 'Settings', keys: 'g s', palette: true, run: (app, h) => app.nav.to(`/p/${encodeURIComponent(h.r.slug)}/settings`) }),
  sidebar: page({ label: 'Toggle sidebar', keys: '[', palette: true, run: (app) => app.stores.ui.getState().setSideHidden(!app.stores.ui.getState().sideHidden) }),
  undo: page({
    label: 'Undo',
    keys: 'z',
    palette: true,
    why: (app) => (app.stores.feedback.getState().undo.length ? null : 'Nothing of yours to undo here. Older changes are in Change log'),
    run: (app) => void app.stores.feedback.getState().undo.at(-1)?.run(),
  }),
  keys: page({ label: 'Keyboard shortcuts', keys: '?', palette: true, run: (app) => app.sheets.open({ kind: 'keys' }) }),
  palette: page({ label: 'Go to or do', keys: 'Meta+k', run: (app) => app.sheets.open({ kind: 'palette' }, { focus: false }) }),
  back: page({ label: 'Step back one level', keys: 'Escape', run: (app, h) => stepBack(app, h) }),
  step: page({
    label: 'Next item',
    keys: 'j',
    why: (_, h) => (lists(h) ? null : h.r.place.kind === 'settings' ? 'Press Esc to return to the list' : 'J and K move in Items, Archive and Rules'),
    run: (app, h) => {
      if (h.m) app.nav.step(1, app.listOrder, (k) => codeOf(h.m!, k), (w) => app.toasts.show(w))
    },
  }),
  'step-back': page({
    label: 'Previous item',
    keys: 'k',
    why: (_, h) => (lists(h) ? null : h.r.place.kind === 'settings' ? 'Press Esc to return to the list' : 'J and K move in Items, Archive and Rules'),
    run: (app, h) => {
      if (h.m) app.nav.step(-1, app.listOrder, (k) => codeOf(h.m!, k), (w) => app.toasts.show(w))
    },
  }),
} satisfies Record<string, Action>

export type ActionId = keyof typeof ACTIONS

const typingIn = (el: Element | null) => /INPUT|TEXTAREA|SELECT/.test(el?.tagName || '') || !!(el as HTMLElement | null)?.isContentEditable

/** Esc: one level back: the drawer, the sheet, a subitem being written, an edit, the search, a field, full width, the
 * search's words, the item. */
function stepBack(app: App, h: Here): void {
  const { r } = h
  const active = document.activeElement
  const layers = app.stores.route.getState().layers
  if (layers.includes('drawer')) return app.nav.drawer(false)
  if (layers.includes('viewer')) return app.media.close()
  // the picked rows are let go first
  if (app.stores.ui.getState().selected.size && !app.stores.sheet.getState().spec && !typingIn(active)) return app.selection.clear()
  if (app.voice.recording()) return void app.voice.cancel() // a recording stops first, as everywhere
  // a correction, an edit, details added, the preferences: stopped, unless you are writing words in the box
  const inBox = app.desk() && app.fields.focused('box') && !!(app.fields.get('box') as HTMLTextAreaElement | null)?.value.trim()
  if (app.stores.box.getState().mode && !inBox) return app.box.stop()
  if (app.stores.sheet.getState().spec?.req.kind === 'doc-edit') return app.docs.keep() // its text kept as a draft
  if (app.stores.sheet.getState().spec) return app.sheets.close()
  const view = app.stores.itemView.getState()
  if (view.subFor != null && typingIn(active)) return view.setSubFor(null)
  if (view.editing != null) return view.setEditing(null)
  if (r.place.kind === 'doc') {
    // a document: its editor (kept as a draft), the area being drawn, what you picked, then the document itself
    const doc = app.stores.docView.getState()
    if (doc.editing) return app.docs.keep()
    if (doc.circle) return doc.setCircle(false)
    if (doc.quote || doc.sel.size || doc.reply) return app.docs.unpick()
    if (doc.inspect) return doc.setInspect(false) // a web page's Comment mode
    // the phone's document is a sheet: Esc closes it, even from the box
    if (!app.desk() || !typingIn(active)) {
      if (app.desk() && app.stores.route.getState().full) return app.nav.full(false)
      return app.docs.close()
    }
  }
  if (r.place.kind === 'settings' || (!app.desk() && r.place.kind === 'side')) {
    // Settings: a field first, then back out of it
    if (typingIn(active)) return (active as HTMLElement).blur()
    if (app.stores.box.getState().mode?.kind === 'prefs') return app.box.stop()
    return app.nav.settingsBack()
  }
  if (app.desk()) {
    // the New input page opened from an item or a document: Esc in the empty box goes back there
    const boxEmpty = !(app.fields.get('box') as HTMLTextAreaElement | null)?.value.trim() && !app.stores.box.getState().files[app.stores.box.getState().shown.key]?.length
    if (r.place.kind === 'new' && app.fields.focused('box') && boxEmpty && app.nav.composeBack()) return
    if (app.fields.focused('search')) {
      if (r.list.q) app.nav.setList({ q: '' })
      return app.fields.get('search')?.blur()
    }
    if (typingIn(active)) return (active as HTMLElement).blur()
    if (app.stores.route.getState().full) return app.nav.full(false)
    if (r.place.kind === 'new' && app.nav.composeBack()) return
    if (r.list.q) return app.nav.setList({ q: '' })
    if (r.place.kind === 'item' && r.tab !== 'inputs') return app.nav.closeItem()
    return
  }
  if (layers.includes('search') && app.fields.focused('search')) return app.nav.search(false)
  if (r.place.kind === 'item' && !typingIn(active)) return app.nav.closeItem()
}

const lists = (h: Here) => h.r.tab !== 'inputs' && h.r.place.kind !== 'settings' && !!h.m

/** The project and item the page shows now. */
export function hereOf(app: App): Here | null {
  const r = app.stores.route.getState().route
  if (r.page !== 'project') return null
  const m = app.model(r.slug)
  const n = r.place.kind === 'item' && m ? liveN(m, Number(/\d+/.exec(r.place.ref)?.[0])) : null
  const it = n != null ? m?.byN.get(n) : undefined
  return { r, m, it, code: it && m ? codeOf(m, it.n) : '' }
}

const byId = (id: ActionId): Action => ACTIONS[id]

/** Why it cannot be done here (said instead); null: it can. */
export function whyNotHere(app: App, id: ActionId, h: Here): string | null {
  const a = byId(id)
  if ('item' in a) {
    if (!h.it || !h.m) return a.none ?? (h.r.tab === 'inputs' || h.r.place.kind === 'new' ? 'Open an item in Items, Archive or Rules to use these keys' : 'First pick an item: J or a click')
    return a.why?.(app, h as OnItem) ?? null
  }
  return a.why?.(app, h) ?? null
}

/** Do it here, or say why not (`quiet`: just do nothing). -> whether it was done */
export function runAction(app: App, id: ActionId, h: Here | null = hereOf(app), quiet = false): boolean {
  if (!h) return false
  const why = whyNotHere(app, id, h)
  if (why !== null) {
    if (why && !quiet) app.toasts.show(why)
    return false
  }
  const a = byId(id)
  return ('item' in a ? a.run(app, h as OnItem) : a.run(app, h)) !== false
}

/** Here, about another item than the open one (the menu of a row). */
export function hereFor(app: App, n: number): Here | null {
  const h = hereOf(app)
  const it = h?.m?.byN.get(n)
  return h && it && h.m ? { ...h, it, code: codeOf(h.m, n) } : null
}

/** The action these keys do, if any. */
export function actionOfKeys(keys: string): ActionId | null {
  for (const [id, a] of Object.entries(ACTIONS) as [ActionId, Action][]) if (a.keys === keys) return id
  return null
}

/** Whether an action acts on the open item. */
export const onItem = (id: ActionId) => 'item' in byId(id)

/** An action's keys as the page writes them: ⇧C, G P, ⌘K. */
export function keysShown(id: ActionId): string {
  const k = byId(id).keys
  if (!k) return ''
  return k
    .split(' ')
    .map((x) => (x === 'Meta+k' ? '⌘K' : x === 'Meta+Enter' ? '⌘↵' : /^[A-Z]$/.test(x) ? '⇧' + x : x.toUpperCase()))
    .join(' ')
}

/** The command palette's rows: what can be done on the open item, then on the page, in the table's order. */
export function paletteRows(item: boolean): { id: ActionId; label: string; keys: string; item: boolean }[] {
  return (Object.entries(ACTIONS) as [ActionId, Action][])
    .filter(([, a]) => a.palette && ('item' in a) === item)
    .map(([id, a]) => ({ id, label: typeof a.palette === 'string' ? a.palette : a.label, keys: a.keys || '', item: 'item' in a }))
}

/** S, P or T was pressed for this item: the key after it sets that field (a status's digit, a priority's, a type's
 * letter). -> whether it did */
export function setArmed(app: App, h: Here, key: string): boolean {
  const it = h.it
  const k = it ? app.keyArm.take(it.n) : null
  if (!it || !k) return false
  const STATUSES = it.type === 'rule' ? ['proposed', 'open', 'dropped'] : ['proposed', 'open', 'doing', 'review', 'done', 'dropped']
  const TYPES: Record<string, string> = { f: 'feature', b: 'bug', i: 'idea', t: 'task', r: 'rule' }
  const [f, v] = k === 'p' ? ['pri', /^[0-3]$/.test(key) && 'P' + key] : k === 't' ? ['type', TYPES[key.toLowerCase()]] : ['status', /^[1-9]$/.test(key) && STATUSES[Number(key) - 1]]
  if (!v) return false
  void app.items.change(it.n, f as string, v)
  return true
}

/** A choice of the question that waits on you (1-9). */
export function pickChoice(app: App, h: Here, i: number): boolean {
  const it = h.it
  if (!it || it.wait?.kind !== 'ask' || i >= app.answers.labels(it).length) return false
  app.answers.pick(it, i, choiceMulti(it.wait.text, i))
  return true
}

/** The keys sheet (?): its groups of rows; a row made of actions shows their keys as the table has them. */
type HelpRow = { ids: ActionId[]; sep: string; text: string } | { keys: string; text: string }
const HELP: [string, HelpRow[]][] = [
  [
    'Move',
    [
      { ids: ['step', 'step-back'], sep: ' / ', text: 'Next or previous item' },
      { keys: 'O or ↵', text: 'Full width; Esc goes back' },
      { keys: 'Space', text: 'Scroll the item' },
      { keys: 'G then I N A R', text: 'Items, Inputs, Archive, Rules' },
      { keys: 'G then P', text: 'Switch project' },
      { keys: 'G then S', text: 'Settings' },
      { ids: ['sidebar'], sep: '', text: 'Toggle sidebar' },
    ],
  ],
  [
    'Act on the selected item',
    [
      { ids: ['next'], sep: '', text: "The item's next step: Accept, Approve, Answer or Reply" },
      { ids: ['reply'], sep: '', text: 'Reply or add to it' },
      { ids: ['not-yet'], sep: '', text: 'Not yet: back to in progress at once' },
      { keys: '1–9, ⌘↵', text: 'Pick a choice, send the answer' },
      { ids: ['done', 'drop', 'later'], sep: ' · ', text: "Done · Won't do · Later / Now" },
      { ids: ['archive', 'archive-all'], sep: ' / ', text: 'Archive or unarchive / archive every finished item' },
      { ids: ['status', 'priority', 'type'], sep: ' · ', text: "Status, priority, type (then the menu's digit)" },
      { ids: ['put-under', 'copy'], sep: ' · ', text: 'Put under… · Copy for agent' },
      { ids: ['edit', 'new-doc', 'add-sub'], sep: ' · ', text: 'Edit · New doc · Add subitem' },
      { ids: ['menu'], sep: '', text: 'All actions' },
      { ids: ['undo'], sep: '', text: 'Undo last action; older changes in Change log' },
    ],
  ],
  [
    'Mouse',
    [
      { keys: 'Hover a row', text: 'Quick actions' },
      { keys: 'Right-click a row', text: 'Item menu' },
      { keys: 'Click cut-off words', text: 'Show them all' },
      { keys: 'Drag a pane edge', text: 'Resize; double-click for the default' },
    ],
  ],
  [
    'Write and find',
    [
      { ids: ['palette'], sep: '', text: 'Go to an item or do anything here' },
      { keys: '⌘ / ⇧ click', text: 'Select multiple rows to act on together' },
      { ids: ['new-input'], sep: '', text: 'New input' },
      { ids: ['voice-note'], sep: '', text: 'Voice note for the selected item; V again stops' },
      { ids: ['voice'], sep: '', text: 'New input by voice; ⇧V again stops and sends' },
      { keys: '⌥V', text: 'Voice note while typing' },
      { keys: '↵', text: 'While recording: stop, into the box' },
      { keys: '⇧↵ or ⌘↵', text: 'Send; while recording: stop and send' },
      { ids: ['search'], sep: '', text: 'Search' },
      { ids: ['filters'], sep: '', text: 'Filters' },
      { ids: ['keys'], sep: '', text: 'This sheet' },
      { keys: 'Esc', text: 'Step back one level' },
    ],
  ],
]

/** The keys sheet's groups, as [group, [keys, what][]]. */
export function keyHelp(): [string, [string, string][]][] {
  return HELP.map(([group, rows]) => [group, rows.map((r) => ['ids' in r ? r.ids.map(keysShown).join(r.sep) : r.keys, r.text] as [string, string])])
}

/** The actions with keys the keys sheet tells of (the others are told as typed words: arrows, Enter, Space). */
export const helpedActions = (): ActionId[] => HELP.flatMap(([, rows]) => rows.flatMap((r) => ('ids' in r ? r.ids : [])))
