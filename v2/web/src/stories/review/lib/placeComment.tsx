// B498 (r815, #7079): for Review, not built yet. One control for every place picked in a page to comment on (a
// Markdown paragraph, a part of a web page): two buttons beside it, voice and comment. Voice turns them, where they
// are, into a small recording strip like the input box's, with no text field: the voice button becomes ✓ (stop: the
// words go into the real input box below, at this place), the comment button becomes ↑ (send at once), and ✕ at the
// far left cancels. Comment (words) writes in the real input box below, at this place.
// What the page has is drawn as the page draws it (its classes, its icons, its thread of comments: the real Thread);
// the strip is drawn from the input box's own recording strip (Composer's RecBar and buttons). The recorder is not
// real: its time runs and its level moves by itself.
import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from '../../../components/ui'
import { Thread } from '../../../components/Doc'
import { clock } from '../../../lib/state'
import type { IconName } from '../../../lib/icons'
import type { Comment, Doc } from '../../../lib/types'

export type Step = 'picked' | 'typing' | 'recording' | 'checked' | 'sent' | 'cancelled'
export type Kind = 'md' | 'web'

// what is said about each place (the comment's words, Chinese escaped: the source stays English)
const SAID: Record<Kind, string> = {
  md: '这一步要多久？', // how long does this step take?
  web: '410 ms 能再快一点吗？', // can 410 ms be any faster?
}
const QUOTE: Record<Kind, string> = {
  md: 'Apply the current filter when writing the file.',
  web: 'Write CSV 410 ms',
}
// the document the place is in, as Taska sends it (for the real Thread)
const DOC: Doc = {
  d: 56,
  n: 432,
  title: 'Export plan',
  md: '',
  t0: '2026-10-22T15:22:00-07:00',
  t1: '2026-10-22T15:22:00-07:00',
  by: 'claude-code',
  versions: 1,
  comments: [],
  blocks: [],
  detached: [],
  whole: [],
  open: 0,
  resolved: {},
}

// ---------------------------------------------------------------- the recorder (not real): its time and its level

/** While it is drawn: the time since it began, and a voice's level (a few syllables a second, quieter between) */
function useRecorder() {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    const t0 = Date.now(),
      tick = window.setInterval(() => setMs(Date.now() - t0), 110)
    return () => clearInterval(tick)
  }, [])
  const levels = Array.from({ length: 12 }, (_, i) => {
    const x = (ms / 1000) * 5 - i * 0.55
    return Math.max(0.08, Math.abs(Math.sin(x)) * (0.45 + 0.55 * Math.abs(Math.sin(x * 0.37 + i))))
  })
  return { ms, levels }
}

/** The input box's recording strip, small: the red dot, the time, the level (Composer's RecBar, smaller) */
function Level({ ms, levels, phone }: { ms: number; levels: number[]; phone: boolean }) {
  return (
    <>
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-red-500" />
      <span
        className={`shrink-0 font-mono text-zinc-800 tabular-nums dark:text-zinc-100 ${phone ? 'text-[15px]' : 'text-xs'}`}
      >
        {clock(ms)}
      </span>
      <span
        className={`flex min-w-0 items-center gap-[3px] overflow-hidden ${phone ? 'h-8 flex-1 justify-end' : 'h-5 w-14 justify-end'}`}
      >
        {levels.slice(phone ? 0 : 6).map((l, i) => (
          <span
            key={i}
            className="w-[3px] shrink-0 rounded-full bg-zinc-500 dark:bg-zinc-400"
            style={{ height: Math.round((phone ? 4 : 3) + l * (phone ? 24 : 14)) }}
          />
        ))}
      </span>
    </>
  )
}

// ---------------------------------------------------------------- the control

// the page's own small buttons beside a part (WebPage, BlockActs)
const SMALL =
  'grid size-7 shrink-0 place-items-center rounded-lg bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-900/10 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white'
// the input box's buttons: plain, and the round dark one (Composer's BoxBtn classes)
const PLAIN = (phone: boolean) =>
  `grid shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${phone ? 'size-11' : 'size-7'}`
const MAIN = (phone: boolean) =>
  `grid shrink-0 place-items-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${phone ? 'size-11' : 'size-7'}`

function B({
  icon,
  label,
  cls,
  on,
  big,
  sw,
}: {
  icon: IconName
  label: string
  cls: string
  on: () => void
  big?: boolean
  sw?: string
}) {
  return (
    <button data-proto={icon} aria-label={label} title={label} onClick={on} className={cls}>
      <Icon n={icon} c={big ? 'size-5' : 'size-4'} sw={sw} />
    </button>
  )
}

interface Go {
  speak: () => void
  write: () => void
  cancel: () => void
  check: () => void
  send: () => void
}

/** Desktop, speaking: the strip, its ✓ and ↑ where the two buttons were (the pointer stays put) */
function DeskStrip({ go }: { go: Go }) {
  const rec = useRecorder()
  return (
    <div
      data-proto="strip"
      role="status"
      aria-label="Recording"
      className="flex h-8 items-center gap-1 rounded-full bg-white p-0.5 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10"
    >
      <B icon="x" label="Cancel · Esc" cls={PLAIN(false)} on={go.cancel} />
      <span className="flex items-center gap-1.5 pr-1">
        <Level ms={rec.ms} levels={rec.levels} phone={false} />
      </span>
      <B icon="check" label="Stop: the words go into the box below" cls={PLAIN(false)} on={go.check} sw="2.5" />
      <B icon="up" label="Stop and send" cls={MAIN(false)} on={go.send} sw="2.25" />
    </div>
  )
}
/** Desktop: the two buttons beside the place; speaking, the strip */
function DeskControl({ step, go }: { step: Step; go: Go }) {
  if (step === 'recording') return <DeskStrip go={go} />
  return (
    <div className="flex gap-1">
      <B icon="mic" label="Speak a comment" cls={SMALL} on={go.speak} />
      <B icon="comment" label="Comment" cls={SMALL} on={go.write} />
    </div>
  )
}

/** Phone, speaking: the same strip, made for a thumb */
function PhoneStrip({ go }: { go: Go }) {
  const rec = useRecorder()
  return (
    <>
      <B icon="x" label="Cancel" cls={PLAIN(true)} on={go.cancel} big />
      <Level ms={rec.ms} levels={rec.levels} phone />
      <B icon="check" label="Stop: the words go into the box" cls={PLAIN(true)} on={go.check} big sw="2.5" />
      <B icon="up" label="Stop and send" cls={MAIN(true)} on={go.send} big sw="2.25" />
    </>
  )
}
/** Phone: under the place, as the row under a tapped paragraph is now; the same rules, made for a thumb */
function PhoneControl({ step, go }: { step: Step; go: Go }) {
  return (
    <div className="flex h-12 items-center gap-2">
      {step === 'recording' ? (
        <PhoneStrip go={go} />
      ) : (
        <>
          <span className="min-w-0 flex-1 pl-2 text-[13px] text-zinc-500 dark:text-zinc-400">
            Speak or write about it
          </span>
          <B icon="mic" label="Speak a comment" cls={`${MAIN(true)} shadow-lg`} on={go.speak} big />
          <B
            icon="comment"
            label="Comment"
            cls="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-600 dark:hover:bg-zinc-800"
            on={go.write}
            big
          />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- the input box below (Composer's look)

function Box({ phone, kind, step }: { phone: boolean; kind: Kind; step: Step }) {
  const at = step === 'typing' || step === 'checked',
    words = step === 'checked' ? SAID[kind] : ''
  return (
    <div
      data-proto="box"
      className={`flex flex-col rounded-4xl border bg-white shadow-sm dark:bg-zinc-900 dark:shadow-none ${at ? 'border-zinc-300 dark:border-zinc-700' : 'border-zinc-200 dark:border-zinc-800'}`}
    >
      {at ? (
        // the box's line: what it writes to (Composer's ScopeLine), the place picked
        <div className="flex h-8 items-center gap-1.5 pt-1 pr-1.5 pl-4 text-[13px] text-zinc-500 dark:text-zinc-400">
          <Icon n="comment" c="size-3.5 text-zinc-400 dark:text-zinc-500" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-zinc-800 dark:text-zinc-100">Comment on D56</span> “{QUOTE[kind]}”
          </span>
          <span className="grid size-8 shrink-0 place-items-center text-zinc-400 dark:text-zinc-500">
            <Icon n="x" c="size-4" />
          </span>
        </div>
      ) : null}
      {step === 'checked' ? (
        // the voice note, its words in (Composer's DraftFiles)
        <div className="flex gap-2.5 px-3 pt-3 pb-1">
          <div className="flex h-16 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            <Icon n="mic" c="size-4" />
            <span className="font-mono tabular-nums">0:03</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Transcribed</span>
          </div>
        </div>
      ) : null}
      <div className={`flex items-end ${phone ? 'gap-2 p-1.5' : 'gap-0.5 p-1.5'}`}>
        <span className={`${PLAIN(phone)} ${phone ? '' : 'm-1 size-9'}`}>
          <Icon n="plus" c={phone ? 'size-6' : 'size-5'} />
        </span>
        <div
          className={`min-w-0 flex-1 px-1 py-2.5 leading-6 text-zinc-900 dark:text-zinc-100 ${phone ? 'min-h-11 text-[17px]' : 'min-h-11 text-[15px]'}`}
        >
          {words}
          {at ? <span className="ml-px inline-block h-5 w-0.5 translate-y-1 animate-pulse bg-blue-500" /> : null}
          {!words ? (
            <span className="text-zinc-400 dark:text-zinc-500">{at ? 'Comment on D56…' : 'Reply to F432…'}</span>
          ) : null}
        </div>
        {words ? (
          <span className={`${PLAIN(phone)} ${phone ? '' : 'm-1 size-9'}`}>
            <Icon n="mic" c="size-5" />
          </span>
        ) : null}
        <span className={`${MAIN(phone)} ${phone ? '' : 'm-1 size-9'}`}>
          <Icon n={words ? 'up' : 'mic'} c="size-5" sw={words ? '2.25' : '1.75'} />
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- the place, and what is on it

/** The comment posted, opened on its place: right away, its words still coming (…); a moment later, its words (the
 * real Thread) */
function Posted({ kind, rail }: { kind: Kind; rail: boolean }) {
  const [words, setWords] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setWords(true), 1600)
    return () => clearTimeout(t)
  }, [])
  const c: Comment = {
    id: words ? 9101 : -1, // a comment being saved has no id yet (and no Edit, Move or Delete)
    key: 'p',
    th: words ? 9101 : undefined,
    quote: QUOTE[kind],
    text: words ? SAID[kind] : '\u2026',
    by: 'you',
    t: new Date().toISOString(),
  }
  return <Thread d={DOC} k="p" comments={[c]} rail={rail} />
}
/** a thread's count, in its place's top right corner (WebPage) or beside the paragraph (BlockActs) */
const Count = ({ cls }: { cls: string }) => (
  <span
    className={`flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-lg bg-amber-100 px-1.5 text-xs font-semibold text-amber-900 shadow-sm dark:bg-amber-900/80 dark:text-amber-100 ${cls}`}
  >
    <Icon n="comment" c="size-3.5" />1
  </span>
)
const RING = 'ring-2 ring-amber-300 dark:ring-amber-600'

function MdPlace({ phone, step, go }: { phone: boolean; step: Step; go: Go }) {
  const sent = step === 'sent'
  return (
    <div
      className={`text-[15px] leading-relaxed text-zinc-900 dark:text-zinc-100 ${phone ? 'px-4 pt-4' : 'pt-5 pr-24 pl-8'}`}
    >
      <div className="text-xl font-bold tracking-tight">Export plan</div>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">Two ways to ship filtered export, and what each costs.</p>
      {/* the paragraph picked (DocView's section, picked) */}
      <section
        className={`relative -mx-2 mt-3 rounded-lg px-2 py-1 ${sent ? '' : `bg-amber-50 dark:bg-amber-950/40 ${RING}`}`}
      >
        <div className={phone && sent ? 'pr-12' : ''}>
          {QUOTE.md} The file then holds what you see in the list, and the server need not change.
        </div>
        {phone ? (
          <>
            {sent ? <Count cls="absolute top-1 right-1" /> : null}
            {sent ? (
              <Posted kind="md" rail={false} />
            ) : (
              <div className="mt-2">
                <PhoneControl step={step} go={go} />
              </div>
            )}
          </>
        ) : (
          <>
            {/* beside it, as the paragraph's buttons are now; speaking, the strip ends where they end and grows to the
                left, over the paragraph's first line */}
            {sent ? (
              <Count cls="absolute top-0 left-full ml-1" />
            ) : (
              <div className="absolute top-0 -right-17 z-10 flex justify-end">
                <DeskControl step={step} go={go} />
              </div>
            )}
            {sent ? (
              <div className="absolute top-full -right-16 z-20 mt-2 w-80 text-sm shadow-xl">
                <Posted kind="md" rail />
              </div>
            ) : null}
          </>
        )}
      </section>
      <p className="mt-3 text-zinc-700 dark:text-zinc-300">Option B saves filters on the server and ships next week.</p>
    </div>
  )
}

/** a row of the page's bars (D56: label, bar, time) */
const Bar = ({ label, w, ms }: { label: string; w: string; ms: string }) => (
  <div className="grid grid-cols-[84px_1fr_52px] items-center gap-2.5 text-[13px]">
    {label}
    <div className="h-3 overflow-hidden rounded-md bg-zinc-100">
      <div className={`h-full rounded-md bg-blue-500 ${w}`} />
    </div>
    {ms}
  </div>
)

function WebPlace({ phone, step, go }: { phone: boolean; step: Step; go: Go }) {
  const sent = step === 'sent'
  return (
    // the page as it is: its own colors (white), whatever Taska's are
    <div className={`bg-white text-zinc-900 ${phone ? 'px-4 pt-4 pb-2' : 'px-8 pt-5 pb-3'}`}>
      <div className="mb-3 text-[17px] font-semibold">Where the time goes</div>
      <div className="flex flex-col gap-2">
        <Bar label="Read list" w="w-[72%]" ms="720 ms" />
        <Bar label="Apply filter" w="w-[18%]" ms="180 ms" />
        {/* the part picked: the amber ring around it; on the desktop its buttons just above its right end */}
        <div className="relative">
          <Bar label="Write CSV" w="w-[41%]" ms="410 ms" />
          <div
            className={`pointer-events-none absolute -inset-1 rounded-lg ${sent ? 'ring-2 ring-amber-400' : RING}`}
          />
          {sent ? <Count cls="absolute -top-1 right-0" /> : null}
          {!phone && !sent ? (
            <div className="absolute -top-10 right-0 z-10">
              <DeskControl step={step} go={go} />
            </div>
          ) : null}
          {sent ? (
            <div
              className={`absolute top-full z-20 mt-3 text-sm text-zinc-900 shadow-xl dark:text-zinc-100 ${phone ? 'inset-x-0' : 'right-0 w-80'}`}
            >
              <Posted kind="web" rail />
            </div>
          ) : null}
          {phone && !sent ? (
            // on the phone, under the part, over the page (as the row under a tapped part is now)
            <div className="absolute inset-x-0 top-full z-10 mt-3 rounded-xl bg-white p-1.5 pr-1.5 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-900 dark:ring-white/10">
              <PhoneControl step={step} go={go} />
            </div>
          ) : null}
        </div>
      </div>
      <div className={`text-[17px] font-semibold ${phone ? 'mt-24' : 'mt-8'}`}>Options</div>
      <div className="mt-2 rounded-xl border border-zinc-200 p-3 text-[13px] text-zinc-600">
        A · Filter on export: apply the current filter when writing the file.
      </div>
    </div>
  )
}

/** One place picked, its control, and the input box below where it matters; it plays from `start` as you tap */
export function Scene({ kind, phone, start, box = false }: { kind: Kind; phone: boolean; start: Step; box?: boolean }) {
  const [step, setStep] = useState<Step>(start)
  const go: Go = {
    speak: () => setStep('recording'),
    write: () => setStep('typing'),
    cancel: () => setStep('cancelled'),
    check: () => setStep('checked'),
    send: () => setStep('sent'),
  }
  const showBox = box || step === 'typing' || step === 'checked' || step === 'recording'
  return (
    <div className="flex flex-col items-start gap-2">
      <div
        className={`relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${phone ? 'w-[393px]' : 'w-[580px]'} ${step === 'sent' ? 'min-h-80' : ''}`}
      >
        {kind === 'md' ? <MdPlace phone={phone} step={step} go={go} /> : <WebPlace phone={phone} step={step} go={go} />}
        {showBox ? (
          <div
            className={`mt-auto border-t border-zinc-200 bg-zinc-50 dark:border-transparent dark:bg-transparent ${phone ? 'px-3 pt-3 pb-4' : 'px-8 pt-3 pb-4'}`}
          >
            <Box phone={phone} kind={kind} step={step} />
          </div>
        ) : (
          <div className={`h-4 ${kind === 'web' ? 'bg-white' : ''}`} />
        )}
        {step === 'cancelled' ? (
          // the page's toast (Shell), as Esc on a recording says now
          <div className="mx-auto mb-3 flex w-fit items-center gap-3 rounded-full bg-zinc-900 py-1.5 pr-1.5 pl-4 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
            Recording discarded
            <span className="h-8 rounded-full bg-white/15 px-3 text-sm leading-8 font-semibold dark:bg-zinc-900/10">
              Undo
            </span>
          </div>
        ) : null}
      </div>
      <button
        data-proto="again"
        onClick={() => setStep(start)}
        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        Start over
      </button>
    </div>
  )
}

/** One state, named, in light and in dark side by side */
export function Row({
  title,
  note,
  children,
}: {
  title: string
  note: string
  children: (dark: boolean) => ReactNode
}) {
  return (
    <section className="mb-10">
      <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
      <p className="mb-3 max-w-3xl text-[13px] text-zinc-600">{note}</p>
      <div className="flex flex-wrap items-start gap-6">
        {[false, true].map((dark) => (
          <div key={String(dark)} data-theme={dark ? 'dark' : 'light'} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-500">{dark ? 'Dark' : 'Light'}</span>
            {children(dark)}
          </div>
        ))}
      </div>
    </section>
  )
}
