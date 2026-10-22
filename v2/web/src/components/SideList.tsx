// T402 (D30, design A): Documents, Activity and Deleted are lists in the list column, like the item list: the sidebar
// stays, the item pane shows what you open. Actions repeated on every row show on hover only.
import { U, byN, code, liveN, model, plural, rcode, useArea, when } from '../lib/state'
import { useEffect } from 'react'
import { P_CACHE, loadLog } from '../lib/settings'
import { clean } from '../lib/markdown'
import { LogMore, logLine } from './Settings'
import { Empty, Icon } from './ui'

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
            <Icon n="file" c="mt-0.5 size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
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

function Log() {
  const lines = P_CACHE.log
  if (!lines) return <Empty>Loading…</Empty>
  if (!lines.length) return <Empty>Nothing has changed yet.</Empty>
  return (
    <>
      {lines.map((l) => {
        const u = (model.S.undo || []).find((x) => l.startsWith(`#${x.seq} `)) // one of your changes that can be put back (F80)
        return (
          <div
            key={l.slice(0, l.indexOf(' '))}
            className={`${ROW} text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300`}
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

function Deleted() {
  const S = model.S,
    gone = S.gone || [],
    inputs = S.deleted || []
  if (!gone.length && !inputs.length) return <Empty>Nothing deleted</Empty>
  return (
    <>
      {gone.map((x) => {
        const label = x.kind === 'item' ? x.code : `D${x.d}`
        return (
          <div key={label} className={ROW}>
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
      {inputs.map((x) => (
        <div key={x.id} className={ROW}>
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
      ))}
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
