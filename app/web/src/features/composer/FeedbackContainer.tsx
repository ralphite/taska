// The line over the box with the page's data: what you sent is on its way, or what became of the last one you sent
// from here (once it says where it ended up, it goes after a while), and what its links do.

import { useEffect } from 'react'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { useProjectModel, type ProjectRoute } from '../../app/hooks'
import { feedbackLine } from '../../model/boxFoot'
import { showsOnItsWay } from '../../model/outgoing'
import type { DraftKey } from '../../model/draftTarget'
import { codeOf } from '../../model/project'
import { Feedback } from './Composer'

export function FeedbackContainer({ route, composePage, scope, boxKey }: { route: ProjectRoute; composePage: boolean; scope: string | null; boxKey: DraftKey }) {
  const app = useServices('box', 'fields', 'inputActions', 'inputs', 'nav', 'sheets')
  const stores = useStores('box', 'data', 'outbox', 'ui')
  const desk = useLayout() === 'desk'
  const m = useProjectModel(route.slug)
  const outbox = useStoreValue(stores.outbox, (s) => s.list)
  const justSent = useStoreValue(stores.box, (s) => s.sent)
  const lastSent = useStoreValue(stores.ui, (s) => s.lastSent)
  const projects = useStoreValue(stores.data, (s) => s.projects)
  const mine = outbox.filter((o) => o.slug === route.slug && !o.unsent && showsOnItsWay(o))
  // the input the line speaks of
  const sentRow = lastSent?.slug === route.slug && m ? m.byId.get(lastSent.rid) : undefined
  const feedback = feedbackLine({ m, desk, composePage, scope, mine, lastSent: lastSent?.slug === route.slug ? lastSent.rid : null, lastQ: lastSent?.q, others: (projects || []).some((p) => p.name !== route.slug), undoable: (q) => !!q && justSent.some((x) => x.q === q) })
  // a line that says where it ended up goes after a while
  useEffect(() => {
    if (!feedback?.final) return
    const t = window.setTimeout(() => stores.ui.getState().setLastSent(null), 6000)
    return () => clearTimeout(t)
  }, [app, stores, feedback?.final])
  return (
    <Feedback
      line={feedback?.line ?? null}
      on={{
        dismiss: () => stores.ui.getState().setLastSent(null),
        undo: () => {
          const q = mine[0]?.q ?? lastSent?.q
          if (q) app.box.unsend(q)
        },
        retry: () => void app.inputs.flush(),
        edit: () => app.box.editOutgoing(route.slug, boxKey) && app.fields.focus('box'),
        view: () => {
          const n = sentRow?.touched[0]
          if (m && n) app.nav.openItem(codeOf(m, n))
        },
        undoFiling: () => sentRow && app.inputActions.undoFiling(route.slug, sentRow.id),
        move: () => sentRow && app.sheets.open({ kind: 'input-move', id: sentRow.id }),
        retryOrganizer: () => sentRow && app.inputActions.organizeAgain(route.slug, sentRow.id),
      }}
    />
  )
}
