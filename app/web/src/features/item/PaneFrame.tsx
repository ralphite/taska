// The pane's frame: its bar (Back on the phone, what it shows, its actions) and its body, which scrolls. Props only.

import type { ReactNode } from 'react'
import { usePaneRef } from '../../app/panes'
import { Icon } from '../../ui/Icon'

export function PaneFrame({
  place,
  hidden,
  desk,
  head,
  acts,
  nav,
  menu,
  onBack,
  onMenu,
  children,
}: {
  place: string
  hidden?: boolean
  desk: boolean
  head?: ReactNode
  acts?: ReactNode
  nav?: ReactNode
  menu?: boolean
  onBack(): void
  onMenu?(): void
  children?: ReactNode
}) {
  const pane = usePaneRef('detail')
  return (
    <section ref={pane} hidden={hidden} className={`flex min-h-0 flex-1 flex-col ${place}`}>
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-zinc-100 px-1 desk:border-zinc-200 desk:px-3 dark:border-zinc-800/70 dark:desk:border-zinc-800">
        <button
          aria-label="Back"
          onClick={onBack}
          className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 data-pressed:bg-zinc-100 desk:hidden dark:text-zinc-400 dark:data-pressed:bg-zinc-800"
        >
          <Icon n="left" c="size-6" sw="2" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center leading-tight desk:flex-row desk:items-center desk:gap-2 desk:pl-2">{head}</div>
        <div className="hidden items-center gap-0.5 desk:flex">{desk ? acts : null}</div>
        <button
          hidden={!menu}
          aria-label="Item actions"
          title="All actions · ."
          onClick={onMenu}
          className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 data-pressed:bg-zinc-100 desk:size-9 desk:rounded-lg desk:hover:bg-zinc-100 dark:text-zinc-400 dark:data-pressed:bg-zinc-800 dark:desk:hover:bg-zinc-800"
        >
          <Icon n="more" c="size-6 desk:size-5" />
        </button>
        <div className="hidden items-center gap-0.5 border-l border-zinc-200 pl-2 desk:ml-1.5 desk:flex dark:border-zinc-800">{desk ? nav : null}</div>
      </header>
      <div className="-mb-(--foot-h) min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(var(--foot-h,0px)+1.5rem)] desk:scrollbar-gutter-both desk:mask-b-from-[calc(100%-2rem)] desk:group-data-[compose]/app:hidden desk:hover:scrollbar-thumb-zinc-500/80 dark:desk:hover:scrollbar-thumb-zinc-400/70">
        {children}
      </div>
    </section>
  )
}
