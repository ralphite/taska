// The desktop pane's bar over a document: what it is (D4 and its title, or Editing), what can be done to it (Comment
// mode for a web page, Edit, Move, Delete), and the way back, first and plain to see. Props only.

import type { MouseEvent, ReactNode } from 'react'
import type { Doc } from '../../model/types'
import { Kbd } from '../../ui/bits'
import { Icon } from '../../ui/Icon'

const PaneBtn = ({ pressed, onClick, children }: { pressed?: boolean; onClick(e: MouseEvent<HTMLButtonElement>): void; children: ReactNode }) => (
  <button
    onClick={onClick}
    {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
    className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-100 aria-pressed:bg-amber-100 aria-pressed:text-amber-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:aria-pressed:bg-amber-900/60 dark:aria-pressed:text-amber-100"
  >
    {children}
  </button>
)

export function DocPaneHead({ d, editing }: { d: Pick<Doc, 'd' | 'title' | 'fmt'>; editing: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <Icon n={editing ? 'pencil' : d.fmt === 'html' ? 'web' : 'doc'} c="size-[18px] text-zinc-500 dark:text-zinc-400" />
      {editing ? <span className="font-semibold">Editing</span> : null}
      <span className="font-mono font-bold text-zinc-700 dark:text-zinc-200">D{d.d}</span>
      <span className={`truncate ${editing ? '' : 'font-semibold'}`}>{d.title}</span>
    </span>
  )
}

export function DocPaneActs({ web, inspect, deleting, d, on }: { web: boolean; inspect: boolean; deleting: boolean; d: number; on: { inspect(): void; edit(): void; move(from: HTMLElement): void; remove(): void } }) {
  return (
    <>
      {web ? (
        <PaneBtn pressed={inspect} onClick={on.inspect}>
          <Icon n="comment" c="size-4" />
          Comment
          {inspect ? <Kbd k="Esc" /> : null}
        </PaneBtn>
      ) : null}
      <PaneBtn onClick={on.edit}>
        <Icon n="pencil" c="size-4" />
        Edit
      </PaneBtn>
      <PaneBtn onClick={(e) => on.move(e.currentTarget)}>
        <Icon n="arrow" c="size-4" />
        Move
      </PaneBtn>
      <PaneBtn onClick={on.remove}>
        <Icon n="trash" c="size-4" />
        {deleting ? `Delete D${d}?` : 'Delete'}
      </PaneBtn>
    </>
  )
}

/** Back to where it was opened from: Documents, Activity or Deleted, else its item. */
export function DocPaneNav({ to, onBack }: { to: string; onBack(): void }) {
  return (
    <button onClick={onBack} className="flex h-9 items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">
      <Icon n="left" c="size-4" sw="2.25" />
      Back to {to}
      <Kbd k="Esc" />
    </button>
  )
}
