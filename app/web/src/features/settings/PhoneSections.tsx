// The phone's pages of Settings that look their own way: Projects in grouped rows (each row's actions under its ⋯),
// and Documents, Activity and Deleted, which the desktop shows beside the items. Props only.

import { useState, type ReactNode } from 'react'
import type { LogSentence } from '../../model/activity'
import type { ItemType } from '../../model/types'
import { plural } from '../../model/words'
import { ProjTile } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { P_BTN, SECOND, TYPE_TEXT } from '../../ui/tones'
import { Empty } from '../../ui/bits'
import { LogLine, LogMore, type LogEvents } from '../../ui/Log'
import { NameField, type ProjectsEvents, type ProjectsFacts } from './Sections'
import { PH_GROUP, PhLabel, PhNote, Ruled } from './SettingsParts'

const PILL = 'flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-100 px-3.5 text-sm font-medium dark:bg-zinc-800'

export function PhoneProjectsBody({ f, on }: { f: ProjectsFacts; on: ProjectsEvents }) {
  const [name, setName] = useState(f.pNewText)
  const [rename, setRename] = useState('')
  if (!f.live) return <p className="px-5 py-6 text-sm text-zinc-400">Loading…</p>
  const more = (key: string, title: string) => (
    <button
      onClick={() => on.menu(key)}
      aria-label={`More for ${title}`}
      aria-expanded={f.menu === key}
      className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-400 aria-expanded:bg-zinc-100 aria-expanded:text-zinc-700 dark:text-zinc-500 dark:aria-expanded:bg-zinc-800 dark:aria-expanded:text-zinc-200"
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
        {f.pNew ? (
          <div className="px-3.5 py-3">
            <NameField value={f.pNewText} label="New project name" cls="h-11 py-2" onValue={setName} onEnter={(v) => on.create(v)} onEsc={() => on.newProject(false)} />
            {two(() => on.create(name), 'Create', () => on.newProject(false))}
            <p className={`mt-2 text-xs leading-snug ${f.pErr ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}>{f.pErr || ''}</p>
          </div>
        ) : (
          <button onClick={() => on.newProject(true)} className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px] font-medium text-blue-600 dark:text-blue-400">
            <Icon n="plus" c="size-5" />
            New project
          </button>
        )}
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
              {f.menu === p.name ? (
                <div className="flex gap-2 pr-3.5 pb-3 pl-[3.75rem]">
                  <button onClick={() => (setRename(p.title), on.rename(p.name))} className={PILL}>
                    <Icon n="pencil" c="size-4" />
                    Rename
                  </button>
                  <button onClick={() => on.remove(p.name)} className={`${PILL} text-red-600 dark:text-red-400`}>
                    <Icon n="trash" c="size-4" />
                    Delete
                  </button>
                </div>
              ) : null}
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
                    <span className="mt-0.5 block truncate text-xs text-zinc-400 dark:text-zinc-500">
                      Deleted {d.when} · {plural(d.items, 'item')}
                    </span>
                  </span>
                  <button onClick={() => on.restore(d.name)} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-sm font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                    <Icon n="undo" c="size-4" sw="2" />
                    Restore
                  </button>
                  {more('gone:' + d.name, d.title)}
                </div>
                {f.menu === 'gone:' + d.name ? (
                  <div className="flex pr-3.5 pb-3 pl-[3.75rem]">
                    <button onClick={() => on.purge(d.name)} className={`${PILL} text-red-600 dark:text-red-400`}>
                      <Icon n="trash" c="size-4" />
                      {f.purging.has(d.name) ? "Tap again: it can't be undone" : 'Delete forever'}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <PhNote>Deleted projects keep their data. To delete forever, tap ⋯ and confirm.</PhNote>
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
          No documents yet.
          <br />
          Agents write them on items; an item&apos;s ⋯ makes one too.
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
              <span className="block truncate text-[15px] font-medium">{d.title}</span>
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
        <p className="py-6 text-sm text-zinc-400">Loading…</p>
      </Ruled>
    )
  if (!rows.length)
    return (
      <Ruled>
        <Empty>Nothing has changed yet.</Empty>
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

export interface GoneThingRow {
  label: string
  title: string
  what: string
  at: string
}

export interface GoneInputRow {
  id: string
  code: string
  t: string
  at: string
  text: string
  items: { code: string; title: string; type: ItemType }[]
}

export function DeletedBody({ things, inputs, on }: { things: GoneThingRow[]; inputs: GoneInputRow[]; on: { restore(label: string): void; restoreInput(id: string): void } }) {
  const rows: ReactNode = things.length ? (
    <ul className="mb-6 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {things.map((x) => (
        <li key={x.label} className="flex items-center gap-3 py-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px]">
              <span className="mr-1.5 font-mono text-[13px] font-bold">{x.label}</span>
              {x.title}
            </span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              {x.what} · deleted {x.at}
            </span>
          </span>
          <button onClick={() => on.restore(x.label)} className={P_BTN}>
            Restore
          </button>
        </li>
      ))}
    </ul>
  ) : null
  return (
    <>
      {rows}
      {inputs.length ? (
        <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {inputs.map((x) => (
            <li key={x.id} className="flex items-start gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-mono">{x.code}</span> · {x.t} · deleted {x.at}
                </p>
                <p className="mt-1 line-clamp-3 text-[15px] leading-snug break-words">{x.text}</p>
                {x.items.length ? (
                  <p className="mt-1.5 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
                    With{' '}
                    {x.items.map((i, k) => (
                      <span key={i.code}>
                        {k ? ' · ' : ''}
                        <span className={`font-mono text-xs font-bold ${TYPE_TEXT[i.type]}`}>{i.code}</span> {i.title}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
              <button onClick={() => on.restoreInput(x.id)} className={`${SECOND} shrink-0`}>
                <Icon n="undo" c="size-4" />
                Restore
              </button>
            </li>
          ))}
        </ul>
      ) : things.length ? null : (
        <Ruled>
          <Empty>Nothing deleted</Empty>
        </Ruled>
      )}
    </>
  )
}
