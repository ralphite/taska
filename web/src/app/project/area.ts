// The project's part of the page, made together: the projects listed and changed, Settings, notices, the activity,
// what is restored, pictures' sizes, a newer page of Taska's, and the project open in the page (its copy and its
// change stream), made last since it hands what comes to the rest. `access` asks for the key; `busy` is what a reload
// now would lose.

import type { CopyCache } from '../../sync/cache'
import { noCache } from '../../sync/cache'
import type { Presence } from '../../sync/projectSync'
import type { Core } from '../core'
import type { InputsArea } from '../inputs/area'
import { Activity } from './activity'
import { Notices } from './notices'
import { PictureSizes } from './pictureSizes'
import { Projects } from './projects'
import { ProjectSession } from './projectSession'
import { Restores } from './restores'
import { Settings } from './settings'
import { Updates } from './updates'

export interface ProjectLinks {
  presence: Presence
  cache?: CopyCache
  /** the name of the page's main script, to tell when Taska has newer code than this page */
  pageScript?: string
  /** the key is needed: ask for it */
  keyNeeded(): void
  /** something being said or still on its way: a reload now would lose it */
  busy(): boolean
}

export function makeProject(c: Core, i: Pick<InputsArea, 'box' | 'inputActions' | 'keptNotes'>, l: ProjectLinks) {
  const { s, toasts } = c
  const pictureSizes = new PictureSizes({ api: c.api, data: s.data, model: c.model })
  const activity = new Activity({ api: c.api, store: s.activity, toasts })
  const restores = new Restores({ runner: c.runner, toasts, inputs: i.inputActions, model: c.model })
  const projects = new Projects({ api: c.api, delivery: c.delivery, data: s.data, kv: c.kv, toasts, home: () => s.route.getState().route.page === 'home' })
  const refreshProjects = () => projects.refresh()
  const settings = new Settings({ api: c.api, delivery: c.delivery, store: s.settings, data: s.data, projects, route: s.route, sheets: c.sheets, toasts, box: i.box, boxStore: s.box, fields: c.fields, refresh: (sl) => c.project().stale(sl) })
  const notices = new Notices(c.kv, () => s.settings.getState().set({ noticeRev: s.settings.getState().noticeRev + 1 }), { api: c.api, toasts, data: s.data, slug: c.slug, desk: c.desk, go: c.go })
  const updates = new Updates({ toasts, session: c.session, busy: l.busy, reload: () => location.reload(), mine: l.pageScript ?? '' })
  const projectSession = new ProjectSession({
    api: c.api,
    data: s.data,
    route: s.route,
    cache: l.cache ?? noCache,
    presence: l.presence,
    model: c.model,
    fresh: { ui: s.ui, itemView: s.itemView, keptEdits: s.keptEdits, docTicks: s.docTicks, box: s.box, drafts: s.drafts, pictureSizes, keptNotes: i.keptNotes, notices },
    server: (v) => updates.seen(v),
    // Taska may be back: what waits for it goes now (and the activity loads again once it answers)
    back: {
      window: () => c.delivery.back(),
      reached: () => {
        c.delivery.back()
        activity.back()
      },
      online: () => c.delivery.back(),
    },
    keyNeeded: l.keyNeeded,
    projects: refreshProjects,
  })
  return { pictureSizes, activity, restores, projects, refreshProjects, settings, notices, updates, projectSession }
}
