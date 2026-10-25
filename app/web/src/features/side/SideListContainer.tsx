// Documents, Activity and Deleted with the page's data, in the list's column; and the deleted thing picked there,
// shown in the pane beside it.

import { useEffect, useMemo } from 'react'
import { useServices, useStores, useStoreValue } from '../../app/context'
import { useProjectModel } from '../../app/hooks'
import { activityRows, logTarget } from '../../model/activity'
import { codeOf, type ProjectModel } from '../../model/project'
import { listedDocs } from '../../model/docs'
import { goneRows } from './goneRows'
import { ActivityList, DeletedList, DeletedView, DocsList, SideFrame, type ActivityRow, type DocRow, type Side } from './SideLists'

function useRestore(slug: string, m: ProjectModel | null) {
  const app = useServices('restores')
  return (key: string) => {
    if (!m) return
    const x = m.facts.deletedInputs.find((y) => y.id === key)
    if (x) return app.restores.input(slug, x.id)
    if (/^D\d+$/.test(key)) return void app.restores.doc(slug, Number(key.slice(1)))
    void app.restores.item(slug, key)
  }
}

export function SideListContainer({ slug, side }: { slug: string; side: Side }) {
  const app = useServices('activity', 'docs', 'nav', 'restores', 'sheets')
  const stores = useStores('activity', 'data', 'route', 'ui')
  const m = useProjectModel(slug)
  const route = useStoreValue(stores.route, (s) => s.route)
  const picked = useStoreValue(stores.ui, (s) => s.sideSel)
  const rows = useStoreValue(stores.activity, (s) => (s.slug === slug ? s.rows : null))
  const end = useStoreValue(stores.activity, (s) => s.slug === slug && s.end)
  const cursor = useStoreValue(stores.data, (s) => s.copies[slug]?.cursor ?? '')
  useEffect(() => {
    if (side === 'log' && cursor) void app.activity.show(slug, cursor) // what changed since shows too
  }, [app, side, slug, cursor])
  const restore = useRestore(slug, m)

  const docs = useMemo((): DocRow[] => (m ? listedDocs(m) : []), [m])
  const activity = useMemo((): ActivityRow[] | null => (m && rows ? activityRows(m, rows) : null), [m, rows])
  const gone = useMemo(() => (m ? goneRows(m) : []), [m])

  const openItem = (n: number) => m && app.nav.openItem(codeOf(m, n))
  const openInput = (id?: string) => (id ? app.nav.goInput(id, (x) => stores.ui.getState().setLit(x)) : app.nav.newInput())
  const count = side === 'docs' ? docs.length : side === 'deleted' ? gone.length : 0 // the log loads as you scroll
  return (
    <SideFrame side={side} count={count}>
      {side === 'docs' ? (
        <DocsList docs={docs} open={route.page === 'project' && route.place.kind === 'doc' ? route.place.d : null} onOpen={(d) => app.docs.open(d)} />
      ) : side === 'log' ? (
        <ActivityList
          rows={activity}
          end={end}
          picked={picked}
          on={{
            open: (key) => {
              const e = rows?.find((x) => '#' + x.seq === key)
              const to = m && e ? logTarget(m, e) : null
              if (!to) return
              stores.ui.getState().setSideSel(key)
              if ('n' in to) openItem(to.n)
              else if ('d' in to) app.docs.open(to.d)
              else openInput(to.id)
            },
            item: openItem,
            input: openInput,
            undo: (seq) => app.sheets.confirm('revert ' + seq) && void app.restores.revert(slug, seq),
            more: () => void app.activity.more(slug),
          }}
        />
      ) : (
        <DeletedList
          rows={gone}
          picked={picked}
          on={{
            show: (key) => {
              stores.ui.getState().setSideSel(key)
              if (route.page === 'project' && route.place.kind !== 'side') app.nav.side('deleted')
            },
            restore,
          }}
        />
      )}
    </SideFrame>
  )
}

/** The deleted thing picked in Deleted, beside the list. */
export function DeletedPickContainer({ slug }: { slug: string }) {
  const stores = useStores('ui')
  const m = useProjectModel(slug)
  const picked = useStoreValue(stores.ui, (s) => s.sideSel)
  const restore = useRestore(slug, m)
  const x = m && picked ? goneRows(m).find((g) => g.key === picked) : undefined
  return x ? <DeletedView x={x} onRestore={() => restore(x.key)} /> : null
}
