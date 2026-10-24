// The phone's Inputs tab: everything you said, newest first by day, each with what became of it (the items it made
// or changed, the organizer's note) and what you can do about it; what is still on its way on top. Props only.

import { useRef, type ReactNode } from 'react'
import type { InputStanding } from '../../model/inputs'
import type { FileRef, Input, ItemType } from '../../model/types'
import { DraftMark, Empty, Hit } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { Rich } from '../../ui/Markdown'
import type { InlineWorld } from '../../ui/markdown/inline'
import { useMarks } from '../../ui/marks'
import { HIT, LINK_BTN, TYPE_TEXT } from '../../ui/tones'

export interface InputChip {
  n: number
  code: string
  type: ItemType
  title: string
  /** what was done with it ("Created"), from the organizer's note */
  did: string
}

export interface InputFacts {
  r: Input
  code: string
  time: string
  /** the day's name when this input starts a day */
  day: string | null
  standing: InputStanding
  scope: { n: number; code: string; title: string } | null
  chips: InputChip[]
  /** the organizer's note, without what the chips say */
  note: string | null
  noteBad: boolean
  /** a mark beside the chips when the note is all in them */
  spark: boolean
  retry: string | null
  moved: { href: string; label: string } | null
  draft: 'edit' | 'append' | null
  long: boolean
  opened: boolean
}

export interface OutgoingRow {
  q: string
  text: string
  state: string
  bad: boolean
  scope: string | null
  previews: string[]
}

export interface InputEvents {
  goto(n: number): void
  more(id: string): void
  menu(id: string): void
  retry(id: string): void
  draft(id: string, mode: 'edit' | 'append'): void
  moved(href: string): void
  ref(code: string): void
  picture(fid: string, all: string[]): void
}

const dot = (cls: string) => <span className={`size-1.5 animate-pulse rounded-full ${cls}`} />
const standingIcon = (s: InputStanding) => (s.icon === 'dot' ? dot('bg-blue-500 dark:bg-blue-400') : <Icon n={s.icon} c="size-3.5" sw={s.icon === 'check' ? '2.25' : '2'} />)

export function InputCard({ x, words, world, files, on }: { x: InputFacts; words: readonly string[]; world: InlineWorld; files(f: FileRef[]): ReactNode; on: InputEvents }) {
  const r = x.r
  const chips = x.chips.length
    ? x.chips.map((c) => (
        <button
          key={c.n}
          onClick={() => on.goto(c.n)}
          className={`${HIT} flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-lg bg-zinc-100 px-2 text-[13px] hover:bg-zinc-200/70 dark:bg-zinc-800 dark:hover:bg-zinc-700`}
        >
          {c.did ? <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{c.did}</span> : null}
          <span className={`font-mono text-xs font-bold ${TYPE_TEXT[c.type]}`}>{c.code}</span>
          <span className="truncate">{c.title}</span>
        </button>
      ))
    : null
  const noteTone = x.noteBad ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'
  const note = x.note ? (
    <div className={`mt-1.5 flex min-h-5 items-center gap-1 text-xs ${noteTone}`}>
      <Icon n="sparkle" c="size-3.5" />
      <span className="min-w-0">{x.note}</span>
    </div>
  ) : null
  const more = (
    <button title="More" aria-label={`More for ${x.code}`} onClick={() => on.menu(r.id)} className={`${LINK_BTN} text-zinc-600 dark:text-zinc-300`}>
      <Icon n="more" c="size-4" />
    </button>
  )
  return (
    <article className="border-b border-zinc-100 px-4 py-2 transition-colors duration-700 dark:border-zinc-800/70">
      <div className="min-w-0">
        <div className="flex min-h-5 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          {r.acked ? null : <span title="Not handled yet" className="size-2 shrink-0 rounded-full bg-blue-500 dark:bg-blue-400" />}
          <span className="shrink-0 font-mono">
            <Hit text={x.code} words={words} />
          </span>
          <span className="shrink-0 whitespace-nowrap">{x.time}</span>
          {x.draft ? (
            <button onClick={() => on.draft(r.id, x.draft as 'edit')} className={`${HIT} shrink-0`}>
              <DraftMark small />
            </button>
          ) : null}
          {x.scope ? (
            <button
              onClick={() => on.goto((x.scope as { n: number }).n)}
              className="relative min-w-0 truncate text-blue-600 after:absolute after:inset-x-0 after:-inset-y-3.5 hover:underline dark:text-blue-400"
            >
              ↳ {x.scope.code} {x.scope.title}
            </button>
          ) : null}
          <span className={`ml-auto flex shrink-0 items-center gap-1 font-medium ${x.standing.tone}`}>
            {standingIcon(x.standing)}
            {x.standing.label}
          </span>
          {x.moved ? null : <span className="-my-2 -mr-2 flex shrink-0 items-center">{more}</span>}
        </div>
        <div
          data-hit-html
          onClick={x.long ? () => on.more(r.id) : undefined}
          className={`mt-1.5 rounded-2xl rounded-tr-md bg-blue-50 px-3.5 py-2 text-[15px] leading-relaxed text-zinc-900 dark:bg-blue-400/10 dark:text-zinc-100 ${x.long ? 'cursor-pointer' : ''}`}
        >
          {r.text ? <Rich text={r.text} world={world} cls={x.long && !x.opened ? 'max-h-28 overflow-hidden' : ''} onRef={on.ref} onPicture={on.picture} /> : null}
          {x.long ? (
            <button onClick={(e) => (e.stopPropagation(), on.more(r.id))} className="-my-2 flex h-11 items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
              {x.opened ? 'Less' : 'More'}
            </button>
          ) : null}
          {r.files.length ? <div className="mt-2 flex items-end gap-2 overflow-x-auto">{files(r.files)}</div> : null}
        </div>
        {x.moved ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <a
              href={x.moved.href}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) return
                e.preventDefault()
                on.moved((x.moved as { href: string }).href)
              }}
              className={`${LINK_BTN} max-w-full min-w-0`}
            >
              <Icon n="arrow" c="size-3.5" sw="2" />
              <span className="truncate">{x.moved.label}</span>
            </a>
          </div>
        ) : x.retry ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <button onClick={() => on.retry(r.id)} className={LINK_BTN}>
              <Icon n="loop" c="size-3.5" sw="2" />
              {x.retry}
            </button>
          </div>
        ) : null}
      </div>
      <div className="min-w-0">
        {note && chips ? (
          <div className="mt-1 flex items-start gap-1.5">
            <span className="grid h-8 shrink-0 place-items-center text-zinc-400 dark:text-zinc-500">
              <Icon n="sparkle" c="size-3.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <span className={`text-xs ${noteTone}`}>{x.note}</span>
              {chips}
            </div>
          </div>
        ) : (
          <>
            {note}
            {chips ? (
              <div className="mt-1 flex items-start gap-1.5">
                {x.spark ? (
                  <span className="grid h-8 shrink-0 place-items-center text-zinc-400 dark:text-zinc-500">
                    <Icon n="sparkle" c="size-3.5" />
                  </span>
                ) : null}
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{chips}</div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </article>
  )
}

/** What is still on its way, shown first where your inputs are listed. */
export function OutboxRows({ list }: { list: OutgoingRow[] }) {
  return (
    <>
      {list.map((q) => (
        <article key={q.q} className="border-b border-zinc-100 px-4 py-2 lg:px-0 lg:py-4 dark:border-zinc-800/70">
          <div className={`flex min-h-5 items-center gap-2 text-xs ${q.bad ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
            {q.bad ? <Icon n="alert" c="size-3.5" sw="2" /> : dot('bg-blue-500 dark:bg-blue-400')}
            <span className="font-medium">{q.state}</span>
            {q.scope ? <span className="min-w-0 truncate text-zinc-500 dark:text-zinc-400">↳ {q.scope}</span> : null}
          </div>
          <div className="mt-1.5 rounded-2xl rounded-tr-md bg-blue-50 px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-900 opacity-70 lg:max-w-[calc(100%-22.5rem)] dark:bg-blue-400/10 dark:text-zinc-100">
            {q.text}
            {q.previews.length ? (
              <div className="mt-2 flex gap-2">
                {q.previews.map((src, i) => (
                  <img key={i} src={src} alt="" className="size-11 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700" />
                ))}
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </>
  )
}

export function InputsView({ hidden, rows, outgoing, words, world, files, hints, viewRef, on }: {
  hidden: boolean
  rows: InputFacts[]
  outgoing: OutgoingRow[]
  words: readonly string[]
  world: InlineWorld
  files(f: FileRef[]): ReactNode
  /** under a search: the other tabs' and projects' matches */
  hints: ReactNode
  viewRef?: (el: HTMLElement | null) => void
  on: InputEvents
}) {
  const ref = useRef<HTMLElement | null>(null)
  useMarks(ref, words)
  return (
    <section
      ref={(el) => {
        ref.current = el
        viewRef?.(el)
      }}
      hidden={hidden}
      className="-mb-(--foot-h) min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(var(--foot-h,0px)+1.5rem)]"
    >
      {hidden ? null : outgoing.length && !words.length ? <OutboxRows list={outgoing} /> : null}
      {hidden ? null : rows.length ? (
        <>
          {rows.map((x) => (
            <div key={x.r.id} className="contents">
              {x.day ? <div className="px-4 pt-2.5 pb-0.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{x.day}</div> : null}
              <InputCard x={x} words={words} world={world} files={files} on={on} />
            </div>
          ))}
          {words.length ? <div className="flex flex-col py-4">{hints}</div> : null}
        </>
      ) : outgoing.length ? null : (
        <Empty>
          {words.length ? 'No matching inputs' : 'No inputs yet.'}
          {words.length ? <span className="mt-3 flex flex-col">{hints}</span> : null}
        </Empty>
      )}
    </section>
  )
}

