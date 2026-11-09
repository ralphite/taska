// The phone's pages of Settings that the desktop shows beside the items: Documents, Activity and Deleted. (Projects,
// in the phone's grouped rows, is Sections' ProjectsBody, the same body as the desktop's.) Props only.

import type { LogSentence } from '../../model/activity'
import { plural } from '../../model/words'
import { Skeleton } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { P_BTN } from '../../ui/tones'
import { Empty } from '../../ui/bits'
import { LogLine, LogMore, type LogEvents } from '../../ui/Log'
import type { GoneRow } from '../../model/goneRows'
import { Ruled } from './SettingsParts'

// ---- Documents, Activity, Deleted (the phone's pages)

export interface PhoneDocRow {
  d: number
  title: string
  web: boolean
  on: string
  comments: number
}

export function DocsBody({ docs, onOpen }: { docs: PhoneDocRow[]; onOpen(d: number): void }) {
  if (!docs.length)
    return (
      <Ruled>
        <Empty>
          No documents yet · item ⋯ › New doc
        </Empty>
      </Ruled>
    )
  return (
    <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {docs.map((d) => (
        <li key={d.d}>
          <button onClick={() => onOpen(d.d)} className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900">
            <Icon n={d.web ? 'web' : 'doc'} c="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 block text-[15px] font-medium break-words">{d.title}</span>
              <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-mono">D{d.d}</span>
                {d.on ? ` · ${d.on}` : ''}
                {d.comments ? ` · ${plural(d.comments, 'comment')}` : ''}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function LogBody({ rows, end, asking, on }: { rows: { s: LogSentence; undo: number | null }[] | null; end: boolean; asking: ReadonlySet<number>; on: LogEvents & { undo(seq: number): void; more(): void } }) {
  if (!rows)
    return (
      <Ruled>
        <Skeleton shape="text" cls="py-4" />
      </Ruled>
    )
  if (!rows.length)
    return (
      <Ruled>
        <Empty>No changes yet</Empty>
      </Ruled>
    )
  return (
    <>
      <Ruled>
        <div className="pt-2">
          <ol className="divide-y divide-zinc-100 text-[13px] leading-relaxed text-zinc-600 dark:divide-zinc-800 dark:text-zinc-300">
            {rows.map(({ s, undo }) => (
              <li key={s.key} className="flex items-baseline gap-2 py-1.5">
                <span className="min-w-0 flex-1 break-words">
                  <LogLine s={s} withTime on={on} />
                </span>
                {undo != null ? (
                  <button
                    onClick={() => on.undo(undo)}
                    className="relative -my-1 shrink-0 rounded-md px-2 py-1 font-sans text-xs font-semibold text-blue-600 after:absolute after:-inset-x-1 after:-inset-y-2.5 hover:bg-blue-50 lg:after:hidden dark:text-blue-400 dark:hover:bg-blue-400/10"
                  >
                    {asking.has(undo) ? 'Tap again to undo' : 'Undo'}
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </Ruled>
      <LogMore end={end} cls="pt-4" onNear={on.more} />
    </>
  )
}

/** What was deleted, as the desktop's Deleted lists it (goneRows: one list, the latest first, whatever it was), each
 * with Restore. */
export function DeletedBody({ rows, on }: { rows: GoneRow[]; on: { restore(x: GoneRow): void } }) {
  if (!rows.length)
    return (
      <Ruled>
        <Empty>Nothing deleted</Empty>
      </Ruled>
    )
  return (
    <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {rows.map((x) => (
        <li key={x.key} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            {x.kind === 'input' ? (
              <>
                <p className="line-clamp-2 text-[15px] leading-snug break-words">{x.text}</p>
                <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-mono">{x.code}</span> · deleted {x.at}
                  {x.with ? ` · with ${x.with}` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="truncate text-[15px]">
                  <span className="mr-1.5 font-mono text-[13px] font-bold">{x.key}</span>
                  {x.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {x.what} · deleted {x.at}
                </p>
              </>
            )}
          </div>
          <button onClick={() => on.restore(x)} className={P_BTN}>
            Restore
          </button>
        </li>
      ))}
    </ul>
  )
}
