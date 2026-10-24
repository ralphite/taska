// Under a search: how many it matches in the other tabs (with a way there), and what the other projects have: the
// search there says it is searching, that it found nothing there, or that it could not search. Props only.

import { closed } from '../model/items'
import type { SearchHit } from '../model/types'
import { STATUS_WORD, TAB_WORD, type Tab } from '../model/words'
import { ProjTile } from './bits'
import { LINK_BTN } from './tones'

export interface CrossFacts {
  list: SearchHit[] | null
  failed: boolean
  q: string
}

function CrossHits({ cross, tone, onGo }: { cross: CrossFacts; tone(slug: string): string; onGo(href: string): void }) {
  const list = cross.list
  if (!list?.length)
    return (
      <p className="mt-4 px-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
        {cross.failed ? "Couldn't search the other projects" : list ? 'Not in other projects' : 'Searching the other projects…'}
      </p>
    )
  return (
    <div className="mx-auto mt-4 w-full max-w-xl px-2 text-left">
      <p className="px-3 pb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
        In other projects · {list.length}
        {list.length === 30 ? '+' : ''}
      </p>
      {list.slice(0, 8).map((x) => {
        const href = `/p/${encodeURIComponent(x.project)}/${x.kind === 'input' ? 'inputs?q=' + encodeURIComponent(cross.q) : encodeURIComponent(x.code)}`
        return (
          <a
            key={x.project + x.code}
            href={href}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) return
              e.preventDefault()
              onGo(href)
            }}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <ProjTile title={x.ptitle || x.project} tone={tone(x.project)} cls="size-5 rounded text-[10px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                <span className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">{x.code}</span> {x.title}
              </span>
              <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                {x.ptitle || x.project}
                {x.kind === 'input' ? ' · what you said' : x.archived ? ' · archived' : closed(x.status || '') ? ` · ${STATUS_WORD[x.status as 'done'] || x.status}` : ''}
              </span>
            </span>
          </a>
        )
      })}
      {list.length > 8 ? <p className="px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400">and {list.length - 8} more: a longer search narrows them</p> : null}
    </div>
  )
}

export function SearchHints({ other, cross, tone, onShow, onGo }: {
  /** the other tabs it matches in, and how many */
  other: readonly (readonly [Tab, number])[]
  cross: CrossFacts | null
  tone(slug: string): string
  onShow(tab: Tab): void
  onGo(href: string): void
}) {
  return (
    <>
      {other.map(([t, n]) => (
        <p key={t} className="flex items-center justify-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          {n === 1 ? '1 match' : `${n} matches`} in {TAB_WORD[t]}
          <button onClick={() => onShow(t)} className={LINK_BTN}>
            Show
          </button>
        </p>
      ))}
      {cross ? <CrossHits cross={cross} tone={tone} onGo={onGo} /> : null}
    </>
  )
}
