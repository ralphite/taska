// Under New input on the desktop: every input, the latest first (more comes as you scroll), each as the line every
// list of inputs draws (its number and when, its words, its files, what became of it beside them), Undo on what you
// just sent; what is still on its way, and a voice note being recorded, on top. A search of its own. Props only.

import { useEffect, useRef, type ReactNode } from 'react'
import type { SaidInput, SaidOutgoing } from '../../model/saidLately'
import type { FileRef } from '../../model/types'
import { Hit } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { InputRow, OutgoingRow, RecordingRow, type OutgoingAct } from '../../ui/InputRow'

export interface SaidEvents {
  goto(n: number): void
  /** a long one opened, or closed again */
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

/** Its words with the searched ones marked: closed up when cut short; opened, its paragraphs a third of a line apart. */
function Said({ text, words, cut }: { text: string; words: string[]; cut: boolean }) {
  if (cut)
    return (
      <p className="break-words whitespace-pre-line">
        <Hit text={text.replace(/\n{2,}/g, '\n')} words={words} />
      </p>
    )
  return (
    <>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className={`break-words whitespace-pre-line ${i ? 'mt-2' : ''}`}>
          <Hit text={para} words={words} />
        </p>
      ))}
    </>
  )
}

/** One input as the list draws it: its words as they were said, the searched ones marked. */
export function SaidRow({ x, words, files, on }: { x: SaidInput; words: string[]; files: ReactNode; on: SaidEvents }) {
  return <InputRow x={x} words={words} undo={x.canUndoSend} text={(cut) => <Said text={x.r.text} words={words} cut={cut} />} files={files} on={on} />
}

/** What can be done about one on its way: Undo just after sending, Retry when Taska said no, Edit when not sent. */
const outgoingActs = (q: SaidOutgoing, on: SaidEvents): OutgoingAct[] => [
  ...(q.canUndo ? [{ label: 'Undo', run: () => on.undoSend(q.q) }] : []),
  ...(q.failed && !q.net ? [{ label: 'Retry', run: on.outboxRetry }] : []),
  ...(q.failed ? [{ label: 'Edit', run: on.outboxEdit }] : []),
]

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
  const end = useRef<HTMLDivElement>(null)
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
        <div className="mt-3">
          {recording ? <RecordingRow clock={recording} /> : null}
          {outgoing.map((o) => (
            <OutgoingRow key={o.q} text={o.text} state={o.state} bad={o.failed && !o.net} acts={outgoingActs(o, on)} />
          ))}
          {rows.map((x) => (
            <SaidRow key={x.r.id} x={x} words={words} files={x.r.files.length ? files(x.r.files, 'cl' + x.r.id) : null} on={on} />
          ))}
          {more ? (
            <div ref={end} className="flex h-16 items-center text-sm text-zinc-400 dark:text-zinc-500">
              Loading more…
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">{words.length ? `No matches for “${q.trim()}”.` : null}</p>
      )}
    </div>
  )
}
