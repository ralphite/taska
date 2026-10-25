// Sheets about projects: moving an item or an input to another project, and a project's menu. Props only.

import { Icon } from './Icon'
import type { IconName } from './icon-paths'
import { ProjTile } from './bits'
import type { SheetParts } from './Sheet'

export interface OtherProject {
  slug: string
  title: string
  tone: string
  open: number | string
}

export function itemMoveProjectSheet({ code, others }: { code: string; others: OtherProject[] }, onPick: (slug: string) => void): SheetParts {
  return {
    title: `Move ${code} to another project`,
    body: (
      <>
        <div className="-mx-1 flex flex-col gap-0.5">
          {others.map((p) => (
            <button key={p.slug} onClick={() => onPick(p.slug)} className="flex h-12 items-center gap-3 rounded-xl px-3 text-left hover:bg-zinc-100 lg:h-10 dark:hover:bg-zinc-800">
              <ProjTile title={p.title} tone={p.tone} cls="size-7 rounded-lg text-sm" />
              <span className="min-w-0 flex-1 truncate">{p.title}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
          It is made there with its text and its talk, and its subitems go along under it; here they are marked won&apos;t do and archived, with a note where each went.
        </p>
      </>
    ),
  }
}

export function moveInputSheet({ code, words, others, made, byOrganizer, scope }: {
  code: string
  /** what was said, or how many files */
  words: string
  others: OtherProject[]
  /** the items made of it here, as "F12 title" */
  made: string[]
  byOrganizer: boolean
  /** the item it is in the talk of */
  scope: string | null
}, onPick: (slug: string) => void): SheetParts {
  const list = made.join(', ')
  return {
    title: `Move ${code} to another project`,
    body: (
      <div className="flex flex-col gap-3">
        <p className="line-clamp-3 rounded-xl bg-blue-50 px-3 py-2 text-[15px] leading-snug break-words text-zinc-900 dark:bg-blue-400/10 dark:text-zinc-100">{words}</p>
        <div className="-mx-1 flex flex-col gap-0.5">
          {others.length ? (
            others.map((p) => (
              <button
                key={p.slug}
                onClick={() => onPick(p.slug)}
                className="flex h-12 items-center gap-3 rounded-xl px-3 text-left hover:bg-zinc-100 data-pressed:bg-zinc-100 dark:hover:bg-zinc-800 dark:data-pressed:bg-zinc-800"
              >
                <ProjTile title={p.title} tone={p.tone} cls="size-7 rounded-lg text-xs" />
                <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                <span className="text-xs text-zinc-400">{p.open} open</span>
              </button>
            ))
          ) : (
            <p className="px-3 text-sm text-zinc-500">No other projects.</p>
          )}
        </div>
        <p className="text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
          It goes there with its files and is organized again.
          {made.length ? (byOrganizer ? ` Organizer changes here will be undone: ${list}.` : ` Items made here will stay: ${list}.`) : ''}
          {scope ? ` It also leaves the conversation of ${scope}.` : ''}
        </p>
      </div>
    ),
  }
}

export interface ProjectMenuEvents {
  open(): void
  settings(): void
  manage(): void
}

/** A project's menu: opened from its own name above it, it does not say that name again. */
export function projectMenuSheet({ here, slug, title, tone, open }: { here: boolean; slug: string; title: string; tone: string; open: number | string }, on: ProjectMenuEvents): SheetParts {
  const row = (key: string, icon: IconName, label: string, run: () => void, k = '') => (
    <button key={key} onClick={run} className="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
      <Icon n={icon} c="size-[18px] text-zinc-500 dark:text-zinc-400" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {k ? <kbd className="grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-600">{k}</kbd> : null}
    </button>
  )
  return {
    menu: true,
    // which project it is, this one too (on the phone the sheet would show nothing over its rows)
    head: (
      <span className="flex items-center gap-2.5">
        <ProjTile title={title} tone={tone} cls="size-8 rounded-lg text-sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="block truncate font-mono text-xs font-normal text-zinc-500 dark:text-zinc-400">
            /p/{slug} · {open} open
          </span>
        </span>
      </span>
    ),
    body: (
      <div className="-mx-1 flex flex-col">
        {here ? null : row('open', 'arrow', 'Open', on.open)}
        {row('settings', 'gear', 'Project settings', on.settings, here ? 'G S' : '')}
        <div className="my-1.5 border-t border-zinc-100 dark:border-zinc-800" />
        {row('manage', 'pencil', 'Rename or delete…', on.manage)}
      </div>
    ),
  }
}
