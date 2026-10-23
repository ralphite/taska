// What you said (inputs), and what became of each: the phone's Inputs tab (on the desktop what you said is under New
// input, F347), "You said lately" on the New input page, and what is still on its way (F85).
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { HIT, LINK_BTN, SMALL_BTN, TYPE_TEXT } from '../lib/constants'
import {
  U,
  byN,
  code,
  dayOf,
  inputMatch,
  model,
  otherProjects,
  parseRef,
  projName,
  rcode,
  searchWords,
  statusName,
  useArea,
  when,
  els,
} from '../lib/state'
import type { Input } from '../lib/types'
import type { Job } from '../lib/state'
import { arrived, outboxLine, outboxState, projTitle } from '../lib/state'
import { draftsOf } from '../lib/drafts'
import { DraftMark, Empty, Hit, Icon, ProjTile, StateIcon } from './ui'
import { Rich, Thumbs } from './Talk'
import { SearchHints } from './List'

const isVoice = (r: Input | null | undefined) => !!r?.files?.some((f) => (f.mime || '').startsWith('audio/'))
export const voiceAttr = (r: Input | null | undefined) => (isVoice(r) ? { 'data-voice': r?.id } : {})
export const canUndoInput = (r: Input) =>
  !!r.org &&
  r.org.ok &&
  !r.org.undone &&
  !!r.touched.length &&
  (!r.org.keep || (!!r.history?.length && !!r.org.changed)) &&
  !!r.filing?.can // T113 A4
export const filingTip = (r: Input) => `${rcode(r.id)}: ${r.filing?.what || ''}`
const codes = (ns: number[]) => ns.map(code).join(', ')
export const deleteTip = (r: Input) =>
  `Delete ${rcode(r.id)}` +
  (r.drop?.go.length ? ` and ${codes(r.drop.go)}` : '') +
  (r.drop?.keep.length ? `; ${r.drop.keep.map(([n, why]) => `${code(n)} stays: ${why}`).join('; ')}` : '')

/** T274 #35: mark the searched words inside rich text too (it is HTML, drawn by the Markdown renderer). */
export function useMarkHits(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    for (const m of root.querySelectorAll('mark[data-mark]'))
      m.replaceWith(document.createTextNode(m.textContent || ''))
    root.normalize()
    const words = searchWords()
    if (!words.length) return
    const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i')
    for (const el of root.querySelectorAll('[data-hit-html]')) {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT),
        nodes: Text[] = []
      while (walk.nextNode()) {
        const t = walk.currentNode as Text
        if (!t.parentElement?.closest('mark') && re.test(t.data)) nodes.push(t)
      }
      for (const t of nodes)
        t.replaceWith(
          ...t.data.split(re).map((s, i) => {
            if (!(i % 2)) return document.createTextNode(s)
            const m = document.createElement('mark')
            m.className = 'rounded-sm bg-yellow-200 text-inherit dark:bg-yellow-400/30'
            m.dataset.mark = ''
            m.textContent = s
            return m
          }),
        )
    }
  })
}

const dot = (cls: string) => <span className={`size-1.5 animate-pulse rounded-full ${cls}`} />
// -> [label, tone, icon]
export function inputState(r: Input): [string, string, ReactNode] {
  const S = model.S
  if (r.moved)
    return [
      `Moved to ${projName(r.moved.to)}`,
      'text-zinc-500 dark:text-zinc-400',
      <Icon n="arrow" c="size-3.5" sw="2" />,
    ]
  if (r.tr_wait) return ['Transcribing…', 'text-blue-600 dark:text-blue-400', dot('bg-blue-500 dark:bg-blue-400')] // B165
  if (S.org?.busy === r.id)
    return ['Organizing…', 'text-blue-600 dark:text-blue-400', dot('bg-blue-500 dark:bg-blue-400')]
  if (r.org?.undone) return ['Undone', 'text-zinc-500 dark:text-zinc-400', <Icon n="undo" c="size-3.5" sw="2" />]
  const check = <Icon n="check" c="size-3.5" sw="2.25" />
  if (r.kind === 'answer') return ['Answer', 'text-zinc-500 dark:text-zinc-400', check] // F419: no organizer for it
  if (r.acked)
    return r.org?.keep
      ? ['Handled by your agent', 'text-zinc-400 dark:text-zinc-500', check]
      : !r.org && !r.touched.length
        ? ['Seen by your agent', 'text-zinc-500 dark:text-zinc-400', check]
        : ['Organized', 'text-emerald-700 dark:text-emerald-400', check]
  if (r.org && !r.org.ok)
    return ['Organizer failed', 'text-red-600 dark:text-red-400', <Icon n="alert" c="size-3.5" sw="2" />] // T232 #5
  if (r.org) return ['Left for your agent', 'text-zinc-600 dark:text-zinc-300', <Icon n="bot" c="size-3.5" sw="2" />]
  return [
    S.org?.on ? 'Queued' : 'Waiting for your agent',
    'text-zinc-600 dark:text-zinc-300',
    <Icon n="hourglass" c="size-3.5" sw="2" />,
  ]
}
const busyOf = (r: Input) => model.S.org?.busy === r.id || (!r.acked && !!model.S.org?.on && !r.org)
// What you can do about an input now: the same on Inputs and in "You said lately" (T113 A26, B32) -> [its state's, every input's]
export function inputActs(r: Input, cls = LINK_BTN): [ReactNode, ReactNode] {
  if (r.moved)
    return [
      <a href={`/p/${encodeURIComponent(r.moved.to)}/`} className={`${cls} max-w-full min-w-0`}>
        <Icon n="arrow" c="size-3.5" sw="2" />
        <span className="truncate">
          Open {projName(r.moved.to)} · {rcode(r.moved.as)}
        </span>
      </a>,
      null,
    ]
  const S = model.S,
    quiet = cls === LINK_BTN ? ' text-zinc-600 dark:text-zinc-300' : ''
  const retry =
    !r.acked && S.org?.on && r.org && (!r.org.ok || r.org.undone) ? (
      <button key="retry" data-act="retry" data-id={r.id} className={cls}>
        <Icon n="loop" c="size-3.5" sw="2" />
        {r.org.undone ? 'Organize again' : 'Retry'}
      </button>
    ) : null
  const now = retry ? [retry] : null
  const more = (
    <button
      data-act="input-more"
      data-id={r.id}
      title="More"
      aria-label={`More for ${rcode(r.id)}`}
      className={`${cls}${quiet}`}
    >
      <Icon n="more" c="size-4" />
    </button>
  )
  return [now, more] // T274 #16
}
export const inputMenuRows = (r: Input) => {
  const busy = busyOf(r)
  return {
    undo: canUndoInput(r),
    move: otherProjects().length > 0 && !busy,
    history: !!r.history?.length,
  }
}

const long = (r: Input) => r.text.length > 160 || r.text.split('\n').length > 4
// One input with what became of it and what you can do with it: a row of the phone's Inputs tab
// B329: a dot on the inputs the Inputs tab's number counts: those not handled yet
function NotHandled({ r }: { r: Input }) {
  return r.acked ? null : (
    <span title="Not handled yet" className="size-2 shrink-0 rounded-full bg-blue-500 dark:bg-blue-400" />
  )
}
export function InputCard({ r }: { r: Input }) {
  const [label, tone, icon] = inputState(r),
    scope = r.scope ? byN.get(r.scope) : null,
    fold = long(r)
  // the chip says what was done with its item ("Created B224 …"); the line above keeps only what no chip says (T225 #18)
  const shown = r.moved ? [] : r.touched.filter((n) => byN.has(n) && n !== r.scope),
    did: Record<number, string> = {},
    rest: string[] = []
  for (const part of (r.org?.msg || '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean)) {
    const m = /^(.+?) ([A-Z]\d+)$/.exec(part),
      n = m && parseRef(m[2])
    if (m && n && shown.includes(n)) did[n] ||= m[1]
    else rest.push(part)
  }
  const org = !r.moved && r.org && !(r.acked && r.org.keep)
  const told = (p: string) =>
    p.toLowerCase() === label.toLowerCase() || (/^Left for your/.test(p) && /^Left for your/.test(label))
  const left = rest.filter((p) => !told(p))
  const noteTone = r.org?.ok ? 'text-zinc-500 dark:text-zinc-400' : 'text-red-600 dark:text-red-400'
  const note =
    org && left.length ? (
      <div className={`mt-1.5 flex min-h-5 items-center gap-1 text-xs ${noteTone}`}>
        <Icon n="sparkle" c="size-3.5" />
        <span className="min-w-0">{left.join(' · ')}</span>
      </div>
    ) : null
  const spark =
    org && !note && shown.some((n) => did[n]) ? (
      <span className="grid h-8 shrink-0 place-items-center text-zinc-400 dark:text-zinc-500">
        <Icon n="sparkle" c="size-3.5" />
      </span>
    ) : null
  const chips = shown.length
    ? shown.map((n) => {
        const it = byN.get(n)
        if (!it) return null
        return (
          <button
            key={n}
            data-act="goto"
            data-n={n}
            className={`${HIT} flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-lg bg-zinc-100 px-2 text-[13px] hover:bg-zinc-200/70 dark:bg-zinc-800 dark:hover:bg-zinc-700`}
          >
            {did[n] ? <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{did[n]}</span> : null}
            <span className={`font-mono text-xs font-bold ${TYPE_TEXT[it.type]}`}>{code(n)}</span>
            <span className="truncate">{it.title}</span>
          </button>
        )
      })
    : null
  const [now, more] = inputActs(r)
  const dk = (['edit', 'append'] as const).find(
    (m) =>
      !(U.amend && 'id' in U.amend && U.amend.id === r.id && U.amend.mode === m) &&
      String(draftsOf(model.S.project)[`${m} ${r.id}`] || '').trim(),
  ) // B301
  const opened = U.moreInputs.has(r.id)
  return (
    <article
      data-r={r.id}
      className="border-b border-zinc-100 px-4 py-2 transition-colors duration-700 dark:border-zinc-800/70"
    >
      <div className="min-w-0">
        <div className="flex min-h-5 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <NotHandled r={r} />
          <span className="shrink-0 font-mono">
            <Hit text={rcode(r.id)} />
          </span>
          <span className="shrink-0 whitespace-nowrap">{when(r.t)}</span>

          {dk ? (
            <button data-act={`input-${dk}`} data-id={r.id} className={`${HIT} shrink-0`}>
              <DraftMark small />
            </button>
          ) : null}
          {scope ? (
            <button
              data-act="goto"
              data-n={scope.n}
              className="relative min-w-0 truncate text-blue-600 after:absolute after:inset-x-0 after:-inset-y-3.5 hover:underline dark:text-blue-400"
            >
              ↳ {code(scope.n)} {scope.title}
            </button>
          ) : null}
          <span className={`ml-auto flex shrink-0 items-center gap-1 font-medium ${tone}`}>
            {icon}
            {label}
          </span>
          {more ? <span className="-my-2 -mr-2 flex shrink-0 items-center">{more}</span> : null}
        </div>
        <div
          data-hit-html
          {...(fold ? { 'data-act': 'more-input', 'data-expand': '', 'data-id': r.id } : {})}
          {...voiceAttr(r)}
          className={`mt-1.5 rounded-2xl rounded-tr-md bg-blue-50 px-3.5 py-2 text-[15px] leading-relaxed text-zinc-900 dark:bg-blue-400/10 dark:text-zinc-100 ${fold ? 'cursor-pointer' : ''}`}
        >
          {r.text ? (
            <Rich text={r.text} gid={'in' + r.id} cls={fold && !opened ? 'max-h-28 overflow-hidden' : ''} />
          ) : null}
          {fold ? (
            <button
              data-act="more-input"
              data-id={r.id}
              className="-my-2 flex h-11 items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {opened ? 'Less' : 'More'}
            </button>
          ) : null}
          {r.files.length ? (
            <div className="mt-2 flex items-end gap-2 overflow-x-auto">
              <Thumbs files={r.files} gid={'in' + r.id} size="size-11" />
            </div>
          ) : null}
        </div>
        {now ? <div className="mt-1 flex flex-wrap items-center gap-1">{now}</div> : null}
      </div>
      <div className="min-w-0">
        {note && chips ? (
          <div className="mt-1 flex items-start gap-1.5">
            <span className="grid h-8 shrink-0 place-items-center text-zinc-400 dark:text-zinc-500">
              <Icon n="sparkle" c="size-3.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <span className={`text-xs ${noteTone}`}>{left.join(' · ')}</span>
              {chips}
            </div>
          </div>
        ) : (
          <>
            {note}
            {chips ? (
              <div className="mt-1 flex items-start gap-1.5">
                {spark}
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{chips}</div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </article>
  )
}
// What is still on its way, shown first where your inputs are listed (F85).
export function OutboxRows({ oldestFirst = false }: { oldestFirst?: boolean }) {
  const mine = U.outbox.filter((q) => !arrived(q) && !q.unsent),
    list = oldestFirst ? mine : [...mine].reverse()
  return (
    <>
      {list.map((q) => (
        <article key={q.q} className="border-b border-zinc-100 px-4 py-2 lg:px-0 lg:py-4 dark:border-zinc-800/70">
          <div
            className={`flex min-h-5 items-center gap-2 text-xs ${q.failed && !q.net ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}
          >
            {q.failed && !q.net ? <Icon n="alert" c="size-3.5" sw="2" /> : dot('bg-blue-500 dark:bg-blue-400')}
            <span className="font-medium">{outboxState(q)}</span>
            {q.scope ? <span className="min-w-0 truncate text-zinc-500 dark:text-zinc-400">↳ {q.scope}</span> : null}
          </div>
          <div className="mt-1.5 rounded-2xl rounded-tr-md bg-blue-50 px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-900 opacity-70 lg:max-w-[calc(100%-22.5rem)] dark:bg-blue-400/10 dark:text-zinc-100">
            {q.text || outboxLine(q)}
            {q.files.some((f) => f.preview) ? (
              <div className="mt-2 flex gap-2">
                {q.files
                  .filter((f) => f.preview)
                  .map((f, i) => (
                    <img
                      key={i}
                      src={f.preview}
                      alt=""
                      className="size-11 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                    />
                  ))}
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </>
  )
}
const FIRST_ROWS = 40,
  MORE_ROWS = 120
export function InputsView({ hidden }: { hidden: boolean }) {
  useArea('inputs')
  useArea('list')
  const ref = useRef<HTMLElement>(null)
  useMarkHits(ref)
  useLayoutEffect(() => {
    els.inputsView = ref.current
  })
  const S = model.S,
    words = searchWords()
  const rows = hidden ? [] : newestFirst(S.inputs).filter((r) => inputMatch(r, words))
  // T339: the tab shows at once with its first screenful; the rest follows a few frames later, not all 400 in one go
  const [upTo, setUpTo] = useState(FIRST_ROWS)
  useEffect(() => {
    const next = hidden ? FIRST_ROWS : upTo < rows.length ? upTo + MORE_ROWS : upTo
    if (next === upTo) return
    const t = requestAnimationFrame(() => setUpTo(next))
    return () => cancelAnimationFrame(t)
  }, [hidden, upTo, rows.length])
  let day = ''
  const out: ReactNode[] = []
  for (const r of rows.slice(
    0,
    Math.max(upTo, Math.ceil((U.tabTop.inputs || 0) / 50) + FIRST_ROWS), // enough to come back to where you were
  )) {
    const d = dayOf(r.t)
    if (d !== day)
      out.push(
        <div key={'d' + r.id} className="px-4 pt-2.5 pb-0.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {(day = d)}
        </div>,
      )
    out.push(<InputCard key={r.id} r={r} />)
  }
  return (
    <section
      id="inputsView"
      ref={ref}
      hidden={hidden}
      className="-mb-(--foot-h) min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(var(--foot-h,0px)+1.5rem)]"
    >
      {hidden ? null : U.outbox.length && !words.length ? <OutboxRows /> : null}
      {hidden ? null : rows.length ? (
        <>
          {out}
          {words.length ? (
            <div className="flex flex-col py-4">
              <SearchHints shown={rows.length} />
            </div>
          ) : null}
        </>
      ) : U.outbox.length ? null : (
        <Empty>
          {words.length ? 'No matching inputs' : 'No inputs yet.'}
          {words.length ? (
            <span className="mt-3 flex flex-col">
              <SearchHints shown={0} />
            </span>
          ) : null}
        </Empty>
      )}
    </section>
  )
}
// ---------------------------------------------------------------- You said lately (the New input page)
// T359: one input in the list under New input: a line saying which it is, when, what it answers and where it
// stands, with what you can do; under it your words and voice notes; under them what became of it. No timeline
// dots (they only said the state again) and no chat bubbles (this is what you said, not a talk).
export function SaidStep({
  head,
  acts,
  body,
  foot,
  time,
  attrs = {},
}: {
  head: ReactNode
  acts?: ReactNode
  body: ReactNode
  foot?: ReactNode
  time?: string
  attrs?: Record<string, unknown>
}) {
  // T359 (D27, design B): what you said first; the time on the right, where Add more and ⋯ take its place while you
  // point at it (nothing moves); the number, state and the item it went to in a small line under it
  return (
    <li className="group/row -mx-3 rounded-lg border-b border-zinc-100 px-3 py-3 last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-900/60">
      <div className="flex min-w-0 items-start gap-3">
        <div {...attrs} className="min-w-0 flex-1 text-[15px] leading-6 text-zinc-900 dark:text-zinc-100">
          {body}
        </div>
        {time || acts ? (
          <div className="grid shrink-0 justify-items-end">
            {time ? (
              <span className="col-start-1 row-start-1 hidden pt-0.5 font-mono text-xs text-zinc-400 tabular-nums lg:block lg:group-focus-within/row:invisible lg:group-hover/row:invisible dark:text-zinc-500">
                {time}
              </span>
            ) : null}
            {acts ? (
              <span className="col-start-1 row-start-1 -my-0.5 flex items-center lg:invisible lg:group-focus-within/row:visible lg:group-hover/row:visible">
                {acts}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {foot ? <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 empty:hidden">{foot}</div> : null}
      <div className="mt-1.5 flex min-h-5 min-w-0 items-center gap-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">
        {head}
        {time ? <span className="shrink-0 tabular-nums lg:hidden">· {time}</span> : null}
      </div>
    </li>
  )
}
// F106: a bubble whose two lines cut the words opens on a click, and closes the same way.
function useCut(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    for (const el of root.querySelectorAll<HTMLElement>('[data-expand]:not([data-act])')) {
      const cut = el.querySelector('[data-cut]')
      if (U.moreInputs.has(el.dataset.id || '') || (cut && cut.scrollHeight > cut.clientHeight + 1)) {
        el.dataset.act = 'more-input'
        el.classList.add('cursor-pointer')
      }
    }
  })
}
// T359: where an input stands, in a word (the whole sentence when you point at it)
const SHORT: Record<string, string> = {
  'Waiting for your agent': 'For your agent', // T438 #11: not the Waiting of what has not reached Taska yet
  'Handled by your agent': 'Handled',
  'Seen by your agent': 'Seen',
  'Left for your agent': 'Left for agent',
}
function SaidRow({ r, words = [] }: { r: Input; last?: boolean; words?: string[] }) {
  const [label, tone, icon] = inputState(r),
    scope = r.scope ? byN.get(r.scope) : undefined
  const said = r.text // B361: a voice note alone is its player, with its length; no "Voice note" over it
  const chips = r.moved
    ? null
    : r.touched
        .filter((n) => byN.has(n) && n !== r.scope)
        .map((n) => {
          const it = byN.get(n)
          if (!it) return null
          return (
            <button
              key={n}
              data-act="goto"
              data-n={n}
              className="flex h-7 max-w-80 min-w-0 items-center gap-1.5 rounded-lg bg-zinc-100 pr-2.5 pl-1.5 text-[13px] text-zinc-800 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <StateIcon s={it.status} label={statusName(it)} cls="size-4" />
              <span className={`font-mono text-xs font-bold ${TYPE_TEXT[it.type]}`}>{code(n)}</span>
              <span className="truncate">{it.title}</span>
            </button>
          )
        })
  const busy = busyOf(r)
  const [now, more] = inputActs(r, SMALL_BTN)
  const dk = (['edit', 'append'] as const).find(
    (m) =>
      !(U.amend && 'id' in U.amend && U.amend.id === r.id && U.amend.mode === m) &&
      String(draftsOf(model.S.project)[`${m} ${r.id}`] || '').trim(),
  ) // C8 (T422): what you began to add or change and did not send shows here, as on the phone (B301)
  return (
    <SaidStep
      time={new Date(r.t).toTimeString().slice(0, 5)}
      head={
        <>
          <span className="shrink-0 font-mono">{rcode(r.id)}</span>

          <span className={`flex shrink-0 items-center gap-1 pr-1 pl-1.5 font-medium ${tone}`}>
            {icon}
            {SHORT[label] || label}
          </span>
          {scope ? (
            <button
              data-act="goto"
              data-n={scope.n}
              className="flex min-w-0 items-center gap-1 rounded-md px-1 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <Icon n="scope" c="size-3.5 shrink-0" />
              <span className={`shrink-0 font-mono text-xs font-bold ${TYPE_TEXT[scope.type]}`}>{code(scope.n)}</span>
              <span className="truncate">{scope.title}</span>
            </button>
          ) : null}
          {dk ? (
            <button data-act={`input-${dk}`} data-id={r.id} className={`${HIT} shrink-0`}>
              <DraftMark small />
            </button>
          ) : null}
          <span className="ml-auto" />
        </>
      }
      acts={
        <>
          <TakeBack job={U.sentJobs.find((j) => j.rid === r.id)} />
          {/* F347: adding to what you said is the most common thing to do here: in sight on every input, not in ⋯ */}
          {r.moved ? null : (
            <button data-act="input-append" data-id={r.id} className={SMALL_BTN}>
              <Icon n="plus" c="size-3.5" sw="2" />
              Add more
            </button>
          )}
          {more}
        </>
      }
      body={
        <>
          {said ? (
            <p data-cut className={`whitespace-pre-line ${U.moreInputs.has(r.id) ? '' : 'line-clamp-3'} break-words`}>
              <Hit text={said} words={words} />
            </p>
          ) : null}
          {r.files.length ? (
            <div className={`flex flex-wrap items-end gap-2 ${said ? 'mt-2' : ''}`}>
              <Thumbs files={r.files} gid={'cl' + r.id} size="size-12" />
            </div>
          ) : null}
        </>
      }
      foot={
        <>
          {chips}
          {busy ? <span className="h-7 w-44 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" /> : null}
          {r.org && !r.org.ok ? (
            <span className="min-w-0 basis-full truncate text-[13px] text-red-600/80 dark:text-red-400/80">
              {r.org.msg}
            </span>
          ) : null}
          {now ? (
            // the first thing on the line starts where the words above it start
            <span className={`flex items-center gap-1.5 ${chips?.length || busy ? '' : '-ml-2'}`}>{now}</span>
          ) : null}
        </>
      }
      attrs={{ 'data-expand': '', 'data-id': r.id, ...voiceAttr(r) }}
    />
  )
}
// B440: taking back what you just sent is on its line in the list (it was on the line over the box)
const TakeBack = ({ job }: { job: Job | undefined }) =>
  job?.undo && !job.undo.entry?.done ? (
    <button data-act="unsend" data-q={job.q} className={SMALL_BTN}>
      <Icon n="undo" c="size-3.5" sw="2" />
      Undo
    </button>
  ) : null
function OutboxStep({ q }: { q: Job; last?: boolean }) {
  const state = outboxState(q)
  return (
    <SaidStep
      head={
        <>
          <span>Just now</span>
          <span
            className={`ml-auto flex shrink-0 items-center gap-1.5 font-medium ${q.failed && !q.net ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}
          >
            {q.failed && !q.net ? (
              <Icon n="alert" c="size-3.5" sw="2" />
            ) : (
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
            )}
            {state}
          </span>
        </>
      }
      acts={
        q.failed ? (
          <>
            <TakeBack job={q} />
            {q.net ? null : (
              <button data-act="outbox-retry" className={`${SMALL_BTN} text-blue-600 dark:text-blue-400`}>
                Retry
              </button>
            )}
            <button data-act="outbox-edit" className={SMALL_BTN}>
              Edit
            </button>
          </>
        ) : (
          <TakeBack job={q} />
        )
      }
      body={
        <>
          {q.text ? <p className="line-clamp-3 break-words">{q.text}</p> : <p>{outboxLine(q)}</p>}
          {q.files.some((f) => f.preview) ? (
            <div className="mt-2 flex gap-2">
              {q.files
                .filter((f) => f.preview)
                .map((f, i) => (
                  <img
                    key={i}
                    src={f.preview}
                    alt=""
                    className="size-12 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                  />
                ))}
            </div>
          ) : null}
        </>
      }
    />
  )
}
// F347: under New input, everything you said, the latest first: more comes as you scroll down; a search on top
const SAID_STEP = 30
// C2 (T422): newest first by when it was said, so one restored or moved back keeps its place
const num = (id: string) => Number(id.replace(/\D/g, '')) || 0
const newestFirst = (list: Input[]) =>
  [...list].sort((a, b) => Date.parse(b.t) - Date.parse(a.t) || num(b.id) - num(a.id))
export function SaidLately({ draft }: { draft: ReactNode }) {
  const S = model.S
  const ref = useRef<HTMLDivElement>(null),
    end = useRef<HTMLLIElement>(null)
  const [q, setQ] = useState('')
  const [upTo, setUpTo] = useState(SAID_STEP)
  useCut(ref)
  useMarkHits(ref)
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const all = newestFirst(S.inputs).filter((r) => inputMatch(r, words)),
    recent = all.slice(0, upTo),
    queued = words.length ? [] : [...U.outbox].reverse().filter((q) => !arrived(q) && !q.unsent),
    n = queued.length + recent.length,
    rest = all.length > recent.length
  useEffect(() => {
    const el = end.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (seen) => {
        if (seen.some((e) => e.isIntersecting)) setUpTo((u) => u + SAID_STEP)
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rest, upTo])
  return (
    <div ref={ref}>
      {/* C17 (T422): a new project has said nothing yet: no heading over nothing */}
      <div hidden={!S.inputs.length && !queued.length} className="flex h-9 items-center gap-3">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">You said</h2>
        <span className="font-mono text-xs text-zinc-400 tabular-nums dark:text-zinc-500">
          {(words.length ? all.length : S.inputs.length) || ''}
        </span>
        {S.inputs.length ? (
          <label className="ml-auto flex h-9 w-64 min-w-0 items-center gap-2 rounded-xl bg-zinc-100 pl-3 text-zinc-400 ring-blue-500/40 focus-within:bg-white focus-within:ring-2 dark:bg-zinc-800 dark:text-zinc-500 dark:focus-within:bg-zinc-900">
            <Icon n="search" c="size-4" />
            <input
              id="saidQ"
              type="search"
              autoComplete="off"
              placeholder="Search what you said"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setUpTo(SAID_STEP)
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 [&::-webkit-search-cancel-button]:hidden"
            />
          </label>
        ) : null}
      </div>
      <ol id="draftSlot">{draft}</ol>
      {n ? (
        <ol className="mt-4">
          {queued.map((q, k) => (
            <OutboxStep key={q.q} q={q} last={k === n - 1} />
          ))}
          {recent.map((r, k) => {
            // T359: the inputs of a day under its name; each says only its time
            const day = dayOf(r.t),
              head = k === 0 || dayOf(recent[k - 1].t) !== day
            return (
              <Fragment key={r.id}>
                {head ? (
                  <li className="pt-5 pb-1 text-xs font-semibold text-zinc-500 first:pt-1 dark:text-zinc-400">{day}</li>
                ) : null}
                <SaidRow r={r} last={!rest && queued.length + k === n - 1} words={words} />
              </Fragment>
            )
          })}
          {rest ? (
            <li ref={end} className="flex h-16 items-center pl-9 text-sm text-zinc-400 dark:text-zinc-500">
              Loading more…
            </li>
          ) : null}
        </ol>
      ) : (
        <p id="saidNone" className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">
          {words.length ? `No matches for “${q.trim()}”.` : null}
        </p>
      )}
    </div>
  )
}
// The New input page's head: the project, and what the box does now (B73)
export function ComposeHead() {
  // B440 (over D25 #1): the project's name over the box, as Yadong asked; the line under it stays out. T438 #2: also
  // while you edit or add to an input (the box's own line says that), so the box never moves
  return (
    <div className="flex items-center gap-3">
      <ProjTile name={model.S.project} cls="size-11 rounded-xl text-xl shadow-sm" />
      <h1 className="text-[28px] leading-none font-semibold tracking-tight">{projTitle()}</h1>
    </div>
  )
}
