// Under New input on the desktop (T661, the approved "Anchored Stream"): a voice note being recorded, what is still on
// its way and the draft to check, as lines of their own; then every input, the latest first (more comes as you
// scroll), each as the row every list of inputs draws (its number and when, its words, its files, what became of it
// on a shelf under them), Undo on what you just sent; more being said into one of them, on its line (F657). Search is
// the sidebar's (F479). Props only.

import { useEffect, useRef, type ReactNode } from 'react'
import type { SaidInput, SaidOutgoing } from '../../model/saidLately'
import type { FileRef } from '../../model/types'
import { Spinner } from '../../ui/Icon'
import { INPUT_LIST, InputRow, OutgoingRow, RecordingRow, type OutgoingAct } from '../../ui/InputRow'

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
  /** the voice note being recorded here (a new input, or more for one): let it go (✕, Esc) */
  discard(): void
  loadMore(): void
}

/** Words with their web addresses as links (mono, blue), as the row draws them. */
function Linked({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s]+)/).map((part, i) =>
        i % 2 ? (
          <a key={i} href={part} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="font-mono text-xs break-all text-blue-600 hover:underline dark:text-blue-400">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  )
}

/** Its words: closed up when cut short; opened, its paragraphs a third of a line apart. */
function Said({ text, cut }: { text: string; cut: boolean }) {
  if (cut)
    return (
      <p className="break-words whitespace-pre-line">
        <Linked text={text.replace(/\n{2,}/g, '\n')} />
      </p>
    )
  return (
    <>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className={`break-words whitespace-pre-line ${i ? 'mt-2' : ''}`}>
          <Linked text={para} />
        </p>
      ))}
    </>
  )
}

/** One input as the list draws it. */
export function SaidRow({ x, files, rec = null, on }: {
  x: SaidInput
  files: ReactNode
  /** more being said into it: its time and level */
  rec?: ReactNode | null
  on: SaidEvents
}) {
  return <InputRow x={x} words={[]} undo={x.canUndoSend} rec={rec} text={(cut) => <Said text={x.r.text} cut={cut} />} files={files} on={on} />
}

/** What can be done about one on its way: Undo just after sending, Retry when Taska said no, Edit when not sent. */
const outgoingActs = (q: SaidOutgoing, on: SaidEvents): OutgoingAct[] => [
  ...(q.canUndo ? [{ label: 'Undo', run: () => on.undoSend(q.q) }] : []),
  ...(q.failed && !q.net ? [{ label: 'Retry', run: on.outboxRetry }] : []),
  ...(q.failed ? [{ label: 'Edit', run: on.outboxEdit }] : []),
]

export function SaidLately({ rows, outgoing, more, draft, files, recording = null, adding = null, on }: {
  rows: SaidInput[]
  outgoing: SaidOutgoing[]
  /** more rows to load as you scroll */
  more: boolean
  draft?: ReactNode
  files(f: FileRef[], gid: string): ReactNode
  /** a voice note being recorded into a new input: how long so far (it shows first, B627) */
  recording?: string | null
  /** more being said into one of them (its Voice): which, and its time and level */
  adding?: { id: string; meter: ReactNode } | null
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
  return (
    <div>
      {/* empty (nothing recording, on its way or to check): no room taken */}
      <div className="mb-6 space-y-2 empty:hidden">
        {recording ? <RecordingRow clock={recording} onDiscard={on.discard} /> : null}
        {outgoing.map((o) => (
          <OutgoingRow key={o.q} text={o.text} state={o.state} bad={o.failed && !o.net} waiting={o.waiting} acts={outgoingActs(o, on)} />
        ))}
        {draft}
      </div>
      {rows.length ? (
        <div className={INPUT_LIST}>
          {rows.map((x) => (
            <SaidRow key={x.r.id} x={x} files={x.r.files.length ? files(x.r.files, 'cl' + x.r.id) : null} rec={adding?.id === x.r.id ? adding.meter : null} on={on} />
          ))}
        </div>
      ) : null}
      {more ? (
        <div ref={end} role="status" aria-label="Loading more" className="flex items-center justify-center py-12 text-zinc-400 dark:text-zinc-600">
          <Spinner c="size-3.5" />
        </div>
      ) : null}
    </div>
  )
}
