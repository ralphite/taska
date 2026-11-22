// What you can do in a project, each defined once: its words, its keys, when it can be done here (or why not, in a
// few words, said instead) and what it does, with only the services it names. The keys (keys.ts), the search's
// Actions, the keys sheet and the task's menu all read this table, so a key, an action row and a menu row always do
// the same thing.

import { closed } from '../model/tasks'
import { visible } from '../model/visible'
import { choiceMulti } from '../model/markdown'
import { askRowOf } from '../model/talk'
import { armHint, armedSet, doneTo, dropTo, pageStatuses, whyNot } from '../model/actions'
import { TASK_ACTS, type TaskActId } from '../model/taskActs'
import { yourStep } from '../model/needStates'
import { codeOf, liveN, type ProjectModel } from '../model/project'
import type { Task } from '../model/types'
import type { Tab } from '../model/words'
import { NEW_DRAFT } from '../model/draftTarget'
import type { BoxStore } from '../stores/box'
import type { DocViewStore } from '../stores/docView'
import type { FeedbackStore } from '../stores/feedback'
import type { Finder } from './search/finder'
import type { TaskViewStore } from '../stores/taskView'
import type { RouteStore } from '../stores/route'
import type { SheetStore } from '../stores/sheet'
import type { UiStore } from '../stores/ui'
import type { Answers } from './tasks/answers'
import type { Box } from './inputs/box'
import { copyText, forAgent } from './page/clipboard'
import type { Docs } from './docs/docs'
import type { DocEditor } from './docs/editor'
import type { Rules } from './docs/rules'
import type { SharedRules } from './docs/sharedRules'
import { isSharedSlug } from '../model/includes'
import type { Fields } from './page/fields'
import type { ProjectRoute } from './hooks'
import type { TaskActions } from './tasks/taskActions'
import type { TaskEdits } from './tasks/taskEdits'
import type { KeyArm } from './page/keyArm'
import type { ListOrder } from './tasks/listOrder'
import type { Media } from './page/media'
import type { Navigation } from './page/navigation'
import type { Selection } from './tasks/selection'
import type { Sheets } from './page/sheets'
import type { Toasts } from './page/toasts'
import type { Voice } from './voice/voice'

/** What the actions do their work with; each action names the ones it uses and is given only those. */
export interface ActionWorld {
  tasks: TaskActions
  taskEdits: TaskEdits
  keyArm: KeyArm
  answers: Answers
  toasts: Toasts
  nav: Navigation
  fields: Fields
  sheets: Sheets
  docs: Docs
  docEditor: DocEditor
  rules: Rules
  sharedRules: SharedRules
  box: Box
  voice: Voice
  media: Media
  selection: Selection
  listOrder: ListOrder
  route: RouteStore
  ui: UiStore
  feedback: FeedbackStore
  sheet: SheetStore
  taskView: TaskViewStore
  docView: DocViewStore
  boxStore: BoxStore
  /** the search: the phone's page, the desktop's dialog */
  finder: Finder
  desk(): boolean
  model(slug: string): ProjectModel | null
}
type Uses = keyof ActionWorld

/** Where an action is done: the project shown, its model, the open task. */
export interface Here {
  r: ProjectRoute
  m: ProjectModel | null
  it: Task | undefined
  code: string
  /** the key that asked for it (Shift-Space scrolls back) */
  shift?: boolean
}
type OnTask = Here & { m: ProjectModel; it: Task }
const onAnTask = (h: Here): h is OnTask => !!h.it && !!h.m

interface PageAction<K extends Uses = Uses> {
  uses: readonly K[]
  label: string
  /** the keys, as the keyboard names them; a space between keys pressed one after the other */
  keys?: string
  /** among the search's Actions when its words name it (T479), with these words when they differ */
  listed?: string | true
  /** only of use on the desktop (the sidebar, the keys) */
  desk?: true
  why?(w: Pick<ActionWorld, K>, h: Here): string | null
  /** false: nothing to do after all (the key goes on as a key) */
  run(w: Pick<ActionWorld, K>, h: Here): void | boolean
}
interface TaskAction<K extends Uses = Uses> {
  task: true
  uses: readonly K[]
  /** said when no task is open (default: how to open one; '': nothing) */
  none?: string
  label: string
  keys?: string
  listed?: string | true
  desk?: true
  why?(w: Pick<ActionWorld, K>, h: OnTask): string | null
  run(w: Pick<ActionWorld, K>, h: OnTask): void | boolean
}
type Action = PageAction | TaskAction

const task = <K extends Uses = never>(uses: readonly K[], a: Omit<TaskAction<K>, 'task' | 'uses'>): TaskAction<K> => ({ ...a, uses, task: true })
const page = <K extends Uses = never>(uses: readonly K[], a: Omit<PageAction<K>, 'uses'>): PageAction<K> => ({ ...a, uses })
const set = (w: Pick<ActionWorld, 'tasks'>, h: OnTask, f: string, v: unknown, o: { said?: string } = {}) => void w.tasks.change(h.it.n, f, v, o)
const arm = (k: 's' | 'p') => (w: Pick<ActionWorld, 'keyArm' | 'toasts'>, h: OnTask) => {
  w.keyArm.set(k, h.it.n)
  w.toasts.show(armHint(k, h.it))
}
/** a task action's words and key (model/taskActs) */
const named = (id: TaskActId) => ({ label: TASK_ACTS[id].label, keys: (TASK_ACTS[id].key ?? '').toLowerCase() })
const tab = (t: Tab) => (w: Pick<ActionWorld, 'nav'>) => w.nav.tab(t)
const steps = (d: 1 | -1) => (w: Pick<ActionWorld, 'nav' | 'listOrder' | 'toasts'>, h: Here) => {
  const m = h.m
  if (m) w.nav.step(d, w.listOrder, (k) => codeOf(m, k), (words) => w.toasts.show(words))
}
const stepWhy = (_: unknown, h: Here) => (lists(h) ? null : h.r.place.kind === 'settings' || h.r.place.kind === 'help' ? 'Press Esc to return to the list' : 'J and K move in Tasks and Archive')

/** always a fresh new input, written in the box */
function newInput(w: Pick<ActionWorld, 'box' | 'route' | 'nav' | 'fields'>): void {
  w.box.stop()
  if (w.route.getState().full) w.route.getState().setFull(false, true)
  w.nav.newInput()
  requestAnimationFrame(() => w.fields.focus('box'))
}

export const ACTIONS = {
  // the task
  next: task(['fields', 'tasks'], {
    label: 'Accept or approve',
    keys: 'a',
    listed: true,
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
  reply: task(['fields'], { label: TASK_ACTS.reply.label, keys: 'r', listed: true, run: (w) => w.fields.focus('box') }),
  'not-yet': task(['tasks'], { ...named('not-yet'), listed: true, why: (_, h) => whyNot.notYet(h.it), run: (w, h) => set(w, h, 'status', 'open', { said: 'is back to open' }) }),
  done: task(['tasks'], { ...named('done'), listed: true, why: (_, h) => whyNot.done(h.it, h.code), run: (w, h) => set(w, h, 'status', doneTo(h.it)) }),
  // Later asks until when: Tomorrow, Next week, a day picked, or none (D115 #21); back to now at once
  later: task(['tasks', 'sheets'], { ...named('later'), listed: 'Later or back to now', why: (_, h) => whyNot.later(h.it), run: (w, h) => (h.it.when === 'now' ? w.sheets.open({ kind: 'later', n: h.it.n }, { focus: false }) : set(w, h, 'when', 'now')) }),
  archive: task(['tasks', 'nav'], {
    ...named('archive'),
    listed: true,
    run: (w, h) => {
      const on = !h.it.archived
      set(w, h, 'archived', on)
      if (on && h.r.place.kind === 'task') w.nav.closeTask()
    },
  }),
  drop: task(['tasks'], { ...named('drop'), listed: true, why: (_, h) => whyNot.drop(h.it, h.code), run: (w, h) => set(w, h, 'status', dropTo()) }),
  edit: task(['taskEdits'], { label: 'Edit', keys: 'i', listed: true, run: (w, h) => w.taskEdits.start(h.it.n) }),
  status: task(['keyArm', 'toasts'], { label: 'Status…', keys: 's', listed: true, run: arm('s') }),
  priority: task(['keyArm', 'toasts'], { label: 'Priority…', keys: 'p', listed: true, run: arm('p') }),
  tags: task(['sheets'], { label: 'Tags…', keys: 't', listed: true, run: (w, h) => w.sheets.open({ kind: 'task-menu', n: h.it.n, arm: 't' }, { pop: true, focus: false, narrow: true }) }),
  // beside its row in the list, as its right-click menu is (T801, T640 #8700: it was in the window's corner)
  'put-under': task(['sheets', 'fields'], {
    label: 'Put under…',
    keys: 'm',
    listed: true,
    run: (w, h) => w.sheets.openFrom(w.fields.get('list')?.querySelector(`article[data-n="${h.it.n}"]`) ?? null, { kind: 'task-move-parent', n: h.it.n }, { focus: false }),
  }),
  'add-sub': task(['taskEdits'], { label: 'Add subtask', keys: 'A', listed: true, run: (w, h) => w.taskEdits.subStart(h.it.n) }),
  'new-doc': task(['docEditor'], { label: 'New doc', keys: 'D', listed: true, run: (w, h) => w.docEditor.create(h.it.n) }),
  copy: task(['toasts'], { label: 'Copy for agent', keys: 'C', listed: true, run: (w, h) => void copyText(forAgent(h.it, h.code, h.m.facts.base)).then(() => w.toasts.show('Copied')) }),
  full: task(['nav', 'route'], { none: 'First pick a task: J or a click', label: 'Full width', keys: 'o', listed: true, run: (w) => w.nav.full(!w.route.getState().full) }),
  menu: task(['sheets'], { label: 'All actions', keys: '.', run: (w, h) => w.sheets.open({ kind: 'task-menu', n: h.it.n, arm: null }, { pop: true, focus: false }) }),
  'send-answer': task(['answers'], { none: '', label: 'Send the answer', keys: 'Meta+Enter', run: (w, h) => w.answers.send(h.m, h.r.slug, h.it) }),
  scroll: task(['fields'], {
    none: '',
    label: 'Scroll the task',
    keys: ' ',
    run: (w, h) => {
      const talk = w.fields.get('talk')
      if (!talk) return false
      talk.scrollBy({ top: (h.shift ? -0.8 : 0.8) * talk.clientHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    },
  }),
  // the page
  'new-input': page(['box', 'route', 'nav', 'fields'], { label: 'New input', keys: 'c', listed: true, run: newInput }),
  search: page(['desk', 'route', 'sheet', 'finder'], {
    label: 'Search',
    keys: 'Meta+k',
    run: (w) => {
      // the desktop's dialog (again: it closes); the phone's search is a page over the page, listening at once (T479)
      if (w.desk()) return w.sheet.getState().spec?.req.kind === 'search' ? w.finder.closeDesk() : w.finder.openDesk()
      if (!w.route.getState().layers.includes('search')) w.finder.open()
    },
  }),
  filters: page(['ui'], { label: 'Filters', keys: 'f', listed: true, run: (w) => w.ui.getState().setDeskFilters(!w.ui.getState().deskFilters) }),
  voice: page(['voice', 'box', 'route', 'nav', 'fields'], {
    label: 'Record voice input',
    keys: 'V',
    listed: true,
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
    // into the box as it is now (the open task's reply); again: it stops into the box
    run: (w, h) => {
      if (w.voice.recording()) return void w.voice.finish(false)
      const { key, scope } = w.boxStore.getState().shown
      void w.voice.start(h.r.slug, key, scope, 'main')
    },
  }),
  tasks: page(['nav'], { label: 'Tasks', keys: 'g t', listed: true, run: tab('tasks') }),
  inputs: page(['nav'], { label: 'Inputs', keys: 'g n', listed: true, run: tab('inputs') }),
  'archive-all': page(['tasks'], {
    label: 'Archive every finished task',
    keys: 'E',
    why: (_, h) => (h.m && h.r.tab !== 'archive' ? null : 'Nothing finished to archive here'),
    run: (w, h) => {
      if (h.m) w.tasks.archiveAll(visible(h.m.tasks, h.r.tab, h.r.list).filter((it) => !it.archived && closed(it.status)).map((it) => it.n))
    },
  }),
  'archive-tab': page(['nav'], { label: 'Archive', keys: 'g a', listed: true, run: tab('archive') }),
  rules: page(['nav'], { label: 'Rules', keys: 'g r', listed: true, run: tab('rules') }),
  'switch-project': page(['sheets'], { label: 'Switch project', keys: 'g p', listed: true, run: (w) => w.sheets.open({ kind: 'switch-project' }, { focus: false }) }),
  settings: page(['nav'], { label: 'Settings', keys: 'g s', listed: true, run: (w, h) => w.nav.to(`/p/${encodeURIComponent(h.r.slug)}/settings`) }),
  documents: page(['nav'], { label: 'Documents', keys: 'g d', listed: true, run: (w, h) => w.nav.to(`/p/${encodeURIComponent(h.r.slug)}/docs`) }),
  activity: page(['nav'], { label: 'Activity', keys: 'g h', listed: true, run: (w, h) => w.nav.to(`/p/${encodeURIComponent(h.r.slug)}/log`) }),
  deleted: page(['nav'], { label: 'Deleted', keys: 'g x', listed: true, run: (w, h) => w.nav.to(`/p/${encodeURIComponent(h.r.slug)}/deleted`) }),
  sidebar: page(['ui'], { label: 'Toggle sidebar', keys: '[', listed: true, desk: true, run: (w) => w.ui.getState().setSideHidden(!w.ui.getState().sideHidden) }),
  undo: page(['feedback'], {
    label: 'Undo',
    keys: 'z',
    listed: true,
    why: (w) => (w.feedback.getState().undo.length ? null : 'Nothing of yours to undo here. Older changes are in Activity'),
    run: (w) => void w.feedback.getState().undo.at(-1)?.run(),
  }),
  keys: page(['sheets'], { label: 'Keyboard shortcuts', keys: '?', listed: true, desk: true, run: (w) => w.sheets.open({ kind: 'keys' }) }),
  back: page(['finder', 'route', 'nav', 'media', 'ui', 'sheet', 'sheets', 'selection', 'voice', 'desk', 'fields', 'boxStore', 'box', 'docs', 'docEditor', 'rules', 'sharedRules', 'taskEdits', 'taskView', 'docView'], { label: 'Step back one level', keys: 'Escape', run: (w, h) => stepBack(w, h) }),
  step: page(['nav', 'listOrder', 'toasts'], { label: 'Next task', keys: 'j', why: stepWhy, run: steps(1) }),
  'step-back': page(['nav', 'listOrder', 'toasts'], { label: 'Previous task', keys: 'k', why: stepWhy, run: steps(-1) }),
} satisfies Record<string, Action>

export type ActionId = keyof typeof ACTIONS

/** every action's id, in the table's order */
export const ACTION_IDS = Object.keys(ACTIONS) as ActionId[]

const typingIn = (el: Element | null) => /INPUT|TEXTAREA|SELECT/.test(el?.tagName || '') || !!(el as HTMLElement | null)?.isContentEditable

type BackWorld = Pick<ActionWorld, 'finder' | 'route' | 'nav' | 'media' | 'ui' | 'sheet' | 'sheets' | 'selection' | 'voice' | 'desk' | 'fields' | 'boxStore' | 'box' | 'docs' | 'docEditor' | 'rules' | 'sharedRules' | 'taskEdits' | 'taskView' | 'docView'>

/** Esc: one level back: the drawer, the sheet, a subtask being written, an edit, the search, a field, a web page over
 * the window, full width, the search's words, the task. */
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
  if (w.sheet.getState().spec?.req.kind === 'doc-edit') return w.docEditor.keep() // its text kept as a draft
  if (w.sheet.getState().spec) return w.sheets.close()
  const view = w.taskView.getState()
  if (view.subFor != null && typingIn(active)) return w.taskEdits.subLeave()
  if (view.editing != null) return w.taskEdits.leave()
  if (r.tab === 'rules' && (r.place.kind === 'tab' || r.place.kind === 'rules')) {
    // the rules (T693): the editor (kept as a draft), what you picked, then a page of them back to the rules
    const doc = w.docView.getState()
    if (doc.editing) return w.rules.keep()
    if (doc.quote || doc.sel.size || doc.reply) return w.docs.unpick()
    if (r.place.kind === 'rules' && !typingIn(active)) return w.rules.go({ kind: 'read' }, false)
    if (isSharedSlug(r.slug) && !typingIn(active)) return w.sharedRules.back() // a shared rule's page: back to the list (T779)
  }
  if (r.place.kind === 'doc') {
    // a document: its editor (kept as a draft), the area being drawn, what you picked, then the document itself
    const doc = w.docView.getState()
    if (doc.full) return doc.setFull(false) // a web page over the window: back to its pane (T751)
    if (doc.editing) return w.docEditor.keep()
    if (doc.circle) return doc.setCircle(false)
    if (doc.quote || doc.sel.size || doc.reply) return w.docs.unpick()
    if (doc.inspect) return doc.setInspect(false) // a web page's Comment mode
    // the phone's document is a sheet: Esc closes it, even from the box
    if (!w.desk() || !typingIn(active)) {
      if (w.desk() && w.route.getState().full) return w.nav.full(false)
      return w.docs.close()
    }
  }
  if (r.place.kind === 'settings' || r.place.kind === 'help' || (!w.desk() && r.place.kind === 'side')) {
    // Settings and Help: a field first, then back out of it
    if (typingIn(active)) return (active as HTMLElement).blur()
    if (w.boxStore.getState().mode?.kind === 'prefs') return w.box.stop()
    return w.nav.settingsBack()
  }
  if (w.desk()) {
    // the New input page opened from a task or a document: Esc in the empty box goes back there
    const boxEmpty = !(w.fields.get('box') as HTMLTextAreaElement | null)?.value.trim() && !w.boxStore.getState().files[w.boxStore.getState().shown.key]?.length
    if (r.place.kind === 'new' && w.fields.focused('box') && boxEmpty && w.nav.composeBack()) return
    if (typingIn(active)) return (active as HTMLElement).blur()
    if (w.route.getState().full) return w.nav.full(false)
    if (r.place.kind === 'new' && w.nav.composeBack()) return
    if (r.place.kind === 'task' && r.tab !== 'inputs') return w.nav.closeTask()
    return
  }
  // the phone's search page: Esc leaves it (a task opened from it goes back to it, below)
  if (layers.includes('search') && r.place.kind !== 'task' && r.place.kind !== 'doc') return w.finder.leave()
  if (r.place.kind === 'task' && !typingIn(active)) return w.nav.closeTask()
}

const lists = (h: Here) => h.r.tab !== 'inputs' && h.r.place.kind !== 'settings' && h.r.place.kind !== 'help' && !!h.m

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

  /** The project and task the page shows now. */
  here(): Here | null {
    const r = this.w.route.getState().route
    if (r.page !== 'project') return null
    const m = this.w.model(r.slug)
    const n = r.place.kind === 'task' && m ? liveN(m, Number(/\d+/.exec(r.place.ref)?.[0])) : null
    const it = n != null ? m?.byN.get(n) : undefined
    return { r, m, it, code: it && m ? codeOf(m, it.n) : '' }
  }

  /** Here, about another task than the open one (the menu of a row). */
  hereFor(n: number): Here | null {
    const h = this.here()
    const it = h?.m?.byN.get(n)
    return h && it && h.m ? { ...h, it, code: codeOf(h.m, n) } : null
  }

  /** Why it cannot be done here (said instead); null: it can. */
  why(id: ActionId, h: Here): string | null {
    const a = byId(id)
    if ('task' in a) {
      if (!onAnTask(h)) return a.none ?? (h.r.tab === 'inputs' || h.r.place.kind === 'new' ? 'Open a task in Tasks or Archive to use these keys' : 'First pick a task: J or a click')
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
    if (!('task' in a)) return a.run(given(this.w, a.uses), h) !== false
    return onAnTask(h) && a.run(given(this.w, a.uses), h) !== false
  }

  /** Do it on task `n`, open or not. */
  runOn(id: ActionId, n: number): boolean {
    const h = this.hereFor(n)
    return !!h && this.run(id, h)
  }

  /** S, P or T was pressed for this task: the key after it sets that field. -> whether it did */
  setArmed(h: Here, key: string): boolean {
    const it = h.it
    const k = it ? this.w.keyArm.take(it.n) : null
    const to = it && k ? armedSet(k, key, pageStatuses(it)) : null
    if (!it || !to) return false
    void this.w.tasks.change(it.n, to[0], to[1])
    return true
  }

  /** A choice of the question that waits on you (1-9). */
  pickChoice(h: Here, i: number): boolean {
    const it = h.it
    if (!it || it.wait?.kind !== 'ask' || askRowOf(it.thread, it.wait.id) || i >= this.w.answers.labels(it).length) return false
    this.w.answers.pick(it, i, choiceMulti(it.wait.text, i))
    return true
  }
}

/** The action these keys do, if any. */
export function actionOfKeys(keys: string): ActionId | null {
  return ACTION_IDS.find((id) => ACTIONS[id].keys === keys) ?? null
}

/** An action's keys as the page writes them: ⇧C, G P, ⌘K. */
export function keysShown(id: ActionId): string {
  const k = byId(id).keys
  if (!k) return ''
  return k
    .split(' ')
    .map((x) => (x === 'Meta+k' ? '⌘K' : x === 'Meta+Enter' ? '⌘↵' : /^[A-Z]$/.test(x) ? '⇧' + x : x.toUpperCase()))
    .join(' ')
}

/** The search's Actions: what can be done on the open task, then on the page, in the table's order. */
export function listedActions(task: boolean): { id: ActionId; label: string; keys: string; task: boolean; desk: boolean }[] {
  return ACTION_IDS.map((id) => [id, byId(id)] as const)
    .filter(([, a]) => a.listed && ('task' in a) === task)
    .map(([id, a]) => ({ id, label: typeof a.listed === 'string' ? a.listed : a.label, keys: keysShown(id), task: 'task' in a, desk: !!a.desk }))
}

/** The keys sheet (?): its groups of rows; a row made of actions shows their keys as the table has them. */
type HelpRow = { ids: ActionId[]; sep: string; text: string } | { keys: string; text: string }
const HELP: [string, HelpRow[]][] = [
  [
    'Move',
    [
      { ids: ['step', 'step-back'], sep: ' / ', text: 'Next or previous task' },
      { keys: 'O or ↵', text: 'Full width; Esc goes back' },
      { keys: 'Space', text: 'Scroll the task' },
      { keys: 'G then I N A R', text: 'Tasks, Inputs, Archive, Rules' },
      { keys: 'G then P', text: 'Switch project' },
      { keys: 'G then S', text: 'Settings' },
      { keys: 'G then D H X', text: 'Documents, Activity, Deleted' },
      { ids: ['sidebar'], sep: '', text: 'Toggle sidebar' },
    ],
  ],
  [
    'Act on the selected task',
    [
      { ids: ['next'], sep: '', text: "The task's next step: Accept, Approve, Answer or Reply" },
      { ids: ['reply'], sep: '', text: 'Reply or add to it' },
      { ids: ['not-yet'], sep: '', text: 'Not yet: back to in progress at once' },
      { keys: '1–9, ⌘↵', text: 'Pick a choice, send the answer' },
      { ids: ['done', 'drop', 'later'], sep: ' · ', text: `${TASK_ACTS.done.label} · ${TASK_ACTS.drop.label} · ${TASK_ACTS.later.label} / Now` },
      { ids: ['archive', 'archive-all'], sep: ' / ', text: 'Archive or unarchive / archive every finished task' },
      { ids: ['status', 'priority', 'tags'], sep: ' · ', text: "Status, priority (then the menu's digit), tags" },
      { ids: ['put-under', 'copy'], sep: ' · ', text: 'Put under… · Copy for agent' },
      { ids: ['edit', 'new-doc', 'add-sub'], sep: ' · ', text: 'Edit · New doc · Add subtask' },
      { ids: ['menu'], sep: '', text: 'All actions' },
      { ids: ['undo'], sep: '', text: 'Undo last action; older changes in Activity' },
    ],
  ],
  [
    'Mouse',
    [
      { keys: 'Hover a row', text: 'Quick actions' },
      { keys: 'Right-click a row', text: 'Task menu' },
      { keys: 'Click cut-off words', text: 'Show them all' },
      { keys: 'Drag a pane edge', text: 'Resize; double-click for the default' },
    ],
  ],
  [
    'Write and find',
    [
      { keys: '⌘ / ⇧ click', text: 'Select multiple rows to act on together' },
      { ids: ['new-input'], sep: '', text: 'New input' },
      { ids: ['voice-note'], sep: '', text: 'Voice note for the selected task; V again stops' },
      { ids: ['voice'], sep: '', text: 'New input by voice; ⇧V again stops and sends' },
      { keys: '⌥V', text: 'Voice note while typing' },
      { keys: '↵', text: 'While recording: stop, into the box' },
      { keys: '⇧↵ or ⌘↵', text: 'Send; while recording: stop and send' },
      { ids: ['search'], sep: '', text: 'Search every project (or /); the words of an action do it' },
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
