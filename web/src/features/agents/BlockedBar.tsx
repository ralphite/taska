// The project's agent session blocked, waiting on the user (T711, Yadong chose Gemini's "floating orange bar"): a
// strong orange bar floating at the bottom of every project page, just above the box, never pushing what is under
// it. The agent by its app's icon, the word Blocked, and Open, which opens the Agents sheet (Taska cannot unblock a
// session: that is done in the agent's own app; the sheet says which session and what it waits on). Props only.

import type { CSSProperties } from 'react'
import { Avatar } from '../../ui/bits'

/** `by`: the agent whose session is blocked; null: none is, and nothing shows (the live region stays, so a screen
 * reader hears the bar come). `place` and `style`: where it floats (the page's layout says); `barRef`: the bar, so
 * the toast keeps clear of it. */
export function BlockedBar({ by, place, style, barRef, onOpen }: { by: string | null; place: string; style?: CSSProperties; barRef?(el: HTMLElement | null): void; onOpen(): void }) {
  return (
    <div role="status" aria-live="polite" style={style} className={`pointer-events-none flex justify-center ${place}`}>
      {by ? (
        <div
          ref={barRef}
          data-part="blocked-bar"
          className="pointer-events-auto flex w-full max-w-[364px] items-center gap-3 rounded-3xl bg-linear-to-r from-orange-500 to-amber-500 p-2 text-white shadow-xl shadow-orange-500/35 dark:shadow-black/50"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white shadow-sm">
            <Avatar by={by} named big />
          </span>
          <span className="min-w-0 flex-1 pl-1 text-base font-bold tracking-wide uppercase text-shadow-sm">Blocked</span>
          <button
            type="button"
            onClick={onOpen}
            aria-label="Open Agents"
            className="mr-1 flex h-11 shrink-0 items-center rounded-2xl bg-white px-5 text-[15px] font-bold text-orange-600 shadow-sm transition-transform hover:bg-orange-50 active:scale-95"
          >
            Open
          </button>
        </div>
      ) : null}
    </div>
  )
}
