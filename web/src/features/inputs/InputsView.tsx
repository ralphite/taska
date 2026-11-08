// The phone's Inputs tab: everything you said, newest first, each as the row every list of inputs draws (its number
// and when, its words, its files, what became of it on a shelf under them); a voice note being recorded and what is
// still on its way as lines of their own on top. A row swipes as the item list's do (D115 #42): right opens the item
// it became, left shows Move and Delete; held, its menu opens. Props only.

import { useEffect, useRef, type ReactNode } from 'react'
import type { InputLine } from '../../model/became'
import type { OutgoingFacts } from '../../model/outgoing'
import { useLitRow } from '../../ui/litRow'
import type { FileRef } from '../../model/types'
import { Empty } from '../../ui/bits'
import { INPUT_LIST, InputRow, OutgoingRow as OutgoingLine } from '../../ui/InputRow'
import { inputWords } from '../../ui/Markdown'
import type { InlineWorld } from '../../ui/markdown/inline'
import { useRowSwipe, type RowSwipe } from '../../ui/rowSwipe'
import { PULL } from '../../ui/tones'

export interface InputFacts extends InputLine {
  /** gone to: lit up for a moment, brought into view ('shown') or where the list is ('still') */
  lit?: 'shown' | 'still'
  /** it can go to another project (Move, a swipe left) */
  movable?: boolean
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
  outboxRetry(q: string): void
  outboxEdit(q: string): void
  /** one on its way, cancelled (its ×): it does not go */
  outboxCancel(q: string): void
  /** the list scrolled to its last drawn rows: draw more */
  end(): void
  /** swiped left: Move (its sheet) and Delete (Undo puts it back) (D115 #42) */
  moveInput(id: string): void
  remove(id: string): void
  /** swiped right: the item it became; held: its menu */
  swipe: RowSwipe
}

/** One input: the line every list of inputs draws, its words drawn as Markdown (references and pictures in them work),
 * brought into view and lit when gone to. */
export function InputCard({ x, world, files, on }: { x: InputFacts; world: InlineWorld; files(f: FileRef[]): ReactNode; on: InputEvents }) {
  const litRef = useLitRow<HTMLElement>(x.lit === 'shown')
  const r = x.r
  const to = x.became.k === 'filed' ? (x.became.items[0]?.item ?? null) : x.became.k === 'answer' ? x.became.item : null
  return (
    <InputRow
      place="inputs"
      x={x}
      lit={!!x.lit}
      rowRef={litRef}
      text={(cut) => inputWords(world, on)(r.text, cut)}
      files={r.files.length ? files(r.files) : null}
      swipe={x.became.k === 'moved' ? null : { open: to?.code ?? null, move: !!x.movable, on: { move: on.moveInput, remove: on.remove } }}
      on={{ ...on, menu: (id) => on.menu(id) }}
    />
  )
}

/** What is still on its way, shown first where your inputs are listed, with what can be done to each there
 * (model/outgoingStates). */
export function OutboxRows({ list, on }: { list: OutgoingFacts[]; on: Pick<InputEvents, 'outboxRetry' | 'outboxEdit' | 'outboxCancel'> }) {
  return (
    <>
      {list.map((q) => (
        <OutgoingLine
          key={q.q}
          text={q.text}
          show={q.show}
          scope={q.scope}
          previews={q.previews}
          on={{ retry: () => on.outboxRetry(q.q), edit: () => on.outboxEdit(q.q), cancel: () => on.outboxCancel(q.q) }}
        />
      ))}
    </>
  )
}

export function InputsView({ hidden, rows, more, outgoing, world, files, on }: {
  hidden: boolean
  rows: InputFacts[]
  /** older inputs not drawn yet: they come when the list nears its end */
  more: boolean
  outgoing: OutgoingFacts[]
  world: InlineWorld
  files(f: FileRef[]): ReactNode
  on: InputEvents
}) {
  const ref = useRef<HTMLElement | null>(null)
  useRowSwipe(ref, !hidden, on.swipe, rows)
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
      className={`${PULL} -mb-(--foot-h) min-h-0 flex-1 overflow-y-auto outline-none overscroll-contain pb-[calc(var(--foot-h,0px)+1.5rem)]`}
    >
      {hidden ? null : (
        <div className="mb-6 space-y-2 px-4 pt-4 empty:hidden">
          {outgoing.length ? <OutboxRows list={outgoing} on={on} /> : null}
        </div>
      )}
      {hidden ? null : rows.length ? (
        <>
          <div className={INPUT_LIST}>
            {rows.map((x) => (
              <InputCard key={x.r.id} x={x} world={world} files={files} on={on} />
            ))}
          </div>
          {more ? <div ref={end} aria-hidden className="h-24" /> : null}
        </>
      ) : outgoing.length ? null : (
        <Empty>No inputs</Empty>
      )}
    </section>
  )
}

