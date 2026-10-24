// The composition root: the page's services, made once and handed to the components through React context. It only
// assembles: each piece gets what it needs and watches what it follows itself; nothing reaches for a global. Stories
// and tests make their own with fakes.

import { Http } from '../api/http'
import { TaskaApi } from '../api/taska'
import type { ProjectModel } from '../model/project'
import { openItemN, routeSlug } from '../model/route'
import { createChangesStore, keptChanges, type ChangesStore } from '../stores/changes'
import { createDataStore, type DataStore } from '../stores/data'
import { createFeedbackStore, type FeedbackStore } from '../stores/feedback'
import { createOutboxStore, keptOutgoing, type OutboxStore } from '../stores/outbox'
import { createRouteStore, type History, type RouteStore } from '../stores/route'
import { memoryStore, type KeyValueStore } from '../stores/storage'
import { createBoxStore, type BoxStore } from '../stores/box'
import { createDraftsStore, type DraftsStore } from '../stores/drafts'
import { createItemViewStore, type ItemViewStore } from '../stores/itemView'
import { createSearchStore, type SearchStore } from '../stores/search'
import { createSheetStore, type SheetStore } from '../stores/sheet'
import { createUiStore, type UiStore } from '../stores/ui'
import { noCache, type CopyCache } from '../sync/cache'
import type { Presence } from '../sync/projectSync'
import { ChangeRunner } from './changeRunner'
import { InputActions } from './inputActions'
import { InputSender } from './inputSender'
import { ItemActions } from './itemActions'
import { Navigation } from './navigation'
import { ListHold } from './listHold'
import { Answers } from './answers'
import { Box } from './box'
import { CrossSearch } from './crossSearch'
import { Projects } from './projects'
import { KeyArm } from './keyArm'
import { PictureSizes } from './pictureSizes'
import { Activity } from './activity'
import { Restores } from './restores'
import { Docs } from './docs'
import { Settings } from './settings'
import { Notices } from './notices'
import { Voice } from './voice'
import { VoiceWords } from './voiceWords'
import { KeptNotes } from './keptNotes'
import { DocVoice } from './docVoice'
import { Dictation } from './dictation'
import { Media } from './media'
import { SavedViews } from './views'
import { createGripsStore, type GripsStore } from '../stores/grips'
import { createDragStore, type DragStore } from '../stores/drag'
import { ItemDrag } from './itemDrag'
import { Selection } from './selection'
import { Updates } from './updates'
import { Merges } from './merges'
import { DraftPlaces } from './draftPlaces'
import { draftName, type DraftKey } from '../model/draftTarget'
import { Actions } from './actions'
import { OtherTabs } from './otherTabs'
import { ItemEdits } from './itemEdits'
import { createKeptEditsStore, type KeptEditsStore } from '../stores/keptEdits'
import { Access } from './access'
import { createViewsStore, type ViewsStore } from '../stores/views'
import { createMediaStore, type MediaStore } from '../stores/media'
import { createDictationStore, type DictationStore } from '../stores/dictation'
import { memoryVault, type NoteVault } from '../stores/noteVault'
import { createRecordingStore, type RecordingStore } from '../stores/recording'
import { createSettingsStore, type SettingsStore } from '../stores/settings'
import { createDocViewStore, type DocViewStore } from '../stores/docView'
import { createDocTicksStore, type DocTicksStore } from '../stores/docTicks'
import { createActivityStore, type ActivityStore } from '../stores/activity'
import { Fields } from './fields'
import { ListOrder } from './listOrder'
import { Moves } from './moves'
import { RowSizes } from './rowSizes'
import { Sheets } from './sheets'
import { Seen } from '../stores/seen'
import { Toasts } from './toasts'
import { ProjectModels } from './projectModels'
import { ProjectSession } from './projectSession'
import { Delivered } from './delivered'
import { DraftSender } from './draftSender'
import { SideOver } from './sideOver'

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
  stores: {
    data: DataStore
    changes: ChangesStore
    outbox: OutboxStore
    feedback: FeedbackStore
    ui: UiStore
    itemView: ItemViewStore
    search: SearchStore
    drafts: DraftsStore
    box: BoxStore
    sheet: SheetStore
    route: RouteStore
    activity: ActivityStore
    docView: DocViewStore
    docTicks: DocTicksStore
    settings: SettingsStore
    recording: RecordingStore
    dictation: DictationStore
    media: MediaStore
    views: ViewsStore
    grips: GripsStore
    drag: DragStore
    keptEdits: KeptEditsStore
  }
  toasts: Toasts
  items: ItemActions
  inputs: InputSender
  nav: Navigation
  listHold: ListHold
  seen: Seen
  /** the list's rows give their elements here, for their heights */
  rows: RowSizes
  /** the list's items in the order it shows them, for Previous and Next */
  listOrder: ListOrder
  /** the list's search, in the other projects */
  crossSearch: CrossSearch
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
  docs: Docs
  settings: Settings
  notices: Notices
  voice: Voice
  voiceWords: VoiceWords
  docVoice: DocVoice
  dictation: Dictation
  media: Media
  views: SavedViews
  itemDrag: ItemDrag
  selection: Selection
  access: Access
  refreshProjects(): Promise<boolean>
  stop(): void
}

export function createApp(env: AppEnv): App {
  const api = new TaskaApi(env.http)
  const kept = Projects.kept(env.kv)
  const data = createDataStore(kept.rows, kept.needs, Date.now())
  const changes = createChangesStore(env.kv)
  const outbox = createOutboxStore(env.kv)
  const feedback = createFeedbackStore(env.kv)
  const ui = createUiStore(env.kv)
  const route = createRouteStore(env.history)
  const unlisten = env.history.listen(() => route.getState().read()) // Back and Forward
  const toasts = new Toasts(feedback)
  const nav = new Navigation(route, env.desk)
  const listHold = new ListHold(ui, env.desk)
  const seen = new Seen(env.kv)
  const rows = new RowSizes()
  const listOrder = new ListOrder()
  const itemView = createItemViewStore(env.kv)
  const keptEdits = createKeptEditsStore(env.kv)
  const search = createSearchStore()
  const activityStore = createActivityStore()
  const docView = createDocViewStore()
  const docTicks = createDocTicksStore(env.kv)
  const settingsStore = createSettingsStore()
  const recording = createRecordingStore()
  const dictationStore = createDictationStore()
  const mediaStore = createMediaStore()
  const viewsStore = createViewsStore()
  const gripsStore = createGripsStore(env.kv)
  const dragStore = createDragStore()
  const drafts = createDraftsStore(env.kv)
  const boxStore = createBoxStore(env.session ?? memoryStore())
  const sheetStore = createSheetStore()

  const slug = () => routeSlug(route.getState().route)
  const models = new ProjectModels({ data, changes })
  const model = models.of
  const here = () => model(slug())
  const title = (s: string) => data.getState().projects?.find((p) => p.name === s)?.title || s
  const goUrl = (url: string) => route.getState().go(url, true)
  const recordingNow = () => !!recording.getState().rec
  // the project open in the page (made last: what it needs is made below)
  const session = (): ProjectSession => projectSession
  const keep = (blob: Blob) => keptNotes.keep(blob)
  const goDraft = (key: DraftKey) => draftPlaces.go(key)

  const pictureSizes = new PictureSizes({ api, data, model })
  const fields = new Fields()
  const sheets = new Sheets(sheetStore, route, env.desk)
  const runner = new ChangeRunner(api, changes, {
    changes: (s, a) => session().take(s, a),
    stale: (s) => session().stale(s),
    cursor: (s) => session().cursor(s),
    unreachable: () => {},
    refused: (c, why) => toasts.changeRefused(c, why),
  })
  const delivered = new Delivered({ box: boxStore, ui, route, runner, toasts, model, slug, desk: env.desk })
  const inputs = new InputSender(api, outbox, {
    cursor: (s) => session().cursor(s),
    changes: (s, a) => session().take(s, a),
    stale: (s) => session().stale(s),
    sent: (o, rid) => delivered.sent(o, rid),
    refused: (_o, why) => toasts.show(why ? `err: ${why}` : 'Not saved', null),
    log: () => {},
  })
  const items = new ItemActions({
    slug,
    model: here,
    runner,
    toasts,
    ui,
    held: () => listHold.started(),
    listKey: () => {
      const r = route.getState().route
      return r.page === 'project' ? JSON.stringify([r.slug, r.tab, r.list]) : ''
    },
    openItem: () => openItemN(route.getState().route),
    desk: env.desk,
    rowHeight: (n) => rows.height(n),
    undoSeq: (n, f) => here()?.facts.undo.find((u) => u.n === n && f in u.f)?.seq ?? null,
    noteWith: () => false,
  })
  const inputActions = new InputActions({ runner, toasts, api, model, refresh: (s) => session().stale(s), title, go: goUrl })
  // the other tabs of this browser: their drafts show here too
  const otherTabs = new OtherTabs({ kv: env.kv, drafts, box: boxStore, toasts, slug, recording: recordingNow })
  const box = new Box({ api, store: boxStore, drafts, outbox, inputs, runner, toasts, keep, recording: recordingNow, goDraft, model, kv: env.kv, sent: (s, key) => otherTabs.sent(s, key), refresh: (s) => session().refresh(s) })
  const activity = new Activity({ api, store: activityStore, toasts })
  const restores = new Restores({ runner, toasts, inputs: inputActions, model })
  const docs = new Docs({ runner, changes, toasts, view: docView, nav, route, sheets, fields, desk: env.desk, model, box, boxStore, kv: env.kv, ticks: docTicks, inputs, mic: { stop: () => dictation.stop(), discard: (key) => dictation.discard(key), settled: () => dictation.settled() } })
  const projects = new Projects({ api, data, kv: env.kv, toasts, home: () => route.getState().route.page === 'home' })
  const refreshProjects = () => projects.refresh()
  const settings = new Settings({ api, store: settingsStore, data, projects, route, sheets, toasts, box, boxStore, fields, refresh: (s) => session().stale(s) })
  const voiceWords = new VoiceWords({ api, box, store: boxStore, toasts, fields })
  const draftSender = new DraftSender({ box, boxStore, inputs, docVoice: () => docVoice, model })
  const voice = new Voice({
    api,
    store: recording,
    box,
    boxStore,
    outbox,
    toasts,
    fields,
    desk: env.desk,
    send: (s, key) => draftSender.send(s, key),
    boxKey: () => boxStore.getState().shown.key,
    flush: () => void inputs.flush(),
    keep,
    goDraft,
    about: (a) => docVoice.about(a.d, a.key, a.quote),
  })
  const docVoice = new DocVoice({ voice, docs, box, boxStore, recording, view: docView, runner, changes, toasts, model, desk: env.desk, reply: (s, key, scope) => void box.send(s, model(s), scope, key) })
  const dictation: Dictation = new Dictation({ api, store: dictationStore, view: docView, route, docs, fields, toasts, model, recording: recordingNow })
  const views = new SavedViews({ api, store: viewsStore, nav, toasts, list: () => { const r = route.getState().route; return r.page === 'project' ? r.list : null } })
  const moves = new Moves({ api, changes, toasts, model, title, go: goUrl, refresh: (s) => session().stale(s) })
  const selection = new Selection({ ui, order: listOrder, runner, toasts, slug, model: here, open: () => openItemN(route.getState().route) })
  const itemDrag = new ItemDrag({ store: dragStore, items, moves, slug, model: here })
  const media = new Media({ api, store: mediaStore, route, sheets, toasts, desk: env.desk })
  const itemEdits = new ItemEdits({ view: itemView, kept: keptEdits, route, toasts, desk: env.desk, model: here })
  const keyArm = new KeyArm()
  const answers = new Answers({ inputs, view: itemView, outbox })
  const actions = new Actions({ items, itemEdits, keyArm, answers, toasts, nav, fields, sheets, docs, box, voice, media, selection, listOrder, route, ui, feedback, sheet: sheetStore, itemView, docView, boxStore, desk: env.desk, model })
  const keptNotes: KeptNotes = new KeptNotes({
    vault: env.vault ?? memoryVault(),
    kv: env.kv,
    box: boxStore,
    outbox,
    inputs,
    toasts,
    resume: (s, key, f, blob, scope) => (f.plain ? box.resume(s, f.key, blob, f.name) : voice.resume(s, key, f, blob, scope)),
    place: (s, key, f) => voice.placeKept(s, key, f),
    draftName,
    goDraft,
    boxKey: () => boxStore.getState().shown.key,
  })
  // where a draft belongs, to go there
  const draftPlaces: DraftPlaces = new DraftPlaces({ route, nav, box, docs: () => docs, fields, toasts, slug, model })
  // a merged item gives way to the one it went into; what you wrote for it goes along
  const merges = new Merges({ route, data, drafts, box: boxStore, toasts, model, showItem: (code, tab) => nav.openItemHere(code, tab), goDraft })
  const sideOver = new SideOver(route, ui)
  const notices = new Notices(env.kv, () => settingsStore.getState().set({ noticeRev: settingsStore.getState().noticeRev + 1 }), { api, toasts, data, slug, desk: env.desk, go: goUrl })
  const access = new Access({ api, sheets, toasts, refresh: () => void session().refresh() })
  const updates = new Updates({
    api,
    toasts,
    session: env.session ?? memoryStore(),
    busy: () => recordingNow() || Object.values(boxStore.getState().files).some((fs) => fs.some((f) => f.uploading || f.transcribing)) || outbox.getState().list.some((o) => o.state === 'sending'),
    boot: async () => {
      const s = slug()
      const cur = s ? data.getState().copies[s]?.cursor : null
      if (!s || !cur) return null
      return (await api.changes(s, cur, 0)).cursor.split('.')[0] || null
    },
    reload: () => location.reload(),
    mine: env.pageScript ?? '',
  })
  const projectSession = new ProjectSession({
    api,
    data,
    route,
    cache: env.cache ?? noCache,
    presence: env.presence,
    model,
    fresh: { ui, itemView, keptEdits, docTicks, box: boxStore, drafts, pictureSizes, keptNotes, notices },
    server: (v) => updates.seen(v),
    back: {
      window: () => inputs.back(),
      reached: () => {
        runner.back()
        inputs.back()
        activity.back()
      },
      online: () => {
        inputs.back()
        runner.back()
      },
    },
    keyNeeded: () => access.ask(),
    projects: refreshProjects,
  })

  // what did not go out before a reload goes now, in the order it was made
  for (const c of keptChanges(env.kv)) void runner.send(c)
  for (const o of keptOutgoing(env.kv)) outbox.getState().push(o)
  if (outbox.getState().list.length) void inputs.flush()

  const app: App = {
    api,
    stores: { data, changes, outbox, feedback, ui, itemView, search, drafts, box: boxStore, sheet: sheetStore, route, activity: activityStore, docView, docTicks, settings: settingsStore, recording, dictation: dictationStore, media: mediaStore, views: viewsStore, grips: gripsStore, drag: dragStore, keptEdits },
    toasts,
    items,
    inputs,
    nav,
    listHold,
    seen,
    rows,
    listOrder,
    crossSearch: new CrossSearch(api, search),
    answers,
    itemEdits,
    fields,
    inputActions,
    box,
    sheets,
    moves,
    desk: env.desk,
    runner,
    model,
    showProject: (s) => projectSession.show(s),
    projects,
    keyArm,
    activity,
    restores,
    docs,
    settings,
    notices,
    voice,
    voiceWords,
    docVoice,
    dictation,
    media,
    views,
    itemDrag,
    selection,
    access,
    refreshProjects,
    stop: () => {
      for (const s of [projects, projectSession, pictureSizes, sheets, docs, merges, sideOver, notices]) s.stop()
      unlisten()
    },
    actions,
  }
  return app
}
