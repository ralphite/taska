// One input as every list of inputs draws it (T661, the approved "Anchored Stream"): a line with its number and its
// day and time (edited, a draft of yours on it), its buttons at the end; its words (a long one: four lines, More); its
// voice notes, pictures and files as chips; and what became of it on a shelf of its own under them. A hairline
// between rows; under the pointer a row is a shade darker, as the item list's are. Its buttons: the phone's ⋯ (where it does not swipe, D115 #42; Add
// more, Edit and the rest are in it); the desktop's Voice, Comment and ⋯ as the page's other places have them
// (PlaceVoice, B498), under the pointer only (or the keys); Voice turns them into the recording strip right there, its
// ✓ where Voice was, which stops and adds the note to this input. Its ⋯ has Delete, last (B666: no Undo for a while
// after sending). What is still on its way (its × cancels it), and a voice note being recorded, are lines of their own
// over the list. Props only.

import type { ReactNode, Ref } from 'react'
import { BECAME_WORD as W, type Became, type InputLine, type ItemRef } from '../model/became'
import { voiceMark } from '../model/inputs'
import { Hit } from './bits'
import { Icon, Spinner, StateIcon } from './Icon'
import { PLACE_BUTTON, PlaceVoice } from './PlaceVoice'
import { TYPE_TEXT } from './tones'

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
  /** the desktop's Voice: more to add, said; its ✓ (pressed again) stops it and it is added */
  voice?(id: string): void
  /** the recording here let go (its ✕, or Esc) */
  discard?(): void
}

/** The rows of a list: a hairline between them, across the whole row. */
export const INPUT_LIST = 'divide-y divide-zinc-200/80 dark:divide-zinc-800/80'
/** A row: more room under it than over it, so what it became stays with it and apart from the next one's line. Under
 * the pointer (or the keys) a shade darker than the page, as the item list's rows (dark: the same tone as theirs). */
const ROW =
  'group/row px-4 pt-4 pb-5 transition-colors lg:-mx-3 lg:px-3 lg:hover:bg-zinc-100 lg:focus-within:bg-zinc-100 dark:lg:hover:bg-[color-mix(in_oklab,var(--color-zinc-900)_70%,var(--color-zinc-950))] dark:lg:focus-within:bg-[color-mix(in_oklab,var(--color-zinc-900)_70%,var(--color-zinc-950))]'
/** gone to: lit up for a moment */
const LIT = 'bg-blue-50 dark:bg-blue-400/10'
/** ⋯ on the phone: 44px */
/** under the pointer only on the desktop (or while the keys are in the row); always on the phone */
const HOVER = 'lg:opacity-0 lg:transition-opacity lg:group-focus-within/row:opacity-100 lg:group-hover/row:opacity-100'
const LINK = 'text-blue-600 hover:underline dark:text-blue-400'

/** What became of it: a shelf under the words, tinted for where it stands. */
const SHELF = 'inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs'
const GREY = 'border-zinc-200/70 bg-zinc-100/80 dark:border-zinc-800 dark:bg-zinc-900/70'
const QUIET = `${GREY} font-medium text-zinc-500 dark:text-zinc-400`
const BUSY = 'border-blue-200/80 bg-blue-50/80 py-1 font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300'
const FAILED = 'border-red-200/80 bg-red-50/70 font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-400'
const DONE = 'gap-1.5 border-emerald-200/80 bg-emerald-50/80 font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
const DID = 'shrink-0 whitespace-nowrap font-medium text-zinc-500 dark:text-zinc-400'

/** An item: its status mark, code and title (cut to fit). */
function ItemLink({ it, narrow, on }: { it: ItemRef; narrow: boolean; on: Pick<InputRowEvents, 'goto'> }) {
  return (
    <button onClick={() => on.goto(it.n)} title={it.title} className="inline-flex min-w-0 items-center gap-1.5 text-left text-zinc-800 hover:underline dark:text-zinc-200">
      <StateIcon {...it.status} cls="size-4 shrink-0" />
      <span className={`font-mono font-bold ${TYPE_TEXT[it.type]}`}>{it.code}</span>
      <span className={`truncate ${narrow ? 'max-w-[150px] sm:max-w-[180px]' : 'max-w-[260px] sm:max-w-[420px]'}`}>{it.title}</span>
    </button>
  )
}

const say = (s: string) => s[0].toUpperCase() + s.slice(1)
const Dot = () => <span>·</span>

/** What became of it, the same words in every list: the items with what was done to each (said once over the items
 * it was done to) and the organizer's note; or where it stands, in its tint (blue while Taska is on it, red when it
 * failed, green when an agent handled it), with what can be done now. */
export function BecameLine({ b, id, on }: { b: Became; id: string; on: Pick<InputRowEvents, 'goto' | 'retry' | 'send' | 'moved'> }) {
  if (b.k === 'filed' || b.k === 'answer') {
    const rows = b.k === 'filed' ? b.items : [{ did: W.answer, item: b.item }]
    const note = b.k === 'filed' ? b.note : null
    if (rows.length === 1 && !note)
      return (
        <div className={`${SHELF} ${GREY}`}>
          {rows[0].did ? <span className={DID}>{rows[0].did}</span> : null}
          <ItemLink it={rows[0].item} narrow={false} on={on} />
        </div>
      )
    const sep = <span className="hidden text-zinc-300 sm:inline dark:text-zinc-700">·</span>
    return (
      <div className={`${SHELF} ${GREY} flex-wrap gap-x-3 gap-y-1.5`}>
        {rows.map(({ did, item }, i) => (
          <span key={item.n} className="contents">
            {i ? sep : null}
            <span className="flex min-w-0 items-center gap-1.5">
              {did && !(i && rows[i - 1].did === did) ? <span className={DID}>{did}</span> : null}
              <ItemLink it={item} narrow={rows.length > 1} on={on} />
            </span>
          </span>
        ))}
        {note ? (
          <>
            {sep}
            <span className={DID}>{say(note)}</span>
          </>
        ) : null}
      </div>
    )
  }
  switch (b.k) {
    case 'transcribing':
    case 'organizing':
      return (
        <div className={`${SHELF} ${BUSY}`}>
          <Spinner c="size-3 text-blue-600 dark:text-blue-400" />
          <span>{W[b.k]}</span>
        </div>
      )
    case 'failed':
      return (
        <div className={`${SHELF} ${FAILED} flex-wrap`}>
          <span>
            {W.failed} · {b.why}
          </span>
          {b.retry ? (
            <>
              <Dot />
              <button onClick={() => on.retry(id)} className="font-semibold underline hover:text-red-900 dark:hover:text-red-200">
                {W.tryAgain}
              </button>
            </>
          ) : null}
        </div>
      )
    case 'undone':
      return (
        <div className={`${SHELF} ${QUIET}`}>
          <span>{W.undone}</span>
          {b.retry ? (
            <>
              <Dot />
              <button onClick={() => on.retry(id)} className={LINK}>
                {W.organizeAgain}
              </button>
            </>
          ) : null}
        </div>
      )
    case 'cancelled':
      return (
        <div className={`${SHELF} ${QUIET}`}>
          <span>{W.cancelled}</span>
          <Dot />
          <button onClick={() => on.send(id)} className={`${LINK} font-semibold`}>
            {W.send}
          </button>
        </div>
      )
    case 'note':
      return <div className={`${SHELF} ${QUIET}`}>{say(b.text)}</div>
    case 'agent':
    case 'waiting':
      return <div className={`${SHELF} ${QUIET} gap-1.5`}>{W[b.k]}</div>
    case 'handled':
      return (
        <div className={`${SHELF} ${DONE}`}>
          <Icon n="bolt" c="size-3.5 text-emerald-600 dark:text-emerald-400" sw="2" />
          <span>{W.handled}</span>
        </div>
      )
    default:
      return (
        <div className={`${SHELF} ${GREY} text-zinc-500 dark:text-zinc-400`}>
          <span>{W.moved(b.to)}</span>
          <Dot />
          <a
            href={b.href}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) return
              e.preventDefault()
              on.moved(b.href)
            }}
            className={`${LINK} font-medium`}
          >
            {W.open(b.as)}
          </a>
        </div>
      )
  }
}

/** Its words: a long one shows four lines with More; opened, all of it, with Less. `text(cut)`: its words drawn,
 * closed up when cut short. */
function Words({ x, text, on }: { x: InputLine; text(cut: boolean): ReactNode; on: Pick<InputRowEvents, 'more'> }) {
  const cut = x.long && !x.opened
  return (
    <div data-hit-html {...voiceMark(x.r)} className="text-[15px] leading-[1.6] text-zinc-900 dark:text-zinc-100">
      <div onClick={cut ? () => on.more(x.r.id) : undefined} className={cut ? 'line-clamp-4 cursor-pointer' : ''}>
        {text(cut)}
      </div>
      {x.long ? (
        <button onClick={() => on.more(x.r.id)} className="mt-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          {x.opened ? 'Less' : 'More'}
        </button>
      ) : null}
    </div>
  )
}

/** Its buttons, on the desktop: Voice and Comment as the page's other places have them (PlaceVoice; recording, its
 * strip: ✕, the time and level, ✓ where Voice was), and ⋯ beside them. The phone has none: the row swipes, and a long
 * press opens the menu (D115 #42, r1059). */
function RowButtons({ x, rec, on }: { x: InputLine; rec: ReactNode | null; on: InputRowEvents }) {
  const r = x.r
  if (x.became.k === 'moved') return null
  return (
    <>
      <span className={`hidden items-center gap-1 lg:flex ${rec ? '' : HOVER}`}>
        {on.voice && on.append ? (
          <PlaceVoice
            rec={!!rec}
            meter={rec}
            labels={{ say: `Voice for ${x.code}`, comment: `Comment on ${x.code}`, check: `Stop and add to ${x.code}` }}
            on={{ say: () => on.voice?.(r.id), comment: () => on.append?.(r.id), check: () => on.voice?.(r.id), cancel: () => on.discard?.() }}
          />
        ) : null}
        <button title="More" aria-label={`More for ${x.code}`} onClick={(e) => on.menu(r.id, e.currentTarget)} className={PLACE_BUTTON}>
          <Icon n="more" c="size-4" sw="2" />
        </button>
      </span>
    </>
  )
}

export function InputRow({ x, words, text, files, lit = false, rec = null, rowRef, swipe = null, on }: {
  x: InputLine
  /** the searched words, marked in its number */
  words: readonly string[]
  text(cut: boolean): ReactNode
  /** its voice notes, pictures and files */
  files: ReactNode
  lit?: boolean
  /** more to add being recorded here (Voice): its time and level */
  rec?: ReactNode | null
  rowRef?: Ref<HTMLElement>
  /** the phone swipes it (its ⋯ goes: a long press opens its menu) */
  swipe?: InputSwipe | null
  on: InputRowEvents
}) {
  const r = x.r
  const edited = r.history?.some((h) => h.mode === 'edit')
  const voiceOnly = r.files.every((f) => (f.mime || '').startsWith('audio/'))
  const row = (
    <article ref={rowRef} className={`${ROW} ${lit ? LIT : ''}`}>
      <header className={`mb-1.5 flex items-center justify-between gap-2 ${x.draft || rec ? 'h-6' : 'h-5'}`}>
        <div className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] whitespace-nowrap text-zinc-400 dark:text-zinc-500">
          <span className="font-medium text-zinc-600 dark:text-zinc-400">
            <Hit text={x.code} words={words} />
          </span>
          <span>
            {x.day} {x.time}
          </span>
          {edited ? <span className="italic">· edited</span> : null}
          {x.draft ? (
            <button
              data-draft
              onClick={() => on.draft(r.id, x.draft as 'edit')}
              className="rounded bg-amber-100 px-1 font-sans text-[10px] font-semibold text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
            >
              Draft
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <RowButtons x={x} rec={rec} on={on} />
        </div>
      </header>
      {r.text ? <Words x={x} text={text} on={on} /> : null}
      {files ? <div className={`flex flex-wrap items-center gap-2 ${!r.text ? 'my-1.5' : voiceOnly ? 'mt-2' : 'mt-2.5'}`}>{files}</div> : null}
      <footer className="mt-2.5">
        <BecameLine b={x.became} id={r.id} on={on} />
      </footer>
    </article>
  )
  if (!swipe) return row
  // the phone's swipe (D115 #42): right opens the item it became, left shows Move and Delete; a long press, its menu
  return (
    <div className="relative overflow-hidden">
      <div data-swipe-left hidden className="absolute inset-0 flex items-center gap-2 bg-blue-600 pl-6 text-sm font-semibold text-white dark:bg-blue-500">
        {swipe.open ? (
          <>
            <Icon n="open" c="size-5" />
            Open {swipe.open}
          </>
        ) : null}
      </div>
      <div data-swipe-right hidden className="absolute inset-y-0 right-0 flex">
        {swipe.move ? (
          <button onClick={() => swipe.on.move(r.id)} className={`${SWIPE_BTN} bg-zinc-600 dark:bg-zinc-700`}>
            <Icon n="arrow" c="size-5" />
            Move
          </button>
        ) : null}
        <button onClick={() => swipe.on.remove(r.id)} className={`${SWIPE_BTN} bg-red-600 dark:bg-red-500`}>
          <Icon n="trash" c="size-5" />
          Delete
        </button>
      </div>
      <div data-swipe={r.id} className="relative touch-pan-y bg-white transition-transform duration-200 select-none [-webkit-touch-callout:none] dark:bg-zinc-950">
        {row}
      </div>
    </div>
  )
}

const SWIPE_BTN = 'flex w-19 flex-col items-center justify-center gap-1 text-xs font-semibold text-white'

/** What a row swiped shows (the phone's Inputs tab): the item it opens (its code; none: no swipe right), Move (when it
 * can go to another project), Delete. */
export interface InputSwipe {
  open: string | null
  move: boolean
  on: { move(id: string): void; remove(id: string): void }
}

export interface OutgoingAct {
  label: string
  run(): void
}

/** What is still on its way, as a line over the list: its words on one line, where it is (blue on its way, amber
 * waiting for Taska, red when Taska said no), what can be done, and × at the end, which cancels it (B666). */
export function OutgoingRow({ text, state, bad, waiting, scope = null, previews = [], acts, cancel }: {
  text: string
  state: string
  /** Taska said no */
  bad: boolean
  /** Taska is out of reach: it waits */
  waiting: boolean
  scope?: string | null
  previews?: string[]
  acts: OutgoingAct[]
  /** ×: it does not go */
  cancel(): void
}) {
  const tone = bad
    ? { box: 'border-red-200/80 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/25', state: 'text-red-700 dark:text-red-400', act: 'font-semibold text-red-800 hover:underline dark:text-red-300' }
    : waiting
      ? { box: 'border-amber-200/80 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/25', state: 'text-amber-700 dark:text-amber-400', act: 'font-semibold text-amber-800 hover:underline dark:text-amber-300' }
      : { box: 'border-blue-200/80 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/25', state: 'text-blue-600 dark:text-blue-400', act: 'font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100' }
  return (
    <div role="status" className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-xs ${tone.box}`}>
      <div className="flex min-w-0 items-center gap-2">
        {previews.map((src, i) => (
          <img key={i} src={src} alt="" className="size-5 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-700" />
        ))}
        <p className="min-w-0 truncate text-zinc-800 dark:text-zinc-200">{text}</p>
        {scope ? <span className="shrink-0 text-zinc-500 dark:text-zinc-400">on {scope}</span> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <span className={`flex items-center gap-1 font-medium ${tone.state}`}>
          {bad || waiting ? <Icon n="alert" c="size-3" sw="2" /> : <Spinner c="size-3" />}
          {state}
        </span>
        {acts.map((a) => (
          <button key={a.label} onClick={a.run} className={`transition-colors ${tone.act}`}>
            {a.label}
          </button>
        ))}
        <button onClick={cancel} aria-label="Cancel" title="Cancel: it is not sent" className="-my-1 -mr-1.5 grid size-6 place-items-center rounded-full text-zinc-500 hover:bg-zinc-900/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100">
          <Icon n="x" c="size-3.5" sw="2" />
        </button>
      </div>
    </div>
  )
}

/** A voice note being recorded into a new input: first, with how long so far (B627); drawn as before T661 (r1051). */
export function RecordingRow({ clock }: { clock: string }) {
  return (
    <article className="border-zinc-100 px-4 py-2.5 lg:-mx-3 lg:px-3 dark:border-zinc-800/70">
      <div className="flex h-5 min-w-0 items-center gap-2 text-[13px] font-medium text-red-600 dark:text-red-400">
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
        Recording
        <span className="font-mono tabular-nums">{clock}</span>
      </div>
    </article>
  )
}
