// The project switcher (G P: Up and Down choose, Enter opens) and the sheet of every key (?). Props only. Finding
// anything else, and the actions by their words, is the search's (F479: pages/SearchDialog).

import { useLayoutEffect, useRef, useState } from 'react'
import { CurrentMark, NeedsCount, ProjTile, Skeleton } from '../../ui/bits'
import type { SheetParts } from '../../ui/Sheet'
import { FIELD } from '../../ui/tones'
import { noMatches } from '../../model/words'

/** The keys sheet's groups: [group, [keys, what][]] (from the table of actions). */
export type KeyGroups = [string, [string, string][]][]


export function keysSheet(groups: KeyGroups): SheetParts {
  const sec = ([group, keys]: KeyGroups[number]) => (
    <section key={group} className="mb-5">
      <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">{group}</h3>
      <dl className="flex flex-col gap-1.5 text-sm">
        {keys.map(([k, what]) => (
          <div key={k} className="flex items-baseline gap-3">
            <dt className="w-28 shrink-0 font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-200">{k}</dt>
            <dd className="text-zinc-600 dark:text-zinc-300">{what}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
  return {
    title: 'Keyboard shortcuts',
    body: (
      <div className="grid gap-x-8 sm:grid-cols-2">
        <div>
          {sec(groups[0])}
          {sec(groups[3])}
        </div>
        <div>
          {sec(groups[1])}
          {sec(groups[2])}
        </div>
      </div>
    ),
  }
}


export interface SwitchRow {
  slug: string
  title: string
  tone: string
  icon?: string
  needs: number
  here: boolean
}

export function Switcher({ rows, loading, query = '', onOpen }: { rows: SwitchRow[]; loading: boolean; /** the words in its field when it opens */ query?: string; onOpen(slug: string): void }) {
  const [q, setQ] = useState(query)
  const [i, setI] = useState(-1)
  const list = useRef<HTMLDivElement>(null)
  const shown = rows.filter((p) => (p.title + ' ' + p.slug).toLowerCase().includes(q.trim().toLowerCase()))
  // the keys' row: the first project that is not this one, until you move it
  const pick = i < 0 || i >= shown.length ? Math.max(0, shown.findIndex((p) => !p.here)) : i
  useLayoutEffect(() => {
    list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' })
  })
  return (
    <>
      <input
        autoFocus
        className={FIELD}
        placeholder="Find project…"
        aria-label="Find a project"
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setI(-1)
        }}
        onKeyDown={(e) => {
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && shown.length) {
            e.preventDefault()
            setI((pick + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length)
          } else if (e.key === 'Enter' && !e.nativeEvent.isComposing && shown[pick]) {
            e.preventDefault()
            onOpen(shown[pick].slug)
          }
        }}
      />
      <div ref={list} className="-mx-1 mt-2 flex flex-col gap-0.5">
        {shown.length ? (
          shown.map((p, k) => (
            <a
              key={p.slug}
              href={`/p/${encodeURIComponent(p.slug)}/`}
              aria-selected={k === pick}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) return
                e.preventDefault()
                onOpen(p.slug)
              }}
              className="flex h-11 items-center gap-3 rounded-xl px-3 hover:bg-zinc-100 aria-selected:bg-blue-50 aria-selected:ring-1 aria-selected:ring-blue-200 dark:hover:bg-zinc-800 dark:aria-selected:bg-blue-400/15 dark:aria-selected:ring-blue-400/30"
            >
              <ProjTile title={p.title} tone={p.tone} icon={p.icon} cls="size-6 rounded-md text-xs" />
              <span className="min-w-0 flex-1 truncate">{p.title}</span>
              {p.needs ? <NeedsCount n={p.needs} /> : null}
              {p.here ? <CurrentMark /> : null}
            </a>
          ))
        ) : (
          loading ? <Skeleton shape="tile" /> : <p className="px-3 py-2 text-sm text-zinc-500">{noMatches(q)}</p>
        )}
      </div>
    </>
  )
}
