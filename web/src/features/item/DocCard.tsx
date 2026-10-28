// A document as a card: its title, code, comments and time; it opens in Taska. Choices ticked in it and not sent are
// said on it too, so they are not forgotten. Props only.

import { when } from '../../model/time'
import type { Doc } from '../../model/types'
import { commentCount } from '../../model/docs'
import { plural } from '../../model/words'
import { Icon } from '../../ui/Icon'
import { NEEDS_PILL } from '../../ui/tones'

export function DocCard({ d, now, waiting = '', cls = '', onOpen }: { d: Doc; now: number; waiting?: string; cls?: string; onOpen(d: number): void }) {
  return (
    <button
      onClick={() => onOpen(d.d)}
      className={`flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 ${cls}`}
    >
      <Icon n={d.fmt === 'html' ? 'web' : 'doc'} c="size-5 text-zinc-500 dark:text-zinc-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{d.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="min-w-0 truncate">
            D{d.d} · {plural(commentCount(d), 'comment')} · {when(d.t1, now)}
          </span>
          {waiting ? <span className={`${NEEDS_PILL} -my-0.5`}>{waiting}</span> : null}
        </span>
      </span>
      <Icon n="right" c="size-4 text-zinc-300 dark:text-zinc-600" />
    </button>
  )
}
