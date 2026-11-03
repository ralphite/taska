// Under New input on the desktop: every input, the latest first (more comes as you scroll), each with where
// it stands and what became of it; what is still on its way on top. A search of its own. Props only.

import { useEffect, useRef, type ReactNode } from 'react'
import { voiceMark, type InputStanding } from '../../model/inputs'
import type { SaidChip, SaidInput, SaidOutgoing } from '../../model/saidLately'
import type { FileRef } from '../../model/types'
import { DraftMark, Hit } from '../../ui/bits'
import { Icon, StateIcon } from '../../ui/Icon'
import { HIT, TYPE_TEXT } from '../../ui/tones'

const SMALL_BTN =
  'flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'

/** One step of the list: a line with its code, where it stands and its day and time, then its words. On the
 * desktop its buttons show over the right of that line under the pointer, taking no room otherwise; `actsShown`:
 * always, as for what Taska refused (it needs you). */
export function SaidStep({ head, acts, body, foot, time, actsShown = false }: { head: ReactNode; acts?: ReactNode; body: ReactNode; foot?: ReactNode; time?: string; actsShown?: boolean }) {
  return (
    <li className="group/row relative -mx-3 rounded-lg border-b border-zinc-100 px-3 py-3 last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-900/60">
      <div className="flex min-h-6 min-w-0 items-center gap-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">
        {head}
        {time ? <span className="ml-auto shrink-0 tabular-nums">{time}</span> : null}
        {acts ? (
          <span className={`flex shrink-0 items-center ${actsShown ? '' : 'lg:invisible lg:absolute lg:top-2.5 lg:right-2 lg:rounded-lg lg:bg-zinc-50 lg:group-focus-within/row:visible lg:group-hover/row:visible dark:lg:bg-zinc-900'}`}>
            {acts}
          </span>
        ) : null}
      </div>
      <div className="mt-1 min-w-0 text-[15px] leading-6 text-zinc-900 dark:text-zinc-100">{body}</div>
      {foot ? <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 empty:hidden">{foot}</div> : null}
    </li>
  )
}

export interface SaidEvents {
  goto(n: number): void
  more(id: string): void
  append(id: string): void
  /** the draft of an edit, or of details to add, written on */
  draft(id: string, mode: 'edit' | 'append'): void
  menu(id: string, from: HTMLElement): void
  undoSend(key: string): void
  retry(id: string): void
  /** a recording kept as cancelled, sent after all */
  send(id: string): void
  /** to the project it was moved to */
  moved(href: string): void
  outboxRetry(): void
  outboxEdit(): void
  query(q: string): void
  loadMore(): void
}

const standingIcon = (s: InputStanding) =>
  s.icon === 'dot' ? <span className="size-1.5 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" /> : <Icon n={s.icon} c="size-3.5" sw={s.icon === 'check' ? '2.25' : '2'} />

function Chip({ c, on }: { c: SaidChip; on: SaidEvents }) {
  return (
    <button
      onClick={() => on.goto(c.n)}
      className="flex h-7 max-w-80 min-w-0 items-center gap-1.5 rounded-lg bg-zinc-100 pr-2.5 pl-1.5 text-[13px] text-zinc-800 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
    >
      <StateIcon {...c.status} cls="size-4" />
      <span className={`font-mono text-xs font-bold ${TYPE_TEXT[c.type]}`}>{c.code}</span>
      <span className="truncate">{c.title}</span>
    </button>
  )
}

function SaidRow({ x, words, files, on }: { x: SaidInput; words: string[]; files(f: FileRef[]): ReactNode; on: SaidEvents }) {
  const r = x.r
  return (
    <SaidStep
      time={x.time}
      head={
        <>
          <span className="shrink-0 font-mono font-semibold text-zinc-800 dark:text-zinc-200">{x.code}</span>
          <span className={`flex shrink-0 items-center gap-1 pr-1 pl-1.5 font-medium ${x.standing.tone}`}>
            {standingIcon(x.standing)}
            {x.short}
          </span>
          {x.scope ? (
            <button
              onClick={() => on.goto((x.scope as SaidChip).n)}
              className="flex min-w-0 items-center gap-1 rounded-md px-1 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <Icon n="scope" c="size-3.5 shrink-0" />
              <span className={`shrink-0 font-mono text-xs font-bold ${TYPE_TEXT[x.scope.type]}`}>{x.scope.code}</span>
              <span className="truncate">{x.scope.title}</span>
            </button>
          ) : null}
          {x.draft ? (
            <button onClick={() => on.draft(r.id, x.draft as 'edit')} className={`${HIT} shrink-0`}>
              <DraftMark small />
            </button>
          ) : null}
        </>
      }
      acts={
        <>
          {x.canUndoSend ? (
            <button onClick={() => on.undoSend(r.id)} className={SMALL_BTN}>
              <Icon n="undo" c="size-3.5" sw="2" />
              Undo
            </button>
          ) : null}
          {r.moved ? null : (
            <button onClick={() => on.append(r.id)} className={SMALL_BTN}>
              <Icon n="plus" c="size-3.5" sw="2" />
              Add more
            </button>
          )}
          {x.moved ? null : (
            <button title="More" aria-label={`More for ${x.code}`} onClick={(e) => on.menu(r.id, e.currentTarget)} className={SMALL_BTN}>
              <Icon n="more" c="size-4" />
            </button>
          )}
        </>
      }
      body={
        <>
          {r.text ? (
            <p {...voiceMark(r)} className={`whitespace-pre-line ${x.opened ? '' : 'line-clamp-3'} break-words`} onClick={() => on.more(r.id)}>
              <Hit text={r.text} words={words} />
            </p>
          ) : null}
          {r.files.length ? <div className={`flex flex-wrap items-end gap-2 ${r.text ? 'mt-2' : ''}`}>{files(r.files)}</div> : null}
        </>
      }
      foot={
        <>
          {x.chips.map((c) => (
            <Chip key={c.n} c={c} on={on} />
          ))}
          {x.busy ? <span className="h-7 w-44 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" /> : null}
          {r.org && !r.org.ok ? <span className="min-w-0 basis-full truncate text-[13px] text-red-600/80 dark:text-red-400/80">{r.org.msg}</span> : null}
          {x.moved ? (
            // the first thing on the line starts where the words above it start
            <span className={`flex items-center gap-1.5 ${x.chips.length || x.busy ? '' : '-ml-2'}`}>
              <a
                href={x.moved.href}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) return
                  e.preventDefault()
                  on.moved((x.moved as { href: string }).href)
                }}
                className={`${SMALL_BTN} max-w-full min-w-0`}
              >
                <Icon n="arrow" c="size-3.5" sw="2" />
                <span className="truncate">{x.moved.label}</span>
              </a>
            </span>
          ) : x.send ? (
            <span className="-ml-2 flex items-center gap-1.5">
              <button onClick={() => on.send(r.id)} className={`${SMALL_BTN} text-blue-600 dark:text-blue-400`}>
                <Icon n="up" c="size-3.5" sw="2" />
                Send
              </button>
            </span>
          ) : x.retry ? (
            <span className={`flex items-center gap-1.5 ${x.chips.length || x.busy ? '' : '-ml-2'}`}>
              <button onClick={() => on.retry(r.id)} className={SMALL_BTN}>
                <Icon n="loop" c="size-3.5" sw="2" />
                {x.retry}
              </button>
            </span>
          ) : null}
        </>
      }
    />
  )
}

function OutboxStep({ q, on }: { q: SaidOutgoing; on: SaidEvents }) {
  const bad = q.failed && !q.net
  return (
    <SaidStep
      actsShown={bad}
      head={
        <>
          <span>Just now</span>
          <span className={`ml-auto flex shrink-0 items-center gap-1.5 font-medium ${bad ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
            {bad ? <Icon n="alert" c="size-3.5" sw="2" /> : <span className="size-1.5 animate-pulse rounded-full bg-current" />}
            {q.state}
          </span>
        </>
      }
      acts={
        q.failed ? (
          <>
            {q.canUndo ? (
              <button onClick={() => on.undoSend(q.q)} className={SMALL_BTN}>
                <Icon n="undo" c="size-3.5" sw="2" />
                Undo
              </button>
            ) : null}
            {q.net ? null : (
              <button onClick={on.outboxRetry} className={`${SMALL_BTN} text-blue-600 dark:text-blue-400`}>
                Retry
              </button>
            )}
            <button onClick={on.outboxEdit} className={SMALL_BTN}>
              Edit
            </button>
          </>
        ) : q.canUndo ? (
          <button onClick={() => on.undoSend(q.q)} className={SMALL_BTN}>
            <Icon n="undo" c="size-3.5" sw="2" />
            Undo
          </button>
        ) : null
      }
      body={<p className="line-clamp-3 break-words">{q.text}</p>}
    />
  )
}

export function SaidLately({
  count,
  total,
  q,
  rows,
  outgoing,
  more,
  words,
  draft,
  files,
  recording = null,
  on,
}: {
  /** what the heading counts */
  count: number
  /** how many inputs the project has (none: no heading) */
  total: number
  q: string
  rows: SaidInput[]
  outgoing: SaidOutgoing[]
  /** more rows to load as you scroll */
  more: boolean
  words: string[]
  draft?: ReactNode
  files(f: FileRef[], gid: string): ReactNode
  /** a voice note being recorded into a new input: how long so far (it shows first, B627) */
  recording?: string | null
  on: SaidEvents
}) {
  const end = useRef<HTMLLIElement>(null)
  useEffect(() => {
    const el = end.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((seen) => seen.some((e) => e.isIntersecting) && on.loadMore(), { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [more, rows.length, on])
  const n = outgoing.length + rows.length + (recording ? 1 : 0)
  return (
    <div>
      <div hidden={!total && !outgoing.length && !recording} className="flex h-9 items-center gap-3">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">Inputs</h2>
        <span className="font-mono text-xs text-zinc-400 tabular-nums dark:text-zinc-500">{count || ''}</span>
        {total ? (
          <label className="ml-auto flex h-9 w-64 min-w-0 items-center gap-2 rounded-xl bg-zinc-100 pl-3 text-zinc-400 ring-blue-500/40 focus-within:bg-white focus-within:ring-2 dark:bg-zinc-800 dark:text-zinc-500 dark:focus-within:bg-zinc-900">
            <Icon n="search" c="size-4" />
            <input
              type="search"
              autoComplete="off"
              placeholder="Search"
              value={q}
              onChange={(e) => on.query(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 [&::-webkit-search-cancel-button]:hidden"
            />
          </label>
        ) : null}
      </div>
      <ol>{draft}</ol>
      {n ? (
        <ol className="mt-4">
          {recording ? (
            <SaidStep
              time={recording}
              head={
                <span className="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
                  <span className="size-1.5 animate-pulse rounded-full bg-current" />
                  Recording
                </span>
              }
              body={<span className="text-zinc-400 italic dark:text-zinc-500">Voice note</span>}
            />
          ) : null}
          {outgoing.map((o) => (
            <OutboxStep key={o.q} q={o} on={on} />
          ))}
          {rows.map((x) => (
            <SaidRow key={x.r.id} x={x} words={words} files={(f) => files(f, 'cl' + x.r.id)} on={on} />
          ))}
          {more ? (
            <li ref={end} className="flex h-16 items-center pl-9 text-sm text-zinc-400 dark:text-zinc-500">
              Loading more…
            </li>
          ) : null}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">{words.length ? `No matches for “${q.trim()}”.` : null}</p>
      )}
    </div>
  )
}
