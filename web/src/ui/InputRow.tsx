// One input as every list of inputs draws it (B629), words first, no boxes or bubbles: a line with its number and its
// day and time (a draft of yours on it, its buttons at the end), its words (a long one: four lines fading, More), its
// pictures and voice note, and what became of it in a line of 13px under the words, on the phone and the desktop
// alike (F659). Its buttons: the phone's ⋯ (Add more, Edit and the rest are in it); the desktop's Comment, Voice and
// ⋯, under the pointer only (or the keys), taking no room (F657); Voice records more to add right there, red with how
// long so far, and shows until pressed again. Undo, just after sending, always shows. What is still on its way, and a voice note being recorded, are drawn as lines of the same shape. Props only.

import type { ReactNode, Ref } from 'react'
import { BECAME_WORD as W, whenParts, type Became, type InputLine, type ItemRef } from '../model/became'
import { voiceMark } from '../model/inputs'
import { DraftMark, Hit } from './bits'
import { Icon, StateIcon } from './Icon'
import { HIT, MUTED, TYPE_TEXT } from './tones'

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
  /** the desktop's Comment: words to add, written in the box (the phone has Add more in ⋯) */
  append?(id: string): void
  /** the desktop's Voice: more to add, said; pressed again while it records, it stops and is added */
  voice?(id: string): void
  undoSend?(id: string): void
  /** a prototype's compact row (T661): picked, to be shown whole beside the list */
  pick?(id: string): void
}

const ROW =
  'group/row border-t border-zinc-100 px-4 py-2.5 transition-colors duration-700 first:border-t-0 lg:-mx-3 lg:px-3 lg:hover:bg-zinc-50 dark:border-zinc-800/70 dark:lg:hover:bg-zinc-900/60'
/** a prototype's row (T661): under the pointer a shade darker than the New input page's own grey */
const ROW_QUIET = ROW.replace('lg:hover:bg-zinc-50', 'lg:hover:bg-zinc-100/70').replace('dark:lg:hover:bg-zinc-900/60', 'dark:lg:hover:bg-zinc-900')
/** gone to: lit up for a moment */
const LIT = 'bg-blue-50 dark:bg-blue-400/10'
const META = 'flex h-5 min-w-0 items-center gap-2 text-[13px]'
const LINK = 'relative shrink-0 font-semibold text-blue-600 after:absolute after:inset-x-0 after:-inset-y-3 hover:underline dark:text-blue-400'
const BTN =
  'relative flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 after:absolute after:-inset-2 text-[13px] font-medium text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
/** Undo, just after sending: blue, as every other thing to do here (not the grey of the row's buttons) */
const UNDO =
  'flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10'
/** an icon alone in the row's buttons */
const ICON_BTN = `${BTN} w-7 justify-center px-0`
/** recording: red, as the mic beside a document's paragraph while it records, with how long so far */
const REC_BTN = 'flex h-7 shrink-0 items-center gap-1 rounded-md bg-red-600 px-1.5 font-mono text-[13px] font-medium text-white tabular-nums ring-1 ring-red-700 hover:bg-red-700'
/** under the pointer only on the desktop (or while the keys are in the row) */
const HOVER = 'lg:invisible lg:group-focus-within/row:visible lg:group-hover/row:visible'
const BECAME = 'mt-1.5 min-w-0 text-[13px] leading-5'

/** An item: its status mark, code and title; the title wraps, it is never cut. A prototype's looks (T661): `chip`, on a
 * tint of its own; `oneLine`, its title cut to one line (a list whose detail shows it whole). */
function ItemLink({ it, chip = false, oneLine = false, on }: { it: ItemRef; chip?: boolean; oneLine?: boolean; on: Pick<InputRowEvents, 'goto'> }) {
  const look = chip ? 'justify-self-start rounded-md bg-zinc-100 px-1.5 py-px hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700' : 'hover:underline'
  return (
    <button onClick={() => on.goto(it.n)} className={`${HIT} flex min-w-0 items-start gap-1.5 text-left ${look} ${oneLine ? 'max-w-full' : ''}`}>
      <StateIcon {...it.status} cls={chip ? 'mt-[3px] size-3.5 shrink-0' : 'mt-0.5 size-4 shrink-0'} />
      <span className={oneLine ? 'min-w-0 truncate' : 'min-w-0'}>
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
export function BecameLine({ b, id, chips = false, oneLine = false, on }: {
  b: Became
  id: string
  /** a prototype's look (T661): each item on a tint of its own */
  chips?: boolean
  /** a prototype's look (T661): each item's title on one line */
  oneLine?: boolean
  on: Pick<InputRowEvents, 'goto' | 'retry' | 'send' | 'moved'>
}) {
  if (b.k === 'filed' || b.k === 'answer') {
    const rows = b.k === 'filed' ? b.items : [{ did: W.answer, item: b.item }]
    const note = b.k === 'filed' ? b.note : null
    return (
      <div className={`grid grid-cols-[auto_minmax(0,1fr)] content-start items-start gap-x-1.5 ${chips ? 'gap-y-1' : ''}`}>
        {rows.map(({ did, item }, i) => (
          <div key={item.n} className="contents">
            <span className={`whitespace-nowrap ${MUTED} ${chips ? 'py-px' : ''}`}>{i && rows[i - 1].did === did ? '' : did}</span>
            <ItemLink it={item} chip={chips} oneLine={oneLine} on={on} />
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

/** A prototype's look of a row (T661); none: the page's own. `quiet`: the list says each day once over its rows, so its
 * first line is its time, its number quieter and its voice notes; `rail`: its time and number in a column beside a
 * line through the day, with a dot in the colour of where it stands (grey when done, blue while Taska is on it, red or
 * amber when it needs you), what it became as chips, its buttons floating over its corner under the pointer;
 * `compact`: its time, two lines of its words and one of what it became, picked to be shown whole beside the list. */
export type InputLook = 'quiet' | 'rail' | 'compact'

/** where it stands, as the rail's dot: quiet when done, blue while Taska is on it, red or amber when it needs you */
const DOT: Record<Became['k'], string> = {
  filed: 'bg-zinc-300 dark:bg-zinc-600',
  answer: 'bg-zinc-300 dark:bg-zinc-600',
  handled: 'bg-zinc-300 dark:bg-zinc-600',
  note: 'bg-zinc-300 dark:bg-zinc-600',
  agent: 'bg-zinc-300 dark:bg-zinc-600',
  waiting: 'bg-zinc-300 dark:bg-zinc-600',
  moved: 'bg-zinc-300 dark:bg-zinc-600',
  transcribing: 'animate-pulse bg-blue-500',
  organizing: 'animate-pulse bg-blue-500',
  queued: 'bg-blue-400',
  failed: 'bg-red-500',
  undone: 'bg-amber-500',
  cancelled: 'bg-amber-500',
}
const RAIL_ROW = 'group/row grid grid-cols-[3rem_1.25rem_minmax(0,1fr)] transition-colors duration-700 lg:-mx-3 lg:rounded-lg lg:pr-3 lg:hover:bg-zinc-100/70 dark:lg:hover:bg-zinc-900'
const GUTTER = 'py-2.5 text-right'
const GUTTER_TIME = `mt-0.5 text-[13px] leading-6 tabular-nums ${MUTED}`
const GUTTER_SMALL = `font-mono text-[11px] leading-4 ${MUTED}`

/** The day's line through a rail row, with the row's dot by its first line. */
function RailDot({ dot }: { dot: string }) {
  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-zinc-200 dark:bg-zinc-800" />
      <span className={`absolute top-5 left-1/2 size-2 -translate-x-1/2 rounded-full ${dot}`} />
    </div>
  )
}

/** A day over its rows, in a prototype's look (T661): its name, on the rail as a ring. */
export function DayHead({ day, look, first }: { day: string; look: InputLook; first: boolean }) {
  if (look === 'rail')
    return (
      <h3 className="grid grid-cols-[3rem_1.25rem_minmax(0,1fr)] lg:-mx-3 lg:pr-3">
        <span />
        <span className="relative">
          <span className={`absolute bottom-0 left-1/2 w-px -translate-x-1/2 bg-zinc-200 dark:bg-zinc-800 ${first ? 'top-[18px]' : 'top-0'}`} />
          <span className="absolute top-[13px] left-1/2 size-2.5 -translate-x-1/2 rounded-full border-2 border-zinc-400 bg-zinc-50 dark:border-zinc-500 dark:bg-zinc-950" />
        </span>
        <span className={`pl-1 text-[13px] leading-5 font-semibold text-zinc-900 dark:text-zinc-100 ${first ? 'py-2' : 'pt-5 pb-2'}`}>{day}</span>
      </h3>
    )
  return <h3 className={`px-4 pb-1.5 [&+article]:border-t-0 text-[13px] leading-5 font-semibold text-zinc-900 lg:px-0 dark:text-zinc-100 ${first ? 'pt-1' : 'pt-6'}`}>{day}</h3>
}

/** Its buttons: the desktop's Comment and Voice (Stop with how long so far while it records), and ⋯. */
function RowButtons({ x, rec, on }: { x: InputLine; rec: string | null; on: InputRowEvents }) {
  const r = x.r
  if (x.became.k === 'moved') return null
  return (
    <>
      {on.append && !rec ? (
        <button title="Comment" aria-label={`Comment on ${x.code}`} onClick={() => on.append?.(r.id)} className={`${ICON_BTN} hidden lg:flex ${HOVER}`}>
          <Icon n="comment" c="size-4" />
        </button>
      ) : null}
      {on.voice ? (
        rec ? (
          <button title="Stop" aria-label={`Stop and add to ${x.code}`} onClick={() => on.voice?.(r.id)} className={`${REC_BTN} hidden lg:flex`}>
            <Icon n="stop" c="size-4" />
            {rec}
          </button>
        ) : (
          <button title="Voice" aria-label={`Voice for ${x.code}`} onClick={() => on.voice?.(r.id)} className={`${ICON_BTN} hidden lg:flex ${HOVER}`}>
            <Icon n="mic" c="size-4" />
          </button>
        )
      ) : null}
      <button title="More" aria-label={`More for ${x.code}`} onClick={(e) => on.menu(r.id, e.currentTarget)} className={`${ICON_BTN} ${HOVER}`}>
        <Icon n="more" c="size-4" />
      </button>
    </>
  )
}

export function InputRow({ x, words, text, files, lit = false, undo = false, rec = null, rowRef, look, voice = null, on }: {
  x: InputLine
  /** the searched words, marked in its number */
  words: readonly string[]
  text(cut: boolean): ReactNode
  files: ReactNode
  lit?: boolean
  /** just sent: Undo */
  undo?: boolean
  /** more to add being recorded here (Voice): how long so far */
  rec?: string | null
  rowRef?: Ref<HTMLElement>
  /** a prototype's look (T661); none: the page's own */
  look?: InputLook
  /** a prototype's look: its voice notes in its first line (quiet, compact) or at the end of what it became (rail),
   * `files` holding the rest */
  voice?: ReactNode
  on: InputRowEvents
}) {
  const r = x.r
  const edited = r.history?.some((h) => h.mode === 'edit') ? ' · edited' : ''
  const draft = x.draft ? (
    <button onClick={() => on.draft(r.id, x.draft as 'edit')} className={`${HIT} shrink-0 text-xs`}>
      <DraftMark small />
    </button>
  ) : null
  const undoButton =
    undo && on.undoSend ? (
      <button onClick={() => on.undoSend?.(r.id)} className={UNDO}>
        <Icon n="undo" c="size-3.5" sw="2" />
        Undo
      </button>
    ) : null
  const filesRow = files ? <div className={`flex flex-wrap items-end gap-2 ${r.text ? 'mt-1.5' : 'mt-1'}`}>{files}</div> : null
  const { time } = whenParts(x.when)
  if (look === 'rail')
    return (
      <article ref={rowRef} className={`${RAIL_ROW} ${lit ? LIT : ''}`}>
        <div className={GUTTER}>
          <div className={GUTTER_TIME}>{time}</div>
          <div className={GUTTER_SMALL}>
            <Hit text={x.code} words={words} />
          </div>
          {edited ? <div className={GUTTER_SMALL}>edited</div> : null}
        </div>
        <RailDot dot={DOT[x.became.k]} />
        <div className="relative min-w-0 py-2.5 pl-1">
          <span
            className={`flex items-center phone:float-right phone:-mt-0.5 phone:-mr-1.5 phone:ml-2 lg:absolute lg:-top-4 lg:right-0 lg:z-10 lg:rounded-lg lg:border lg:border-zinc-200 lg:bg-white lg:p-0.5 lg:shadow-sm dark:lg:border-zinc-700 dark:lg:bg-zinc-900 ${rec ? '' : HOVER} ${x.became.k === 'moved' ? 'hidden' : ''}`}
          >
            <RowButtons x={x} rec={rec} on={on} />
          </span>
          {r.text ? <Words x={x} text={text} on={on} /> : null}
          {filesRow}
          <div className={`${BECAME} flex items-start gap-x-2`}>
            <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-2 gap-y-1">
              <BecameLine b={x.became} id={r.id} chips on={on} />
              {draft ? <span className="flex h-[22px] items-center">{draft}</span> : null}
              {undoButton ? <span className="-my-[3px] -ml-1.5 flex">{undoButton}</span> : null}
            </div>
            {voice ? <span className="-my-[3px] -mr-1 flex shrink-0 items-center">{voice}</span> : null}
          </div>
        </div>
      </article>
    )
  const quiet = look === 'quiet' || look === 'compact'
  const compact = look === 'compact'
  return (
    <article ref={rowRef} onClick={compact && on.pick ? () => on.pick?.(r.id) : undefined} className={`${quiet ? ROW_QUIET : ROW} ${lit ? LIT : ''} ${compact ? 'cursor-pointer' : ''}`}>
      <div className="min-w-0">
        <div className={META}>
          {quiet ? (
            <>
              <span className={`shrink-0 whitespace-nowrap tabular-nums ${MUTED}`}>
                {time}
                {edited}
              </span>
              <span className={`shrink-0 font-mono text-xs ${MUTED}`}>
                <Hit text={x.code} words={words} />
              </span>
              {voice ? <span className="-my-1.5 -ml-1.5 flex shrink-0 items-center">{voice}</span> : null}
            </>
          ) : (
            <>
              <span className="shrink-0 font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
                <Hit text={x.code} words={words} />
              </span>
              <span className={`shrink-0 whitespace-nowrap tabular-nums ${MUTED}`}>
                {x.when}
                {edited}
              </span>
            </>
          )}
          {draft}
          <span className="-my-1.5 -mr-1.5 ml-auto flex shrink-0 items-center">
            {compact ? null : <RowButtons x={x} rec={rec} on={on} />}
            {/* last, where ⋯ is, so it does not float mid-line while the pointer is elsewhere */}
            {undoButton}
          </span>
        </div>
        {r.text ? (
          compact ? (
            <div {...voiceMark(r)} className="mt-0.5 line-clamp-2 text-[15px] leading-6 text-zinc-900 dark:text-zinc-100">
              {text(true)}
            </div>
          ) : (
            <Words x={x} text={text} on={on} />
          )
        ) : null}
        {filesRow}
      </div>
      <div className={BECAME}>
        <BecameLine b={x.became} id={r.id} oneLine={compact} on={on} />
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
export function OutgoingRow({ text, state, bad, scope = null, previews = [], acts, look }: { text: string; state: string; bad: boolean; scope?: string | null; previews?: string[]; acts: OutgoingAct[]; /** a prototype's look (T661) */ look?: InputLook }) {
  if (look === 'rail')
    return (
      <article className={RAIL_ROW}>
        <div className={GUTTER}>
          <div className={GUTTER_TIME}>Now</div>
        </div>
        <RailDot dot={bad ? 'bg-red-500' : 'animate-pulse bg-blue-500'} />
        <div className="min-w-0 py-2.5 pl-1">
          <p className="mt-0.5 line-clamp-4 text-[15px] leading-6 break-words whitespace-pre-wrap text-zinc-900/70 dark:text-zinc-100/70">{text}</p>
          <div className={`${BECAME} flex flex-wrap items-start gap-x-2`}>
            <span className={`font-medium ${bad ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>{state}</span>
            {acts.map((a) => (
              <button key={a.label} onClick={a.run} className={LINK}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </article>
    )
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
export function RecordingRow({ clock, look }: { clock: string; /** a prototype's look (T661) */ look?: InputLook }) {
  if (look === 'rail')
    return (
      <article className={RAIL_ROW}>
        <div className={GUTTER}>
          <div className="mt-0.5 font-mono text-[13px] leading-6 text-red-600 tabular-nums dark:text-red-400">{clock}</div>
        </div>
        <RailDot dot="animate-pulse bg-red-500" />
        <div className="py-2.5 pl-1">
          <div className="mt-0.5 text-[13px] leading-6 font-medium text-red-600 dark:text-red-400">Recording</div>
        </div>
      </article>
    )
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
