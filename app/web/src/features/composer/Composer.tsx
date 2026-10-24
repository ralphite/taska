// The one input box: a line on top saying what it writes to (when that needs saying), the words, and its buttons
// (add files; a voice note, or Send once there are words). Past one line on the desktop the words take the box's
// whole width and the buttons go to a row under them. Props only.

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { Icon, type IconName } from '../../ui/Icon'

export interface BoxLine {
  icon: IconName
  label: ReactNode
  detail?: ReactNode
  right?: ReactNode
  /** a line with a button of its own drops its icon in a narrow box, so its words are whole */
  tight?: boolean
}

export function ScopeLine({ icon, label, detail, right, tight = false }: BoxLine) {
  return (
    <>
      <Icon n={icon} c={`size-3.5 text-zinc-400 dark:text-zinc-500 ${tight ? '@max-xs:hidden' : ''}`} />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-zinc-800 dark:text-zinc-100">{label}</span>
        {detail ? <> {detail}</> : null}
      </span>
      {right}
    </>
  )
}

export interface ComposerProps {
  line: BoxLine | null
  /** the line hides on the New input page, where the page's head says it */
  lineOnComposePage?: boolean
  placeholder: string
  sendWord: string
  text: string
  desk: boolean
  composePage: boolean
  /** the voice button's tip (desktop) */
  micTip: string
  files?: ReactNode
  /** words of a voice note that may be misheard, under its files */
  doubts?: ReactNode
  /** the phone: the words shown with the versions to pick from, where you type */
  words?: ReactNode
  /** files wait in the draft: Send shows, as words do */
  hasFiles?: boolean
  /** the box's element, for the layout to measure */
  boxRef?: RefObject<HTMLDivElement | null>
  /** where you write, for the keys (R replies) */
  fieldRef?: (el: HTMLTextAreaElement | null) => void
  /** recording a voice note here: its time, its loudness lately (0 to 1), and which mic started it */
  rec?: { time: string; levels: readonly number[]; from: 'main' | 'aux' } | null
  on: {
    text(t: string): void
    send(): void
    attach(files: File[]): void
    mic(aux: boolean): void
    /** recording: discard it, stop into the box, stop and send */
    recCancel?(): void
    recStop?(): void
    recSend?(): void
  }
}

interface Btn {
  label: string
  tip: string
  icon: IconName
  iconCls: string
  sw: string
  run(): void
}
const btn = (label: string, tip: string, icon: IconName, run: () => void, iconCls = 'size-6 lg:size-5', sw = '1.75'): Btn => ({ label, tip, icon, iconCls, sw, run })

/** The recording: a red dot, its time, and a bar for each moment of sound lately. */
function RecBar({ time, levels }: { time: string; levels: readonly number[] }) {
  return (
    <>
      <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
      <span className="shrink-0 font-mono text-[15px] text-zinc-800 tabular-nums dark:text-zinc-100">{time}</span>
      <span className="flex h-8 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden">
        {levels.map((l, i) => (
          <span key={i} className="w-[3px] shrink-0 rounded-full bg-zinc-500 dark:bg-zinc-400" style={{ height: Math.round(4 + l * 24) }} />
        ))}
      </span>
    </>
  )
}


export function Composer({ line, lineOnComposePage, placeholder, sendWord, text, desk, composePage, micTip, files, doubts, words, hasFiles = false, boxRef, fieldRef, rec = null, on }: ComposerProps) {
  const area = useRef<HTMLTextAreaElement | null>(null)
  const box = useRef<HTMLDivElement | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const has = !!text.trim() || hasFiles
  // where you were in the words: words that come from elsewhere after yours (another tab's) keep your place in them
  const mine = useRef({ text, start: text.length, end: text.length })
  const keep = (t: HTMLTextAreaElement) => {
    mine.current = { text: t.value, start: t.selectionStart, end: t.selectionEnd }
  }
  useLayoutEffect(() => {
    const t = area.current
    const was = mine.current
    if (!t || text === was.text) return
    if (was.text && text.startsWith(was.text)) t.setSelectionRange(was.start, was.end)
    keep(t)
  }, [text])
  useLayoutEffect(() => {
    const t = area.current
    const b = box.current
    if (!t || !b) return
    // empty is one line; past one line (measured beside the buttons) the words take the box's whole width
    b.removeAttribute('data-multi')
    t.style.height = ''
    if (t.value) {
      t.style.height = 'auto'
      t.style.height = Math.min(t.scrollHeight, desk && composePage ? 320 : 192) + 'px'
    }
    if (desk && !!t.value && (t.value.includes('\n') || t.scrollHeight > 52)) {
      b.setAttribute('data-multi', '')
      t.style.height = 'auto'
      t.style.height = Math.min(t.scrollHeight, 192) + 'px'
    }
  })
  return (
    <div
      ref={(el) => {
        box.current = el
        if (boxRef) boxRef.current = el
      }}
      id="composer"
      className="group/box flex flex-col rounded-4xl border border-zinc-200 bg-white shadow-sm focus-within:border-zinc-300 lg:mx-auto lg:max-w-[42rem] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none dark:focus-within:border-zinc-700"
    >
      <div
        hidden={!line}
        className={`@container flex h-8 items-center gap-1.5 pt-1 pr-1.5 pl-4 text-[13px] text-zinc-500 dark:text-zinc-400 ${lineOnComposePage ? '' : 'lg:group-data-[compose]/app:hidden'}`}
      >
        {line ? <ScopeLine {...line} /> : null}
      </div>
      {files}
      {doubts}
      <div className="flex items-end gap-2 p-1.5 group-data-[multi]/box:flex-wrap lg:gap-0.5 lg:group-data-[compose]/app:order-first">
        <button
          aria-label={rec ? 'Discard the recording' : 'Add images or files'}
          title={desk ? (rec ? 'Discard · Esc' : 'Add images or files') : undefined}
          onClick={() => (rec ? on.recCancel?.() : picker.current?.click())}
          className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 group-data-[multi]/box:mr-auto hover:bg-zinc-100 hover:text-zinc-800 lg:m-1 lg:size-9 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <Icon n={rec ? 'x' : 'plus'} c="size-6 lg:size-5" />
        </button>
        <div className="grid min-w-0 flex-1 group-data-[multi]/box:order-first group-data-[multi]/box:basis-full group-data-[multi]/box:px-2 group-data-[multi]/box:pt-1">
          <textarea
            ref={(el) => {
              area.current = el
              fieldRef?.(el)
            }}
            rows={1}
            value={text}
            placeholder={placeholder}
            aria-label="Input"
            className={`col-start-1 row-start-1 max-h-48 min-h-11 w-full min-w-0 resize-none bg-transparent px-1 py-2.5 text-[17px] leading-6 outline-none placeholder:text-zinc-400 roomy:text-[15px] lg:scrollbar-thin dark:placeholder:text-zinc-500 ${rec || words ? 'invisible' : ''}`}
            onChange={(e) => {
              keep(e.currentTarget)
              on.text(e.currentTarget.value)
            }}
            onSelect={(e) => keep(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && (e.shiftKey || e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                on.send()
              }
            }}
            onPaste={(e) => {
              const list = [...(e.clipboardData?.files || [])]
              if (list.length) {
                e.preventDefault()
                on.attach(list)
              }
            }}
          />
          {rec ? null : words}
          {/* the same box while recording, wherever it is */}
          <div hidden={!rec} role="status" aria-label="Recording" className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 px-1">
            {rec ? <RecBar time={rec.time} levels={rec.levels} /> : null}
          </div>
        </div>
        {(() => {
          // a second press where the recording started sends it; the other button stops it into the box
          const recSend = btn('Stop and send', 'Stop and send · ⇧↵', 'up', () => on.recSend?.(), 'size-5', '2')
          const recStop = btn('Stop and put words in the box', 'Words into the box · ↵', 'check', () => on.recStop?.(), 'size-5', '2.5')
          const mic = (aux: boolean, cls?: string) => btn('Record a voice note', micTip, 'mic', () => on.mic(aux), cls)
          const main = rec ? (rec.from === 'main' ? recSend : recStop) : has ? btn(`${sendWord} (Shift + Enter)`, `${sendWord} · ⇧↵`, 'up', on.send, 'size-5', '2.25') : mic(false)
          const aux = rec ? (rec.from === 'main' ? recStop : recSend) : mic(true, 'size-5')
          return (
            <>
              <button
                aria-label={aux.label}
                title={desk ? aux.tip : undefined}
                hidden={!(rec || has)}
                onClick={aux.run}
                className="mr-4 grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 lg:m-1 lg:mr-0 lg:size-9 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <Icon n={aux.icon} c={aux.iconCls} sw={aux.sw} />
              </button>
              <button
                aria-label={main.label}
                title={desk ? main.tip : undefined}
                onClick={main.run}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-zinc-900 text-white disabled:opacity-25 lg:m-1 lg:size-9 lg:hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:lg:hover:bg-white"
              >
                <Icon n={main.icon} c={main.iconCls} sw={main.sw} />
              </button>
            </>
          )
        })()}
      </div>
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          on.attach([...(e.target.files || [])])
          e.target.value = ''
        }}
      />
    </div>
  )
}

const Dismiss = ({ onClick }: { onClick(): void }) => (
  <button onClick={onClick} aria-label="Dismiss" className="-my-2 grid size-11 shrink-0 place-items-center rounded-full text-zinc-400">
    <Icon n="x" c="size-3.5" sw="2" />
  </button>
)

const Pulse = () => <span className="size-2 shrink-0 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />

export type FeedbackLine =
  | { kind: 'sending'; text: string; more: number; uploading: boolean; canUndo: boolean }
  | { kind: 'waiting'; text: string; more: number }
  | { kind: 'not-sent'; text: string; more: number }
  | { kind: 'organizing' }
  | { kind: 'transcribing' }
  | { kind: 'org-failed'; msg: string }
  | { kind: 'undone'; code: string }
  | { kind: 'organized'; msg: string; view: boolean; undo: boolean; move: boolean }
  | { kind: 'sent'; organizer: boolean; canUndo: boolean; move: boolean }
  | { kind: 'moved'; code: string; to: string; as: string; href: string }

/** The line above the box: what happened to what you sent last. */
export function Feedback({ line, on }: { line: FeedbackLine | null; on: { dismiss(): void; undo(): void; retry(): void; edit(): void; view(): void; undoFiling(): void; move(): void; retryOrganizer(): void } }) {
  const link = (label: string, run: () => void) => (
    <button onClick={run} className="-my-2 h-11 shrink-0 rounded-full px-2 font-semibold text-blue-600 dark:text-blue-400">
      {label}
    </button>
  )
  const more = (n: number) => (n > 0 ? ` (+${n})` : '')
  let node: ReactNode = null
  if (line)
    switch (line.kind) {
      case 'waiting':
        node = (
          <>
            <Pulse />
            <span className="min-w-0 flex-1 truncate">
              Waiting for Taska{more(line.more)}: {line.text}
            </span>
            {link('Edit', on.edit)}
          </>
        )
        break
      case 'not-sent':
        node = (
          <>
            <Icon n="alert" c="size-4 text-red-600 dark:text-red-400" sw="2" />
            <span className="min-w-0 flex-1 truncate text-red-600 dark:text-red-400">
              Not sent{more(line.more)}: {line.text}
            </span>
            {link('Retry', on.retry)}
            {link('Edit', on.edit)}
          </>
        )
        break
      case 'sending':
        node = (
          <>
            <Pulse />
            <span className="min-w-0 flex-1 truncate">
              {line.uploading ? 'Uploading, then sending' : 'Sending'}
              {more(line.more)}: {line.text}
            </span>
            {line.canUndo ? link('Undo', on.undo) : null}
          </>
        )
        break
      case 'moved':
        node = (
          <>
            <Icon n="arrow" c="size-4 text-zinc-500" sw="2" />
            <span className="min-w-0 flex-1 truncate">
              Moved {line.code} to {line.to} as {line.as}
            </span>
            <a href={line.href} className="-my-2 flex h-11 shrink-0 items-center rounded-full px-2 font-semibold text-blue-600 dark:text-blue-400">
              Open
            </a>
            <Dismiss onClick={on.dismiss} />
          </>
        )
        break
      case 'transcribing':
        node = (
          <>
            <Pulse />
            <span className="min-w-0 flex-1 truncate">Sent. Transcribing…</span>
            <Dismiss onClick={on.dismiss} />
          </>
        )
        break
      case 'organizing':
        node = (
          <>
            <Pulse />
            <span className="min-w-0 flex-1 truncate">Sent, organizing…</span>
            <Dismiss onClick={on.dismiss} />
          </>
        )
        break
      case 'org-failed':
        node = (
          <>
            <Icon n="alert" c="size-4 text-red-600 dark:text-red-400" sw="2" />
            <span className="min-w-0 flex-1 truncate text-red-600 dark:text-red-400">Organizer failed: {line.msg}</span>
            {link('Retry', on.retryOrganizer)}
            <Dismiss onClick={on.dismiss} />
          </>
        )
        break
      case 'undone':
        node = (
          <>
            <span className="min-w-0 flex-1 truncate">Undid the changes for {line.code}</span>
            <Dismiss onClick={on.dismiss} />
          </>
        )
        break
      case 'organized':
        node = (
          <>
            <span className="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950">
              <Icon n="check" c="size-3" sw="3" />
            </span>
            <span className="min-w-0 flex-1 truncate">{line.msg}</span>
            {line.view ? link('View', on.view) : null}
            {line.undo ? link('Undo', on.undoFiling) : null}
            {line.move ? link('Move to…', on.move) : null}
            <Dismiss onClick={on.dismiss} />
          </>
        )
        break
      case 'sent':
        node = (
          <>
            <span className="size-2 shrink-0 rounded-full bg-zinc-400" />
            <span className="line-clamp-2 min-w-0 flex-1 leading-snug">Sent. {line.organizer ? 'Left for your agent' : 'Waiting for your agent'}</span>
            {line.canUndo ? link('Undo', on.undo) : null}
            {line.move ? link('Move to…', on.move) : null}
            <Dismiss onClick={on.dismiss} />
          </>
        )
        break
    }
  return (
    <div
      hidden={!line}
      role="status"
      className="mb-1.5 flex min-h-7 items-center gap-2 rounded-full bg-white/95 pr-1 pl-2.5 text-[13px] text-zinc-600 lg:mx-auto lg:max-w-[42rem] dark:bg-zinc-950/95 dark:text-zinc-300"
    >
      {node}
    </div>
  )
}
