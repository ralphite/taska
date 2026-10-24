// What you can do in a project, each defined once: its words, its keys, when it can be done here (or why not, in a
// few words, said instead) and what it does, with only the services it names. The keys (keys.ts), the command
// palette, the keys sheet and the item's menu all read this table, so a key, a palette row and a menu row always do
// the same thing.

import { closed } from '../model/items'
import { visible } from '../model/visible'
import { choiceMulti } from '../model/markdown'
import { armedSet, doneTo, dropTo, pageStatuses, whyNot, yourStep } from '../model/actions'
import { codeOf, liveN, type ProjectModel } from '../model/project'
import type { Item } from '../model/types'
import type { Tab } from '../model/words'
import { NEW_DRAFT } from '../model/draftTarget'
import type { BoxStore } from '../stores/box'
import type { DocViewStore } from '../stores/docView'
import type { FeedbackStore } from '../stores/feedback'
import type { ItemViewStore } from '../stores/itemView'
import type { RouteStore } from '../stores/route'
import type { SheetStore } from '../stores/sheet'
import type { UiStore } from '../stores/ui'
import type { Answers } from './answers'
import type { Box } from './box'
import { copyText, forAgent } from './clipboard'
import type { Docs } from './docs'
import type { Fields } from './fields'
import type { ProjectRoute } from './hooks'
import type { ItemActions } from './itemActions'
import type { ItemEdits } from './itemEdits'
import type { KeyArm } from './keyArm'
import type { ListOrder } from './listOrder'
import type { Media } from './media'
import type { Navigation } from './navigation'
import type { Selection } from './selection'
import type { Sheets } from './sheets'
import type { Toasts } from './toasts'
import type { Voice } from './voice'

/** What the actions do their work with; each action names the ones it uses and is given only those. */
export interface ActionWorld {
  items: ItemActions
  itemEdits: ItemEdits
  keyArm: KeyArm
  answers: Answers
  toasts: Toasts
  nav: Navigation
  fields: Fields
  sheets: Sheets
  docs: Docs
  box: Box
  voice: Voice
  media: Media
  selection: Selection
  listOrder: ListOrder
  route: RouteStore
  ui: UiStore
  feedback: FeedbackStore
  sheet: SheetStore
  itemView: ItemViewStore
  docView: DocViewStore
  boxStore: BoxStore
  desk(): boolean
  model(slug: string): ProjectModel | null
}
type Uses = keyof ActionWorld

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
const onAnItem = (h: Here): h is OnItem => !!h.it && !!h.m

interface PageAction<K extends Uses = Uses> {
  uses: readonly K[]
  label: string
  /** the keys, as the keyboard names them; a space between keys pressed one after the other */
  keys?: string
  /** in the command palette, with these words when they differ */
  palette?: string | true
  why?(w: Pick<ActionWorld, K>, h: Here): string | null
  /** false: nothing to do after all (the key goes on as a key) */
  run(w: Pick<ActionWorld, K>, h: Here): void | boolean
}
interface ItemAction<K extends Uses = Uses> {
  item: true
  uses: readonly K[]
  /** said when no item is open (default: how to open one; '': nothing) */
  none?: string
  label: string
  keys?: string
  palette?: string | true
  why?(w: Pick<ActionWorld, K>, h: OnItem): string | null
  run(w: Pick<ActionWorld, K>, h: OnItem): void | boolean
}
type Action = PageAction | ItemAction

const item = <K extends Uses = never>(uses: readonly K[], a: Omit<ItemAction<K>, 'item' | 'uses'>): ItemAction<K> => ({ ...a, uses, item: true })
const page = <K extends Uses = never>(uses: readonly K[], a: Omit<PageAction<K>, 'uses'>): PageAction<K> => ({ ...a, uses })
const set = (w: Pick<ActionWorld, 'items'>, h: OnItem, f: string, v: unknown, o: { said?: string; note?: string } = {}) => void w.items.change(h.it.n, f, v, o)
const arm = (k: 's' | 'p' | 't', hint: string) => (w: Pick<ActionWorld, 'keyArm' | 'toasts'>, h: OnItem) => {
  w.keyArm.set(k, h.it.n)
  w.toasts.show(hint)
}
const tab = (t: Tab) => (w: Pick<ActionWorld, 'nav'>) => w.nav.tab(t)
const steps = (d: 1 | -1) => (w: Pick<ActionWorld, 'nav' | 'listOrder' | 'toasts'>, h: Here) => {
  const m = h.m
  if (m) w.nav.step(d, w.listOrder, (k) => codeOf(m, k), (words) => w.toasts.show(words))
}
const stepWhy = (_: unknown, h: Here) => (lists(h) ? null : h.r.place.kind === 'settings' ? 'Press Esc to return to the list' : 'J and K move in Items, Archive and Rules')

/** always a fresh new input, written in the box */
function newInput(w: Pick<ActionWorld, 'box' | 'route' | 'nav' | 'fields'>): void {
  w.box.stop()
  if (w.route.getState().full) w.route.getState().setFull(false, true)
  w.nav.newInput()
  requestAnimationFrame(() => w.fields.focus('box'))
}

export const ACTIONS = {
  // the item
  next: item(['fields', 'items'], {
    label: 'Accept or approve',
    keys: 'a',
    palette: true,
    why: (_, h) => whyNot.next(h.it, h.code),
    run: (w, h) => {
      const step = yourStep(h.it)
      if (!step) return
      if ('set' in step) return set(w, h, step.set[0], step.set[1])
      if (step.answer === 'words') w.fields.focus('box')
      // a question with choices: on its first choice
      else w.fields.get('talk')?.querySelector<HTMLElement>('button[data-choice]')?.focus()
    },
  }),
  reply: item(['fields'], { label: 'Reply', keys: 'r', palette: true, run: (w) => w.fields.focus('box') }),
  'not-yet': item(['items'], { label: 'Not yet', keys: 'n', palette: true, why: (_, h) => whyNot.notYet(h.it), run: (w, h) => set(w, h, 'status', 'doing', { said: 'is back in progress' }) }),
  done: item(['items'], { label: 'Done', keys: 'd', palette: true, why: (_, h) => whyNot.done(h.it, h.code), run: (w, h) => set(w, h, 'status', doneTo(h.it)) }),
  later: item(['items'], { label: 'Later', keys: 'l', palette: 'Later or back to now', why: (_, h) => whyNot.later(h.it), run: (w, h) => set(w, h, 'when', h.it.when === 'now' ? 'later' : 'now') }),
  archive: item(['items', 'nav'], {
    label: 'Archive',
    keys: 'e',
    palette: true,
    run: (w, h) => {
      const on = !h.it.archived
      set(w, h, 'archived', on, { note: on ? 'Find it under Archive' : '' })
      if (on && h.r.place.kind === 'item') w.nav.closeItem()
    },
  }),
  drop: item(['items'], { label: "Won't do", keys: 'w', palette: true, why: (_, h) => whyNot.drop(h.it, h.code), run: (w, h) => set(w, h, 'status', dropTo()) }),
  edit: item(['itemEdits'], { label: 'Edit', keys: 'i', palette: true, run: (w, h) => w.itemEdits.start(h.it.n) }),
  status: item(['keyArm', 'toasts'], { label: 'Status…', keys: 's', palette: true, run: arm('s', 'Status: 1–6') }),
  priority: item(['keyArm', 'toasts'], { label: 'Priority…', keys: 'p', palette: true, run: arm('p', 'Priority: 0–3') }),
  type: item(['keyArm', 'toasts'], { label: 'Type…', keys: 't', palette: true, run: arm('t', 'Type: F B I T R') }),
  'put-under': item(['sheets'], { label: 'Put under…', keys: 'm', palette: true, run: (w, h) => w.sheets.open({ kind: 'item-move-parent', n: h.it.n }, { pop: true, focus: false }) }),
  'add-sub': item(['itemEdits'], { label: 'Add subitem', keys: 'A', palette: true, run: (w, h) => w.itemEdits.subStart(h.it.n) }),
  'new-doc': item(['docs'], { label: 'New doc', keys: 'D', palette: true, run: (w, h) => w.docs.create(h.it.n) }),
  copy: item(['toasts'], { label: 'Copy for agent', keys: 'C', palette: true, run: (w, h) => void copyText(forAgent(h.it, h.code, h.m.facts.base)).then(() => w.toasts.show('Copied')) }),
  full: item(['nav', 'route'], { none: 'First pick an item: J or a click', label: 'Full width', keys: 'o', palette: true, run: (w) => w.nav.full(!w.route.getState().full) }),
  menu: item(['sheets'], { label: 'All actions', keys: '.', run: (w, h) => w.sheets.open({ kind: 'item-menu', n: h.it.n, arm: null }, { pop: true, focus: false }) }),
  'send-answer': item(['answers'], { none: '', label: 'Send the answer', keys: 'Meta+Enter', run: (w, h) => w.answers.send(h.m, h.r.slug, h.it) }),
  scroll: item(['fields'], {
    none: '',
    label: 'Scroll the item',
    keys: ' ',
    run: (w, h) => {
      const talk = w.fields.get('talk')
      if (!talk) return false
      talk.scrollBy({ top: (h.shift ? -0.8 : 0.8) * talk.clientHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    },
  }),
  // the page
  'new-input': page(['box', 'route', 'nav', 'fields'], { label: 'New input', keys: 'c', palette: true, run: newInput }),
  search: page(['desk', 'route', 'nav', 'fields'], {
    label: 'Search',
    keys: '/',
    palette: true,
    run: (w) => {
      // the phone's search is a layer over the page
      if (!w.desk() && !w.route.getState().layers.includes('search')) return w.nav.search(true)
      if (!w.desk()) return w.fields.focus('search')
      requestAnimationFrame(() => w.fields.focus('search'))
    },
  }),
  filters: page(['ui'], { label: 'Filters', keys: 'f', palette: true, run: (w) => w.ui.getState().setDeskFilters(!w.ui.getState().deskFilters) }),
  voice: page(['voice', 'box', 'route', 'nav', 'fields'], {
    label: 'Record voice input',
    keys: 'V',
    palette: true,
    // a new input by voice; again: it stops and is sent
    run: (w, h) => {
      if (w.voice.recording()) return void w.voice.finish(true)
      newInput(w)
      requestAnimationFrame(() => void w.voice.start(h.r.slug, NEW_DRAFT, null, 'main'))
    },
  }),
  'voice-note': page(['voice', 'boxStore'], {
    label: 'Voice note',
    keys: 'v',
    // into the box as it is now (the open item's reply); again: it stops into the box
    run: (w, h) => {
      if (w.voice.recording()) return void w.voice.finish(false)
      const { key, scope } = w.boxStore.getState().shown
      void w.voice.start(h.r.slug, key, scope, 'main')
    },
  }),
  items: page(['nav'], { label: 'Items', keys: 'g i', palette: true, run: tab('items') }),
  inputs: page(['nav'], { label: 'Inputs', keys: 'g n', palette: true, run: tab('inputs') }),
  'archive-all': page(['items'], {
    label: 'Archive every finished item',
    keys: 'E',
    why: (_, h) => (h.m && h.r.tab !== 'archive' ? null : 'Nothing finished to archive here'),
    run: (w, h) => {
      if (h.m) w.items.archiveAll(visible(h.m.items, h.r.tab, h.r.list).filter((it) => !it.archived && closed(it.status)).map((it) => it.n))
    },
  }),
  'archive-tab': page(['nav'], { label: 'Archive', keys: 'g a', palette: true, run: tab('archive') }),
  rules: page(['nav'], { label: 'Rules', keys: 'g r', palette: true, run: tab('rules') }),
  'switch-project': page(['sheets'], { label: 'Switch project', keys: 'g p', palette: true, run: (w) => w.sheets.open({ kind: 'switch-project' }, { focus: false }) }),
  settings: page(['nav'], { label: 'Settings', keys: 'g s', palette: true, run: (w, h) => w.nav.to(`/p/${encodeURIComponent(h.r.slug)}/settings`) }),
  sidebar: page(['ui'], { label: 'Toggle sidebar', keys: '[', palette: true, run: (w) => w.ui.getState().setSideHidden(!w.ui.getState().sideHidden) }),
  undo: page(['feedback'], {
    label: 'Undo',
    keys: 'z',
    palette: true,
    why: (w) => (w.feedback.getState().undo.length ? null : 'Nothing of yours to undo here. Older changes are in Change log'),
    run: (w) => void w.feedback.getState().undo.at(-1)?.run(),
  }),
  keys: page(['sheets'], { label: 'Keyboard shortcuts', keys: '?', palette: true, run: (w) => w.sheets.open({ kind: 'keys' }) }),
  palette: page(['sheets'], { label: 'Go to or do', keys: 'Meta+k', run: (w) => w.sheets.open({ kind: 'palette' }, { focus: false }) }),
  back: page(['route', 'nav', 'media', 'ui', 'sheet', 'sheets', 'selection', 'voice', 'desk', 'fields', 'boxStore', 'box', 'docs', 'itemEdits', 'itemView', 'docView'], { label: 'Step back one level', keys: 'Escape', run: (w, h) => stepBack(w, h) }),
  step: page(['nav', 'listOrder', 'toasts'], { label: 'Next item', keys: 'j', why: stepWhy, run: steps(1) }),
  'step-back': page(['nav', 'listOrder', 'toasts'], { label: 'Previous item', keys: 'k', why: stepWhy, run: steps(-1) }),
} satisfies Record<string, Action>

export type ActionId = keyof typeof ACTIONS

/** every action's id, in the table's order */
export const ACTION_IDS = Object.keys(ACTIONS) as ActionId[]

const typingIn = (el: Element | null) => /INPUT|TEXTAREA|SELECT/.test(el?.tagName || '') || !!(el as HTMLElement | null)?.isContentEditable

type BackWorld = Pick<ActionWorld, 'route' | 'nav' | 'media' | 'ui' | 'sheet' | 'sheets' | 'selection' | 'voice' | 'desk' | 'fields' | 'boxStore' | 'box' | 'docs' | 'itemEdits' | 'itemView' | 'docView'>

/** Esc: one level back: the drawer, the sheet, a subitem being written, an edit, the search, a field, full width, the
 * search's words, the item. */
function stepBack(w: BackWorld, h: Here): void {
  const { r } = h
  const active = document.activeElement
  const layers = w.route.getState().layers
  if (layers.includes('drawer')) return w.nav.drawer(false)
  if (layers.includes('viewer')) return w.media.close()
  // the picked rows are let go first
  if (w.ui.getState().selected.size && !w.sheet.getState().spec && !typingIn(active)) return w.selection.clear()
  if (w.voice.recording()) return void w.voice.cancel() // a recording stops first, as everywhere
  // a correction, an edit, details added, the preferences: stopped, unless you are writing words in the box
  const inBox = w.desk() && w.fields.focused('box') && !!(w.fields.get('box') as HTMLTextAreaElement | null)?.value.trim()
  if (w.boxStore.getState().mode && !inBox) return w.box.stop()
  if (w.sheet.getState().spec?.req.kind === 'doc-edit') return w.docs.keep() // its text kept as a draft
  if (w.sheet.getState().spec) return w.sheets.close()
  if (w.ui.getState().sideOver) return w.ui.getState().setSideOver(false)
  const view = w.itemView.getState()
  if (view.subFor != null && typingIn(active)) return w.itemEdits.subLeave()
  if (view.editing != null) return w.itemEdits.leave()
  if (r.place.kind === 'doc') {
    // a document: its editor (kept as a draft), the area being drawn, what you picked, then the document itself
    const doc = w.docView.getState()
    if (doc.editing) return w.docs.keep()
    if (doc.circle) return doc.setCircle(false)
    if (doc.quote || doc.sel.size || doc.reply) return w.docs.unpick()
    if (doc.inspect) return doc.setInspect(false) // a web page's Comment mode
    // the phone's document is a sheet: Esc closes it, even from the box
    if (!w.desk() || !typingIn(active)) {
      if (w.desk() && w.route.getState().full) return w.nav.full(false)
      return w.docs.close()
    }
  }
  if (r.place.kind === 'settings' || (!w.desk() && r.place.kind === 'side')) {
    // Settings: a field first, then back out of it
    if (typingIn(active)) return (active as HTMLElement).blur()
    if (w.boxStore.getState().mode?.kind === 'prefs') return w.box.stop()
    return w.nav.settingsBack()
  }
  if (w.desk()) {
    // the New input page opened from an item or a document: Esc in the empty box goes back there
    const boxEmpty = !(w.fields.get('box') as HTMLTextAreaElement | null)?.value.trim() && !w.boxStore.getState().files[w.boxStore.getState().shown.key]?.length
    if (r.place.kind === 'new' && w.fields.focused('box') && boxEmpty && w.nav.composeBack()) return
    if (w.fields.focused('search')) {
      if (r.list.q) w.nav.setList({ q: '' })
      return w.fields.get('search')?.blur()
    }
    if (typingIn(active)) return (active as HTMLElement).blur()
    if (w.route.getState().full) return w.nav.full(false)
    if (r.place.kind === 'new' && w.nav.composeBack()) return
    if (r.list.q) return w.nav.setList({ q: '' })
    if (r.place.kind === 'item' && r.tab !== 'inputs') return w.nav.closeItem()
    return
  }
  if (layers.includes('search') && w.fields.focused('search')) return w.nav.search(false)
  if (r.place.kind === 'item' && !typingIn(active)) return w.nav.closeItem()
}

const lists = (h: Here) => h.r.tab !== 'inputs' && h.r.place.kind !== 'settings' && !!h.m

const byId = (id: ActionId): Action => ACTIONS[id]

/** only the services an action names */
function given<K extends Uses>(w: ActionWorld, uses: readonly K[]): Pick<ActionWorld, K> {
  const out: Partial<Pick<ActionWorld, K>> = {}
  for (const k of uses) out[k] = w[k]
  return out as Pick<ActionWorld, K>
}

/** The table, done here: where you are, why an action cannot be done (said instead), doing it. */
export class Actions {
  private readonly w: ActionWorld
  constructor(w: ActionWorld) {
    this.w = w
  }

  /** The project and item the page shows now. */
  here(): Here | null {
    const r = this.w.route.getState().route
    if (r.page !== 'project') return null
    const m = this.w.model(r.slug)
    const n = r.place.kind === 'item' && m ? liveN(m, Number(/\d+/.exec(r.place.ref)?.[0])) : null
    const it = n != null ? m?.byN.get(n) : undefined
    return { r, m, it, code: it && m ? codeOf(m, it.n) : '' }
  }

  /** Here, about another item than the open one (the menu of a row). */
  hereFor(n: number): Here | null {
    const h = this.here()
    const it = h?.m?.byN.get(n)
    return h && it && h.m ? { ...h, it, code: codeOf(h.m, n) } : null
  }

  /** Why it cannot be done here (said instead); null: it can. */
  why(id: ActionId, h: Here): string | null {
    const a = byId(id)
    if ('item' in a) {
      if (!onAnItem(h)) return a.none ?? (h.r.tab === 'inputs' || h.r.place.kind === 'new' ? 'Open an item in Items, Archive or Rules to use these keys' : 'First pick an item: J or a click')
      return a.why?.(given(this.w, a.uses), h) ?? null
    }
    return a.why?.(given(this.w, a.uses), h) ?? null
  }

  /** Do it here, or say why not (`quiet`: just do nothing). -> whether it was done */
  run(id: ActionId, h: Here | null = this.here(), quiet = false): boolean {
    if (!h) return false
    const why = this.why(id, h)
    if (why !== null) {
      if (why && !quiet) this.w.toasts.show(why)
      return false
    }
    const a = byId(id)
    if (!('item' in a)) return a.run(given(this.w, a.uses), h) !== false
    return onAnItem(h) && a.run(given(this.w, a.uses), h) !== false
  }

  /** Do it on item `n`, open or not. */
  runOn(id: ActionId, n: number): boolean {
    const h = this.hereFor(n)
    return !!h && this.run(id, h)
  }

  /** S, P or T was pressed for this item: the key after it sets that field. -> whether it did */
  setArmed(h: Here, key: string): boolean {
    const it = h.it
    const k = it ? this.w.keyArm.take(it.n) : null
    const to = it && k ? armedSet(k, key, pageStatuses(it)) : null
    if (!it || !to) return false
    void this.w.items.change(it.n, to[0], to[1])
    return true
  }

  /** A choice of the question that waits on you (1-9). */
  pickChoice(h: Here, i: number): boolean {
    const it = h.it
    if (!it || it.wait?.kind !== 'ask' || i >= this.w.answers.labels(it).length) return false
    this.w.answers.pick(it, i, choiceMulti(it.wait.text, i))
    return true
  }
}

/** The action these keys do, if any. */
export function actionOfKeys(keys: string): ActionId | null {
  return ACTION_IDS.find((id) => ACTIONS[id].keys === keys) ?? null
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
  return ACTION_IDS.map((id) => [id, byId(id)] as const)
    .filter(([, a]) => a.palette && ('item' in a) === item)
    .map(([id, a]) => ({ id, label: typeof a.palette === 'string' ? a.palette : a.label, keys: a.keys || '', item: 'item' in a }))
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
