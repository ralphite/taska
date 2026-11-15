// Settings › Shared rules (I779): New shared rules first (as Projects' New project), then each one: its name, how many
// projects put it in, when it last changed; a row opens it (its page is the Rules tab's). No switches: a project puts
// one in by a line of its rules. Props only.

import type { MouseEvent } from 'react'
import { Icon } from '../../ui/Icon'
import { MUTED, SECOND } from '../../ui/tones'
import { Loading } from './SettingsParts'

export interface SharedRow {
  slug: string
  name: string
  /** "3 projects · changed 2 hours ago" */
  meta: string
}

export function SharedRulesBody({ rows, desk, on }: { rows: readonly SharedRow[] | null; desk: boolean; on: { create(from: HTMLElement): void; open(slug: string): void } }) {
  const create = (e: MouseEvent<HTMLButtonElement>) => on.create(e.currentTarget)
  return (
    <>
      {desk ? (
        <section className="flex items-center gap-4 border-t border-zinc-200 py-5 dark:border-zinc-800">
          <button onClick={create} className={`${SECOND} shrink-0`}>
            <Icon n="plus" c="size-4" sw="2" />
            New shared rules
          </button>
        </section>
      ) : (
        <button onClick={create} className="flex min-h-12 w-full items-center gap-3 py-2.5 text-left text-[15px] font-medium text-blue-600 dark:text-blue-400">
          <Icon n="plus" c="size-5" />
          New shared rules
        </button>
      )}
      {rows == null ? (
        <Loading />
      ) : rows.length ? (
        <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {rows.map((s) => (
            <li key={s.slug}>
              <button onClick={() => on.open(s.slug)} className={`flex w-full items-center gap-3 text-left ${desk ? 'min-h-16 py-3 hover:opacity-80' : 'px-1 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}>
                <Icon n="book" c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold break-words">{s.name}</span>
                  <span className={`mt-0.5 block truncate text-xs ${MUTED}`}>{s.meta}</span>
                </span>
                <Icon n="right" c="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`border-t border-zinc-200 py-4 text-sm ${MUTED} dark:border-zinc-800`}>None yet.</p>
      )}
    </>
  )
}
