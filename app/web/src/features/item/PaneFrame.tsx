// The pane's frame: its bar (Back on the phone, what it shows, its actions) and its body, which scrolls. Props only.

import type { ReactNode, Ref } from 'react'
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
  paneRef,
  split = false,
  bar = true,
  lead,
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
  onMenu?(from: Element): void
  /** the pane's element, for the layout (what floats over the page shows over the pane you acted in) */
  paneRef?: Ref<HTMLElement>
  /** it shows an item in its two parts (they scroll, not the body) */
  split?: boolean
  /** false: no bar on the desktop (nothing shows to have one) */
  bar?: boolean
  /** the desktop's way back, first in the bar (a document's) */
  lead?: ReactNode
  children?: ReactNode
}) {
  return (
    <section ref={paneRef} hidden={hidden} className={`flex min-h-0 flex-1 flex-col ${place}`}>
      <header data-tip-side="bottom" className={`flex h-14 shrink-0 items-center gap-1 border-b border-zinc-100 px-1 lg:border-zinc-200 lg:px-3 dark:border-zinc-800/70 dark:lg:border-zinc-800 ${bar ? '' : 'lg:hidden'}`}>
        <button
          aria-label="Back"
          onClick={onBack}
          className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 data-pressed:bg-zinc-100 lg:hidden dark:text-zinc-400 dark:data-pressed:bg-zinc-800"
        >
          <Icon n="left" c="size-6" sw="2" />
        </button>
        {lead ? <div className="hidden shrink-0 lg:flex">{lead}</div> : null}
        <div className="flex min-w-0 flex-1 flex-col items-center leading-tight lg:flex-row lg:items-center lg:gap-2 lg:pl-2">{head}</div>
        <div className="hidden items-center gap-0.5 lg:flex">{desk ? acts : null}</div>
        <button
          hidden={!menu}
          aria-label="Item actions"
          title="All actions · ."
          onClick={(e) => onMenu?.(e.currentTarget)}
          className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-600 data-pressed:bg-zinc-100 lg:size-9 lg:rounded-lg lg:hover:bg-zinc-100 dark:text-zinc-400 dark:data-pressed:bg-zinc-800 dark:lg:hover:bg-zinc-800"
        >
          <Icon n="more" c="size-6 lg:size-5" />
        </button>
        <div className={`hidden items-center gap-0.5 border-l border-zinc-200 pl-2 lg:ml-1.5 dark:border-zinc-800 ${lead ? '' : 'lg:flex'}`}>{desk && !lead ? nav : null}</div>
      </header>
      <div
        {...(split ? { 'data-split': '' } : {})}
        className="-mb-(--foot-h) min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(var(--foot-h,0px)+1.5rem)] lg:scrollbar-gutter-both lg:mask-b-from-[calc(100%-2rem)] lg:group-data-duo/app:pb-0 lg:group-data-[compose]/app:hidden lg:hover:scrollbar-thumb-zinc-500/80 lg:data-split:mask-none lg:data-split:pb-(--foot-h) dark:lg:hover:scrollbar-thumb-zinc-400/70 dark:lg:data-split:pb-[calc(var(--foot-h,0px)+1.5rem)]"
      >
        {children}
      </div>
    </section>
  )
}
