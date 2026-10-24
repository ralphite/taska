// The foot of the project page: the line about what you sent last, the box, and on the desktop's New input page the
// project's name over the box and what you said under it.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useApp, useLayout, useStoreValue } from '../../app/context'
import { usePaneRef } from '../../app/panes'
import { useAway, useProjectModel, type ProjectRoute } from '../../app/hooks'
import { dayOf, newestFirst, organizing, SHORT_STANDING, standing, timeOf } from '../../model/inputs'
import { oneLine, shownStatus } from '../../model/items'
import { codeOf, inputDraft, liveN, type ProjectModel } from '../../model/project'
import { inputMatch } from '../../model/visible'
import type { Input } from '../../model/types'
import { inputCode, plural } from '../../model/words'
import type { BoxMode } from '../../stores/box'
import type { DocViewState } from '../../stores/docView'
import { docTarget, type DocTarget } from '../../model/docs'
import { ticksNotSent, type TickState } from '../../model/docTicks'
import { plainQuote } from '../../model/markdown'
import { outgoingLine, outgoingState, type Outgoing } from '../../stores/outbox'
import { Icon } from '../../ui/Icon'
import { DraftFiles } from './DraftFiles'
import { ProjTile } from '../../ui/bits'
import { HIT, toneOf } from '../../ui/tones'
import { clock } from '../../model/time'
import { SaidLately, type SaidChip, type SaidInput, type SaidOutgoing } from '../inputs/SaidLately'
import { Thumbs } from '../inputs/Files'
import { useSideProjects } from '../sidebar/SidebarContainer'
import { Composer, Feedback, type BoxLine, type FeedbackLine } from './Composer'
import { Doubts, DraftWords, type DoubtsView, type Fixing } from './Doubts'
import { DraftCard, DRAFT_WORDS, type DraftHint } from './DraftCard'
import { fixRange, openDoubts, spotsIn, voiceStretches } from '../../model/doubts'
import type { DraftFile } from '../../stores/box'

const STEP = 30
const EMPTY: Record<string, string> = {}

/** The line over the box: what you sent is on its way, or what became of the last one you sent from here. */
function feedbackLine(a: { m: ProjectModel | null; desk: boolean; composePage: boolean; scope: string | null; mine: Outgoing[]; lastSent: string | null; others: boolean; undoable(q: string | undefined): boolean; lastQ?: string }): { line: FeedbackLine; final?: string } | null {
  if ((a.desk && a.composePage) || a.scope) return null // on the New input page each input is in the list; in an item, in its talk
  const first = a.mine[0]
  const q = first?.quiet && first.state !== 'failed' ? null : first
  if (q) {
    const more = a.mine.length - 1
    if (q.state === 'failed' && q.net) return { line: { kind: 'waiting', text: outgoingLine(q), more } }
    if (q.state === 'failed') return { line: { kind: 'not-sent', text: outgoingLine(q), more } }
    return { line: { kind: 'sending', text: outgoingLine(q), more, uploading: q.files.some((f) => f.uploading), canUndo: a.undoable(q.q) } }
  }
  const r = a.lastSent && a.m ? a.m.byId.get(a.lastSent) : undefined
  if (!r || !a.m || r.scope) return null
  const org = a.m.facts.organizer
  const move = a.others && !r.scope
  let line: FeedbackLine
  if (r.moved) line = { kind: 'moved', code: inputCode(r.id), to: r.moved.to, as: inputCode(r.moved.as), href: `/p/${encodeURIComponent(r.moved.to)}/` }
  else if (r.trWait) line = { kind: 'transcribing' }
  else if (org.busy === r.id || (!r.acked && org.on && !r.org)) line = { kind: 'organizing' }
  else if (r.org && !r.org.ok) line = { kind: 'org-failed', msg: r.org.msg }
  else if (r.org?.undone) line = { kind: 'undone', code: inputCode(r.id) }
  else if (r.acked)
    line = {
      kind: 'organized',
      msg: r.org?.msg || (r.touched.length ? 'Organized' : 'Seen by your agent, no item made'),
      view: !!r.touched.length,
      undo: !!(r.org && r.org.ok && !r.org.undone && !r.org.keep && r.touched.length),
      move,
    }
  else line = { kind: 'sent', organizer: !!r.org, canUndo: a.undoable(a.lastQ), move }
  const final = r.acked || (r.org && r.org.ok) || r.moved
  return { line, final: final ? r.id : undefined }
}

/** What the box writes to now: its key in the drafts, the line on top, the placeholder, what Send says. */
const xButton = (label: string, run: () => void, esc = true) => (
  <button
    onClick={run}
    aria-label={label}
    title={esc ? `${label} · Esc` : label}
    className="-my-1.5 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 hover:text-zinc-800 lg:size-8 lg:hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:lg:hover:bg-zinc-800"
  >
    <Icon n="x" c="size-4" />
  </button>
)

/** What a comment from the box goes to: what is picked in the document, or (the phone) the whole document. */
export type DocAim = { d: number; target: DocTarget } | null

function boxRole(m: ProjectModel | null, route: ProjectRoute, desk: boolean, title: string, mode: BoxMode, stop: () => void, pick: DocViewState, ticks: TickState, on: { unpick(): void; toItem(): void; sendTicks(): void; clearTicks(): void }) {
  // the item open, or the one whose document is open (nothing picked in it, the box replies on the item)
  const docOf = route.place.kind === 'doc' ? m?.docs.find((x) => x.d === (route.place as { d: number }).d) : undefined
  const open = route.place.kind === 'item' ? m?.byN.get(Number(/\d+/.exec(route.place.ref)?.[0])) : docOf && m ? m.byN.get(liveN(m, docOf.n)) : undefined
  const files = m?.facts.organizer.on ? 'the organizer files it' : 'your agent files it'
  const none = { aim: null as DocAim }
  if (mode?.kind === 'prefs') {
    const line: BoxLine = { icon: 'pencil', label: 'Edit transcription preferences', detail: '· every project', right: xButton('Stop editing', stop) }
    return { ...none, key: 'prefs', scope: null, doc: null, line, placeholder: 'How should voice notes be transcribed?', send: 'Save' }
  }
  if (mode?.kind === 'comment') {
    const was = oneLine(mode.was)
    const line: BoxLine = { icon: 'pencil', label: `Edit your comment on D${mode.d}`, detail: was ? `\u201c${was.slice(0, 120)}\u201d` : '', right: xButton('Stop editing', stop) }
    return { ...none, key: `dc ${mode.d} ${mode.id}`, scope: null, doc: null, line, placeholder: 'Write…', send: 'Save' }
  }
  const dt = docOf && !mode ? docTarget(docOf, pick) : null
  if (docOf && dt) {
    const line: BoxLine = {
      icon: dt.reply ? 'reply' : 'comment',
      label: `${dt.reply ? 'Reply in' : 'Comment on'} D${docOf.d}`,
      detail: (dt.many || 0) > 1 ? `· ${dt.many} paragraphs` : dt.quote ? `\u201c${plainQuote(dt.quote).slice(0, 120)}\u201d` : '',
      right: xButton('Cancel the comment', on.unpick),
    }
    return { aim: { d: docOf.d, target: dt } as DocAim, key: `doc ${docOf.d}`, scope: null, doc: docOf.d, line, placeholder: 'Write…', send: dt.reply ? 'Reply' : 'Comment' }
  }
  const waiting = docOf && !mode ? ticksNotSent(ticks, docOf) : ''
  if (docOf && waiting) {
    // choices ticked in the document wait; they go only with this line's Send choices
    const line: BoxLine = {
      icon: 'check',
      label: waiting,
      detail: <span className="@max-xs:hidden">· D{docOf.d}</span>,
      tight: true,
      right: (
        <>
          <button
            onClick={on.sendTicks}
            className={`${HIT} -my-1 flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10`}
          >
            Send choices
          </button>
          {xButton('Clear the ticks', on.clearTicks, false)}
        </>
      ),
    }
    const host = m ? liveN(m, docOf.n) : null
    const reply = desk && host != null && m ? codeOf(m, host) : null
    return reply
      ? { ...none, key: reply, scope: reply, doc: null, line, placeholder: `Reply to ${reply}…`, send: 'Send' }
      : { aim: { d: docOf.d, target: { key: 'doc', quote: '' } } as DocAim, key: `doc ${docOf.d}`, scope: null, doc: docOf.d, line, placeholder: `Comment on D${docOf.d}…`, send: 'Comment' }
  }
  if (docOf && !desk && !mode) {
    // the phone, nothing picked: a comment on the whole document (Reply to its item instead)
    const host = m ? liveN(m, docOf.n) : null
    const line: BoxLine = {
      icon: 'comment',
      label: `Comment on D${docOf.d}`,
      detail: '· or tap a part',
      right:
        host != null && m?.byN.has(host) ? (
          <button
            onClick={on.toItem}
            className={`${HIT} -my-1 flex h-8 shrink-0 items-center rounded-full px-2 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200`}
          >
            Reply to {codeOf(m, host)}
          </button>
        ) : null,
    }
    return { aim: { d: docOf.d, target: { key: 'doc', quote: '' } } as DocAim, key: `doc ${docOf.d}`, scope: null, doc: docOf.d, line, placeholder: `Comment on D${docOf.d}…`, send: 'Comment' }
  }
  if (mode?.kind === 'amend' && m?.byId.has(mode.id)) {
    const r = m.byId.get(mode.id) as Input
    const edit = mode.mode === 'edit'
    const voice = r.files.some((f) => (f.mime || '').startsWith('audio/'))
    const said = oneLine(r.text)
    const x = edit ? 'Stop editing' : 'Stop adding details'
    const line: BoxLine = {
      icon: edit ? 'pencil' : 'plus',
      label: `${edit ? 'Edit' : 'Add details to'} ${inputCode(mode.id)}`,
      detail: said ? `\u201c${said.slice(0, 120)}\u201d` : `· ${voice ? 'a voice note' : plural(r.files.length, 'file')}`,
      right: (
        <button
          onClick={stop}
          aria-label={x}
          title={`${x} · Esc`}
          className="-my-1.5 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 hover:text-zinc-800 lg:size-8 lg:hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:lg:hover:bg-zinc-800"
        >
          <Icon n="x" c="size-4" />
        </button>
      ),
    }
    return { ...none, key: `${mode.mode} ${mode.id}`, scope: open && m ? codeOf(m, open.n) : null, doc: null, line, placeholder: 'Write…', send: 'Save' }
  }
  if (open && m) return { ...none, key: codeOf(m, open.n), scope: codeOf(m, open.n), doc: null, line: null as BoxLine | null, placeholder: `Reply to ${codeOf(m, open.n)}…`, send: 'Send' }
  const line: BoxLine | null = desk ? { icon: 'newinput', label: 'New input', detail: `· ${files}` } : null
  return { ...none, key: 'new', scope: null, doc: null, line, placeholder: m ? `Write to ${title}…` : 'Write anything…', send: 'Send' }
}

/** Where a voice note's words may be misheard in the draft now. */
function useHeard(text: string, files: readonly DraftFile[] | undefined) {
  return useMemo(() => {
    const fs = files || []
    const spots = spotsIn(text, fs)
    const open = openDoubts(text, fs)
    return { spots, open, altOpen: open.filter((d) => d.x.alt).length, pickable: spots.some((p) => p.x.alt) }
  }, [text, files])
}

/** The foot's height, for what scrolls under it: the list and the pane run on under the box, around its corners. */
function useFootRoom(hidden: boolean | undefined, onHeight: ((px: number) => void) | undefined, boxRef: RefObject<HTMLDivElement | null>) {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const foot = ref.current
    if (!foot || typeof ResizeObserver === 'undefined') return
    const set = () => {
      const f = foot.getBoundingClientRect()
      const box = boxRef.current?.getBoundingClientRect()
      onHeight?.(foot.hidden ? 0 : foot.offsetHeight)
      // only around the box's top: from its middle down the foot is the page's own colour
      foot.style.setProperty('--foot-cut', (box ? box.top - f.top + box.height / 2 : f.height) + 'px')
    }
    const ro = new ResizeObserver(set)
    ro.observe(foot)
    set()
    return () => ro.disconnect()
  }, [hidden, onHeight, boxRef])
  return ref
}

export function FootContainer({ route, place, hidden, composePage, onHeight, bare = false }: { route: ProjectRoute; place: string; hidden?: boolean; composePage: boolean; onHeight?(px: number): void; /** just the box (Settings' transcription preferences) */ bare?: boolean }) {
  const app = useApp()
  const boxRef = useRef<HTMLDivElement | null>(null)
  const footRef = useFootRoom(hidden, onHeight, boxRef)
  const pane = usePaneRef('foot')
  const layout = useLayout()
  const desk = layout === 'desk'
  const m = useProjectModel(route.slug)
  const away = useAway(route.slug)
  const outbox = useStoreValue(app.stores.outbox, (s) => s.list)
  const { tones } = useSideProjects(route.slug)
  const title = m?.facts.title || route.slug
  const mode = useStoreValue(app.stores.box, (s) => s.mode)
  const pick = useStoreValue(app.stores.docView, (s) => s)
  const ticks = useStoreValue(app.stores.docTicks, (s) => s)
  const role = boxRole(m, route, desk, title, mode, () => app.box.stop(), pick, ticks, {
    unpick: () => app.docs.unpick(),
    toItem: () => app.docs.toItem(),
    sendTicks: () => pick.d != null && void app.docs.sendTicks(route.slug, pick.d),
    clearTicks: () => pick.d != null && app.docs.clearTicks(pick.d),
  })
  const key = app.box.key(role.scope, mode, role.doc)
  useLayoutEffect(() => {
    if (!bare) app.stores.box.getState().setShown(key, role.scope)
  }, [app, key, role.scope, bare])
  const recording = useStoreValue(app.stores.recording, (s) => s.rec)
  // the recording shows in the box it was started in
  const rec = recording && recording.slug === route.slug && recording.key === key ? { time: clock(recording.ms), levels: recording.levels, from: recording.from } : null
  const drafts = useStoreValue(app.stores.drafts, (s) => s.bySlug[route.slug]) || EMPTY
  const text = drafts[key] ?? ''
  const draftFiles = useStoreValue(app.stores.box, (s) => s.files[key])
  const setText = (v: string) => app.box.write(route.slug, key, v)
  const showWords = useStoreValue(app.stores.box, (s) => s.showWords)
  const [fixing, setFixing] = useState<Fixing | null>(null)
  const heard = useHeard(text, draftFiles)
  const justSent = useStoreValue(app.stores.box, (s) => s.sent)
  const [q, setQ] = useState('')
  const [upTo, setUpTo] = useState(STEP)
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())

  const send = () => {
    if (mode?.kind === 'prefs') return void app.settings.savePrefs(route.slug)
    if (mode?.kind === 'comment') return void app.docs.saveComment(route.slug, mode.d, mode.id, key)
    if (role.aim) return void app.docs.comment(route.slug, role.aim.d, role.aim.target, key)
    void app.box.send(route.slug, m, role.scope)
  }
  const mine = outbox.filter((o) => o.slug === route.slug && !o.unsent)
  const words = useMemo(() => q.trim().toLowerCase().split(/\s+/).filter(Boolean), [q])
  const said = useMemo(() => {
    if (!m || !composePage) return null
    const all = newestFirst(m.inputs).filter((r) => inputMatch(r, words))
    const recent = all.slice(0, upTo)
    const chip = (n: number): SaidChip | null => {
      const it = m.byN.get(n)
      return it ? { n, code: codeOf(m, n), type: it.type, title: it.title, status: shownStatus(it) } : null
    }
    const rows: SaidInput[] = recent.map((r, k) => {
      const s = standing(r, m.facts.organizer, (slug) => slug)
      return {
        r,
        code: inputCode(r.id),
        time: timeOf(r.t),
        day: k === 0 || dayOf(recent[k - 1].t) !== dayOf(r.t) ? dayOf(r.t) : null,
        standing: s,
        short: SHORT_STANDING[s.label] || s.label,
        scope: r.scope ? chip(r.scope) : null,
        chips: r.moved ? [] : (r.touched.filter((n) => m.byN.has(n) && n !== r.scope).map(chip).filter(Boolean) as SaidChip[]),
        busy: organizing(r, m.facts.organizer),
        draft: inputDraft(r.id, drafts, mode?.kind === 'amend' ? { id: mode.id, mode: mode.mode } : null),
        canUndoSend: justSent.some((x) => x.rid === r.id),
        retry: !r.acked && m.facts.organizer.on && r.org && (!r.org.ok || r.org.undone) ? (r.org.undone ? 'Organize again' : 'Retry') : null,
        opened: opened.has(r.id),
      }
    })
    return { all, rows }
  }, [m, composePage, words, upTo, opened, justSent, drafts, mode])
  const outgoing: SaidOutgoing[] = words.length
    ? []
    : [...mine].reverse().map((o) => ({ q: o.q, text: o.text || outgoingLine(o), state: outgoingState(o, away), failed: o.state === 'failed', net: !!o.net, canUndo: justSent.some((x) => x.q === o.q) }))

  const lastSent = useStoreValue(app.stores.ui, (s) => s.lastSent)
  const projects = useStoreValue(app.stores.data, (s) => s.projects)
  const feedback = feedbackLine({ m, desk, composePage, scope: role.scope, mine, lastSent: lastSent?.slug === route.slug ? lastSent.rid : null, lastQ: lastSent?.q, others: (projects || []).some((p) => p.name !== route.slug), undoable: (q) => !!q && justSent.some((x) => x.q === q) })
  // a line that says where it ended up goes after a while
  useEffect(() => {
    if (!feedback?.final) return
    const t = window.setTimeout(() => app.stores.ui.getState().setLastSent(null), 6000)
    return () => clearTimeout(t)
  }, [app, feedback?.final])

  const url = (f: string) => `/p/${encodeURIComponent(route.slug)}/f/${encodeURIComponent(f)}`
  // words of a voice note that may be misheard: under the box; on the phone in the box itself, to pick from
  const pickWord = (fk: string, k: number, side: 'was' | 'alt') => void app.voiceWords.pick(route.slug, key, fk, k, side)
  const viewWords = !desk && heard.pickable && showWords && !rec
  const doubtsView: DoubtsView | null =
    desk && composePage ? (heard.altOpen ? { kind: 'card', toCheck: heard.altOpen } : null) : !desk ? (heard.pickable ? { kind: 'phone', toCheck: heard.altOpen, showing: viewWords } : null) : heard.open.length ? { kind: 'list', lines: heard.open } : null
  const doubts = doubtsView ? <Doubts view={doubtsView} on={{ use: (fk, k) => app.voiceWords.use(route.slug, key, fk, k), show: () => app.voiceWords.show(true) }} /> : null
  const phoneWords = viewWords ? (
    <DraftWords
      text={text}
      spots={heard.spots}
      className="col-start-1 row-start-1 max-h-48 min-h-11 overflow-y-auto px-1 py-1.5 text-[17px] leading-8 break-words whitespace-pre-wrap text-zinc-900 roomy:text-[15px] dark:text-zinc-100"
      on={{ pick: pickWord, escape: () => app.fields.focus('box'), plain: () => app.voiceWords.show(false) }}
    />
  ) : null
  // the New input page: the draft at the top of what you said, while a voice note's words are there to check
  const card = (() => {
    if (!desk || !composePage || mode || (!text.trim() && !draftFiles?.length)) return null
    const files = draftFiles || []
    const voice = files.filter((f) => (f.mime || '').startsWith('audio/'))
    if (!voice.length && !heard.pickable) return null
    const open = new Set(heard.spots.filter((p) => p.x.alt && !p.x.pick).map((p) => `${p.fk} ${p.k}`)).size
    const hint: DraftHint = open ? { kind: 'check', n: open } : heard.spots.some((p) => p.x.pick) ? { kind: 'switch' } : files.some((f) => f.trAdded && text.includes(f.trAdded)) ? { kind: 'fix' } : null
    const words = text.trim() ? (
      <DraftWords
        text={text}
        spots={heard.spots}
        stretches={voiceStretches(text, files)}
        fixing={fixing}
        className={DRAFT_WORDS}
        on={{
          pick: pickWord,
          escape: () => app.fields.focus('box'),
          select: (s, e) => {
            const r = fixRange(text, s, e)
            if (r && 'error' in r) app.toasts.show(r.error)
            else if (r) setFixing(r)
          },
          fixSave: (right) => {
            setFixing(null)
            if (fixing) void app.voiceWords.fix(route.slug, key, fixing, right, role.scope)
          },
          fixStop: () => setFixing(null),
        }}
      />
    ) : null
    return <DraftCard voice={voice.length} ms={voice.reduce((a, f) => a + (f.ms || 0), 0)} files={files.length - voice.length} transcribing={files.some((f) => f.transcribing)} words={words} hint={hint} />
  })()
  const composer = (
    <Composer
      line={role.line}
      placeholder={role.placeholder}
      sendWord={role.send}
      text={text}
      desk={desk}
      composePage={desk && composePage}
      micTip={composePage ? 'Voice note · ⌥V' : 'Voice note · V'}
      boxRef={boxRef}
      fieldRef={app.fields.ref('box')}
      lineOnComposePage={!!mode}
      hasFiles={!!draftFiles?.length}
      files={<DraftFiles files={draftFiles || []} url={url} onRemove={(fk) => app.box.removeFile(key, fk)} onView={() => {}} />}
      doubts={doubts}
      words={phoneWords}
      rec={rec}
      on={{
        text: setText,
        send,
        attach: (list) => app.box.attach(route.slug, key, list),
        mic: (aux) => void app.voice.start(route.slug, key, role.scope, aux ? 'aux' : 'main'),
        recCancel: () => void app.voice.cancel(),
        recStop: () => void app.voice.finish(false),
        recSend: () => void app.voice.finish(true),
      }}
    />
  )
  if (bare) return composer
  return (
    <footer
      ref={(el) => {
        footRef.current = el
        pane(el)
      }}
      hidden={hidden}
      className={`relative z-20 shrink-0 border-t border-zinc-200 bg-zinc-50 px-3 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] after:pointer-events-none after:absolute after:inset-x-0 after:top-(--foot-cut) after:bottom-0 after:-z-10 after:bg-zinc-50 lg:scrollbar-gutter-both lg:px-8 lg:pb-5 lg:group-data-[compose]/app:overflow-y-auto lg:group-data-[compose]/app:overscroll-contain lg:group-data-[compose]/app:border-transparent lg:group-data-[compose]/app:pt-[5vh] lg:group-data-[compose]/app:pb-16 lg:group-data-[compose]/app:after:hidden lg:hover:scrollbar-thumb-zinc-500/80 dark:border-transparent dark:bg-transparent dark:pt-1 dark:after:bg-zinc-950 dark:lg:hover:scrollbar-thumb-zinc-400/70 ${place}`}
    >
      {desk && composePage ? (
        <div className="mx-auto mb-6 flex max-w-[42rem] flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <ProjTile title={title} tone={toneOf(tones, route.slug)} cls="size-11 rounded-xl text-xl shadow-sm" />
            <h1 className="text-[28px] leading-none font-semibold tracking-tight">{title}</h1>
          </div>
        </div>
      ) : null}
      <Feedback
        line={feedback?.line ?? null}
        on={{ dismiss: () => app.stores.ui.getState().setLastSent(null), undo: () => { const q = mine[0]?.q ?? lastSent?.q; if (q) app.box.unsend(q) }, retry: () => void app.inputs.flush(), edit: () => {}, view: () => {}, undoFiling: () => {}, move: () => {}, retryOrganizer: () => {} }}
      />
      {composer}
      {desk && composePage && said ? (
        <section aria-label="You said lately" className="mx-auto mt-8 block max-w-[42rem]">
          <SaidLately
            count={words.length ? said.all.length : m?.inputs.length || 0}
            total={m?.inputs.length || 0}
            q={q}
            rows={said.rows}
            outgoing={outgoing}
            more={said.all.length > said.rows.length}
            words={words}
            draft={card}
            files={(f) => <Thumbs files={f} url={url} size="size-12" play={() => ({ playing: false, t: null })} tidy={false} on={{ play: () => {}, words: () => {}, view: () => {} }} />}
            on={{
              goto: (n) => m && app.nav.openItem(codeOf(m, n)),
              more: (id) => setOpened((s) => new Set(s).add(id)),
              append: (id) => app.box.amendStart(route.slug, m, id, 'append'),
              draft: (id, mode) => app.box.amendStart(route.slug, m, id, mode),
              menu: (id) => app.sheets.open({ kind: 'input-menu', id }, { pop: true, focus: false }),
              undoSend: (k) => app.box.unsend(justSent.find((x) => x.q === k || x.rid === k)?.q ?? k),
              retry: (id) => app.inputActions.organizeAgain(route.slug, id),
              outboxRetry: () => void app.inputs.flush(),
              outboxEdit: () => {},
              query: (v) => (setQ(v), setUpTo(STEP)),
              loadMore: () => setUpTo((u) => u + STEP),
            }}
          />
        </section>
      ) : null}
    </footer>
  )
}
