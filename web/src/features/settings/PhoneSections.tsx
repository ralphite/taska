// The phone's pages of Settings that look their own way: Projects in grouped rows (each row's actions under its ⋯),
// and Documents, Activity and Deleted, which the desktop shows beside the items. Props only.

import { useState } from 'react'
import type { LogSentence } from '../../model/activity'
import { plural } from '../../model/words'
import { ProjTile, Skeleton } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { MUTED, P_BTN } from '../../ui/tones'
import { Empty } from '../../ui/bits'
import { LogLine, LogMore, type LogEvents } from '../../ui/Log'
import type { GoneRow } from '../../model/goneRows'
import { NameField, type ProjectsEvents, type ProjectsFacts } from './Sections'
import { PH_GROUP, PhLabel, Ruled } from './SettingsParts'

export function PhoneProjectsBody({ f, on }: { f: ProjectsFacts; on: ProjectsEvents }) {
  const [rename, setRename] = useState('')
  if (!f.live) return <Skeleton shape="tile" cls="px-2 py-3" />
  const more = (key: string, title: string) => (
    <button
      onClick={() => on.menu(key)}
      aria-label={`More for ${title}`}
      className={`grid size-11 shrink-0 place-items-center rounded-full data-pressed:bg-zinc-100 dark:data-pressed:bg-zinc-800 ${MUTED}`}
    >
      <Icon n="more" c="size-5" />
    </button>
  )
  const two = (save: () => void, saveLabel: string, cancel: () => void) => (
    <div className="mt-2 flex gap-2">
      <button onClick={save} className="h-11 shrink-0 rounded-xl bg-zinc-900 px-4 text-[15px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
        {saveLabel}
      </button>
      <button onClick={cancel} className="h-11 shrink-0 rounded-xl px-4 text-[15px] font-medium text-zinc-600 dark:text-zinc-300">
        Cancel
      </button>
    </div>
  )
  return (
    <>
      <div className={`${PH_GROUP} mt-4`}>
        <button onClick={(e) => on.newProject(e.currentTarget)} className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px] font-medium text-blue-600 dark:text-blue-400">
          <Icon n="plus" c="size-5" />
          New project
        </button>
      </div>
      <PhLabel>Projects</PhLabel>
      <div className={PH_GROUP}>
        {f.live.map((p) =>
          f.renaming === p.name ? (
            <div key={p.name} className="flex items-start gap-3 px-3.5 py-3">
              <ProjTile title={p.title} tone={p.tone} cls="mt-1.5 size-8 rounded-lg text-sm" />
              <div className="min-w-0 flex-1">
                <NameField value={p.title} label={`New name for ${p.title}`} cls="h-11 py-2 font-medium" select onValue={setRename} onEnter={(v) => on.saveRename(p.name, v, p.title)} onEsc={() => on.rename(null)} />
                {two(() => on.saveRename(p.name, rename || p.title, p.title), 'Save', () => on.rename(null))}
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  The address stays <span className="font-mono">/p/{p.name}</span>
                </p>
              </div>
            </div>
          ) : (
            <div key={p.name}>
              <div className="flex min-h-14 items-center gap-3 py-2 pr-1.5 pl-3.5">
                <a
                  href={`/p/${encodeURIComponent(p.name)}/`}
                  onClick={(e) => {
                    e.preventDefault()
                    on.open(p.name)
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <ProjTile title={p.title} tone={p.tone} cls="size-8 rounded-lg text-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
                      <span className="truncate">{p.title}</span>
                      {p.here ? <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-px text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">This project</span> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono">/p/{p.name}</span> · {p.open} open
                    </span>
                  </span>
                </a>
                {more(p.name, p.title)}
              </div>
            </div>
          ),
        )}
      </div>
      {f.gone.length ? (
        <>
          <PhLabel>Deleted</PhLabel>
          <div className={PH_GROUP}>
            {f.gone.map((d) => (
              <div key={d.name}>
                <div className="flex min-h-14 items-center gap-3 py-2 pr-1.5 pl-3.5">
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-400 text-sm leading-none font-bold text-white uppercase dark:bg-zinc-600">
                    {[...String(d.title || '?')][0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium break-words text-zinc-500 dark:text-zinc-400">{d.title}</span>
                    <span className={`mt-0.5 block truncate text-xs ${MUTED}`}>
                      Deleted {d.when} · {plural(d.items, 'item')}
                    </span>
                  </span>
                  <button onClick={() => on.restore(d.name)} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-sm font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                    <Icon n="undo" c="size-4" sw="2" />
                    Restore
                  </button>
                  {more('gone:' + d.name, d.title)}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  )
}

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
              <li key={s.key} className="flex items-start gap-2 py-1.5">
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
