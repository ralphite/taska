// The composition root: the page's services, made once and handed to the components through React context. Each
// piece gets what it needs; nothing reaches for a global. Stories and tests make their own with fakes.

import { Http } from '../api/http'
import { TaskaApi } from '../api/taska'
import { merge, project, type ProjectModel, type ServerCopy } from '../model/project'
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
import { ProjectSync, type Presence } from '../sync/projectSync'
import { ChangeRunner, newId } from './changeRunner'
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
import { OtherTabs } from './otherTabs'
import { changePlace, changeText, changeWords } from '../model/saidOf'
import { Access } from './access'
import { createViewsStore, type ViewsStore } from '../stores/views'
import { createMediaStore, type MediaStore } from '../stores/media'
import { createDictationStore, type DictationStore } from '../stores/dictation'
import { memoryVault, type NoteVault } from '../stores/noteVault'
import { draftName } from '../model/words'
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
  const pictureSizes = new PictureSizes({ api, data })
  // a text showing a picture of unknown size (one just uploaded) asks for the sizes again
  const unsize = data.subscribe((s, was) => {
    for (const slug of Object.keys(s.copies)) if (s.copies[slug] !== was.copies[slug]) {
      const m = model(slug)
      if (m) pictureSizes.check(slug, m)
    }
  })
  const fields = new Fields()
  // the document shown is the address's: another one (or none) starts afresh
  const docShown = () => {
    const r = route.getState().route
    const d = r.page === 'project' && r.place.kind === 'doc' ? r.place.d : null
    // leaving a document being edited (on the desktop, in the pane) keeps its text as a draft
    const v = docView.getState()
    if (v.editing && v.newFor == null && d !== v.d) docs?.keep()
    v.show(d)
  }
  let docs: Docs | null = null
  docShown()
  const undoc = route.subscribe(docShown)
  const drafts = createDraftsStore(env.kv)
  const boxStore = createBoxStore(env.session ?? memoryStore())
  const sheetStore = createSheetStore()
  const sheets = new Sheets(sheetStore, route, env.desk)
  const unsheet = route.subscribe(() => {
    // Back closed it (an editor's text is kept as a draft)
    const was = sheetStore.getState().spec
    sheets.gone()
    if (was?.req.kind === 'doc-edit' && !sheetStore.getState().spec && docView.getState().editing) docs?.keep()
  })
  let sync: ProjectSync | null = null
  let projectsTimer = 0

  const currentSlug = () => {
    const r = route.getState().route
    return r.page === 'project' ? r.slug : ''
  }
  const memo = new Map<string, { copy: ServerCopy; pending: unknown; model: ProjectModel }>()
  const model = (slug: string): ProjectModel | null => {
    const copy = data.getState().copies[slug]
    if (!copy) return null
    const pending = changes.getState().list
    const hit = memo.get(slug)
    if (hit && hit.copy === copy && hit.pending === pending) return hit.model
    const mine = pending.filter((c) => c.slug === slug)
    const m = project(copy, mine.flatMap((c) => c.patches), Math.max(copy.at, ...mine.map((c) => c.t)), mine.flatMap((c) => c.inputPatches || []), mine.flatMap((c) => c.docPatches || []))
    memo.set(slug, { copy, pending, model: m })
    return m
  }
  const take = (slug: string, a: Parameters<ProjectSync['take']>[0]) => {
    if (sync?.slug === slug) sync.take(a)
    else data.getState().setCopy(slug, merge(data.getState().copies[slug] ?? null, a, Date.now()))
  }
  const stale = (slug: string) => {
    if (sync?.slug === slug) void sync.refresh()
  }
  const runner = new ChangeRunner(api, changes, {
    changes: take,
    stale,
    cursor: (slug) => (sync?.slug === slug ? sync.cursor : null),
    unreachable: () => {},
    refused: (c, why) => c.ownRefusal || toasts.notSaved({ what: changeWords(c.commands), why, slug: c.slug, go: changePlace(c.commands, c.slug), said: changeText(c.commands) }),
  })
  const inputs = new InputSender(api, outbox, {
    cursor: (slug) => (sync?.slug === slug ? sync.cursor : null),
    changes: take,
    stale,
    sent: (o, rid) => {
      // taken back while on its way: once Taska has it, it is deleted there behind you
      if (rid) boxStore.getState().sentAs(o.q, rid)
      if (o.unsent && rid) void runner.send({ id: newId(), slug: o.slug, commands: [{ op: 'delete', id: rid }], patches: [], said: `taking back ${rid}`, t: Date.now() })
      if (o.slug === currentSlug()) ui.getState().setLastSent(o.quiet || o.unsent ? null : { slug: o.slug, rid, q: o.q })
    },
    refused: (_o, why) => toasts.show(why ? `err: ${why}` : 'Not saved', null),
    log: () => {},
  })
  const items = new ItemActions({
    slug: currentSlug,
    model: () => model(currentSlug()),
    runner,
    toasts,
    ui,
    held: () => listHold.started(),
    listKey: () => {
      const r = route.getState().route
      return r.page === 'project' ? JSON.stringify([r.slug, r.tab, r.list]) : ''
    },
    openItem: () => {
      const r = route.getState().route
      if (r.page !== 'project' || r.place.kind !== 'item') return null
      const n = Number(/\d+/.exec(r.place.ref)?.[0])
      return Number.isFinite(n) ? n : null
    },
    desk: env.desk,
    rowHeight: (n) => rows.height(n),
    undoSeq: (n, f) => model(currentSlug())?.facts.undo.find((u) => u.n === n && f in u.f)?.seq ?? null,
    noteWith: () => false,
  })

  const inputActions = new InputActions({
    runner,
    toasts,
    api,
    model,
    refresh: (slug) => stale(slug),
    title: (slug) => data.getState().projects?.find((p) => p.name === slug)?.title || slug,
    go: (url) => route.getState().go(url, true),
  })
  // the other tabs of this browser: their drafts show here too
  const otherTabs = new OtherTabs({ kv: env.kv, drafts, box: boxStore, toasts, slug: () => currentSlug(), recording: () => !!recording.getState().rec })
  const box = new Box({ api, store: boxStore, drafts, outbox, inputs, runner, toasts, keep: (blob) => keep(blob), recording: () => !!recording.getState().rec, goDraft: (key) => goDraft(key), model, kv: env.kv, sent: (slug, key) => otherTabs.sent(slug, key), refresh: async (slug) => {
    if (sync?.slug === slug) await sync.refresh()
  } })
  const activity = new Activity({ api, store: activityStore, toasts })
  const restores = new Restores({ runner, toasts, inputs: inputActions, model })
  docs = new Docs({ runner, toasts, view: docView, nav, route, sheets, fields, desk: env.desk, model, box, boxStore, kv: env.kv, ticks: docTicks, inputs, mic: { stop: () => dictation.stop(), discard: (key) => dictation.discard(key), settled: (): Promise<boolean> => dictation.settled() } })
  const projects = new Projects({ api, data, kv: env.kv, toasts, home: () => route.getState().route.page === 'home' })
  const refreshProjects = () => projects.refresh()
  const settings = new Settings({ api, store: settingsStore, data, projects, route, sheets, toasts, box, boxStore, fields, refresh: (slug) => stale(slug) })
  const boxKeyNow = () => boxStore.getState().shown.key
  const voiceWords = new VoiceWords({ api, box, store: boxStore, toasts, fields })
  const voice = new Voice({
    api,
    store: recording,
    box,
    boxStore,
    outbox,
    toasts,
    fields,
    desk: env.desk,
    // what the draft holds goes to what it writes to (an item's draft: a reply to it; a new input's: a new input)
    send: (slug, key) => {
      const dm = /^doc (\d+)$/.exec(key)
      if (dm) return void docVoice.send(slug, Number(dm[1]), key) // a document's box: its voice comments, or a comment
      const scope = /^[A-Z]\d+$/.test(key) ? key : null
      if (key === boxKeyNow()) void box.send(slug, model(slug), scope)
      else {
        const { text, files } = box.take(slug, key)
        inputs.push({ slug, text, scope, files: files.map(({ key: k, ...f }) => ({ ...f, key: k })) })
      }
    },
    boxKey: () => boxKeyNow(),
    flush: () => void inputs.flush(),
    keep: (blob) => keep(blob),
    goDraft: (key) => goDraft(key),
    about: (a) => docVoice.about(a.d, a.key, a.quote),
  })
  const docVoice = new DocVoice({ voice, docs, box, boxStore, recording, view: docView, runner, changes, toasts, model, desk: env.desk, reply: (slug, key, scope) => void box.send(slug, model(slug), scope, key) })
  const dictation: Dictation = new Dictation({ api, store: dictationStore, view: docView, route, docs, fields, toasts, model, recording: () => !!recording.getState().rec })
  const views = new SavedViews({ api, store: viewsStore, nav, toasts, list: () => { const r = route.getState().route; return r.page === 'project' ? r.list : null } })
  const moves = new Moves({
    api,
    changes,
    toasts,
    model,
    title: (slug) => data.getState().projects?.find((p) => p.name === slug)?.title || slug,
    go: (url) => route.getState().go(url, true),
    refresh: (slug) => stale(slug),
  })
  const selection = new Selection({
    ui,
    order: listOrder,
    runner,
    toasts,
    slug: currentSlug,
    model: () => model(currentSlug()),
    open: () => {
      const r = route.getState().route
      return r.page === 'project' && r.place.kind === 'item' ? Number(/\d+/.exec(r.place.ref)?.[0]) || null : null
    },
  })
  const itemDrag = new ItemDrag({ store: dragStore, items, moves, slug: currentSlug, model: () => model(currentSlug()) })
  const media = new Media({ api, store: mediaStore, route, sheets, toasts, desk: env.desk })
  const keptNotes = new KeptNotes({
    vault: env.vault ?? memoryVault(),
    kv: env.kv,
    box: boxStore,
    outbox,
    inputs,
    toasts,
    resume: (slug, key, f, blob, scope) => (f.plain ? box.resume(slug, f.key, blob, f.name) : voice.resume(slug, key, f, blob, scope)),
    place: (slug, key, f) => voice.placeKept(slug, key, f),
    draftName,
    goDraft: (key) => goDraft(key),
    boxKey: () => boxKeyNow(),
  })
  function keep(blob: Blob): string {
    const rid = keptNotes.id()
    keptNotes.hold(rid, blob)
    return rid
  }
  // to the box a draft belongs to
  const goDraft = (key: string) => {
    const m = model(currentSlug())
    const dm = /^doc (\d+)$/.exec(key)
    const am = /^(edit|append) (\S+)$/.exec(key)
    if (key === 'new') nav.newInput()
    else if (dm) nav.openDoc(Number(dm[1]))
    else if (am && m) {
      nav.newInput()
      box.amendStart(currentSlug(), m, am[2], am[1] as 'edit' | 'append')
    } else if (/^[A-Z]\d+$/.test(key)) nav.openItem(key)
  }
  // a merged item gives way to the one it went into; what you wrote for it goes along
  const merges = new Merges({ route, drafts, box: boxStore, toasts, model, showItem: (code, tab) => nav.openItemHere(code, tab), goDraft })
  data.subscribe((s, was) => {
    const slug = currentSlug()
    if (slug && s.copies[slug] !== was.copies[slug]) merges.settle()
  })
  route.subscribe((s, was) => {
    if (s.route !== was.route) merges.settle()
  })
  const notices = new Notices(env.kv, () => settingsStore.getState().set({ noticeRev: settingsStore.getState().noticeRev + 1 }), { api, toasts, desk: env.desk, go: (url) => route.getState().go(url, true) })
  // the projects listed again: what newly needs you in the others
  data.subscribe((s, was) => {
    if (s.projects && s.projects !== was.projects) notices.projects(s.projects, currentSlug())
  })

  const access = new Access({ api, sheets, toasts, refresh: () => void sync?.refresh() })
  const updates = new Updates({
    api,
    toasts,
    session: env.session ?? memoryStore(),
    busy: () => !!recording.getState().rec || Object.values(boxStore.getState().files).some((fs) => fs.some((f) => f.uploading || f.transcribing)) || outbox.getState().list.some((o) => o.state === 'sending'),
    boot: async () => {
      const slug = currentSlug()
      const cur = slug ? data.getState().copies[slug]?.cursor : null
      if (!slug || !cur) return null
      return (await api.changes(slug, cur, 0)).cursor.split('.')[0] || null
    },
    reload: () => location.reload(),
    mine: env.pageScript ?? '',
  })
  const showProject = (slug: string) => {
    if (sync?.slug === slug) return
    sync?.close()
    ui.getState().reset()
    itemView.getState().show(slug)
    docTicks.getState().show(slug)
    void pictureSizes.load(slug)
    boxStore.getState().show(slug)
    keptNotes.reset()
    notices.fresh()
    drafts.getState().reload(slug)
    sync = new ProjectSync(slug, api, env.cache ?? noCache, {
      copy: (s, copy, fresh) => {
        data.getState().setCopy(s, copy)
        const m = fresh ? model(s) : null
        if (m) void keptNotes.restore(s, m)
        if (fresh) updates.seen(copy.server) // new code for Taska, or for this page
        if (m) notices.items(s, m) // what newly needs you here // what this browser kept that did not go out comes back
      },
      reach: (s, away) => {
        const was = data.getState().away[s] || 0
        data.getState().setAway(s, away)
        if (!away && was) {
          runner.back()
          inputs.back()
          activity.back()
        }
      },
      keyNeeded: () => access.ask(),
      gone: (s, how) => route.getState().go(`/?${how}=${encodeURIComponent(s)}`, true),
    }, env.presence)
    void sync.start()
  }

  // what did not go out before a reload goes now, in the order it was made
  for (const c of keptChanges(env.kv)) void runner.send(c)
  for (const o of keptOutgoing(env.kv)) outbox.getState().push(o)
  if (outbox.getState().list.length) void inputs.flush()

  projectsTimer = window.setInterval(() => {
    if (!env.presence.hidden()) void refreshProjects()
  }, 20000)
  // coming back to the window: what changed meanwhile, and what failed for want of the server goes now; the network
  // back: the same at once, and what waits to try again tries now, not after its pause
  const unwatch = env.presence.watch({
    back: () => {
      void sync?.refresh()
      void refreshProjects()
      inputs.back()
    },
    online: () => {
      void sync?.refresh()
      inputs.back()
      runner.back()
    },
  })

  return {
    api,
    stores: { data, changes, outbox, feedback, ui, itemView, search, drafts, box: boxStore, sheet: sheetStore, route, activity: activityStore, docView, docTicks, settings: settingsStore, recording, dictation: dictationStore, media: mediaStore, views: viewsStore, grips: gripsStore, drag: dragStore },
    toasts,
    items,
    inputs,
    nav,
    listHold,
    seen,
    rows,
    listOrder,
    crossSearch: new CrossSearch(api, search),
    answers: new Answers({ inputs, view: itemView, outbox }),
    fields,
    inputActions,
    box,
    sheets,
    moves,
    desk: env.desk,
    runner,
    model,
    showProject,
    projects,
    keyArm: new KeyArm(),
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
      projects.stop()
      sync?.close()
      clearInterval(projectsTimer)
      unwatch()
      unlisten()
      unsheet()
      undoc()
      unsize()
    },
  }
}
