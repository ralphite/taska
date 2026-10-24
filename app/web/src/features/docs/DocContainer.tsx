// A document with the page's data: on the desktop in the pane beside the list (its bar: what it is, Edit, Move,
// Delete, the way back), on the phone in a sheet over its item. What it shows comes from the model and the document's
// view; what you do goes to app.docs.

import { useEffect, useMemo, type ReactNode, useCallback } from 'react'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { useFiles, useProjectModel, type ProjectRoute } from '../../app/hooks'
import { usePaneRef } from '../../app/panes'
import { resolved, seenNow, threadNew, threadsOf } from '../../model/docs'
import type { Doc } from '../../model/types'
import type { DocViewState } from '../../stores/docView'
import { WebPage } from './WebPage'
import { Lasso } from './Lasso'
import { DraftCard, Thread } from './Thread'
import { codeOf, liveN } from '../../model/project'
import { factsOf } from './docFacts'
import { notSent, type NotSent } from '../../model/voiceComments'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { useItemWorld } from '../../app/hooks'
import { PaneFrame } from '../../ui/PaneFrame'
import { DocPaneActs, DocPaneHead, DocPaneNav } from './DocPane'
import { DocEditContainer } from './DocEditContainer'
import { DocView, SayRow, type DocEvents } from './DocView'
import type { DocEnv } from './Thread'
import { docDraft } from '../../model/draftTarget'

const SIDE_NAME = { docs: 'Documents', log: 'Activity', deleted: 'Deleted' } as const

/** The document's view, with what it does. */
function useDoc(slug: string, dn: number) {
  const app = useServices('docVoice', 'docs', 'nav', 'seen', 'sheets', 'voice')
  const stores = useStores('box', 'docTicks', 'docView', 'drafts', 'recording', 'sheet', 'ui')
  const desk = useLayout() === 'desk'
  const m = useProjectModel(slug)
  const v = useStoreValue(stores.docView, (s) => s)
  const asked = useStoreValue(stores.sheet, (s) => s.asked)
  const ticks = useStoreValue(stores.docTicks, (s) => s)
  const world = useItemWorld(m, slug)
  const d = m?.docs.find((x) => x.d === dn)
  const seen = app.seen.of(slug)
  // the paragraph whose own mic records a comment about it
  // (read as one word, so the document is not drawn again at every moment of sound)
  const said = useStoreValue(stores.recording, (s) => (s.rec ? JSON.stringify({ key: s.rec.about?.d === dn ? s.rec.about.key : null, bar: !!s.rec.about?.bar }) : ''))
  const speaking = useMemo(() => (said ? (JSON.parse(said) as { key: string | null; bar: boolean }) : null), [said])
  // voice comments in the box not sent yet show where they will go
  const draft = useStoreValue(stores.drafts, (s) => s.bySlug[slug]?.[docDraft(dn)] ?? '')
  const draftFiles = useStoreValue(stores.box, (s) => s.files[docDraft(dn)])
  const marks = useStoreValue(stores.box, (s) => s.marks)
  const waiting = useMemo(() => notSent(draft, draftFiles || [], marks, dn), [draft, draftFiles, marks, dn])
  const facts = useMemo(() => (m && d ? factsOf(m, d, v, seen, desk, asked, speaking, ticks, waiting) : null), [m, d, v, seen, desk, asked, speaking, ticks, waiting])
  useEffect(() => {
    // what the document shows now counts as seen
    if (d) for (const [k, t] of seenNow(seen, d)) app.seen.markKey(slug, k, t)
  })
  const media = useFiles(slug)
  const env: DocEnv = { world, now: m?.at ?? 0, desk, tidy: media.tidy, play: media.play, url: world.url }
  const docs = app.docs
  const on: DocEvents = {
    ref: (c) => {
      const to = m ? world.find(c) : null
      if (!to || !m) return
      if (to.kind === 'item') app.nav.openItem(codeOf(m, to.n))
      else if (to.kind === 'doc') docs.open(to.d)
      else app.nav.goInput(to.id, (x) => stores.ui.getState().setLit(x))
    },
    picture: (f, all) => media.on.view(f, all),
    ...media.on,
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
    moveDoc: (from?: HTMLElement) => (desk && from ? app.sheets.openFrom(from, { kind: 'doc-move', d: dn }, { focus: false }) : app.sheets.open({ kind: 'doc-move', d: dn }, { focus: false })),
    deleteDoc: () => docs.remove(dn),
    circle: () => stores.docView.getState().setCircle(!v.circle),
    quote: (key, text) => stores.docView.getState().pick({ quote: { key, text }, sel: new Set(), reply: null }),
    editDoc: () => docs.edit(dn),
    whole: () => docs.whole(),
    tick: (tk, i) => docs.tick(dn, tk, i),
    modifyTicks: (tk) => docs.modifyTicks(dn, tk),
  }
  const page = d?.fmt === 'html' && m ? <WebPageContainer slug={slug} d={d} v={v} seen={seen} env={env} on={on} waiting={waiting} /> : null
  const aimed = useCallback(() => stores.docView.getState().setAim(null), [stores])
  return { m, d, facts, env, on, v, desk, page, aimed }
}

/** A web page document's own view, with its threads. */
function WebPageContainer({ slug, d, v, seen, env, on, waiting }: { slug: string; d: Doc; v: DocViewState; seen: Readonly<Record<string, string>>; env: DocEnv; on: DocEvents; waiting: readonly NotSent[] }) {
  const app = useServices('actions', 'docVoice', 'docs', 'fields', 'voice')
  const stores = useStores('docView', 'recording', 'sheet')
  const asked = useStoreValue(stores.sheet, (s) => s.asked)
  const all = d.blocks.flatMap((b) => threadsOf(b.comments).map((t) => ({ t, key: b.key })))
  // a comment not sent yet (its quote in the box, with what was said or written under it) shows where it will go
  const drafts = waiting.filter((x) => x.key.startsWith('h:'))
  const draftKeys = [...new Set(drafts.map((x) => x.key))]
  const threads = [
    ...all.map(({ t, key }) => ({ tk: t.tk, key, quote: t.quote, n: t.comments.length, done: resolved(d, t.tk) })),
    ...draftKeys.map((key) => ({ tk: `${key}#new`, key, quote: '', n: drafts.filter((x) => x.key === key).length, done: false, draft: true })),
  ]
  // the part spoken about: the mic pressed turns into Stop right there, and no other part lights
  const spoken = useStoreValue(stores.recording, (s) => {
    const a = s.rec?.about
    return a && a.d === d.d && a.key?.startsWith('h:') && !a.bar ? JSON.stringify({ key: a.key, text: a.quote }) : ''
  })
  const rec = !!spoken
  const held = useMemo(() => (spoken ? (JSON.parse(spoken) as { key: string; text: string }) : v.quote?.key.startsWith('h:') ? v.quote : null), [spoken, v.quote])
  const open = all.find(({ t, key }) => v.threads.has(t.tk) || v.threads.has(key))?.t.tk ?? draftKeys.map((k) => `${k}#new`).find((tk) => v.threads.has(tk)) ?? null
  const thread = (tk: string, rail: boolean) => {
    if (tk.endsWith('#new')) {
      const mine = drafts.filter((x) => `${x.key}#new` === tk)
      return mine.length ? (
        // over the page, as the comments are: nothing of the page shows through
        <div className="flex flex-col gap-2 rounded-xl bg-white dark:bg-zinc-900">
          {mine.map((x) => (
            <DraftCard key={x.label} words={x.words} voice={x.voice} transcribing={x.transcribing} />
          ))}
        </div>
      ) : null
    }
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
      rec={rec}
      open={open}
      desk={env.desk}
      inspect={v.inspect}
      renderThread={thread}
      sayRow={<SayRow rec={rec} on={{ say: () => held && void app.docVoice.say(slug, d.d, held.key, held.text, true), cancel: () => void app.voice.cancel(), type: () => app.docs.type() }} />}
      on={{
        pick: (p) => {
          stores.docView.getState().pick({ quote: p, sel: new Set(), reply: null })
          if (env.desk) app.fields.get('box')?.focus({ preventScroll: true })
        },
        say: (part) => void app.docVoice.say(slug, d.d, part.key, part.text, true),
        esc: () => app.actions.run('back'),
        toggle: (tk) => app.docs.toggle(tk),
        away: (tk, key) => stores.docView.getState().closeThreads(tk, key),
      }}
    />
  )
}

/** The desktop's pane with a document. */
export function DocPaneContainer({ route, dn, place, hidden, bodyRef, beside }: { route: ProjectRoute; dn: number; place: string; hidden?: boolean; bodyRef?: (el: HTMLElement | null) => void; /** wide: the document on the left, its item's talk on the right */ beside?: (view: ReactNode, web: boolean) => ReactNode }) {
  const app = useServices('docs')
  const stores = useStores('docView', 'route', 'sheet')
  const pane = usePaneRef('detail')
  const side = useStoreValue(stores.route, (s) => s.side)
  const asked = useStoreValue(stores.sheet, (s) => s.asked)
  const { m, d, facts, env, on, v, page, aimed } = useDoc(route.slug, dn)
  if (!m || !d || !facts) return null
  const web = d.fmt === 'html'
  if (v.editing && v.newFor == null)
    // an existing document is edited where it is read
    return (
      <PaneFrame place={place} hidden={hidden} desk paneRef={pane} bodyRef={bodyRef} head={<DocPaneHead d={d} editing />} onBack={() => app.docs.keep()}>
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
      bodyRef={bodyRef}
      split={!!beside}
      duo={!!beside}
      head={<DocPaneHead d={d} editing={false} />}
      acts={<DocPaneActs web={web} inspect={v.inspect} deleting={!!asked['doc-delete ' + dn]} d={dn} on={{ inspect: () => stores.docView.getState().setInspect(!v.inspect), edit: on.editDoc, move: on.moveDoc, remove: on.deleteDoc }} />}
      lead={<DocPaneNav to={side ? SIDE_NAME[side] : codeOf(m, liveN(m, d.n))} onBack={() => app.docs.close()} />}
      onBack={() => app.docs.close()}
    >
      {beside ? (
        beside(<DocView facts={facts} env={env} on={on} page={page} aim={v.aim} onAimed={aimed} lasso={v.circle ? <Lasso onDrawn={(keys) => app.docs.circled(keys)} /> : null} />, web)
      ) : (
        // a web page brings its own margins: none are added around it
        <div className={web ? 'w-full' : 'w-full px-8 pt-8 pb-12'}>
          <DocView facts={facts} env={env} on={on} page={page} aim={v.aim} onAimed={aimed} lasso={v.circle ? <Lasso onDrawn={(keys) => app.docs.circled(keys)} /> : null} />
        </div>
      )}
    </PaneFrame>
  )
}

/** The phone's sheet with a document, over its item. */
export function DocSheetContainer({ slug, dn, footRoom }: { slug: string; dn: number; footRoom: number }) {
  const app = useServices('docs')
  const { m, d, facts, env, on, v, page, aimed } = useDoc(slug, dn)
  if (!m || !d || !facts) return null
  return (
    <Sheet open look={{ tall: true, aboveComposer: v.typing }} desk={false} footRoom={footRoom} onClose={() => app.docs.close()}>
      <SheetLayout title={`D${d.d}`} body={<DocView facts={facts} env={env} on={on} page={page} aim={v.aim} onAimed={aimed} lasso={v.circle ? <Lasso onDrawn={(keys) => app.docs.circled(keys)} /> : null} />} />
    </Sheet>
  )
}
