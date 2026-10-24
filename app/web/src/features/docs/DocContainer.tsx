// A document with the page's data: on the desktop in the pane beside the list (its bar: what it is, Edit, Move,
// Delete, the way back), on the phone in a sheet over its item. What it shows comes from the model and the document's
// view; what you do goes to app.docs.

import { useEffect, useMemo } from 'react'
import { useApp, useLayout, useStoreValue } from '../../app/context'
import { useProjectModel, type ProjectRoute } from '../../app/hooks'
import { usePaneRef } from '../../app/panes'
import { seenNow } from '../../model/docs'
import { codeOf, liveN } from '../../model/project'
import { factsOf } from './docFacts'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { useItemWorld } from '../item/ItemPageContainer'
import { PaneFrame } from '../item/PaneFrame'
import { DocPaneActs, DocPaneHead, DocPaneNav } from './DocPane'
import { DocView, type DocEvents } from './DocView'
import type { DocEnv } from './Thread'

const SIDE_NAME = { docs: 'Documents', log: 'Activity', deleted: 'Deleted' } as const

/** The document's view, with what it does. */
function useDoc(slug: string, dn: number) {
  const app = useApp()
  const desk = useLayout() === 'desk'
  const m = useProjectModel(slug)
  const v = useStoreValue(app.stores.docView, (s) => s)
  const asked = useStoreValue(app.stores.sheet, (s) => s.asked)
  const world = useItemWorld(m, slug)
  const d = m?.docs.find((x) => x.d === dn)
  const seen = app.seen.of(slug)
  const facts = useMemo(() => (m && d ? factsOf(m, d, v, seen, desk, asked, false) : null), [m, d, v, seen, desk, asked])
  useEffect(() => {
    // what the document shows now counts as seen
    if (d) for (const [k, t] of seenNow(seen, d)) app.seen.markKey(slug, k, t)
  })
  const env: DocEnv = { world, now: m?.at ?? 0, desk, tidy: true, play: () => ({ playing: false, t: null }), url: world.url }
  const docs = app.docs
  const on: DocEvents = {
    ref: (c) => {
      const to = m ? world.find(c) : null
      if (!to || !m) return
      if (to.kind === 'item') app.nav.openItem(codeOf(m, to.n))
      else if (to.kind === 'doc') docs.open(to.d)
    },
    picture: () => {},
    play: () => {},
    words: () => {},
    view: () => {},
    edit: (id) => docs.editComment(slug, dn, id),
    move: (id) => app.sheets.open({ kind: 'comment-move', d: dn, id }, { focus: false }),
    takeOff: (id, f) => docs.takeOff(dn, id, f),
    remove: (id) => docs.deleteComment(dn, id),
    resolve: (tk, on2) => docs.resolve(dn, tk, on2),
    reply: (tk) => docs.reply(tk),
    goItem: () => m && d && app.nav.openItem(codeOf(m, liveN(m, d.n))),
    toggle: (tk) => docs.toggle(tk),
    away: (tk) => docs.away(tk),
    pick: (key, quote, by) => docs.pick(key, quote, by),
    say: () => {},
    sayCancel: () => {},
    type: () => docs.type(),
    moveDoc: () => app.sheets.open({ kind: 'doc-move', d: dn }, { focus: false }),
    deleteDoc: () => docs.remove(dn),
    circle: () => app.stores.docView.getState().setCircle(!v.circle),
    quote: (key, text) => app.stores.docView.getState().pick({ quote: { key, text }, sel: new Set(), reply: null }),
    editDoc: () => {},
    whole: () => docs.whole(),
  }
  return { m, d, facts, env, on, v, desk }
}

/** The desktop's pane with a document. */
export function DocPaneContainer({ route, dn, place, hidden }: { route: ProjectRoute; dn: number; place: string; hidden?: boolean }) {
  const app = useApp()
  const pane = usePaneRef('detail')
  const side = useStoreValue(app.stores.route, (s) => s.side)
  const asked = useStoreValue(app.stores.sheet, (s) => s.asked)
  const { m, d, facts, env, on, v } = useDoc(route.slug, dn)
  if (!m || !d || !facts) return null
  const web = d.fmt === 'html'
  return (
    <PaneFrame
      place={place}
      hidden={hidden}
      desk
      paneRef={pane}
      head={<DocPaneHead d={d} editing={false} />}
      acts={<DocPaneActs web={web} inspect={v.inspect} deleting={!!asked['doc-delete ' + dn]} d={dn} on={{ inspect: () => app.stores.docView.getState().setInspect(!v.inspect), edit: on.editDoc, move: on.moveDoc, remove: on.deleteDoc }} />}
      lead={<DocPaneNav to={side ? SIDE_NAME[side] : codeOf(m, liveN(m, d.n))} onBack={() => app.docs.close()} />}
      onBack={() => app.docs.close()}
    >
      {/* a web page brings its own margins: none are added around it */}
      <div className={web ? 'w-full' : 'w-full px-8 pt-8 pb-12'}>
        <DocView facts={facts} env={env} on={on} />
      </div>
    </PaneFrame>
  )
}

/** The phone's sheet with a document, over its item. */
export function DocSheetContainer({ slug, dn, footRoom }: { slug: string; dn: number; footRoom: number }) {
  const app = useApp()
  const { m, d, facts, env, on, v } = useDoc(slug, dn)
  if (!m || !d || !facts) return null
  return (
    <Sheet open look={{ tall: true, aboveComposer: v.typing }} desk={false} footRoom={footRoom} onClose={() => app.docs.close()}>
      <SheetLayout title={`D${d.d}`} body={<DocView facts={facts} env={env} on={on} />} />
    </Sheet>
  )
}
