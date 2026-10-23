// F479 (D76): search by voice, the parts not built yet, for the prototypes. Tap search and a panel comes up already
// listening: a big red microphone whose rings move with your voice (as Google's and YouTube's voice search). It stops
// by itself when you pause, shows what you said and finds by meaning. Then the list shows what was found: what you
// said on top (words, not a box), the closest first, each with a line saying why. There is no box to type in.
// The panel is the page's own sheet (from the bottom on the phone, in the middle on the desktop); the rows are the
// page's own rows of those items, so a tap opens one as the page does.
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/ui'
import { ICON } from '../../lib/icons'
import { OnPage, wait } from './onPage'

// what Yadong says, and what the model would find for it, the closest first, each with why
export const SAID = '\u987e\u5ba2\u7ed3\u8d26\u65f6\u51fa\u95ee\u9898\u7684\u90a3\u51e0\u4e2a'
export const FOUND: [number, string][] = [
  [2, '\u987e\u5ba2\u70b9 Pay now \u4ed8\u4e0d\u4e86\u94b1'],
  [36, '\u987e\u5ba2\u7ed3\u8d26\u65f6\u603b\u4ef7\u7b97\u9519'],
  [38, '\u5730\u5740\u8868\u5355\u8ba9\u987e\u5ba2\u7ed3\u8d26\u65f6\u586b\u9519'],
  [17, '\u6539\u7ed3\u8d26\u524d\u8981\u9075\u5b88\u7684\u89c4\u5219'],
]

/** listen: the panel is up, nothing said yet; speak: you talk; heard: you paused, your words, finding */
export type Phase = 'listen' | 'speak' | 'heard'

/** how loud a voice is at a moment, 0..1: syllables, words, a breath now and then (as Storybook's microphone) */
const voice = (t: number) =>
  Math.max(0, Math.sin(t * 7.3) * 0.5 + Math.sin(t * 2.1 + 1) * 0.35 + 0.25) * (t % 3.4 < 0.35 ? 0.1 : 1)

/** The big microphone: red with rings that follow the voice while it listens, quiet once it has heard you */
function Mic({ phase, onFinish }: { phase: Phase; onFinish: () => void }) {
  const near = useRef<HTMLSpanElement>(null),
    far = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (phase === 'heard') return
    let id = 0
    const step = () => {
      const t = performance.now() / 1000,
        l = phase === 'speak' ? voice(t) : 0.06 + 0.05 * Math.sin(t * 2.6)
      if (near.current) near.current.style.transform = `scale(${1.1 + l * 0.42})`
      if (far.current) far.current.style.transform = `scale(${1.18 + l * 0.85})`
      id = requestAnimationFrame(step)
    }
    id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [phase])
  const on = phase !== 'heard'
  return (
    <div className="relative mt-2 grid size-40 place-items-center">
      {on ? (
        <>
          <span
            ref={far}
            className="absolute size-20 rounded-full bg-red-500/15 transition-transform duration-100 ease-out dark:bg-red-400/20"
          />
          <span
            ref={near}
            className="absolute size-20 rounded-full bg-red-500/30 transition-transform duration-100 ease-out dark:bg-red-400/35"
          />
        </>
      ) : null}
      <button
        data-proto-act="finish"
        aria-label="Finish"
        disabled={!on}
        onClick={onFinish}
        className={`relative grid size-20 place-items-center rounded-full transition-colors duration-300 ${on ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 dark:bg-red-500' : 'bg-violet-50 text-violet-500 dark:bg-violet-400/10 dark:text-violet-300'}`}
      >
        {on ? <Icon n="mic" c="size-9" sw="2" /> : <Icon n="spinner" c="size-9 animate-spin" sw="2" />}
      </button>
    </div>
  )
}

/** the page's \u2715 in a sheet's head */
const CloseX = () => (
  <span className="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200 group-hover:text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-zinc-700 dark:group-hover:text-zinc-200">
    <Icon n="x" c="size-4" sw="2.25" />
  </span>
)

/** The panel that listens: the page's sheet, up from the bottom on the phone, in the middle on the desktop */
export function ListenPanel({
  phase,
  words,
  onClose,
  onFinish,
}: {
  phase: Phase
  words: string
  onClose: () => void
  onFinish: () => void
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const heard = phase === 'heard'
  return (
    <div
      data-proto="listen"
      {...(shown ? { 'data-in': '' } : {})}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 opacity-0 transition-opacity duration-200 data-in:opacity-100 sm:items-center sm:p-6 dark:bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-label="Search by voice"
        className={`flex w-full max-w-2xl flex-col rounded-t-3xl bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl transition-transform duration-300 ease-out sm:max-w-md sm:rounded-3xl dark:bg-zinc-900 dark:ring-1 dark:ring-white/10 ${shown ? 'translate-y-0 sm:scale-100' : 'translate-y-full sm:translate-y-0 sm:scale-95'}`}
      >
        <div className="flex shrink-0 justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>
        <header className="flex shrink-0 items-center gap-2 py-1 pr-2 pl-5">
          <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-zinc-900 dark:text-zinc-100">
            Search Shop
          </h2>
          <button
            data-proto-act="close"
            aria-label="Close"
            className="group grid size-11 place-items-center rounded-full"
            onClick={onClose}
          >
            <CloseX />
          </button>
        </header>
        <div className="flex flex-col items-center px-6 pt-3 pb-4">
          {/* what you say shows as you say it (as Google's); before the first word, that it listens */}
          <p
            className={`flex min-h-16 w-full items-center justify-center text-center text-[22px] leading-8 ${words ? 'font-medium text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 dark:text-zinc-400'}`}
          >
            {words || 'Listening\u2026'}
          </p>
          <Mic phase={phase} onFinish={onFinish} />
          <p className="mt-2 flex h-6 items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            {heard ? 'Finding by meaning\u2026' : 'Stops when you pause, or tap'}
          </p>
        </div>
      </section>
    </div>
  )
}

/** The page's own rows of the items found, the closest first, each with a line under its title saying why */
export function foundRows(doc: Document) {
  return FOUND.map(([n, why]) => {
    const row = doc.querySelector(`#list article[data-n="${n}"]`)?.cloneNode(true) as HTMLElement | null
    const title = row?.querySelector('[data-act="open"] .min-w-0 > :first-child')
    if (!row || !title) return null
    // why it was found: the model's words, marked as the model's (the sparkle, as on the "By meaning" head)
    const line = doc.createElement('p')
    line.className = 'mt-0.5 flex items-start gap-1 text-[13px] leading-snug text-violet-700 dark:text-violet-300'
    line.dataset.why = ''
    line.innerHTML = `<svg class="mt-px size-3.5 shrink-0 text-violet-500 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON.sparkle}</svg><span class="line-clamp-2 min-w-0"></span>`
    line.lastElementChild!.textContent = why
    title.after(line)
    return row
  }).filter((r): r is HTMLElement => !!r)
}

/** What was found, where the list is: what you said on top, then the rows. On the phone a page of its own (over
 * the bar's room, `bottom`); on the desktop the list's column. */
export function Results({
  rows,
  desk,
  at,
  open,
  onAgain,
  onCancel,
}: {
  rows: HTMLElement[]
  desk: boolean
  at: { left: number; top: number; width: number; bottom: number }
  open: number | null
  /** none: say it again from where search was asked (the bar's Search) */
  onAgain: (() => void) | null
  onCancel: () => void
}) {
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = list.current
    if (!box) return
    box.replaceChildren(...rows)
  }, [rows])
  useEffect(() => {
    // the open one, as the page marks it in its list
    for (const r of rows) {
      const o = r.querySelector('[data-act="open"]')
      if (o) o.setAttribute('aria-current', String(Number(o.getAttribute('data-n')) === open))
    }
  }, [rows, open])
  return (
    <section
      data-proto="results"
      aria-label="Found by meaning"
      className="fixed z-30 flex flex-col bg-white lg:border-r lg:border-zinc-200 dark:bg-zinc-950 dark:lg:border-zinc-800"
      style={at}
    >
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-zinc-100 py-2 pr-2 pl-4 lg:border-zinc-200 lg:pr-3 dark:border-zinc-800/70 dark:lg:border-zinc-800">
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            Searched in Shop
          </p>
          <p className="line-clamp-2 text-[17px] leading-snug font-semibold text-zinc-900 lg:text-[15px] dark:text-zinc-50">
            {SAID}
          </p>
        </div>
        {onAgain ? (
          <button
            data-proto-act="again"
            title="Say it again"
            onClick={onAgain}
            className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-white pr-3 pl-2.5 text-[13px] font-medium text-zinc-700 shadow-xs ring-1 ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-800"
          >
            <Icon n="search" c="size-4" sw="2" />
            Again
          </button>
        ) : null}
        {desk ? (
          <button
            data-proto-act="cancel"
            aria-label="Back to the list"
            title={'Back to the list \u00b7 Esc'}
            onClick={onCancel}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <Icon n="x" c="size-5" />
          </button>
        ) : (
          <button
            data-proto-act="cancel"
            onClick={onCancel}
            className="h-11 shrink-0 px-2.5 text-[15px] font-medium text-blue-600 dark:text-blue-400"
          >
            Cancel
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex h-9 items-center gap-2 border-b border-zinc-200 bg-zinc-100 pr-1 pl-4 dark:border-zinc-700/70 dark:bg-zinc-800">
          <span className="text-violet-500 dark:text-violet-400">
            <Icon n="sparkle" c="size-4" sw="2" />
          </span>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">By meaning</h2>
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-zinc-200/80 px-1.5 text-[11px] font-bold text-zinc-600 tabular-nums dark:bg-zinc-700 dark:text-zinc-300">
            {rows.length}
          </span>
        </div>
        <div ref={list} />
      </div>
    </section>
  )
}

const STEPS = ['listen', 'speak', 'heard', 'found'] as const
// where what is said grows: a word or two each time
const CUTS = [2, 4, 5, 7, 9, 12]
type Step = (typeof STEPS)[number]

/** The search by voice on a page: listen, hear, find, show; again or back to the list, by a tap or a script */
export class VoiceSearch {
  phase: Phase | null = null
  /** what it has heard so far */
  words = ''
  rows: HTMLElement[] | null = null
  private run = 0
  private cut = false
  private at = -1 // how far this search got: an index in STEPS
  private waits: { at: number; done: () => void }[] = []
  constructor(
    private p: OnPage,
    private redraw: () => void,
  ) {}
  private reach(x: Step) {
    this.at = STEPS.indexOf(x)
    for (const w of this.waits.filter((w) => w.at <= this.at)) w.done()
    this.waits = this.waits.filter((w) => w.at > this.at)
  }
  /** resolves once the search has got there (for the walkthrough's words) */
  until(x: Step) {
    const at = STEPS.indexOf(x)
    return at <= this.at ? Promise.resolve() : new Promise<void>((done) => this.waits.push({ at, done }))
  }
  /** tap search: it listens at once; you talk; you pause and it has heard you; then what it found */
  async ask() {
    const run = ++this.run
    this.at = -1
    const step = async (x: Phase, ms: number) => {
      if (run !== this.run) return false
      this.phase = x
      this.redraw()
      this.reach(x)
      await wait(ms)
      return run === this.run
    }
    this.words = ''
    this.cut = false
    if (!(await step('listen', 1500))) return
    // you talk: a word or two at a time, at the pace of speech, as a recognizer gives them
    this.phase = 'speak'
    this.reach('speak')
    for (const n of CUTS) {
      this.words = SAID.slice(0, this.cut ? SAID.length : n)
      this.redraw()
      if (this.cut) break
      await wait(n === SAID.length ? 900 : 650)
      if (run !== this.run) return
    }
    if (!(await step('heard', 2200))) return
    this.rows ||= foundRows(this.p.doc)
    this.phase = null
    this.redraw()
    this.reach('found')
  }
  /** a tap on the microphone: what was said so far is what it searches */
  finish() {
    this.cut = true
  }
  close() {
    this.run++
    this.phase = null
    this.redraw()
  }
  /** back to the list as it was */
  cancel() {
    this.close()
    this.rows = null
    this.redraw()
  }
}
