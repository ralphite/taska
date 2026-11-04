// One input as every list of inputs draws it (T661, the approved "Anchored Stream"): a line with its number and its
// day and time (edited, a draft of yours on it), its buttons at the end; its words (a long one: four lines, More); its
// voice notes, pictures and files as chips; and what became of it on a shelf of its own under them. Its buttons: the
// phone's ⋯ (Add more, Edit and the rest are in it); the desktop's Comment, Voice and ⋯, under the pointer only (or
// the keys); Voice records more to add right there, red with how long so far, and shows until pressed again. Undo,
// just after sending, always shows. What is still on its way, and a voice note being recorded, are lines of their own
// over the list. Props only.

import type { ReactNode, Ref } from 'react'
import { BECAME_WORD as W, type Became, type InputLine, type ItemRef } from '../model/became'
import { voiceMark } from '../model/inputs'
import { Hit } from './bits'
import { Icon, Spinner, StateIcon } from './Icon'
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
  /** the desktop's Voice: more to add, said; pressed again while it records, it stops and is added */
  voice?(id: string): void
  undoSend?(id: string): void
}

/** The rows of a list: a faint line between them. */
export const INPUT_LIST = 'divide-y divide-zinc-200/80 dark:divide-zinc-800/80'
/** A row: more room under it than over it, so what it became stays with it and apart from the next one's line. */
const ROW = 'group/row -mx-2 rounded-xl px-2 pt-4 pb-5 transition-colors duration-700 focus-within:bg-zinc-100/60 dark:focus-within:bg-zinc-900/40'
/** gone to: lit up for a moment */
const LIT = 'bg-blue-50 dark:bg-blue-400/10'
/** the desktop's Comment and Voice */
const ACT = 'hidden rounded px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 lg:block dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
/** ⋯: 44px on the phone, small on the desktop */
const MORE =
  'flex size-11 items-center justify-center text-zinc-400 active:text-zinc-800 lg:size-6 lg:rounded lg:text-zinc-500 lg:hover:bg-zinc-200/60 dark:active:text-zinc-200 dark:lg:hover:bg-zinc-800'
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
const DID = 'font-medium text-zinc-500 dark:text-zinc-400'

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
    case 'queued':
      return <div className={`${SHELF} ${BUSY}`}>{W.queued}</div>
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

/** Its buttons: Voice recording (red, Stop with how long so far), then Comment and Voice on the desktop, and ⋯. */
function RowButtons({ x, rec, on }: { x: InputLine; rec: string | null; on: InputRowEvents }) {
  const r = x.r
  if (x.became.k === 'moved') return null
  return (
    <>
      {rec && on.voice ? (
        <button
          title="Stop"
          aria-label={`Stop and add to ${x.code}`}
          onClick={() => on.voice?.(r.id)}
          className="hidden items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 font-mono text-xs font-medium text-white tabular-nums shadow-2xs hover:bg-red-700 lg:inline-flex"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-white" />
          <span>{rec}</span>
          <span className="ml-0.5 font-sans text-[10px] font-bold uppercase">Stop</span>
        </button>
      ) : null}
      <span className={`-mr-2 flex items-center gap-1 lg:mr-0 ${rec ? '' : HOVER}`}>
        {on.append ? (
          <button aria-label={`Comment on ${x.code}`} onClick={() => on.append?.(r.id)} className={ACT}>
            Comment
          </button>
        ) : null}
        {on.voice && !rec ? (
          <button aria-label={`Voice for ${x.code}`} onClick={() => on.voice?.(r.id)} className={ACT}>
            Voice
          </button>
        ) : null}
        <button title="More" aria-label={`More for ${x.code}`} onClick={(e) => on.menu(r.id, e.currentTarget)} className={MORE}>
          <Icon n="more" c="size-4" sw="2" />
        </button>
      </span>
    </>
  )
}

export function InputRow({ x, words, text, files, lit = false, undo = false, rec = null, rowRef, on }: {
  x: InputLine
  /** the searched words, marked in its number */
  words: readonly string[]
  text(cut: boolean): ReactNode
  /** its voice notes, pictures and files */
  files: ReactNode
  lit?: boolean
  /** just sent: Undo */
  undo?: boolean
  /** more to add being recorded here (Voice): how long so far */
  rec?: string | null
  rowRef?: Ref<HTMLElement>
  on: InputRowEvents
}) {
  const r = x.r
  const edited = r.history?.some((h) => h.mode === 'edit')
  const voiceOnly = r.files.every((f) => (f.mime || '').startsWith('audio/'))
  return (
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
          {undo && on.undoSend ? (
            <button onClick={() => on.undoSend?.(r.id)} className="px-1 py-0.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Undo
            </button>
          ) : null}
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
}

export interface OutgoingAct {
  label: string
  run(): void
}

/** What is still on its way, as a line over the list: its words on one line, where it is (blue on its way, amber
 * waiting for Taska, red when Taska said no) and what can be done. */
export function OutgoingRow({ text, state, bad, waiting, scope = null, previews = [], acts }: {
  text: string
  state: string
  /** Taska said no */
  bad: boolean
  /** Taska is out of reach: it waits */
  waiting: boolean
  scope?: string | null
  previews?: string[]
  acts: OutgoingAct[]
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
      </div>
    </div>
  )
}

/** A voice note being recorded into a new input: first, with how long so far (B627), and Esc to discard it. */
export function RecordingRow({ clock, onDiscard }: { clock: string; onDiscard?(): void }) {
  return (
    <div role="status" className="flex items-center justify-between rounded-xl border border-red-200 bg-red-500/[0.08] px-3.5 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-500/15 dark:text-red-300">
      <div className="flex items-center gap-2">
        <span className="size-2 animate-ping rounded-full bg-red-600" />
        <span className="font-medium">Recording new input…</span>
        <span aria-hidden className="ml-1 flex h-3 items-center gap-0.5 opacity-75">
          {['h-1.5', 'h-3', 'h-2', 'h-3.5'].map((h, i) => (
            <span key={i} className={`w-0.5 ${h} animate-pulse rounded-full bg-red-600 dark:bg-red-400`} style={{ animationDelay: `${[0, 80, 160, 40][i]}ms` }} />
          ))}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono font-semibold tabular-nums">{clock}</span>
        {onDiscard ? (
          <button onClick={onDiscard} aria-label="Discard the recording" title="Discard · Esc" className="font-mono text-[11px] text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">
            Esc
          </button>
        ) : null}
      </div>
    </div>
  )
}
