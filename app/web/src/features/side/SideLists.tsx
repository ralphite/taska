// Documents, Activity and Deleted: lists in the list's column on the desktop, like the item list; the pane beside
// shows what you open from them. Actions repeated on every row show when the pointer is on the row. Props only.

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import type { LogSentence } from '../../model/activity'
import { plural } from '../../model/words'
import { Icon } from '../../ui/Icon'
import { PRIMARY } from '../../ui/tones'

export type Side = 'docs' | 'log' | 'deleted'
const TITLE: Record<Side, string> = { docs: 'Documents', log: 'Activity', deleted: 'Deleted' }

const ROW = 'group relative flex items-start gap-3 border-b border-zinc-100 py-2.5 pr-3 pl-4 lg:hover:bg-zinc-50 dark:border-zinc-800/70 dark:lg:hover:bg-zinc-900/70'
const PICKED = 'lg:aria-[current=true]:bg-blue-50 dark:lg:aria-[current=true]:bg-blue-400/10'
const HOVER_BTN = 'shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 dark:text-blue-400 dark:hover:bg-blue-400/10'

const current = (on: boolean) => (on ? { 'aria-current': 'true' as const } : {})
/** a row's own click, not one on a button or link in it */
const onRow = (run: () => void) => (e: MouseEvent) => {
  if (!(e.target as Element).closest('button, a')) run()
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-6 py-16 text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{children}</div>
}

/** The list's head and its scroller. */
export function SideFrame({ side, count, scrollRef, children }: { side: Side; count: number; scrollRef?: (el: HTMLDivElement | null) => void; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <h2 className="text-[15px] font-semibold">{TITLE[side]}</h2>
        {count ? <span className="font-mono text-xs text-zinc-400 tabular-nums dark:text-zinc-500">{count}</span> : null}
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto lg:scrollbar-thin">
        {children}
      </div>
    </div>
  )
}

export interface DocRow {
  d: number
  title: string
  web: boolean
  /** its item, as "F12 title" */
  on: string
  comments: number
}

export function DocsList({ docs, open, onOpen }: { docs: DocRow[]; open: number | null; onOpen(d: number): void }) {
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
      {docs.map((d) => (
        <div key={d.d} onClick={() => onOpen(d.d)} {...current(open === d.d)} className={`${ROW} cursor-pointer ${PICKED}`}>
          <Icon n={d.web ? 'web' : 'doc'} c="mt-0.5 size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] leading-snug font-medium">{d.title}</p>
            <p className="mt-1 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span className="font-mono">D{d.d}</span>
              {d.on ? ` · ${d.on}` : ''}
              {d.comments ? ` · ${plural(d.comments, 'comment')}` : ''}
            </p>
          </div>
        </div>
      ))}
    </>
  )
}

export interface LogEvents {
  item(n: number): void
  input(id: string): void
}

/** One change as a sentence: who, then what, its codes as links; the time in grey when asked for. */
export function LogLine({ s, withTime = false, on }: { s: LogSentence; withTime?: boolean; on: LogEvents }) {
  // the spaces go with the words beside them, one run of text each, as the words are set
  const parts: LogSentence['parts'] = []
  for (const p of [' ', ...s.parts, ...(withTime ? [' '] : [])]) {
    const last = parts.at(-1)
    if (typeof p === 'string' && typeof last === 'string') parts[parts.length - 1] = last + p
    else parts.push(p)
  }
  return (
    <>
      <span className="font-medium text-zinc-800 dark:text-zinc-100">{s.who}</span>
      {s.session ? (
        <>
          {' '}
          <span className="text-zinc-500 dark:text-zinc-400">{'· ' + s.session}</span>
        </>
      ) : null}
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : 'n' in p ? (
          <button key={i} onClick={() => on.item(p.n)} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
            {p.code}
          </button>
        ) : (
          <button key={i} onClick={() => on.input(p.id)} className="font-mono text-blue-600 hover:underline dark:text-blue-400">
            {p.code}
          </button>
        ),
      )}
      {withTime ? <span className="font-mono text-[11px] whitespace-nowrap text-zinc-400">{s.time}</span> : null}
    </>
  )
}

/** The end of what is loaded: when it comes near, the changes before load. */
export function LogMore({ end, cls, onNear }: { end: boolean; cls: string; onNear(): void }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || end || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && onNear(), { root: el.closest('.overflow-y-auto'), rootMargin: '0px 0px 600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  })
  return (
    <p ref={ref} className={`text-[13px] text-zinc-400 dark:text-zinc-500 ${cls}`}>
      {end ? 'No earlier changes' : 'Loading…'}
    </p>
  )
}

export interface ActivityRow {
  s: LogSentence
  /** it is about something here, which opens beside the list */
  opens: boolean
  /** one of your changes that can be put back */
  undo: number | null
}

export interface ActivityEvents extends LogEvents {
  open(key: string): void
  undo(seq: number): void
  more(): void
}

export function ActivityList({ rows, end, picked, on }: { rows: ActivityRow[] | null; end: boolean; picked: string | null; on: ActivityEvents }) {
  if (!rows) return <Empty>Loading…</Empty>
  if (!rows.length) return <Empty>No changes yet</Empty>
  return (
    <>
      {rows.map(({ s, opens, undo }) => (
        <div
          key={s.key}
          {...(opens ? { onClick: onRow(() => on.open(s.key)) } : {})}
          {...current(picked === s.key)}
          className={`${ROW} text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300 ${opens ? 'cursor-pointer' : ''} ${PICKED}`}
        >
          <span className="min-w-0 flex-1 break-words">
            <LogLine s={s} on={on} />
          </span>
          <span className="shrink-0 pt-px font-mono text-[11px] whitespace-nowrap text-zinc-400 dark:text-zinc-500">{s.time}</span>
          {undo != null ? (
            <button onClick={() => on.undo(undo)} className={`${HOVER_BTN} -my-1`}>
              Undo
            </button>
          ) : null}
        </div>
      ))}
      <LogMore end={end} cls="px-4 py-3" onNear={on.more} />
    </>
  )
}

/** Something deleted: an item (with its subitems), a document, or an input (with the items only it made). */
export type GoneRow =
  | { key: string; kind: 'item' | 'doc'; title: string; what: string; at: string }
  | { key: string; kind: 'input'; id: string; text: string; code: string; with: string; at: string }

const goneWhat = (x: GoneRow) => (x.kind === 'input' ? `Input ${x.code}` : x.what)

export function DeletedList({ rows, picked, on }: { rows: GoneRow[]; picked: string | null; on: { show(key: string): void; restore(key: string): void } }) {
  if (!rows.length) return <Empty>Nothing deleted</Empty>
  return (
    <>
      {rows.map((x) => (
        <div key={x.key} onClick={onRow(() => on.show(x.key))} {...current(picked === x.key)} className={`${ROW} cursor-pointer ${PICKED}`}>
          <div className="min-w-0 flex-1">
            {x.kind === 'input' ? (
              <>
                <p className="line-clamp-2 text-[15px] leading-snug break-words">{x.text}</p>
                <p className="mt-1 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <span className="font-mono">{x.code}</span> · deleted {x.at}
                  {x.with ? ` · with ${x.with}` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="truncate text-[15px] leading-snug font-medium">
                  <span className="mr-1.5 font-mono text-[13px] font-bold">{x.key}</span>
                  {x.title}
                </p>
                <p className="mt-1 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {x.what} · deleted {x.at}
                </p>
              </>
            )}
          </div>
          <button onClick={() => on.restore(x.key)} className={HOVER_BTN}>
            Restore
          </button>
        </div>
      ))}
    </>
  )
}

/** A deleted thing you clicked, beside the list: what it was, when it went, and Restore. */
export function DeletedView({ x, onRestore }: { x: GoneRow; onRestore(): void }) {
  return (
    <div className="mx-auto w-full max-w-[46rem] px-8 pt-8">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {goneWhat(x)} · deleted {x.at}
      </p>
      {x.kind !== 'input' ? (
        <h1 className="mt-2 text-2xl leading-tight font-semibold tracking-tight">
          <span className="mr-2 font-mono text-lg font-bold">{x.key}</span>
          {x.title}
        </h1>
      ) : (
        <p className="mt-2 text-[15px] leading-relaxed break-words whitespace-pre-line">{x.text}</p>
      )}
      {x.kind === 'input' && x.with ? <p className="mt-3 text-[13px] text-zinc-500 dark:text-zinc-400">With {x.with}</p> : null}
      <button onClick={onRestore} className={`mt-6 ${PRIMARY}`}>
        Restore
      </button>
    </div>
  )
}
