// The desktop pane's bar over a document: what it is (D4 and its title, or Editing), what can be done to it (Comment
// mode for a web page, Edit, Move, Delete), and the way back, first and plain to see. A narrow bar (B547: a 1100 wide
// window) keeps the buttons' icons and says their words under the pointer, so the title stays and nothing is cut.
// Props only.

import type { MouseEvent, ReactNode } from 'react'
import type { Doc } from '../../model/types'
import { Kbd } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import type { IconName } from '../../ui/icon-paths'

// words shown only when the bar has room (the pane's header is the container "bar")
const WIDE = 'hidden @2xl/bar:inline'

/** A button of the bar: its icon, and its words when the bar has room (`always`: a question it asks, as Delete D4?). */
const PaneBtn = ({ pressed, icon, label, always = false, onClick, children }: { pressed?: boolean; icon: IconName; label: string; always?: boolean; onClick(e: MouseEvent<HTMLButtonElement>): void; children?: ReactNode }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
    className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-100 aria-pressed:bg-amber-100 aria-pressed:text-amber-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:aria-pressed:bg-amber-900/60 dark:aria-pressed:text-amber-100"
  >
    <Icon n={icon} c="size-4" />
    <span className={always ? '' : WIDE}>{label}</span>
    {children}
  </button>
)

export function DocPaneHead({ d, editing }: { d: Pick<Doc, 'd' | 'title' | 'fmt'>; editing: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2 overflow-hidden text-sm">
      <Icon n={editing ? 'pencil' : d.fmt === 'html' ? 'web' : 'doc'} c="size-[18px] text-zinc-500 dark:text-zinc-400" />
      {editing ? <span className="font-semibold">Editing</span> : null}
      <span className="shrink-0 font-mono font-bold text-zinc-700 dark:text-zinc-200">D{d.d}</span>
      <span className={`truncate ${editing ? '' : 'font-semibold'}`}>{d.title}</span>
    </span>
  )
}

export function DocPaneActs({ web, inspect, deleting, d, on }: { web: boolean; inspect: boolean; deleting: boolean; d: number; on: { inspect(): void; edit(): void; move(from: HTMLElement): void; remove(): void } }) {
  return (
    <>
      {web ? (
        <PaneBtn pressed={inspect} icon="comment" label="Comment" onClick={on.inspect}>
          {inspect ? (
            <span className={WIDE}>
              <Kbd k="Esc" />
            </span>
          ) : null}
        </PaneBtn>
      ) : null}
      <PaneBtn icon="pencil" label="Edit" onClick={on.edit} />
      <PaneBtn icon="arrow" label="Move" onClick={(e) => on.move(e.currentTarget)} />
      <PaneBtn icon="trash" label={deleting ? `Delete D${d}?` : 'Delete'} always={deleting} onClick={on.remove} />
    </>
  )
}

/** Back to where it was opened from: Documents, Activity or Deleted, else its item. */
export function DocPaneNav({ to, onBack }: { to: string; onBack(): void }) {
  return (
    <button onClick={onBack} aria-label={`Back to ${to}`} title={`Back to ${to} · Esc`} className="flex h-9 items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">
      <Icon n="left" c="size-4" sw="2.25" />
      <span>
        <span className={WIDE}>Back to </span>
        {to}
      </span>
      <span className={WIDE}>
        <Kbd k="Esc" />
      </span>
    </button>
  )
}
