// The project's menu (from the sidebar) and the list of what was not saved, with what they do.

import { useServices, useStores, useStoreValue } from '../../app/context'
import { useProjectModel, useProjectRoute } from '../../app/hooks'
import { openCount } from '../../model/visible'
import type { SheetRequest } from '../../stores/sheet'
import { SheetLayout } from '../../ui/Sheet'
import { toneOf } from '../../ui/tones'
import { useSideProjects } from '../../app/projectLists'
import { notSavedSheet } from './NotSaved'
import { notSavedRows } from './notSavedRows'
import { projectMenuSheet } from '../../ui/ProjectSheets'

export function ProjectMenuSheet({ req }: { req: Extract<SheetRequest, { kind: 'project-menu' }> }) {
  const app = useServices('nav', 'sheets')
  const stores = useStores('data')
  const route = useProjectRoute()
  const here = route?.slug === req.slug
  const m = useProjectModel(req.slug)
  const { tones } = useSideProjects(route?.slug ?? '')
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
        { here, slug: req.slug, title, tone: toneOf(tones, req.slug), open },
        {
          open: done(() => app.nav.to(`/p/${encodeURIComponent(req.slug)}/`)),
          settings: done(() => app.nav.to(`/p/${encodeURIComponent(req.slug)}/settings`)),
          manage: done(() => app.nav.to(base + 'projects')),
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
    retry: (sid) => {
      app.toasts.retryNotSaved(sid)
      if (!stores.feedback.getState().notSaved.length) app.sheets.close()
    },
    drop: (sid) => {
      stores.feedback.getState().dropNotSaved(sid)
      if (!stores.feedback.getState().notSaved.length) app.sheets.close()
    },
  })
  if (!parts) return null
  return <SheetLayout {...parts} />
}
