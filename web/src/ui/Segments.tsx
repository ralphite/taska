// A segmented control (one of a few, side by side, the one on pressed) and the options it offers for an item's type
// and priority. Props only.

import type { ReactNode } from 'react'
import { WORK_TYPES } from '../model/words'

export const SEG_ON =
  'aria-pressed:bg-white aria-pressed:text-zinc-900 aria-pressed:shadow-sm aria-pressed:ring-1 aria-pressed:ring-zinc-900/5 dark:aria-pressed:bg-zinc-600 dark:aria-pressed:text-white dark:aria-pressed:ring-white/10'
export function SegCtl({ opts, on, small = false, pick }: { opts: [string, ReactNode][]; on: string; small?: boolean; pick(v: string): void }) {
  return (
    <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
      {opts.map(([v, t]) => (
        <button
          key={v}
          onClick={() => pick(v)}
          aria-pressed={v === on}
          className={`relative flex ${small ? 'h-7' : 'h-9'} min-w-0 flex-1 items-center justify-center gap-1 rounded-lg text-[13px] font-medium text-zinc-600 after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700/70 dark:hover:text-zinc-100 ${SEG_ON}`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

export const typeOpts = (withRule: boolean): [string, ReactNode][] => [
  ...(withRule ? [] : [['all', 'All'] as [string, ReactNode]]),
  ...[...WORK_TYPES, ...(withRule ? ['rule' as const] : [])].map((t) => [t, <span className="truncate">{t[0].toUpperCase() + t.slice(1)}</span>] as [string, ReactNode]),
]
const P0 = <span className="font-semibold text-red-600 dark:text-red-400">P0</span>
export const priOpts = (withAll: boolean): [string, ReactNode][] => [...(withAll ? [['all', 'Any'] as [string, ReactNode]] : []), ['P0', P0], ['P1', 'P1'], ['P2', 'P2'], ['P3', 'P3']]
