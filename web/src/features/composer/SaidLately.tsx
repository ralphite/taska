// Under New input on the desktop: every input, the latest first (more comes as you scroll), each as the line every
// list of inputs draws (its number and when, its words, its files, what became of it under them), Undo on what you
// just sent; what is still on its way, and a voice note being recorded, on top; more being said into one of them, on
// its own line (F657). A search of its own. Props only.

import { useEffect, useRef, type ReactNode } from 'react'
import { whenParts } from '../../model/became'
import type { SaidInput, SaidOutgoing } from '../../model/saidLately'
import type { FileRef } from '../../model/types'
import { Hit } from '../../ui/bits'
import { isAudio } from '../../ui/Files'
import { Icon } from '../../ui/Icon'
import { DayHead, InputRow, OutgoingRow, RecordingRow, type InputLook, type OutgoingAct } from '../../ui/InputRow'

export interface SaidEvents {
  goto(n: number): void
  /** a long one opened, or closed again */
  more(id: string): void
  /** Comment: words to add to it, in the box */
  append(id: string): void
  /** Voice: more to add to it, recorded there; again, it stops and is added */
  voice(id: string): void
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
  /** a prototype's compact rows (T661): one picked, shown whole beside the list */
  pick?(id: string): void
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
export function SaidRow({ x, words, files, rec = null, look, voice, lit = false, on }: {
  x: SaidInput
  words: string[]
  files: ReactNode
  /** more being said into it: how long so far */
  rec?: string | null
  /** a prototype's look (T661) */
  look?: InputLook
  voice?: ReactNode
  lit?: boolean
  on: SaidEvents
}) {
  return <InputRow x={x} words={words} undo={x.canUndoSend} rec={rec} look={look} voice={voice} lit={lit} text={(cut) => <Said text={x.r.text} words={words} cut={cut} />} files={files} on={on} />
}

/** the day's name a line says for today (model/inputs dayOf) */
const TODAY = 'Today'

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
  adding = null,
  look,
  head = true,
  voice,
  picked = null,
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
  /** more being said into one of them (its Voice): which, and how long so far */
  adding?: { id: string; clock: string } | null
  /** a prototype's look (T661): the rows in it, under the name of each day */
  look?: InputLook
  /** the heading with how many and the list's search (a prototype, T661: none, the search being the sidebar's) */
  head?: boolean
  /** a prototype's look (T661): voice notes drawn in a row's first line, the other files under its words */
  voice?(f: FileRef[], gid: string): ReactNode
  /** a prototype's compact rows (T661): the one shown whole beside the list */
  picked?: string | null
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
  const row = (x: SaidInput) => {
    const fs = voice ? x.r.files.filter((f) => !isAudio(f)) : x.r.files
    const vs = voice ? x.r.files.filter(isAudio) : []
    return (
      <SaidRow
        key={x.r.id}
        x={x}
        words={words}
        files={fs.length ? files(fs, 'cl' + x.r.id) : null}
        voice={vs.length ? voice?.(vs, 'cv' + x.r.id) : null}
        rec={adding?.id === x.r.id ? adding.clock : null}
        look={look}
        lit={!!picked && picked === x.r.id}
        on={on}
      />
    )
  }
  // a prototype's look: the rows under the name of each day, in order
  const days = look
    ? rows.reduce<{ day: string; rows: SaidInput[] }[]>((ds, x) => {
        const day = whenParts(x.when).day
        const last = ds[ds.length - 1]
        if (last?.day === day) last.rows.push(x)
        else ds.push({ day, rows: [x] })
        return ds
      }, [])
    : null
  const lead = !!recording || outgoing.length > 0
  const leadRows = (
    <>
      {recording ? <RecordingRow clock={recording} look={look} /> : null}
      {outgoing.map((o) => (
        <OutgoingRow key={o.q} text={o.text} state={o.state} bad={o.failed && !o.net} acts={outgoingActs(o, on)} look={look} />
      ))}
    </>
  )
  return (
    <div>
      <div hidden={!head || (!total && !outgoing.length && !recording)} className="flex h-9 items-center gap-3">
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
        <div className={head ? 'mt-3' : ''}>
          {days && look ? (
            <>
              {/* what is on its way is today's: under Today */}
              {lead && days[0]?.day !== TODAY ? (
                <section aria-label={TODAY}>
                  <DayHead day={TODAY} look={look} first />
                  {leadRows}
                </section>
              ) : null}
              {days.map((d, i) => (
                <section key={d.day} aria-label={d.day}>
                  <DayHead day={d.day} look={look} first={!i && !(lead && d.day !== TODAY)} />
                  {!i && lead && d.day === TODAY ? leadRows : null}
                  {d.rows.map(row)}
                </section>
              ))}
            </>
          ) : (
            <>
              {leadRows}
              {rows.map(row)}
            </>
          )}
          {more ? (
            <div ref={end} className="flex h-16 items-center text-sm text-zinc-400 dark:text-zinc-500">
              Loading more…
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">{words.length ? `No matches for “${q.trim()}”` : null}</p>
      )}
    </div>
  )
}
