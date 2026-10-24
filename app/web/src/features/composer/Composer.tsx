// The one input box: a line on top saying what it writes to (when that needs saying), the words, and its buttons
// (add files; a voice note, or Send once there are words). Past one line on the desktop the words take the box's
// whole width and the buttons go to a row under them. Props only.

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Icon, type IconName } from '../../ui/Icon'

export interface BoxLine {
  icon: IconName
  label: ReactNode
  detail?: ReactNode
  right?: ReactNode
}

export function ScopeLine({ icon, label, detail, right }: BoxLine) {
  return (
    <>
      <Icon n={icon} c="size-3.5 text-zinc-400 dark:text-zinc-500" />
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
  on: {
    text(t: string): void
    send(): void
    attach(files: File[]): void
    mic(aux: boolean): void
  }
}

const BTN_ICON = 'size-6 desk:size-5'

export function Composer({ line, lineOnComposePage, placeholder, sendWord, text, desk, composePage, micTip, files, on }: ComposerProps) {
  const area = useRef<HTMLTextAreaElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const has = !!text.trim()
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
      ref={box}
      id="composer"
      className="group/box flex flex-col rounded-4xl border border-zinc-200 bg-white shadow-sm focus-within:border-zinc-300 desk:mx-auto desk:max-w-[42rem] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none dark:focus-within:border-zinc-700"
    >
      <div
        hidden={!line}
        className={`@container flex h-8 items-center gap-1.5 pt-1 pr-1.5 pl-4 text-[13px] text-zinc-500 dark:text-zinc-400 ${lineOnComposePage ? '' : 'desk:group-data-[compose]/app:hidden'}`}
      >
        {line ? <ScopeLine {...line} /> : null}
      </div>
      {files}
      <div className="flex items-end gap-2 p-1.5 group-data-[multi]/box:flex-wrap desk:gap-0.5 desk:group-data-[compose]/app:order-first">
        <button
          aria-label="Add images or files"
          title={desk ? 'Add images or files' : undefined}
          onClick={() => picker.current?.click()}
          className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 group-data-[multi]/box:mr-auto hover:bg-zinc-100 hover:text-zinc-800 desk:m-1 desk:size-9 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <Icon n="plus" c={BTN_ICON} />
        </button>
        <div className="grid min-w-0 flex-1 group-data-[multi]/box:order-first group-data-[multi]/box:basis-full group-data-[multi]/box:px-2 group-data-[multi]/box:pt-1">
          <textarea
            ref={area}
            rows={1}
            value={text}
            placeholder={placeholder}
            aria-label="Input"
            className="col-start-1 row-start-1 max-h-48 min-h-11 w-full min-w-0 resize-none bg-transparent px-1 py-2.5 text-[17px] leading-6 outline-none placeholder:text-zinc-400 roomy:text-[15px] desk:scrollbar-thin dark:placeholder:text-zinc-500"
            onChange={(e) => on.text(e.currentTarget.value)}
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
        </div>
        <button
          aria-label="Record a voice note"
          title={desk ? micTip : undefined}
          hidden={!has}
          onClick={() => on.mic(true)}
          className="mr-4 grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 desk:m-1 desk:mr-0 desk:size-9 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <Icon n="mic" c="size-5" />
        </button>
        <button
          aria-label={has ? `${sendWord} (Shift + Enter)` : 'Record a voice note'}
          title={desk ? (has ? `${sendWord} · ⇧↵` : micTip) : undefined}
          onClick={() => (has ? on.send() : on.mic(false))}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-zinc-900 text-white disabled:opacity-25 desk:m-1 desk:size-9 desk:hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:desk:hover:bg-white"
        >
          {has ? <Icon n="up" c="size-5" sw="2.25" /> : <Icon n="mic" c={BTN_ICON} />}
        </button>
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
      className="mb-1.5 flex min-h-7 items-center gap-2 rounded-full bg-white/95 pr-1 pl-2.5 text-[13px] text-zinc-600 desk:mx-auto desk:max-w-[42rem] dark:bg-zinc-950/95 dark:text-zinc-300"
    >
      {node}
    </div>
  )
}
