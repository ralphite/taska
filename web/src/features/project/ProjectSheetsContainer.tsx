// The project's menu (from the sidebar) and the list of what was not saved, with what they do.

import { useState } from 'react'
import { keysShown } from '../../app/actions'
import { useServices, useStores, useStoreValue } from '../../app/context'
import { useProjectModel, useProjectRoute } from '../../app/hooks'
import { openCount } from '../../model/visible'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { newProjectTone, toneOf } from '../../ui/tones'
import { NewProjectForm } from '../../ui/NewProjectForm'
import { useSideProjects } from '../../app/projectLists'
import { notSavedSheet } from './NotSaved'
import { notSavedRows } from './notSavedRows'
import { goneProjectMenuSheet, projectMenuSheet } from '../../ui/ProjectSheets'

/** New project (D115 #7): its name and its tile as it will be; made, it opens. */
export function NewProjectSheet() {
  const app = useServices('nav', 'projects', 'sheets')
  const stores = useStores('data')
  const names = useStoreValue(stores.data, (s) => s.projects)?.map((p) => p.name) ?? []
  const [error, setError] = useState('')
  return (
    <SheetLayout
      title="New project"
      body={
        <div className="pb-1">
          <NewProjectForm
            error={error}
            tone={(name) => newProjectTone(names, name)}
            onCreate={(title) =>
              void app.projects.create(title).then((r) => {
                if (!('name' in r)) return setError(r.error)
                app.sheets.close(() => app.nav.to(`/p/${encodeURIComponent(r.name)}/`))
              })
            }
            onCancel={() => app.sheets.close()}
          />
        </div>
      }
    />
  )
}

export function ProjectMenuSheet({ req }: { req: Extract<SheetRequest, { kind: 'project-menu' }> }) {
  return req.gone != null ? <GoneProjectMenu slug={req.slug} title={req.gone} /> : <LiveProjectMenu req={req} />
}

function GoneProjectMenu({ slug, title }: { slug: string; title: string }) {
  const app = useServices('settings', 'sheets')
  const stores = useStores('sheet')
  const asking = useStoreValue(stores.sheet, (s) => !!s.asked['purge ' + slug])
  // the first tap asks again (the menu stays); the second deletes it for good and the menu goes
  return <SheetLayout {...goneProjectMenuSheet({ title, asking }, () => (void app.settings.purge(slug), asking && app.sheets.close()))} />
}

function LiveProjectMenu({ req }: { req: Extract<SheetRequest, { kind: 'project-menu' }> }) {
  const app = useServices('nav', 'settings', 'sheets')
  const stores = useStores('data')
  const route = useProjectRoute()
  const here = route?.slug === req.slug
  const m = useProjectModel(req.slug)
  const { tones, icons } = useSideProjects(route?.slug ?? '')
  const rows = useStoreValue(stores.data, (s) => s.projects)
  const row = rows?.find((p) => p.name === req.slug)
  const title = (here && m?.facts.title) || row?.title || req.slug
  const open = here && m ? openCount(m.items) : (row?.open ?? '')
  const done = (run: () => void) => () => {
    app.sheets.close()
    run()
  }
  const base = route ? `/p/${encodeURIComponent(route.slug)}/` : '/'
  return (
    <SheetLayout
      {...projectMenuSheet(
        { here, slug: req.slug, title, tone: toneOf(tones, req.slug), icon: icons.get(req.slug), open, settingsKeys: keysShown('settings') },
        {
          open: done(() => app.nav.to(`/p/${encodeURIComponent(req.slug)}/`)),
          settings: done(() => app.nav.to(`/p/${encodeURIComponent(req.slug)}/settings`)),
          // renamed where projects are named (Settings › Projects); deleted at once, Undo brings it back
          rename: done(() => (app.nav.to(base + 'projects'), app.settings.rename(req.slug))),
          remove: done(() => void app.settings.remove(req.slug, route?.slug ?? '')),
        },
      )}
    />
  )
}

export function NotSavedSheet() {
  const app = useServices('nav', 'sheets', 'toasts')
  const stores = useStores('data', 'feedback')
  const route = useProjectRoute()
  const list = useStoreValue(stores.feedback, (s) => s.notSaved)
  const titles = useStoreValue(stores.data, (s) => s.projects)
  // its times are told against the time the project's news last came
  const now = useProjectModel(route?.slug ?? '')?.at
  const rows = notSavedRows(list, route?.slug ?? null, (slug) => titles?.find((p) => p.name === slug)?.title || slug, now)
  const parts = notSavedSheet(rows, {
    go: (url) => {
      app.sheets.close()
      app.nav.to(url)
    },
    drop: (sid) => {
      stores.feedback.getState().dropNotSaved(sid)
      if (!stores.feedback.getState().notSaved.length) app.sheets.close()
    },
  })
  if (!parts) return null
  return <SheetLayout {...parts} />
}
