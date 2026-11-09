// The composition root: the page's services, made once and handed to the components through React context. It only
// assembles: each area of the page (app/<area>/area.ts: inputs, docs, voice, items, the page, the project) is made by
// its own factory from the core (app/core.ts: the API, the delivery, the stores, the page's own parts); what an area
// reaches in one made after it, it reaches by a function. The services a feature keeps for itself are made here.
// Stories and tests make their own with fakes.

import type { Http } from '../api/http'
import type { TaskaApi } from '../api/taska'
import type { ProjectModel } from '../model/project'
import { keptChanges } from '../stores/changes'
import { keptOutgoing } from '../stores/outbox'
import type { History } from '../stores/route'
import type { KeyValueStore } from '../stores/storage'
import type { NoteVault } from '../stores/noteVault'
import type { CopyCache } from '../sync/cache'
import type { Presence } from '../sync/projectSync'
import { Seen } from '../stores/seen'
import { ListHold } from '../features/list/listHold'
import { VoiceWords } from '../features/composer/voiceWords'
import { SavedViews } from '../features/list/views'
import { Access } from '../features/project/access'
import { Actions } from './actions'
import type { ChangeRunner } from './changeRunner'
import { makeCore, type Stores } from './core'
import { makeDocs } from './docs/area'
import type { DocChoices } from './docs/choices'
import type { DocComments } from './docs/comments'
import type { Docs } from './docs/docs'
import type { DocEditor } from './docs/editor'
import type { Rules } from './docs/rules'
import { makeInputs } from './inputs/area'
import type { Box } from './inputs/box'
import type { InputActions } from './inputs/inputActions'
import type { InputSender } from './inputs/inputSender'
import { makeItems } from './items/area'
import type { Answers } from './items/answers'
import type { ItemActions } from './items/itemActions'
import type { ItemDrag } from './items/itemDrag'
import type { ItemEdits } from './items/itemEdits'
import type { ListOrder } from './items/listOrder'
import type { Moves } from './items/moves'
import type { Selection } from './items/selection'
import { makePage } from './page/area'
import type { Diagrams } from './page/diagrams'
import type { Fields } from './page/fields'
import type { KeyArm } from './page/keyArm'
import type { Media } from './page/media'
import type { Navigation } from './page/navigation'
import type { Sheets } from './page/sheets'
import type { Toasts } from './page/toasts'
import { makeProject } from './project/area'
import type { Activity } from './project/activity'
import type { Notices } from './project/notices'
import type { Projects } from './project/projects'
import type { Restores } from './project/restores'
import type { Settings } from './project/settings'
import { Finder } from './search/finder'
import { makeVoice } from './voice/area'
import type { Dictation } from './voice/dictation'
import type { DocVoice } from './voice/docVoice'
import type { Voice } from './voice/voice'

export interface AppEnv {
  http?: Http
  kv: KeyValueStore
  /** this tab's own store (what a reload of this tab keeps) */
  session?: KeyValueStore
  history: History
  presence: Presence
  cache?: CopyCache
  /** voice notes and files not up yet, kept with their audio over a reload */
  vault?: NoteVault
  /** the name of the page's main script, to tell when Taska has newer code than this page */
  pageScript?: string
  /** the page's layout is the desktop's (the window is 64rem or wider) */
  desk(): boolean
}

export interface App {
  api: TaskaApi
  stores: Stores
  toasts: Toasts
  items: ItemActions
  inputs: InputSender
  nav: Navigation
  listHold: ListHold
  seen: Seen
  /** the list's items in the order it shows them, for Previous and Next */
  listOrder: ListOrder
  /** the search: listening, writing out, searching every project (F479; Home's field, ⌘K, the phone's page) */
  finder: Finder
  /** answering an agent's question by its choices */
  answers: Answers
  /** an item's editor and its subitem title: what you typed is kept */
  itemEdits: ItemEdits
  /** the table of actions, done here */
  actions: Actions
  /** the places the keys reach (the search, the box, the talk), given by ref */
  fields: Fields
  /** what you do to something you said */
  inputActions: InputActions
  /** the box: its drafts, files, sending */
  box: Box
  /** what floats over the page: sheets and menus */
  sheets: Sheets
  /** an item going to another project */
  moves: Moves
  desk(): boolean
  runner: ChangeRunner
  /** the project the page shows now, with your pending changes over it */
  model(slug: string): ProjectModel | null
  /** show a project: its copy, then its changes as they come */
  showProject(slug: string): void
  projects: Projects
  /** S, P or T pressed: the key after it sets that field */
  keyArm: KeyArm
  activity: Activity
  restores: Restores
  /** a document as you read it: open, close, what a comment goes to, its threads */
  docs: Docs
  /** the project's rules (I693): edited with why, restored, proposals decided, its pages */
  rules: Rules
  docComments: DocComments
  /** a document's choices, ticked and sent */
  docChoices: DocChoices
  /** the document itself: edited, saved or kept as a draft, made, deleted, moved */
  docEditor: DocEditor
  settings: Settings
  notices: Notices
  voice: Voice
  voiceWords: VoiceWords
  docVoice: DocVoice
  dictation: Dictation
  media: Media
  /** Mermaid diagrams in Markdown, drawn once per words and theme; a document's that does not draw goes to its writer */
  diagrams: Diagrams
  views: SavedViews
  itemDrag: ItemDrag
  selection: Selection
  access: Access
  refreshProjects(): Promise<boolean>
  stop(): void
}

export function createApp(env: AppEnv): App {
  const c = makeCore(env, () => project.projectSession)
  const { api, s, toasts, nav, sheets, fields, runner, model } = c
  const unlisten = env.history.listen(() => s.route.getState().read()) // Back and Forward
  const listHold = new ListHold(s.ui, env.desk)
  const seen = new Seen(env.kv)

  const inputs = makeInputs(c, { voice: () => voice.voice, docVoice: () => voice.docVoice, docs: () => docs.docs, docComments: () => docs.docComments, vault: env.vault })
  const docs = makeDocs(c, inputs, () => voice.dictation)
  const voice = makeVoice(c, inputs, docs)
  const items = makeItems(c, inputs, () => listHold.started())
  const page = makePage(c)
  const access = new Access({ api, sheets, toasts, refresh: () => void c.project().refresh() })
  const project = makeProject(c, inputs, { presence: env.presence, cache: env.cache, pageScript: env.pageScript, keyNeeded: () => access.ask(), busy: page.busy })

  // the services a feature keeps for itself
  const voiceWords = new VoiceWords({ api, delivery: c.delivery, box: inputs.box, store: s.box, toasts, fields })
  const views = new SavedViews({
    api,
    delivery: c.delivery,
    store: s.views,
    nav,
    toasts,
    list: () => {
      const r = s.route.getState().route
      return r.page === 'project' ? r.list : null
    },
  })
  const finder = new Finder({
    api,
    store: s.find,
    slug: c.slug,
    layer: (on) => nav.search(on),
    dialog: (on) => (on ? sheets.open({ kind: 'search' }, { search: true, focus: false }) : s.sheet.getState().spec?.req.kind === 'search' && sheets.close()),
    voiceSlug: () => c.slug() || s.data.getState().projects?.[0]?.name || '',
    delivery: c.delivery,
  })
  const { box } = inputs
  const { docs: docsOpen, docEditor, rules } = docs
  const { items: itemActions, itemEdits, answers, selection, listOrder } = items
  const actions = new Actions({ finder, items: itemActions, itemEdits, keyArm: page.keyArm, answers, toasts, nav, fields, sheets, docs: docsOpen, docEditor, rules, box, voice: voice.voice, media: page.media, selection, listOrder, route: s.route, ui: s.ui, feedback: s.feedback, sheet: s.sheet, itemView: s.itemView, docView: s.docView, boxStore: s.box, desk: env.desk, model })

  // what did not go out before a reload goes now, in the order it was made
  for (const k of keptChanges(env.kv)) void runner.send(k)
  for (const o of keptOutgoing(env.kv)) s.outbox.getState().push(o)
  if (s.outbox.getState().list.length) void inputs.inputs.flush()

  return {
    api,
    stores: s,
    toasts,
    items: itemActions,
    inputs: inputs.inputs,
    nav,
    listHold,
    seen,
    listOrder,
    finder,
    answers,
    itemEdits,
    fields,
    inputActions: inputs.inputActions,
    box,
    sheets,
    moves: items.moves,
    desk: env.desk,
    runner,
    model,
    showProject: (sl) => project.projectSession.show(sl),
    projects: project.projects,
    keyArm: page.keyArm,
    activity: project.activity,
    restores: project.restores,
    docs: docsOpen,
    docComments: docs.docComments,
    docChoices: docs.docChoices,
    docEditor,
    rules,
    settings: project.settings,
    notices: project.notices,
    voice: voice.voice,
    voiceWords,
    docVoice: voice.docVoice,
    dictation: voice.dictation,
    media: page.media,
    diagrams: page.diagrams,
    views,
    itemDrag: items.itemDrag,
    selection,
    access,
    refreshProjects: project.refreshProjects,
    stop: () => {
      for (const x of [project.projects, project.projectSession, project.pictureSizes, sheets, docsOpen, docEditor, items.merges, page.arrival, project.notices, page.pageErrors, page.leaveGuard]) x.stop()
      unlisten()
    },
    actions,
  }
}
