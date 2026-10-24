// A document with the page's data: on the desktop in the pane beside the list (its bar: what it is, Edit, Move,
// Delete, the way back), on the phone in a sheet over its item. What it shows comes from the model and the document's
// view; what you do goes to app.docs.

import { useEffect, useMemo } from 'react'
import { useApp, useLayout, useStoreValue } from '../../app/context'
import { useProjectModel, type ProjectRoute } from '../../app/hooks'
import { usePaneRef } from '../../app/panes'
import { resolved, seenNow, threadNew, threadsOf } from '../../model/docs'
import type { Doc } from '../../model/types'
import type { DocViewState } from '../../stores/docView'
import { runAction } from '../../app/actions'
import { WebPage } from './WebPage'
import { Lasso } from './Lasso'
import { Thread } from './Thread'
import { codeOf, liveN } from '../../model/project'
import { factsOf } from './docFacts'
import { notSent } from '../../model/voiceComments'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { useItemWorld } from '../item/ItemPageContainer'
import { PaneFrame } from '../item/PaneFrame'
import { DocPaneActs, DocPaneHead, DocPaneNav } from './DocPane'
import { DocEditContainer } from './DocEditContainer'
import { DocView, SayRow, type DocEvents } from './DocView'
import type { DocEnv } from './Thread'

const SIDE_NAME = { docs: 'Documents', log: 'Activity', deleted: 'Deleted' } as const

/** The document's view, with what it does. */
function useDoc(slug: string, dn: number) {
  const app = useApp()
  const desk = useLayout() === 'desk'
  const m = useProjectModel(slug)
  const v = useStoreValue(app.stores.docView, (s) => s)
  const asked = useStoreValue(app.stores.sheet, (s) => s.asked)
  const ticks = useStoreValue(app.stores.docTicks, (s) => s)
  const world = useItemWorld(m, slug)
  const d = m?.docs.find((x) => x.d === dn)
  const seen = app.seen.of(slug)
  // the paragraph whose own mic records a comment about it
  // (read as one word, so the document is not drawn again at every moment of sound)
  const said = useStoreValue(app.stores.recording, (s) => (s.rec ? JSON.stringify({ key: s.rec.about?.d === dn ? s.rec.about.key : null, bar: !!s.rec.about?.bar }) : ''))
  const speaking = useMemo(() => (said ? (JSON.parse(said) as { key: string | null; bar: boolean }) : null), [said])
  // voice comments in the box not sent yet show where they will go
  const draft = useStoreValue(app.stores.drafts, (s) => s.bySlug[slug]?.[`doc ${dn}`] ?? '')
  const draftFiles = useStoreValue(app.stores.box, (s) => s.files[`doc ${dn}`])
  const marks = useStoreValue(app.stores.box, (s) => s.marks)
  const waiting = useMemo(() => notSent(draft, draftFiles || [], marks, dn), [draft, draftFiles, marks, dn])
  const facts = useMemo(() => (m && d ? factsOf(m, d, v, seen, desk, asked, speaking, ticks, waiting) : null), [m, d, v, seen, desk, asked, speaking, ticks, waiting])
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
    say: (key, quote) => void app.docVoice.say(slug, dn, key, quote ?? d?.blocks.find((b) => b.key === key)?.text ?? ''),
    sayCancel: () => void app.voice.cancel(),
    type: () => docs.type(),
    moveDoc: () => app.sheets.open({ kind: 'doc-move', d: dn }, { focus: false }),
    deleteDoc: () => docs.remove(dn),
    circle: () => app.stores.docView.getState().setCircle(!v.circle),
    quote: (key, text) => app.stores.docView.getState().pick({ quote: { key, text }, sel: new Set(), reply: null }),
    editDoc: () => docs.edit(dn),
    whole: () => docs.whole(),
    tick: (tk, i) => docs.tick(dn, tk, i),
    modifyTicks: (tk) => docs.modifyTicks(dn, tk),
  }
  const page = d?.fmt === 'html' && m ? <WebPageContainer slug={slug} d={d} v={v} seen={seen} env={env} on={on} /> : null
  return { m, d, facts, env, on, v, desk, page }
}

/** A web page document's own view, with its threads. */
function WebPageContainer({ slug, d, v, seen, env, on }: { slug: string; d: Doc; v: DocViewState; seen: Readonly<Record<string, string>>; env: DocEnv; on: DocEvents }) {
  const app = useApp()
  const asked = useStoreValue(app.stores.sheet, (s) => s.asked)
  const all = d.blocks.flatMap((b) => threadsOf(b.comments).map((t) => ({ t, key: b.key })))
  const threads = all.map(({ t, key }) => ({ tk: t.tk, key, quote: t.quote, n: t.comments.length, done: resolved(d, t.tk) }))
  // the part spoken about: the mic pressed turns into Stop right there, and no other part lights
  const spoken = useStoreValue(app.stores.recording, (s) => {
    const a = s.rec?.about
    return a && a.d === d.d && a.key?.startsWith('h:') && !a.bar ? JSON.stringify({ key: a.key, text: a.quote }) : ''
  })
  const rec = !!spoken
  const held = useMemo(() => (spoken ? (JSON.parse(spoken) as { key: string; text: string }) : v.quote?.key.startsWith('h:') ? v.quote : null), [spoken, v.quote])
  const open = all.find(({ t, key }) => v.threads.has(t.tk) || v.threads.has(key))?.t.tk ?? null
  const thread = (tk: string, rail: boolean) => {
    const x = all.find((y) => y.t.tk === tk)
    if (!x) return null
    return <Thread t={x.t} rail={rail} isNew={threadNew(seen, d, x.key, x.t.comments)} done={resolved(d, tk)} replying={v.reply === tk} asking={Object.keys(asked).find((k) => k.startsWith(`unfile ${d.d} `))?.slice(`unfile ${d.d} `.length) ?? null} env={env} on={on} />
  }
  return (
    <WebPage
      title={d.title}
      html={d.md}
      threads={threads}
      held={held}
      open={open}
      desk={env.desk}
      inspect={v.inspect}
      renderThread={thread}
      sayRow={<SayRow rec={rec} on={{ say: () => held && void app.docVoice.say(slug, d.d, held.key, held.text, true), cancel: () => void app.voice.cancel(), type: () => app.docs.type() }} />}
      on={{
        pick: (p) => {
          app.stores.docView.getState().pick({ quote: p, sel: new Set(), reply: null })
          if (env.desk) app.fields.get('box')?.focus({ preventScroll: true })
        },
        say: (part) => void app.docVoice.say(slug, d.d, part.key, part.text, true),
        esc: () => runAction(app, 'back'),
        toggle: (tk) => app.docs.toggle(tk),
        away: (tk, key) => app.stores.docView.getState().closeThreads(tk, key),
      }}
    />
  )
}

/** The desktop's pane with a document. */
export function DocPaneContainer({ route, dn, place, hidden }: { route: ProjectRoute; dn: number; place: string; hidden?: boolean }) {
  const app = useApp()
  const pane = usePaneRef('detail')
  const side = useStoreValue(app.stores.route, (s) => s.side)
  const asked = useStoreValue(app.stores.sheet, (s) => s.asked)
  const { m, d, facts, env, on, v, page } = useDoc(route.slug, dn)
  if (!m || !d || !facts) return null
  const web = d.fmt === 'html'
  if (v.editing && v.newFor == null)
    // an existing document is edited where it is read
    return (
      <PaneFrame place={place} hidden={hidden} desk paneRef={pane} head={<DocPaneHead d={d} editing />} onBack={() => app.docs.keep()}>
        <div className="mx-auto flex min-h-full w-full max-w-[46rem] flex-col px-8 pt-4 pb-12">
          <DocEditContainer slug={route.slug} />
        </div>
      </PaneFrame>
    )
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
        <DocView facts={facts} env={env} on={on} page={page} lasso={v.circle ? <Lasso onDrawn={(keys) => app.docs.circled(keys)} /> : null} />
      </div>
    </PaneFrame>
  )
}

/** The phone's sheet with a document, over its item. */
export function DocSheetContainer({ slug, dn, footRoom }: { slug: string; dn: number; footRoom: number }) {
  const app = useApp()
  const { m, d, facts, env, on, v, page } = useDoc(slug, dn)
  if (!m || !d || !facts) return null
  return (
    <Sheet open look={{ tall: true, aboveComposer: v.typing }} desk={false} footRoom={footRoom} onClose={() => app.docs.close()}>
      <SheetLayout title={`D${d.d}`} body={<DocView facts={facts} env={env} on={on} page={page} lasso={v.circle ? <Lasso onDrawn={(keys) => app.docs.circled(keys)} /> : null} />} />
    </Sheet>
  )
}
