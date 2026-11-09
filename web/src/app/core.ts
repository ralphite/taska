// What every area of the page is made with (createApp makes it once): the API and the one delivery, the stores (one
// per concern), the page's own parts (toasts, navigation, sheets, the fields the keys reach), the change runner and a
// project as the page shows it (its data with your changes still on their way over it). The project open in the page
// is made last, so it is reached by `session()`.

import { Delivery } from '../api/delivery'
import type { Http } from '../api/http'
import { TaskaApi } from '../api/taska'
import type { ProjectModel } from '../model/project'
import { routeSlug } from '../model/route'
import { createActivityStore, type ActivityStore } from '../stores/activity'
import { createBoxStore, type BoxStore } from '../stores/box'
import { createChangesStore, type ChangesStore } from '../stores/changes'
import { createDataStore, type DataStore } from '../stores/data'
import { createDictationStore, type DictationStore } from '../stores/dictation'
import { createDocTicksStore, type DocTicksStore } from '../stores/docTicks'
import { createDocViewStore, type DocViewStore } from '../stores/docView'
import { createDraftsStore, type DraftsStore } from '../stores/drafts'
import { createDragStore, type DragStore } from '../stores/drag'
import { createFeedbackStore, type FeedbackStore } from '../stores/feedback'
import { createFindStore, type FindStore } from '../stores/find'
import { createGripsStore, type GripsStore } from '../stores/grips'
import { createItemViewStore, type ItemViewStore } from '../stores/itemView'
import { createKeptEditsStore, type KeptEditsStore } from '../stores/keptEdits'
import { createMediaStore, type MediaStore } from '../stores/media'
import { createOutboxStore, type OutboxStore } from '../stores/outbox'
import { createRecentStore, type RecentStore } from '../stores/recent'
import { createRecordingStore, type RecordingStore } from '../stores/recording'
import { createRouteStore, type History, type RouteStore } from '../stores/route'
import { createSettingsStore, type SettingsStore } from '../stores/settings'
import { createSheetStore, type SheetStore } from '../stores/sheet'
import { memoryStore, type KeyValueStore } from '../stores/storage'
import { createUiStore, type UiStore } from '../stores/ui'
import { createViewsStore, type ViewsStore } from '../stores/views'
import { ChangeRunner } from './changeRunner'
import { Fields } from './page/fields'
import { Navigation } from './page/navigation'
import { Sheets } from './page/sheets'
import { Toasts } from './page/toasts'
import { ProjectModels } from './project/projectModels'
import { Projects } from './project/projects'
import type { ProjectSession } from './project/projectSession'

export interface Stores {
  data: DataStore
  changes: ChangesStore
  outbox: OutboxStore
  feedback: FeedbackStore
  ui: UiStore
  itemView: ItemViewStore
  /** the search (F479): Home's field, the desktop's dialog, the phone's page */
  find: FindStore
  recent: RecentStore
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

/** The stores, one per concern; what a reload keeps is in `kv` (this tab's own in `session`). */
export function makeStores(kv: KeyValueStore, history: History, session: KeyValueStore): Stores {
  const kept = Projects.kept(kv)
  return {
    data: createDataStore(kept.rows, kept.needs, Date.now()),
    changes: createChangesStore(kv),
    outbox: createOutboxStore(kv),
    feedback: createFeedbackStore(kv),
    ui: createUiStore(kv),
    itemView: createItemViewStore(kv),
    find: createFindStore(),
    recent: createRecentStore(kv),
    drafts: createDraftsStore(kv),
    box: createBoxStore(session),
    sheet: createSheetStore(),
    route: createRouteStore(history),
    activity: createActivityStore(),
    docView: createDocViewStore(),
    docTicks: createDocTicksStore(kv),
    settings: createSettingsStore(),
    recording: createRecordingStore(),
    dictation: createDictationStore(),
    media: createMediaStore(),
    views: createViewsStore(),
    grips: createGripsStore(kv),
    drag: createDragStore(),
    keptEdits: createKeptEditsStore(kv),
  }
}

export interface Core {
  api: TaskaApi
  /** what has to reach Taska is asked until it answers; its pauses end at once when Taska may be back */
  delivery: Delivery
  s: Stores
  kv: KeyValueStore
  /** this tab's own store (what a reload of this tab keeps) */
  session: KeyValueStore
  desk(): boolean
  toasts: Toasts
  nav: Navigation
  sheets: Sheets
  fields: Fields
  runner: ChangeRunner
  /** a project as the page shows it now, with your pending changes over it */
  model(slug: string): ProjectModel | null
  /** the project the address names ('' none), and its model */
  slug(): string
  here(): ProjectModel | null
  /** a project's title, by its name */
  title(slug: string): string
  go(url: string): void
  /** a voice note is being recorded for the box */
  recording(): boolean
  /** the project open in the page */
  project(): ProjectSession
}

export function makeCore(env: { http?: Http; kv: KeyValueStore; session?: KeyValueStore; history: History; desk(): boolean }, project: () => ProjectSession): Core {
  const api = new TaskaApi(env.http)
  const session = env.session ?? memoryStore()
  const s = makeStores(env.kv, env.history, session)
  const toasts = new Toasts(s.feedback)
  const models = new ProjectModels({ data: s.data, changes: s.changes })
  const model = models.of
  const slug = () => routeSlug(s.route.getState().route)
  const delivery = new Delivery()
  return {
    api,
    delivery,
    s,
    kv: env.kv,
    session,
    desk: env.desk,
    toasts,
    nav: new Navigation(s.route, env.desk, (id, still) => s.ui.getState().setLit(id, still)),
    sheets: new Sheets(s.sheet, s.route, env.desk),
    fields: new Fields(),
    runner: new ChangeRunner(api, delivery, s.changes, {
      changes: (sl, a) => project().take(sl, a),
      stale: (sl) => project().stale(sl),
      cursor: (sl) => project().cursor(sl),
      refused: (c, why) => toasts.changeRefused(c, why),
      model: (sl) => model(sl),
    }),
    model,
    slug,
    here: () => model(slug()),
    title: (sl) => s.data.getState().projects?.find((p) => p.name === sl)?.title || sl,
    go: (url) => s.route.getState().go(url, true),
    recording: () => !!s.recording.getState().rec,
    project,
  }
}
