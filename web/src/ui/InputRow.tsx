// One input as every list of inputs draws it (B629), words first, no boxes or bubbles: a line with its number and its
// day and time (a draft of yours on it, its buttons at the end), its words (a long one: four lines fading, More), its
// pictures and voice note, and what became of it in a line of 13px under the words, on the phone and the desktop
// alike (F659). Its buttons: the phone's ⋯ (Add more, Edit and the rest are in it); the
// desktop's Add more and ⋯, under the pointer only (or the keys), taking no room. Undo, just after sending, always
// shows. What is still on its way, and a voice note being recorded, are drawn as lines of the same shape. Props only.

import type { ReactNode, Ref } from 'react'
import { BECAME_WORD as W, type Became, type InputLine, type ItemRef } from '../model/became'
import { voiceMark } from '../model/inputs'
import { DraftMark, Hit } from './bits'
import { Icon, StateIcon } from './Icon'
import { HIT, TYPE_TEXT } from './tones'

export interface InputRowEvents {
  goto(n: number): void
  menu(id: string, from: HTMLElement): void
  /** a long one opened, or closed again */
  more(id: string): void
  retry(id: string): void
  /** a recording kept as cancelled, sent after all */
  send(id: string): void
  /** to the project it was moved to */
  moved(href: string): void
  /** the draft of an edit, or of more to add, written on */
  draft(id: string, mode: 'edit' | 'append'): void
  /** the desktop's Add more (the phone has it in ⋯) */
  append?(id: string): void
  undoSend?(id: string): void
}

const ROW =
  'group/row border-t border-zinc-100 px-4 py-2.5 transition-colors duration-700 first:border-t-0 lg:-mx-3 lg:px-3 lg:hover:bg-zinc-50 dark:border-zinc-800/70 dark:lg:hover:bg-zinc-900/60'
/** gone to: lit up for a moment */
const LIT = 'bg-blue-50 dark:bg-blue-400/10'
const META = 'flex h-5 min-w-0 items-center gap-2 text-[13px]'
const MUTED = 'text-zinc-500 dark:text-zinc-400'
const LINK = `${HIT} shrink-0 font-semibold text-blue-600 hover:underline dark:text-blue-400`
const BTN =
  'flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[13px] font-medium text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
/** Undo, just after sending: blue, as every other thing to do here (not the grey of the row's buttons) */
const UNDO =
  'flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10'
/** under the pointer only on the desktop (or while the keys are in the row) */
const HOVER = 'lg:invisible lg:group-focus-within/row:visible lg:group-hover/row:visible'
const BECAME = 'mt-1.5 min-w-0 text-[13px] leading-5'

/** An item: its status mark, code and title; the title wraps, it is never cut. */
function ItemLink({ it, on }: { it: ItemRef; on: Pick<InputRowEvents, 'goto'> }) {
  return (
    <button onClick={() => on.goto(it.n)} className={`${HIT} flex min-w-0 items-start gap-1.5 text-left hover:underline`}>
      <StateIcon {...it.status} cls="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">
        <span className={`mr-1 font-mono text-xs font-bold ${TYPE_TEXT[it.type]}`}>{it.code}</span>
        <span className="text-zinc-800 dark:text-zinc-200">{it.title}</span>
      </span>
    </button>
  )
}

const say = (s: string) => s[0].toUpperCase() + s.slice(1)

/** What became of it, the same words in every list: the items with what was done to each (said once over the items
 * it was done to) and the organizer's note; or where it stands, in its colour (blue while Taska is on it, red when it
 * failed, green when done), with what can be done now. Every line starts with words at the same left edge. */
export function BecameLine({ b, id, on }: { b: Became; id: string; on: Pick<InputRowEvents, 'goto' | 'retry' | 'send' | 'moved'> }) {
  if (b.k === 'filed' || b.k === 'answer') {
    const rows = b.k === 'filed' ? b.items : [{ did: W.answer, item: b.item }]
    const note = b.k === 'filed' ? b.note : null
    return (
      <div className="grid grid-cols-[auto_minmax(0,1fr)] content-start items-start gap-x-1.5">
        {rows.map(({ did, item }, i) => (
          <div key={item.n} className="contents">
            <span className={`whitespace-nowrap ${MUTED}`}>{i && rows[i - 1].did === did ? '' : did}</span>
            <ItemLink it={item} on={on} />
          </div>
        ))}
        {note ? <span className={`col-span-2 ${MUTED}`}>{say(note)}</span> : null}
      </div>
    )
  }
  const line = (text: ReactNode, tone: string, after?: ReactNode) => (
    <div className="flex flex-wrap items-start gap-x-2">
      <span className={`min-w-0 font-medium ${tone}`}>{text}</span>
      {after}
    </div>
  )
  const busy = 'text-blue-600 dark:text-blue-400'
  const quiet = 'text-zinc-600 dark:text-zinc-300'
  switch (b.k) {
    case 'transcribing':
    case 'organizing':
      return line(W[b.k], busy)
    case 'failed':
      return line(
        W.failed,
        'text-red-600 dark:text-red-400',
        <>
          <span className={MUTED}>{b.why}</span>
          {b.retry ? (
            <button onClick={() => on.retry(id)} className={LINK}>
              {W.tryAgain}
            </button>
          ) : null}
        </>,
      )
    case 'undone':
      return line(
        W.undone,
        quiet,
        b.retry ? (
          <button onClick={() => on.retry(id)} className={LINK}>
            {W.organizeAgain}
          </button>
        ) : null,
      )
    case 'cancelled':
      return line(
        W.cancelled,
        quiet,
        <button onClick={() => on.send(id)} className={LINK}>
          {W.send}
        </button>,
      )
    case 'note':
      return <div className={MUTED}>{say(b.text)}</div>
    case 'queued':
      return line(W.queued, quiet)
    case 'agent':
      return line(W.agent, quiet)
    case 'waiting':
      return line(W.waiting, quiet)
    case 'handled':
      return line(W.handled, 'text-emerald-700 dark:text-emerald-400')
    default:
      return line(
        W.moved(b.to),
        quiet,
        <a
          href={b.href}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey) return
            e.preventDefault()
            on.moved(b.href)
          }}
          className={LINK}
        >
          {W.open(b.as)}
        </a>,
      )
  }
}

/** Its words: a long one shows four lines, the last fading (no ellipsis: after a full stop it reads "..."), with
 * More; opened, all of it, with Less. `text(cut)`: its words drawn, closed up when cut short. */
function Words({ x, text, on }: { x: InputLine; text(cut: boolean): ReactNode; on: Pick<InputRowEvents, 'more'> }) {
  const cut = x.long && !x.opened
  return (
    <div data-hit-html {...voiceMark(x.r)} className="mt-0.5 text-[15px] leading-6 text-zinc-900 dark:text-zinc-100">
      <div onClick={cut ? () => on.more(x.r.id) : undefined} className={cut ? 'max-h-24 cursor-pointer overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]' : ''}>
        {text(cut)}
      </div>
      {x.long ? (
        <button onClick={() => on.more(x.r.id)} className={`${LINK} text-[13px] leading-6`}>
          {x.opened ? 'Less' : 'More'}
        </button>
      ) : null}
    </div>
  )
}

export function InputRow({ x, words, text, files, lit = false, undo = false, rowRef, on }: {
  x: InputLine
  /** the searched words, marked in its number */
  words: readonly string[]
  text(cut: boolean): ReactNode
  files: ReactNode
  lit?: boolean
  /** just sent: Undo */
  undo?: boolean
  rowRef?: Ref<HTMLElement>
  on: InputRowEvents
}) {
  const r = x.r
  const moved = x.became.k === 'moved'
  return (
    <article ref={rowRef} className={`${ROW} ${lit ? LIT : ''}`}>
      <div className="min-w-0">
        <div className={META}>
          <span className="shrink-0 font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
            <Hit text={x.code} words={words} />
          </span>
          <span className={`shrink-0 whitespace-nowrap tabular-nums ${MUTED}`}>
            {x.when}
            {r.history?.some((h) => h.mode === 'edit') ? ' · edited' : ''}
          </span>
          {x.draft ? (
            <button onClick={() => on.draft(r.id, x.draft as 'edit')} className={`${HIT} shrink-0 text-xs`}>
              <DraftMark small />
            </button>
          ) : null}
          <span className="-my-1.5 -mr-1.5 ml-auto flex shrink-0 items-center">
            {moved ? null : (
              <>
                {on.append ? (
                  <button onClick={() => on.append?.(r.id)} className={`${BTN} hidden lg:flex ${HOVER}`}>
                    <Icon n="plus" c="size-3.5" sw="2" />
                    Add more
                  </button>
                ) : null}
                <button title="More" aria-label={`More for ${x.code}`} onClick={(e) => on.menu(r.id, e.currentTarget)} className={`${BTN} w-7 justify-center px-0 ${HOVER}`}>
                  <Icon n="more" c="size-4" />
                </button>
              </>
            )}
            {/* last, where ⋯ is, so it does not float mid-line while the pointer is elsewhere */}
            {undo && on.undoSend ? (
              <button onClick={() => on.undoSend?.(r.id)} className={UNDO}>
                <Icon n="undo" c="size-3.5" sw="2" />
                Undo
              </button>
            ) : null}
          </span>
        </div>
        {r.text ? <Words x={x} text={text} on={on} /> : null}
        {files ? <div className={`flex flex-wrap items-end gap-2 ${r.text ? 'mt-1.5' : 'mt-1'}`}>{files}</div> : null}
      </div>
      <div className={BECAME}>
        <BecameLine b={x.became} id={r.id} on={on} />
      </div>
    </article>
  )
}

export interface OutgoingAct {
  label: string
  run(): void
}

/** What is still on its way, as an input's line: Just now (and the item it is said on), its words and pictures; where
 * it is in the place of what became of it (blue on its way, red when Taska said no), with what can be done. */
export function OutgoingRow({ text, state, bad, scope = null, previews = [], acts }: { text: string; state: string; bad: boolean; scope?: string | null; previews?: string[]; acts: OutgoingAct[] }) {
  return (
    <article className={ROW}>
      <div className="min-w-0">
        <div className={META}>
          <span className={`whitespace-nowrap ${MUTED}`}>Just now</span>
          {scope ? (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className={`min-w-0 truncate ${MUTED}`}>on {scope}</span>
            </>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-4 text-[15px] leading-6 break-words whitespace-pre-wrap text-zinc-900/70 dark:text-zinc-100/70">{text}</p>
        {previews.length ? (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {previews.map((src, i) => (
              <img key={i} src={src} alt="" className="size-14 rounded-lg border border-zinc-200 object-cover lg:size-16 dark:border-zinc-700" />
            ))}
          </div>
        ) : null}
      </div>
      <div className={`${BECAME} flex flex-wrap items-start gap-x-2`}>
        <span className={`font-medium ${bad ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>{state}</span>
        {acts.map((a) => (
          <button key={a.label} onClick={a.run} className={LINK}>
            {a.label}
          </button>
        ))}
      </div>
    </article>
  )
}

/** A voice note being recorded into a new input: first, with how long so far (B627). */
export function RecordingRow({ clock }: { clock: string }) {
  return (
    <article className={ROW}>
      <div className={`${META} font-medium text-red-600 dark:text-red-400`}>
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
        Recording
        <span className="font-mono tabular-nums">{clock}</span>
      </div>
    </article>
  )
}
