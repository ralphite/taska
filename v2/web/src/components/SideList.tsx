// T402 (D30, design A): Documents, Activity and Deleted are lists in the list column, like the item list: the sidebar
// stays, the item pane shows what you open. Actions repeated on every row show on hover only.
import { U, byN, byR, code, docById, liveN, model, parseRef, plural, rcode, useArea, when } from '../lib/state'
import { useEffect } from 'react'
import { P_CACHE, loadLog } from '../lib/settings'
import { clean } from '../lib/markdown'
import { LogMore, logLine } from './Settings'
import { Empty, Icon } from './ui'
import { PRIMARY } from '../lib/constants'

export type Side = 'docs' | 'log' | 'deleted'
const TITLE: Record<Side, string> = { docs: 'Documents', log: 'Activity', deleted: 'Deleted' }
const ROW =
  'group relative flex items-start gap-3 border-b border-zinc-100 py-2.5 pr-3 pl-4 lg:hover:bg-zinc-50 dark:border-zinc-800/70 dark:lg:hover:bg-zinc-900/70'
const HOVER_BTN =
  'shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 dark:text-blue-400 dark:hover:bg-blue-400/10'

function Docs() {
  const docs = [...(model.S.docs || [])].sort((a, b) => String(b.t || '').localeCompare(String(a.t || '')) || b.d - a.d)
  if (!docs.length)
    return (
      <Empty>
        No documents yet.
        <br />
        Agents write them on items; an item&apos;s ⋯ makes one too.
      </Empty>
    )
  return (
    <>
      {docs.map((d) => {
        const it = byN.get(liveN(d.n)),
          c = d.blocks.reduce((k, b) => k + b.comments.length, 0) + (d.whole?.length || 0)
        return (
          <div
            key={d.d}
            data-act="docs-go"
            data-d={d.d}
            {...(U.doc === d.d ? { 'aria-current': 'true' as const } : {})}
            className={`${ROW} cursor-pointer lg:aria-[current=true]:bg-blue-50 dark:lg:aria-[current=true]:bg-blue-400/10`}
          >
            <Icon n={d.fmt === 'html' ? 'web' : 'file'} c="mt-0.5 size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] leading-snug font-medium">{d.title}</p>
              <p className="mt-1 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span className="font-mono">D{d.d}</span>
                {it ? ` · ${code(it.n)} ${it.title}` : ''}
                {c ? ` · ${plural(c, 'comment')}` : ''}
                {d.t ? ` · ${when(d.t)}` : ''}
              </p>
            </div>
          </div>
        )
      })}
    </>
  )
}

// B430: what a line of Activity is about, opened in the pane beside it: its item, else its document, else its input
function logTarget(l: string): Record<string, string> | null {
  const what = l.replace(/^#\d+ \S+ \S+ \S+ /, '')
  for (const c of what.match(/\b[A-Z]\d{1,5}\b/g) || []) {
    if (c[0] === 'D' && docById(Number(c.slice(1)))) return { 'data-d': c.slice(1) }
    const n = parseRef(c)
    if (n && byN.has(n) && code(n) === c) return { 'data-n': String(n) }
  }
  const r = what.match(/\br\d+\b/)?.[0]
  return r && byR.has(r) ? { 'data-id': r } : null
}
function Log() {
  const lines = P_CACHE.log
  if (!lines) return <Empty>Loading…</Empty>
  if (!lines.length) return <Empty>Nothing has changed yet.</Empty>
  return (
    <>
      {lines.map((l) => {
        const u = (model.S.undo || []).find((x) => l.startsWith(`#${x.seq} `)) // one of your changes that can be put back (F80)
        const key = l.slice(0, l.indexOf(' ')),
          to = logTarget(l)
        return (
          <div
            key={key}
            {...(to ? { 'data-act': 'log-open', 'data-key': key, ...to } : {})}
            {...(U.sideSel === key ? { 'aria-current': 'true' as const } : {})}
            className={`${ROW} text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300 ${to ? 'cursor-pointer' : ''} lg:aria-[current=true]:bg-blue-50 dark:lg:aria-[current=true]:bg-blue-400/10`}
          >
            <span
              className="min-w-0 flex-1 break-words"
              dangerouslySetInnerHTML={{ __html: clean(logLine(l, false)) }}
            />
            <span className="shrink-0 pt-px font-mono text-[11px] whitespace-nowrap text-zinc-400 dark:text-zinc-500">
              {(/^#\d+ (\S+ \S+) /.exec(l) || ['', ''])[1]}
            </span>
            {u ? (
              <button data-act="revert" data-seq={u.seq} className={`${HOVER_BTN} -my-1`}>
                Undo
              </button>
            ) : null}
          </div>
        )
      })}
      <LogMore cls="px-4 py-3" />
    </>
  )
}

type DeletedIn = NonNullable<typeof model.S.deleted>[number]
function DeletedInput({ x }: { x: DeletedIn }) {
  return (
    <div
      data-act="gone-show"
      data-key={x.id}
      {...(U.sideSel === x.id ? { 'aria-current': 'true' as const } : {})}
      className={`${ROW} cursor-pointer lg:aria-[current=true]:bg-blue-50 dark:lg:aria-[current=true]:bg-blue-400/10`}
    >
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] leading-snug break-words">
          {x.text || (x.files ? plural(x.files, 'file') : '')}
        </p>
        <p className="mt-1 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <span className="font-mono">{rcode(x.id)}</span> · deleted {when(x.at)}
          {x.items.length ? ` · with ${x.items.map((i) => i.code).join(', ')}` : ''}
        </p>
      </div>
      <button data-act="input-restore" data-id={x.id} className={HOVER_BTN}>
        Restore
      </button>
    </div>
  )
}

function Deleted() {
  const S = model.S,
    gone = S.gone || [],
    inputs = S.deleted || []
  if (!gone.length && !inputs.length) return <Empty>Nothing deleted</Empty>
  // C15 (T422): one list, the latest deleted first, whatever it was
  const rows = [
    ...gone.map((x) => ({ at: x.at, gone: x, input: null })),
    ...inputs.map((x) => ({ at: x.at, gone: null, input: x })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  return (
    <>
      {rows.map(({ gone: x, input }) => {
        if (!x) return input ? <DeletedInput key={input.id} x={input} /> : null
        const label = x.kind === 'item' ? x.code : `D${x.d}`
        return (
          <div
            key={label}
            data-act="gone-show"
            data-key={label}
            {...(U.sideSel === label ? { 'aria-current': 'true' as const } : {})}
            className={`${ROW} cursor-pointer lg:aria-[current=true]:bg-blue-50 dark:lg:aria-[current=true]:bg-blue-400/10`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] leading-snug font-medium">
                <span className="mr-1.5 font-mono text-[13px] font-bold">{label}</span>
                {x.title}
              </p>
              <p className="mt-1 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {x.kind === 'item'
                  ? `Item${x.more ? `, with ${plural(x.more, 'subitem')}` : ''}`
                  : `Document${x.on ? ` on ${x.on}` : ''}`}{' '}
                · deleted {when(x.at)}
              </p>
            </div>
            <button
              data-act="gone-restore"
              data-kind={x.kind}
              data-ref={x.code || ''}
              data-d={x.d || ''}
              data-label={label}
              className={HOVER_BTN}
            >
              Restore
            </button>
          </div>
        )
      })}
    </>
  )
}

export function SideList({ side }: { side: Side }) {
  useArea('project')
  useEffect(() => {
    if (side === 'log' && P_CACHE.logRev !== model.S.rev) loadLog() // what changed since shows too
  })
  const n =
    side === 'docs'
      ? (model.S.docs || []).length
      : side === 'deleted'
        ? (model.S.gone || []).length + (model.S.deleted || []).length
        : 0 // the log loads as you scroll: how many are loaded says nothing (T427)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <h2 className="text-[15px] font-semibold">{TITLE[side]}</h2>
        {n ? <span className="font-mono text-xs text-zinc-400 tabular-nums dark:text-zinc-500">{n}</span> : null}
      </div>
      <div id="sideList" className="min-h-0 flex-1 overflow-y-auto lg:scrollbar-thin">
        {side === 'docs' ? <Docs /> : side === 'log' ? <Log /> : <Deleted />}
      </div>
    </div>
  )
}

// B430: a deleted thing you clicked, beside the list: what it was, when it went, and Restore
export function DeletedView() {
  useArea('project')
  const k = U.sideSel,
    g = (model.S.gone || []).find((x) => (x.kind === 'item' ? x.code : `D${x.d}`) === k),
    r = (model.S.deleted || []).find((x) => x.id === k)
  if (!g && !r) return null
  return (
    <div className="mx-auto w-full max-w-[46rem] px-8 pt-8">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {g
          ? g.kind === 'item'
            ? `Item${g.more ? `, with ${plural(g.more, 'subitem')}` : ''}`
            : `Document${g.on ? ` on ${g.on}` : ''}`
          : `Input ${rcode(r?.id)}`}{' '}
        · deleted {when((g || r)?.at)}
      </p>
      {g ? (
        <h1 className="mt-2 text-2xl leading-tight font-semibold tracking-tight">
          <span className="mr-2 font-mono text-lg font-bold">{k}</span>
          {g.title}
        </h1>
      ) : null}
      {r ? (
        <p className="mt-2 text-[15px] leading-relaxed break-words whitespace-pre-line">
          {r.text || (r.files ? plural(r.files, 'file') : '')}
        </p>
      ) : null}
      {r?.items.length ? (
        <p className="mt-3 text-[13px] text-zinc-500 dark:text-zinc-400">
          With {r.items.map((i) => i.code).join(', ')}
        </p>
      ) : null}
      <button
        {...(g
          ? {
              'data-act': 'gone-restore',
              'data-kind': g.kind,
              'data-ref': g.code || '',
              'data-d': g.d || '',
              'data-label': k || '',
            }
          : { 'data-act': 'input-restore', 'data-id': r?.id })}
        className={`mt-6 ${PRIMARY}`}
      >
        Restore
      </button>
    </div>
  )
}
