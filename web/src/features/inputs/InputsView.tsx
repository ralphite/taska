// The phone's Inputs tab: everything you said, newest first, each as the line every list of inputs draws (its number
// and when, its words, its files, what became of it); what is still on its way on top. Props only.

import { useEffect, useRef, type ReactNode } from 'react'
import type { InputLine } from '../../model/became'
import { useLitRow } from './litRow'
import type { FileRef } from '../../model/types'
import { Empty } from '../../ui/bits'
import { InputRow, OutgoingRow as OutgoingLine, RecordingRow } from '../../ui/InputRow'
import { Rich } from '../../ui/Markdown'
import type { InlineWorld } from '../../ui/markdown/inline'
import { useMarks } from '../../ui/marks'

export interface InputFacts extends InputLine {
  /** gone to: lit up for a moment, brought into view ('shown') or where the list is ('still') */
  lit?: 'shown' | 'still'
}

export interface OutgoingRow {
  q: string
  text: string
  state: string
  /** Taska said no (not only a lost connection): it can be sent again */
  bad: boolean
  /** not sent: it can be taken back into the box */
  failed: boolean
  scope: string | null
  previews: string[]
}

export interface InputEvents {
  goto(n: number): void
  more(id: string): void
  menu(id: string): void
  retry(id: string): void
  /** a recording kept as cancelled, sent after all */
  send(id: string): void
  draft(id: string, mode: 'edit' | 'append'): void
  moved(href: string): void
  ref(code: string): void
  picture(fid: string, all: string[]): void
  /** what is on its way and was not sent: send it again, or take it back into the box */
  outboxRetry(): void
  outboxEdit(): void
  /** the list scrolled to its last drawn rows: draw more */
  end(): void
}

/** One input: the line every list of inputs draws, its words drawn as Markdown (references and pictures in them work),
 * brought into view and lit when gone to. */
export function InputCard({ x, words, world, files, on }: { x: InputFacts; words: readonly string[]; world: InlineWorld; files(f: FileRef[]): ReactNode; on: InputEvents }) {
  const litRef = useLitRow<HTMLElement>(x.lit === 'shown')
  const r = x.r
  return (
    <InputRow
      x={x}
      words={words}
      lit={!!x.lit}
      rowRef={litRef}
      text={(cut) => <Rich text={cut ? r.text.replace(/\n{2,}/g, '\n') : r.text} world={world} onRef={on.ref} onPicture={on.picture} />}
      files={r.files.length ? files(r.files) : null}
      on={{ ...on, menu: (id) => on.menu(id) }}
    />
  )
}

/** What is still on its way, shown first where your inputs are listed: Retry when Taska said no, Edit when not sent. */
export function OutboxRows({ list, on }: { list: OutgoingRow[]; on: Pick<InputEvents, 'outboxRetry' | 'outboxEdit'> }) {
  return (
    <>
      {list.map((q) => (
        <OutgoingLine
          key={q.q}
          text={q.text}
          state={q.state}
          bad={q.bad}
          scope={q.scope}
          previews={q.previews}
          acts={[...(q.bad ? [{ label: 'Retry', run: on.outboxRetry }] : []), ...(q.failed ? [{ label: 'Edit', run: on.outboxEdit }] : [])]}
        />
      ))}
    </>
  )
}

export function InputsView({ hidden, rows, more, outgoing, words, world, files, hints, recording = null, on }: {
  hidden: boolean
  rows: InputFacts[]
  /** older inputs not drawn yet: they come when the list nears its end */
  more: boolean
  outgoing: OutgoingRow[]
  /** a voice note being recorded into a new input: how long so far (it shows first, B627) */
  recording?: string | null
  words: readonly string[]
  world: InlineWorld
  files(f: FileRef[]): ReactNode
  /** under a search: the other tabs' and projects' matches */
  hints: ReactNode
  on: InputEvents
}) {
  const ref = useRef<HTMLElement | null>(null)
  useMarks(ref, words)
  const end = useRef<HTMLDivElement | null>(null)
  const told = useRef(on.end)
  useEffect(() => {
    told.current = on.end
  })
  useEffect(() => {
    const e = end.current
    if (!e || !more || hidden) return
    const o = new IntersectionObserver((seen) => seen.some((x) => x.isIntersecting) && told.current(), { root: ref.current, rootMargin: '0px 0px 800px 0px' })
    o.observe(e)
    return () => o.disconnect()
  }, [more, hidden, rows.length])
  return (
    <section
      data-part="inputs"
      ref={ref}
      hidden={hidden}
      data-vc-area
      className="-mb-(--foot-h) min-h-0 flex-1 overflow-y-auto outline-none overscroll-contain pb-[calc(var(--foot-h,0px)+1.5rem)]"
    >
      {hidden || !recording || words.length ? null : <RecordingRow clock={recording} />}
      {hidden ? null : outgoing.length && !words.length ? <OutboxRows list={outgoing} on={on} /> : null}
      {hidden ? null : rows.length ? (
        <>
          {rows.map((x) => (
            <InputCard key={x.r.id} x={x} words={words} world={world} files={files} on={on} />
          ))}
          {more ? <div ref={end} aria-hidden className="h-24" /> : null}
          {words.length ? <div className="flex flex-col py-4">{hints}</div> : null}
        </>
      ) : outgoing.length || recording ? null : (
        <Empty>
          {words.length ? 'No matching inputs' : 'No inputs yet.'}
          {words.length ? <span className="mt-3 flex flex-col">{hints}</span> : null}
        </Empty>
      )}
    </section>
  )
}

