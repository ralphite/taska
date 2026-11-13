// The card for what an item or a proposal needs from you (T642): its icon and title (who, what), the time or where
// an answer on its way is, its body, and its buttons on a row of their own (on the desktop at the right). An item's
// needs (features/item/NeedsCard) and a rules proposal (features/docs/Rules) are drawn in it alike (B763). Props only.

import type { ReactNode } from 'react'
import type { OutShow, OutTone } from '../model/outgoingStates'
import { when } from '../model/time'
import { Icon } from './Icon'
import type { IconName } from './icon-paths'
import { MUTED, NEEDS_CARD } from './tones'

const GOING_TONE: Record<OutTone, string> = { busy: 'animate-pulse text-blue-600 dark:text-blue-400', partial: 'text-amber-700 dark:text-amber-400', failed: 'text-red-600 dark:text-red-400' }

export function NeedFrame({ icon, title, t, done = false, quiet = false, body, foot, hint = '', going = null, act = null, now }: {
  icon: IconName
  title: ReactNode
  t?: string
  done?: boolean
  /** the title only says who asks: faint and plain, like the time beside it, so the question under it stands out */
  quiet?: boolean
  body: ReactNode
  foot: ReactNode
  hint?: string
  /** an answer on its way says where it is where the time goes, until Taska has it (model/outgoingStates) */
  going?: OutShow | null
  act?: ReactNode
  now: number
}) {
  return (
    <section className={`w-full rounded-2xl border ${done ? 'group/form border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900' : NEEDS_CARD}`}>
      <div className="flex items-center gap-2.5 px-4 pt-3.5 lg:px-5 lg:pt-4">
        <Icon n={icon} c={`size-5 ${done ? 'text-zinc-400 dark:text-zinc-500' : 'text-amber-600 dark:text-amber-400'}`} />
        <p
          className={`min-w-0 flex-1 text-sm ${
            quiet ? MUTED : `font-semibold lg:text-[15px] ${done ? 'text-zinc-600 dark:text-zinc-300' : 'text-amber-900 dark:text-amber-200'}`
          }`}
        >
          {title}
        </p>
        {act}
        {going ? (
          <span className={`text-xs ${GOING_TONE[going.tone]}`}>{going.say}</span>
        ) : t ? (
          <span className={`text-xs ${act ? 'hidden lg:inline' : ''} ${done ? ' ' : 'text-amber-700/80 dark:text-amber-300/70'} ${MUTED}`}>{when(t, now)}</span>
        ) : null}
      </div>
      {body ? <div className="space-y-2 px-4 pt-2 text-[15px] leading-relaxed text-zinc-800 lg:px-5 lg:pl-12 dark:text-zinc-200">{body}</div> : null}
      {foot ? (
        <>
          {/* the phone: how to answer on a line of its own, over the buttons */}
          {hint ? <p className="px-4 pt-2 text-xs text-amber-700/80 lg:hidden dark:text-amber-300/70">{hint}</p> : null}
          <div className="flex min-h-[4.25rem] items-center gap-2.5 p-3 pt-3.5 lg:justify-end lg:px-5 lg:pb-4">
            {hint ? <p className="mr-auto hidden text-xs text-amber-700/80 lg:block dark:text-amber-300/70">{hint}</p> : null}
            {foot}
          </div>
        </>
      ) : hint ? (
        <p className="px-4 pt-2 pb-3.5 text-xs text-amber-700/80 lg:px-5 lg:pl-12 dark:text-amber-300/70">{hint}</p>
      ) : (
        <div className="h-3.5" />
      )}
    </section>
  )
}
