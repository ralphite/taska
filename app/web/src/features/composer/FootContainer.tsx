// The foot of the project page: the line about what you sent last, the box, and on the desktop's New input page the
// project's name over the box and what you said under it.

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useApp, useLayout, useStoreValue } from '../../app/context'
import { useAway, useProjectModel, type ProjectRoute } from '../../app/hooks'
import { dayOf, newestFirst, organizing, SHORT_STANDING, standing, timeOf } from '../../model/inputs'
import { shownStatus } from '../../model/items'
import { codeOf, type ProjectModel } from '../../model/project'
import { inputMatch } from '../../model/visible'
import { inputCode } from '../../model/words'
import { outgoingLine, type Outgoing } from '../../stores/outbox'
import { ProjTile } from '../../ui/bits'
import { toneOf } from '../../ui/tones'
import { SaidLately, type SaidChip, type SaidInput, type SaidOutgoing } from '../inputs/SaidLately'
import { Thumbs } from '../inputs/Files'
import { useSideProjects } from '../sidebar/SidebarContainer'
import { Composer, Feedback, type BoxLine, type FeedbackLine } from './Composer'

const STEP = 30

export const outgoingState = (o: Outgoing, away: number) =>
  o.state === 'failed' && !o.net ? 'Not sent' : o.state === 'failed' || away >= 2 ? 'Waiting for Taska…' : o.files.some((f) => f.uploading) ? 'Uploading…' : 'Sending…'

/** What the box writes to now: its key in the drafts, the line on top, the placeholder, what Send says. */
function boxRole(m: ProjectModel | null, route: ProjectRoute, desk: boolean, title: string) {
  const open = route.place.kind === 'item' ? m?.byN.get(Number(/\d+/.exec(route.place.ref)?.[0])) : undefined
  const files = m?.facts.organizer.on ? 'the organizer files it' : 'your agent files it'
  if (open && m) return { key: codeOf(m, open.n), scope: codeOf(m, open.n), line: null as BoxLine | null, placeholder: `Reply to ${codeOf(m, open.n)}…`, send: 'Send' }
  const line: BoxLine | null = desk ? { icon: 'newinput', label: 'New input', detail: `· ${files}` } : null
  return { key: 'new', scope: null, line, placeholder: m ? `Write to ${title}…` : 'Write anything…', send: 'Send' }
}

/** The foot's height, for what scrolls under it: the list and the pane run on under the box, around its corners. */
function useFootRoom(hidden: boolean | undefined, onHeight: ((px: number) => void) | undefined) {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const foot = ref.current
    if (!foot || typeof ResizeObserver === 'undefined') return
    const set = () => {
      const f = foot.getBoundingClientRect()
      const box = foot.querySelector('#composer')?.getBoundingClientRect()
      onHeight?.(foot.hidden ? 0 : foot.offsetHeight)
      // only around the box's top: from its middle down the foot is the page's own colour
      foot.style.setProperty('--foot-cut', (box ? box.top - f.top + box.height / 2 : f.height) + 'px')
    }
    const ro = new ResizeObserver(set)
    ro.observe(foot)
    set()
    return () => ro.disconnect()
  }, [hidden, onHeight])
  return ref
}

export function FootContainer({ route, place, hidden, composePage, onHeight }: { route: ProjectRoute; place: string; hidden?: boolean; composePage: boolean; onHeight?(px: number): void }) {
  const app = useApp()
  const footRef = useFootRoom(hidden, onHeight)
  const layout = useLayout()
  const desk = layout === 'desk'
  const m = useProjectModel(route.slug)
  const away = useAway(route.slug)
  const outbox = useStoreValue(app.stores.outbox, (s) => s.list)
  const { tones } = useSideProjects(route.slug)
  const title = m?.facts.title || route.slug
  const role = boxRole(m, route, desk, title)
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [upTo, setUpTo] = useState(STEP)
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())

  const send = () => {
    const words = text.trim()
    if (!words) return
    app.inputs.push({ slug: route.slug, text: words, scope: role.scope, files: [] })
    setText('')
  }
  const mine = outbox.filter((o) => o.slug === route.slug && !o.unsent)
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
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
        draft: null,
        canUndoSend: false,
        retry: !r.acked && m.facts.organizer.on && r.org && (!r.org.ok || r.org.undone) ? (r.org.undone ? 'Organize again' : 'Retry') : null,
        opened: opened.has(r.id),
      }
    })
    return { all, rows }
  }, [m, composePage, words.join(' '), upTo, opened])
  const outgoing: SaidOutgoing[] = words.length
    ? []
    : [...mine].reverse().map((o) => ({ q: o.q, text: o.text || outgoingLine(o), state: outgoingState(o, away), failed: o.state === 'failed', net: !!o.net, canUndo: false }))

  const first = mine[0]
  const feedback: FeedbackLine | null =
    (desk && composePage) || role.scope
      ? null
      : first
        ? first.state === 'failed' && first.net
          ? { kind: 'waiting', text: outgoingLine(first), more: mine.length - 1 }
          : first.state === 'failed'
            ? { kind: 'not-sent', text: outgoingLine(first), more: mine.length - 1 }
            : { kind: 'sending', text: outgoingLine(first), more: mine.length - 1, uploading: first.files.some((f) => f.uploading), canUndo: false }
        : null

  const url = (f: string) => `/p/${encodeURIComponent(route.slug)}/f/${encodeURIComponent(f)}`
  return (
    <footer
      ref={footRef}
      hidden={hidden}
      className={`relative z-20 shrink-0 border-t border-zinc-200 bg-zinc-50 px-3 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] after:pointer-events-none after:absolute after:inset-x-0 after:top-(--foot-cut) after:bottom-0 after:-z-10 after:bg-zinc-50 desk:scrollbar-gutter-both desk:px-8 desk:pb-5 desk:group-data-[compose]/app:overflow-y-auto desk:group-data-[compose]/app:overscroll-contain desk:group-data-[compose]/app:border-transparent desk:group-data-[compose]/app:pt-[5vh] desk:group-data-[compose]/app:pb-16 desk:group-data-[compose]/app:after:hidden desk:hover:scrollbar-thumb-zinc-500/80 dark:border-transparent dark:bg-transparent dark:pt-1 dark:after:bg-zinc-950 dark:desk:hover:scrollbar-thumb-zinc-400/70 ${place}`}
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
        line={feedback}
        on={{ dismiss: () => {}, undo: () => {}, retry: () => void app.inputs.flush(), edit: () => {}, view: () => {}, undoFiling: () => {}, move: () => {}, retryOrganizer: () => {} }}
      />
      <Composer
        line={role.line}
        placeholder={role.placeholder}
        sendWord={role.send}
        text={text}
        desk={desk}
        composePage={desk && composePage}
        micTip={composePage ? 'Voice note · ⌥V' : 'Voice note · V'}
        on={{ text: setText, send, attach: () => {}, mic: () => {} }}
      />
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
            files={(f) => <Thumbs files={f} url={url} size="size-12" play={() => ({ playing: false, t: null })} tidy={false} on={{ play: () => {}, words: () => {}, view: () => {} }} />}
            on={{
              goto: (n) => m && app.nav.openItem(codeOf(m, n)),
              more: (id) => setOpened((s) => new Set(s).add(id)),
              append: () => {},
              menu: () => {},
              undoSend: () => {},
              retry: () => {},
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
