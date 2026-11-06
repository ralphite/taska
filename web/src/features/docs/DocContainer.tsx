// A document with the page's data: on the desktop in the pane beside the list (its bar: what it is, Edit, Move,
// Delete, the way back), on the phone in a sheet over its item. What it shows comes from the model and the document's
// view; what you do goes to app.docs.

import { useEffect, useMemo, type ReactNode, useCallback } from 'react'
import { useLayout, useServices, useStores, useStoreValue } from '../../app/context'
import { useFiles, useProjectModel, type ProjectRoute } from '../../app/hooks'
import { usePaneRef } from '../../app/panes'
import { seenNow } from '../../model/docs'
import type { Doc } from '../../model/types'
import type { DocViewState } from '../../stores/docView'
import { WebPage } from './WebPage'
import { Lasso } from './Lasso'
import { WebThread } from './Thread'
import { codeOf, liveN } from '../../model/project'
import { factsOf, webFacts } from './docFacts'
import { notSent, type NotSent } from '../../model/voiceComments'
import { Sheet, SheetLayout } from '../../ui/Sheet'
import { useItemWorld } from '../../app/hooks'
import { PaneFrame } from '../../ui/PaneFrame'
import { DocPaneActs, DocPaneHead, DocPaneNav } from './DocPane'
import { DocEditContainer } from './DocEditContainer'
import { DocSheetMore } from './DocSheets'
import { DocView, PHONE_DOC_LOOK, type DocEvents } from './DocView'
import type { DocEnv } from './Thread'
import { docDraft } from '../../model/draftTarget'
import { RecMeter } from '../../app/RecMeter'
import { PLACE_LEVELS } from '../../ui/PlaceVoice'

const SIDE_NAME = { docs: 'Documents', log: 'Activity', deleted: 'Deleted' } as const

/** The document's view, with what it does. */
function useDoc(slug: string, dn: number) {
  const app = useServices('box', 'docChoices', 'docComments', 'docEditor', 'docVoice', 'docs', 'nav', 'seen', 'sheets', 'voice')
  const stores = useStores('box', 'docTicks', 'docView', 'drafts', 'recent', 'recording', 'sheet', 'ui')
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
  const said = useStoreValue(stores.recording, (s) => (s.rec ? JSON.stringify({ key: s.rec.about?.d === dn ? s.rec.about.key : null, bar: !!s.rec.about?.bar, quote: s.rec.about?.quote ?? '' }) : ''))
  const speaking = useMemo(() => (said ? (JSON.parse(said) as { key: string | null; bar: boolean; quote: string }) : null), [said])
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
  // opened: one of the search's Recent
  const docTitle = d?.title
  useEffect(() => {
    if (m && docTitle != null && d) stores.recent.getState().saw({ project: slug, kind: 'docs', n: d.n, d: dn, code: 'D' + dn, title: docTitle, on: codeOf(m, d.n) })
  }, [stores, m, slug, dn, docTitle]) // eslint-disable-line react-hooks/exhaustive-deps
  const media = useFiles(slug)
  const env: DocEnv = { world, now: m?.at ?? 0, desk, tidy: media.tidy, play: media.play, url: world.url }
  const docs = app.docs
  const on: DocEvents = {
    ref: (c) => {
      const to = m ? world.find(c) : null
      if (!to || !m) return
      if (to.kind === 'item') app.nav.openItem(codeOf(m, to.n))
      else if (to.kind === 'doc') docs.open(to.d)
      else app.nav.goInput(to.id)
    },
    picture: (f, all) => media.on.view(f, all),
    ...media.on,
    edit: (id) => app.docComments.editComment(slug, dn, id),
    move: (id) => app.sheets.open({ kind: 'comment-move', d: dn, id }, { focus: false }),
    takeOff: (id, f) => app.docComments.takeOff(dn, id, f),
    remove: (id) => app.docComments.deleteComment(dn, id),
    menu: (id) => app.sheets.open({ kind: 'comment-menu', d: dn, id }, { focus: false }),
    resolve: (tk, on2) => app.docComments.resolve(dn, tk, on2),
    reply: (tk) => docs.reply(tk),
    goItem: () => m && d && app.nav.openItem(codeOf(m, liveN(m, d.n))),
    toggle: (tk) => docs.toggle(tk),
    away: (tk) => docs.away(tk),
    pick: (key, quote, by) => docs.pick(key, quote, by),
    // a place's Voice, and its recording strip's ✕, ✓ (the phone sends) and ↑ (B498)
    say: (key, quote) => void app.docVoice.say(slug, dn, key, quote ?? d?.blocks.find((b) => b.key === key)?.text ?? ''),
    sayCancel: () => void app.voice.cancel(),
    sayCheck: () => void app.docVoice.check(),
    saySend: () => void app.docVoice.sendNow(),
    type: () => docs.type(),
    moveDoc: (from?: HTMLElement) => (desk && from ? app.sheets.openFrom(from, { kind: 'doc-move', d: dn }, { focus: false }) : app.sheets.open({ kind: 'doc-move', d: dn }, { focus: false })),
    deleteDoc: () => app.docEditor.remove(dn),
    copyDoc: () => app.docs.copy(dn),
    circle: () => stores.docView.getState().setCircle(!v.circle),
    editDoc: () => app.docEditor.edit(dn),
    // the phone has no box over a document (B643): a comment on the whole of it is spoken
    whole: () => (desk ? docs.whole() : void app.docVoice.say(slug, dn, 'doc', '')),
    tick: (tk, i) => app.docChoices.tick(dn, tk, i),
    modifyTicks: (tk) => app.docChoices.modifyTicks(dn, tk),
    // the box line's Send choices, from the document's own line (the phone's): the draft the box would write now
    sendTicks: () => void app.docChoices.sendTicks(slug, dn, app.box.key(null, undefined, dn)),
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
  // the part spoken about: its buttons are its recording strip right there, and no other part lights
  const spoken = useStoreValue(stores.recording, (s) => {
    const a = s.rec?.about
    return a && a.d === d.d && a.key?.startsWith('h:') && !a.bar ? JSON.stringify({ key: a.key, text: a.quote }) : ''
  })
  const rec = !!spoken
  const w = useMemo(() => webFacts(d, v, seen, asked, waiting, spoken ? (JSON.parse(spoken) as { key: string; text: string }) : null), [d, v, seen, asked, waiting, spoken])
  const held = w.held
  return (
    <WebPage
      title={d.title}
      html={d.md}
      threads={w.threads}
      held={held}
      rec={rec}
      meter={<RecMeter n={env.desk ? PLACE_LEVELS.desk : PLACE_LEVELS.phone} />}
      open={w.open}
      desk={env.desk}
      inspect={v.inspect}
      renderThread={(tk, rail) => <WebThread card={w.cards[tk]} rail={rail} replying={v.reply === tk} asking={w.asking} env={env} on={on} />}
      on={{
        pick: (p) => {
          stores.docView.getState().pick({ quote: p, sel: new Set(), reply: null })
          if (env.desk) app.fields.get('box')?.focus({ preventScroll: true })
        },
        // a part's Comment: what you write in the box comments on it (the phone's box opens for it)
        comment: (p) => {
          stores.docView.getState().pick({ quote: p, sel: new Set(), reply: null })
          if (env.desk) app.fields.get('box')?.focus({ preventScroll: true })
          else app.docs.type()
        },
        say: (part) => void app.docVoice.say(slug, d.d, part.key, part.text),
        cancel: on.sayCancel,
        check: on.sayCheck,
        send: on.saySend,
        esc: () => app.actions.run('back'),
        toggle: (tk) => app.docs.toggle(tk),
        away: (tk, key) => stores.docView.getState().closeThreads(tk, key),
      }}
    />
  )
}

/** The desktop's pane with a document. */
export function DocPaneContainer({ route, dn, place, hidden, bodyRef, beside }: { route: ProjectRoute; dn: number; place: string; hidden?: boolean; bodyRef?: (el: HTMLElement | null) => void; /** wide: the document on the left, its item's talk on the right */ beside?: (view: ReactNode, web: boolean) => ReactNode }) {
  const app = useServices('docEditor', 'docs')
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
      <PaneFrame place={place} hidden={hidden} desk paneRef={pane} bodyRef={bodyRef} head={<DocPaneHead d={d} editing />} onBack={() => app.docEditor.keep()}>
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
      acts={<DocPaneActs web={web} inspect={v.inspect} whole={v.quote?.key === 'doc'} deleting={!!asked['doc-delete ' + dn]} on={{ inspect: () => stores.docView.getState().setInspect(!v.inspect), whole: () => (v.quote?.key === 'doc' ? stores.docView.getState().pick({ quote: null }) : app.docs.whole()), copy: on.copyDoc, edit: on.editDoc, move: on.moveDoc, remove: on.deleteDoc }} />}
      lead={<DocPaneNav to={side ? SIDE_NAME[side] : codeOf(m, liveN(m, d.n))} onBack={() => app.docs.close()} />}
      onBack={() => app.docs.close()}
    >
      {beside ? (
        beside(<DocView facts={facts} env={env} on={on} page={page} meter={<RecMeter n={PLACE_LEVELS.desk} />} aim={v.aim} onAimed={aimed} lasso={v.circle ? <Lasso onDrawn={(keys) => app.docs.circled(keys)} /> : null} />, web)
      ) : (
        // a web page brings its own margins: none are added around it
        <div className={web ? 'w-full' : 'w-full px-8 pt-8 pb-12'}>
          <DocView facts={facts} env={env} on={on} page={page} meter={<RecMeter n={PLACE_LEVELS.desk} />} aim={v.aim} onAimed={aimed} lasso={v.circle ? <Lasso onDrawn={(keys) => app.docs.circled(keys)} /> : null} />
        </div>
      )}
    </PaneFrame>
  )
}

/** The phone's sheet with a document, over its item. */
export function DocSheetContainer({ slug, dn, footRoom }: { slug: string; dn: number; footRoom: number }) {
  const app = useServices('docs', 'sheets')
  const { m, d, facts, env, on, v, page, aimed } = useDoc(slug, dn)
  if (!m || !d || !facts) return null
  return (
    // above the box, which stays under it (what it says shows), so nothing of the document is under the box (r672)
    <Sheet open look={PHONE_DOC_LOOK} desk={false} footRoom={footRoom} onClose={() => app.docs.close()}>
      <SheetLayout
        title={`D${d.d}`}
        extra={<DocSheetMore code={`D${d.d}`} circle={v.circle} on={{ more: () => app.sheets.open({ kind: 'doc-menu', d: d.d }, { focus: false }), done: on.circle }} />}
        body={<DocView facts={facts} env={env} on={on} page={page} meter={<RecMeter n={PLACE_LEVELS.phone} />} aim={v.aim} onAimed={aimed} lasso={v.circle ? <Lasso onDrawn={(keys) => app.docs.circled(keys)} /> : null} />} />
    </Sheet>
  )
}
