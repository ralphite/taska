// What you said (inputs), and what became of each: the Inputs tab (a list; on the desktop a list and a pane, T274 #9),
// "You said lately" on the New input page, and what is still on its way (F85).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { HIT, LINK_BTN, SMALL_BTN, TYPE_TEXT } from '../lib/constants'
import {
  U,
  byN,
  code,
  dayOf,
  desk,
  inputMatch,
  model,
  oneLine,
  otherProjects,
  parseRef,
  plural,
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
export const filingTip = (r: Input) => `Undo what the organizer did with ${rcode(r.id)}: ${r.filing?.what || ''}`
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
  if (r.acked)
    return r.org?.keep
      ? ['Handled by your agent', 'text-zinc-400 dark:text-zinc-500', check]
      : !r.org && !r.touched.length
        ? ['Seen by your agent', 'text-zinc-500 dark:text-zinc-400', check]
        : ['Organized', 'text-emerald-700 dark:text-emerald-400', check]
  if (r.org && !r.org.ok)
    return ['Organizer failed', 'text-red-600 dark:text-red-400', <Icon n="alert" c="size-3.5" sw="2" />] // T232 #5
  if (r.org) return ['Left for your agent', 'text-zinc-600 dark:text-zinc-300', <Icon n="arrow" c="size-3.5" sw="2" />]
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
    busy = busyOf(r),
    quiet = cls === LINK_BTN ? ' text-zinc-600 dark:text-zinc-300' : ''
  const retry =
    !r.acked && S.org?.on && r.org && (!r.org.ok || r.org.undone) ? (
      <button key="retry" data-act="retry" data-id={r.id} className={cls}>
        <Icon n="loop" c="size-3.5" sw="2" />
        {r.org.undone ? 'Organize again' : 'Retry'}
      </button>
    ) : null
  const make =
    !r.acked && !r.scope && !busy ? (
      <button
        key="make"
        data-act="make-item"
        data-id={r.id}
        className={cls
          .replace(/text-zinc-500|hover:text-zinc-800/g, 'text-blue-600')
          .replace(/dark:text-zinc-400|dark:hover:text-zinc-200/g, 'dark:text-blue-400')}
      >
        <Icon n="plus" c="size-3.5" sw="2" />
        Turn into item
      </button>
    ) : null
  const now = retry || make ? [retry, make] : null
  const more = (
    <button
      data-act="input-more"
      data-id={r.id}
      title="Edit, add more, move, delete…"
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
// One input with what became of it and what you can do with it: a row of Inputs on the phone, the pane on the desktop
// B329: a dot on the inputs the Inputs tab's number counts: those not handled yet
function NotHandled({ r }: { r: Input }) {
  return r.acked ? null : (
    <span
      title="Not handled yet: counted in the Inputs number"
      className="size-2 shrink-0 rounded-full bg-blue-500 dark:bg-blue-400"
    />
  )
}
export function InputCard({ r, pane = false }: { r: Input; pane?: boolean }) {
  const [label, tone, icon] = inputState(r),
    scope = r.scope ? byN.get(r.scope) : null,
    fold = !pane && long(r)
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
      className={
        pane
          ? 'rounded-xl transition-colors duration-700'
          : 'border-b border-zinc-100 px-4 py-2 transition-colors duration-700 dark:border-zinc-800/70'
      }
    >
      <div className="min-w-0">
        <div className="flex min-h-5 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          {pane ? null : (
            <>
              <NotHandled r={r} />
              <span className="shrink-0 font-mono">
                <Hit text={rcode(r.id)} />
              </span>
              <span className="shrink-0 whitespace-nowrap">{when(r.t)}</span>
            </>
          )}
          {r.from === 'rules' ? <span className="font-medium">as a rule</span> : null}
          {dk ? (
            <button
              data-act={`input-${dk}`}
              data-id={r.id}
              title="Not saved yet: go on with it"
              className={`${HIT} shrink-0`}
            >
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
          <span className={`ml-auto flex shrink-0 items-center gap-1 font-medium lg:hidden ${tone}`}>
            {icon}
            {label}
          </span>
          {more ? <span className="-my-2 -mr-2 flex shrink-0 items-center lg:hidden">{more}</span> : null}
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
            <div className="mt-2 flex items-end gap-2 overflow-x-auto lg:scrollbar-thin">
              <Thumbs files={r.files} gid={'in' + r.id} size="size-11" />
            </div>
          ) : null}
        </div>
        {now ? <div className="mt-1 flex flex-wrap items-center gap-1 lg:hidden">{now}</div> : null}
      </div>
      <div className="min-w-0 lg:pt-4">
        <div className={`hidden items-center gap-1.5 text-[13px] font-semibold lg:flex ${tone}`}>
          {icon}
          {label}
          {now || more ? (
            <span className="-my-2 ml-auto flex items-center gap-1 font-normal">
              {now}
              {more}
            </span>
          ) : null}
        </div>
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
const ROW_TINT =
  'data-sel:bg-blue-100 dark:data-sel:bg-blue-400/20 lg:data-sel:hover:bg-blue-100 dark:lg:data-sel:hover:bg-blue-400/20 lg:hover:bg-zinc-50 dark:lg:hover:bg-zinc-900/70 lg:aria-[current=true]:bg-blue-50 dark:lg:aria-[current=true]:bg-blue-400/10 pointer-coarse:transition-colors pointer-coarse:delay-75 data-pressed:bg-zinc-100 lg:data-pressed:bg-zinc-100 dark:data-pressed:bg-zinc-900 dark:lg:data-pressed:bg-zinc-900'
// the desktop's list of inputs: what you said in two lines, where it stands
function InputRow({ r }: { r: Input }) {
  const [label, tone] = inputState(r),
    said = r.text
      ? r.text.replace(/\s+/g, ' ').trim()
      : r.files.some((f) => (f.mime || '').startsWith('audio/'))
        ? 'Voice note'
        : plural(r.files.length, 'file')
  return (
    <article data-ri={r.id} className="border-b border-zinc-100 dark:border-zinc-800/70">
      <div
        data-act="in-pick"
        data-id={r.id}
        {...(U.inSel === r.id ? { 'aria-current': 'true' as const } : {})}
        className={`cursor-pointer px-4 py-2.5 ${ROW_TINT}`}
      >
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <NotHandled r={r} />
          <span className="font-mono">{rcode(r.id)}</span>
          <span>{when(r.t)}</span>
          <span className={`ml-auto font-medium ${tone}`}>{label}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[15px] leading-snug">
          <Hit text={said} />
        </p>
      </div>
    </article>
  )
}
export const outboxLine = (q: Job) =>
  q.text.split('\n')[0] ||
  (q.files.some((f) => (f.mime || '').startsWith('audio/'))
    ? 'Voice note'
    : `${q.files.length} file${q.files.length === 1 ? '' : 's'}`)
// What is still on its way, shown first where your inputs are listed (F85).
export function OutboxRows({ oldestFirst = false }: { oldestFirst?: boolean }) {
  const list = oldestFirst ? [...U.outbox] : [...U.outbox].reverse()
  return (
    <>
      {list.map((q) => (
        <article key={q.q} className="border-b border-zinc-100 px-4 py-2 lg:px-0 lg:py-4 dark:border-zinc-800/70">
          <div
            className={`flex min-h-5 items-center gap-2 text-xs ${q.failed ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}
          >
            {q.failed ? <Icon n="alert" c="size-3.5" sw="2" /> : dot('bg-blue-500 dark:bg-blue-400')}
            <span className="font-medium">
              {q.failed ? 'Not sent' : q.files.some((f) => !f.f && !f.failed) ? 'Uploading…' : 'Sending…'}
            </span>
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
  const rows = hidden ? [] : [...S.inputs].reverse().filter((r) => inputMatch(r, words))
  if (desk() && !rows.some((r) => r.id === U.inSel)) U.inSel = rows[0]?.id || null
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
    Math.max(upTo, rows.findIndex((x) => x.id === U.inSel) + 1, Math.ceil((U.tabTop.inputs || 0) / 50) + FIRST_ROWS), // enough to come back to where you were
  )) {
    const d = dayOf(r.t)
    if (d !== day)
      out.push(
        <div key={'d' + r.id} className="px-4 pt-2.5 pb-0.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {(day = d)}
        </div>,
      )
    out.push(desk() ? <InputRow key={r.id} r={r} /> : <InputCard key={r.id} r={r} />)
  }
  return (
    <section
      id="inputsView"
      ref={ref}
      hidden={hidden}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 lg:col-start-1 lg:row-span-2 lg:row-start-4 lg:scrollbar-thin lg:scrollbar-gutter-stable lg:border-r lg:border-zinc-200 lg:hover:scrollbar-thumb-zinc-500/80 dark:lg:border-zinc-800 dark:lg:hover:scrollbar-thumb-zinc-400/70"
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
// T274 #9: the input picked in the list, whole (the desktop's pane)
export function InputPane() {
  const r = U.inSel ? model.S.inputs.find((x) => x.id === U.inSel) : undefined
  const ref = useRef<HTMLDivElement>(null)
  useMarkHits(ref)
  return r ? (
    <div ref={ref} className="mx-auto w-full max-w-[46rem] px-8 pt-6 pb-12">
      <InputCard r={r} pane />
    </div>
  ) : (
    <div className="grid h-full place-items-center p-8 text-center text-[15px] text-zinc-500 dark:text-zinc-400">
      Pick an input, or write one below
    </div>
  )
}
export function InputPaneHead() {
  const r = U.inSel ? model.S.inputs.find((x) => x.id === U.inSel) : undefined
  return r ? (
    <>
      <span className="font-mono text-sm font-bold">{rcode(r.id)}</span>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{when(r.t)}</span>
    </>
  ) : null
}

// ---------------------------------------------------------------- You said lately (the New input page)
const DOT: Record<string, ReactNode> = {
  pulse: (
    <span className="relative flex size-2.5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
      <span className="relative inline-flex size-2.5 rounded-full bg-blue-500 dark:bg-blue-400" />
    </span>
  ),
  ok: (
    <span className="size-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15 dark:bg-emerald-400 dark:ring-emerald-400/15" />
  ),
  bad: (
    <span className="size-2.5 rounded-full bg-red-500 ring-4 ring-red-500/15 dark:bg-red-400 dark:ring-red-400/15" />
  ),
  idle: <span className="size-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />,
  wait: <span className="size-2.5 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />,
}
const dotOf = (r: Input) => {
  const S = model.S
  return r.moved
    ? 'wait'
    : S.org?.busy === r.id || r.tr_wait
      ? 'pulse'
      : r.org && !r.org.ok
        ? 'bad'
        : r.org?.undone
          ? 'idle'
          : r.acked
            ? 'ok'
            : !r.org && S.org?.on
              ? 'idle'
              : 'wait'
}
// One step of the timeline: a dot, your words in a bubble, and the line saying what became of them.
export function SaidStep({
  dot,
  bubble,
  meta,
  result,
  last,
  attrs = {},
}: {
  dot: ReactNode
  bubble: ReactNode
  meta: ReactNode
  result: ReactNode
  last: boolean
  attrs?: Record<string, unknown>
}) {
  return (
    <li className="group/row relative flex gap-3 pb-5">
      {last ? null : (
        <span
          aria-hidden="true"
          className="absolute top-7.5 -bottom-1.5 left-[11.5px] w-px bg-zinc-200 dark:bg-zinc-800"
        />
      )}
      <span className="relative mt-1.5 grid size-6 shrink-0 place-items-center">{dot}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div
            {...attrs}
            className="w-fit max-w-full min-w-0 rounded-2xl rounded-tl-md bg-blue-50 px-3.5 py-1.5 text-[15px] leading-6 text-zinc-900 dark:bg-blue-400/10 dark:text-zinc-100"
          >
            {bubble}
          </div>
          <span className="ml-auto shrink-0 pt-1.5 text-xs whitespace-nowrap text-zinc-400 tabular-nums dark:text-zinc-500">
            {meta}
          </span>
        </div>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">{result}</div>
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
function SaidRow({ r, last }: { r: Input; last: boolean }) {
  const [label, tone] = inputState(r),
    scope = r.scope ? byN.get(r.scope) : undefined
  const said = r.text || (r.files.some((f) => (f.mime || '').startsWith('audio/')) ? 'Voice note' : '')
  const bubble = (
    <>
      {scope ? (
        <button
          data-act="goto"
          data-n={scope.n}
          className="mb-0.5 flex max-w-full items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
        >
          <Icon n="reply" c="size-3.5" />
          <span className="truncate">
            Reply to {code(scope.n)} · {scope.title}
          </span>
        </button>
      ) : null}
      {said ? (
        <p data-cut className={`${U.moreInputs.has(r.id) ? 'whitespace-pre-line' : 'line-clamp-2'} break-words`}>
          {said}
        </p>
      ) : null}
      {r.files.length ? (
        <div className="mt-2 flex items-end gap-2">
          <Thumbs files={r.files} gid={'cl' + r.id} size="size-12" />
        </div>
      ) : null}
    </>
  )
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
              title={`Open ${code(n)}`}
              className="flex h-7 max-w-60 min-w-0 items-center gap-1.5 rounded-lg bg-zinc-100 pr-2.5 pl-1.5 text-[13px] text-zinc-800 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <StateIcon s={it.status} label={statusName(it)} cls="size-4" />
              <span className={`font-mono text-xs font-bold ${TYPE_TEXT[it.type]}`}>{code(n)}</span>
              <span className="truncate">{it.title}</span>
            </button>
          )
        })
  const busy = busyOf(r)
  const [now, more] = inputActs(r, SMALL_BTN)
  return (
    <SaidStep
      dot={DOT[dotOf(r)]}
      bubble={bubble}
      meta={
        <>
          <span className="font-mono">{rcode(r.id)}</span> · {when(r.t)}
          {r.from === 'rules' ? ' · as a rule' : ''}
        </>
      }
      result={
        <>
          <span className={`mr-1 text-[13px] font-semibold ${tone}`}>{label}</span>
          {more ? <span className="-my-1 ml-auto">{more}</span> : null}
          <div className="flex basis-full flex-wrap items-center gap-1.5 empty:hidden">
            {chips}
            {busy ? <span className="h-7 w-44 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" /> : null}
            {r.org && !r.org.ok ? (
              <span className="min-w-0 basis-full truncate text-[13px] text-red-600/80 dark:text-red-400/80">
                {r.org.msg}
              </span>
            ) : null}
            {now}
          </div>
        </>
      }
      last={last}
      attrs={{ 'data-expand': '', 'data-id': r.id, ...voiceAttr(r) }}
    />
  )
}
function OutboxStep({ q, last }: { q: Job; last: boolean }) {
  const state = q.failed ? 'Not sent' : q.files.some((f) => !f.f && !f.failed) ? 'Uploading…' : 'Sending…'
  return (
    <SaidStep
      dot={q.failed ? DOT.bad : DOT.pulse}
      bubble={
        <>
          {q.text ? <p className="line-clamp-2 break-words">{q.text}</p> : <p>{outboxLine(q)}</p>}
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
      meta="Just now"
      result={
        <>
          <span
            className={`mr-1 text-[13px] font-semibold ${q.failed ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}
          >
            {state}
          </span>
          {q.failed ? (
            <>
              <button data-act="outbox-retry" className={`${SMALL_BTN} text-blue-600 dark:text-blue-400`}>
                Retry
              </button>
              <button data-act="outbox-edit" className={SMALL_BTN}>
                Edit
              </button>
            </>
          ) : null}
        </>
      }
      last={last}
    />
  )
}
export function SaidLately({ draft }: { draft: ReactNode }) {
  const S = model.S
  const ref = useRef<HTMLDivElement>(null)
  useCut(ref)
  const recent = [...S.inputs].reverse().slice(0, 5),
    queued = [...U.outbox].reverse(),
    n = queued.length + recent.length
  return (
    <div ref={ref}>
      <div className="flex h-8 items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          You said lately
        </h2>
        {S.inputs.length ? (
          <button
            data-act="tab"
            data-tab="inputs"
            title="All inputs · G N"
            className="flex h-8 items-center gap-1 rounded-lg pr-1.5 pl-2 text-[13px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10"
          >
            All {S.inputs.length} input{S.inputs.length === 1 ? '' : 's'}
            <kbd className="ml-1 hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold opacity-70 ring-1 ring-current/30 lg:inline-grid">
              G N
            </kbd>
          </button>
        ) : null}
      </div>
      <ol id="draftSlot">{draft}</ol>
      {n ? (
        <ol className="mt-4">
          {queued.map((q, k) => (
            <OutboxStep key={q.q} q={q} last={k === n - 1} />
          ))}
          {recent.map((r, k) => (
            <SaidRow key={r.id} r={r} last={queued.length + k === n - 1} />
          ))}
        </ol>
      ) : (
        <p id="saidNone" className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">
          What you say shows up here, with the items it turns into.
        </p>
      )}
    </div>
  )
}
// The New input page's head: the project, and what the box does now (B73)
export function ComposeHead() {
  const S = model.S
  const tile = <ProjTile name={S.project} cls="size-11 rounded-xl text-xl shadow-sm" />
  const back = (act: string) => (
    <button
      data-act={act}
      className="mt-2 h-8 rounded-full px-3 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      Back to a new input
      <kbd className="ml-1 hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold opacity-70 ring-1 ring-current/30 lg:inline-grid">
        Esc
      </kbd>
    </button>
  )
  if (U.correct && S.inputs.some((r) => r.id === U.correct?.id))
    return (
      <>
        <div className="flex items-center gap-3">
          {tile}
          <h1 className="text-[28px] leading-none font-semibold tracking-tight">Correct “{U.correct.wrong}”</h1>
        </div>
        <p className="mt-3.5 text-[15px] text-zinc-500 dark:text-zinc-400">
          in {U.correct.id}; voice notes in every project will write it your way from now on
        </p>
        {back('correct-cancel')}
      </>
    )
  const am = U.amend && 'id' in U.amend ? U.amend : null,
    a = am ? S.inputs.find((r) => r.id === am.id) : undefined
  if (am && a)
    return (
      <>
        <div className="flex items-center gap-3">
          {tile}
          <h1 className="text-[28px] leading-none font-semibold tracking-tight">
            {am.mode === 'edit' ? 'Edit' : 'Add details to'} {a.id}
          </h1>
        </div>
        <p className="mt-3.5 line-clamp-2 max-w-full text-[15px] text-zinc-500 dark:text-zinc-400">
          “{oneLine(a.text)}”
        </p>
        {back('amend-cancel')}
      </>
    )
  return null
}
