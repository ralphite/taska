// Under New input on the desktop (T661, the approved "Anchored Stream"): a voice note being recorded, what is still on
// its way and the draft to check, as lines of their own; then every input, the latest first (more comes as you
// scroll), each as the row every list of inputs draws (its number and when, its words, its files, what became of it
// on a shelf under them; its ⋯ deletes it); more being said into one of them, on its line (F657). Search is
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
  /** one on its way, cancelled (its ×) */
  cancel(q: string): void
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

/** One input as the list draws it. */
export function SaidRow({ x, files, words, rec = null, on }: {
  x: SaidInput
  files: ReactNode
  /** its words as the page shows text everywhere (Markdown, r1099); `cut`: closed up */
  words(text: string, cut: boolean): ReactNode
  /** more being said into it: its time and level */
  rec?: ReactNode | null
  on: SaidEvents
}) {
  return <InputRow x={x} words={[]} rec={rec} text={(cut) => words(x.r.text, cut)} files={files} on={on} />
}

/** What can be done about one on its way besides its × (cancel): Retry when Taska said no, Edit when not sent. */
const outgoingActs = (q: SaidOutgoing, on: SaidEvents): OutgoingAct[] => [
  ...(q.failed && !q.net ? [{ label: 'Retry', run: on.outboxRetry }] : []),
  ...(q.failed ? [{ label: 'Edit', run: on.outboxEdit }] : []),
]

export function SaidLately({ rows, outgoing, more, draft, files, words, recording = null, adding = null, on }: {
  rows: SaidInput[]
  outgoing: SaidOutgoing[]
  /** more rows to load as you scroll */
  more: boolean
  draft?: ReactNode
  files(f: FileRef[], gid: string): ReactNode
  /** an input's words as the page shows text everywhere (Markdown, r1099); `cut`: closed up */
  words(text: string, cut: boolean): ReactNode
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
      {/* the draft and a voice note being recorded, as the page had them over the list before T661 (r1051) */}
      <ol>{draft}</ol>
      {recording ? <RecordingRow clock={recording} /> : null}
      {/* what is on its way; empty, no room taken */}
      <div className="mt-3 mb-6 space-y-2 empty:hidden">
        {outgoing.map((o) => (
          <OutgoingRow key={o.q} text={o.text} state={o.state} bad={o.failed && !o.net} waiting={o.waiting} acts={outgoingActs(o, on)} cancel={() => on.cancel(o.q)} />
        ))}
      </div>
      {rows.length ? (
        <div className={INPUT_LIST}>
          {rows.map((x) => (
            <SaidRow key={x.r.id} x={x} files={x.r.files.length ? files(x.r.files, 'cl' + x.r.id) : null} words={words} rec={adding?.id === x.r.id ? adding.meter : null} on={on} />
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
