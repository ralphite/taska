// A shared rule's page frame (T779): on the desktop Settings' column of sections beside the shared rule (read as the
// Rules tab reads a project's rules, the box under it); on the phone the shared rule alone, a page of Settings. Props
// only: the column, the rule and the box come in drawn.

import type { CSSProperties, ReactNode } from 'react'
import { PULL } from '../ui/tones'

export function SharedRuleFrame({ desk, nav, foot = 0, children }: { desk: boolean; nav: ReactNode; /** the box's height under it */ foot?: number; children: ReactNode }) {
  const vars = { '--foot-h': foot + 'px' } as CSSProperties
  if (!desk)
    return (
      <div data-part="shared-rule" style={vars} className="relative z-10 mx-auto flex h-full w-full max-w-3xl flex-col bg-white pt-[env(safe-area-inset-top)] md:border-x md:border-zinc-200 dark:bg-zinc-950 md:dark:border-zinc-800">
        {children}
      </div>
    )
  return (
    <div data-part="shared-rule" className="flex h-full w-full bg-white pt-[env(safe-area-inset-top)] dark:bg-zinc-950">
      <nav aria-label="Sections of Settings" className={`${PULL} flex min-h-0 w-60 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 pb-4 scrollbar-thin dark:border-zinc-800`}>
        {nav}
      </nav>
      <div style={vars} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  )
}
