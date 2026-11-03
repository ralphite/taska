// What did not go in, the newest first: what it was and where (a link there), the words it carried, why and when;
// each can be sent again (while this page still has it) or let go. Props only.

import { Icon } from '../../ui/Icon'
import type { SheetParts } from '../../ui/Sheet'

export interface NotSavedRow {
  sid: string
  what: string
  why: string
  when: string
  /** where it belongs, to go and see it */
  go?: string
  said?: string
  /** another project's: its name */
  elsewhere?: string
}

export function notSavedSheet(rows: readonly NotSavedRow[], on: { go(url: string): void; drop(sid?: string): void }): SheetParts | null {
  if (!rows.length) return null
  return {
    title: `Not saved (${rows.length})`,
    body: (
      <div className="-mx-1 flex max-w-sm flex-col">
        {rows.map((f) => (
          <div key={f.sid} className="flex items-start gap-2 rounded-lg px-3 py-2">
            <Icon n="alert" c="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" sw="2" />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug font-medium break-words">
                {f.go ? (
                  <a
                    href={f.go}
                    onClick={(e) => {
                      e.preventDefault()
                      on.go(f.go as string)
                    }}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {f.what}
                  </a>
                ) : (
                  f.what
                )}
                {f.elsewhere ? <span className="font-normal text-zinc-500 dark:text-zinc-400"> · in {f.elsewhere}</span> : null}
              </p>
              {f.said ? <p className="mt-0.5 line-clamp-2 text-[13px] break-words text-zinc-600 dark:text-zinc-300">“{f.said}”</p> : null}
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {f.why} · {f.when}
              </p>
            </div>
            <button
              onClick={() => on.drop(f.sid)}
              aria-label="OK"
              title="OK"
              className="-my-1 grid size-7 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <Icon n="x" c="size-4" />
            </button>
          </div>
        ))}
        {rows.length > 1 ? (
          <div className="mt-1 flex justify-end gap-1 border-t border-zinc-100 px-2 pt-2 dark:border-zinc-800">
            <button onClick={() => on.drop()} className="rounded-lg px-2.5 py-1 text-[13px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Clear all
            </button>
          </div>
        ) : null}
      </div>
    ),
  }
}
