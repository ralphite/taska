// Finding by typing: the project switcher (G P: Up and Down choose, Enter opens), the command palette (Cmd-K: an
// item, or anything the keys do here), and the sheet of every key (?). Props only.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { closed, shownStatus } from '../../model/items'
import type { Item } from '../../model/types'
import { hay } from '../../model/visible'
import { NeedsCount, ProjTile, Skeleton } from '../../ui/bits'
import { StateIcon } from '../../ui/Icon'
import type { SheetParts } from '../../ui/Sheet'
import { FIELD, MUTED, TYPE_TEXT } from '../../ui/tones'
import { noMatches } from '../../model/words'

/** The keys sheet's groups: [group, [keys, what][]] (from the table of actions). */
export type KeyGroups = [string, [string, string][]][]

/** A row of the palette: an action, with its words and keys. */
export interface Command<Id extends string = string> {
  id: Id
  label: string
  keys: string
  /** it acts on the open item (its code shows beside it) */
  item: boolean
  /** only of use on the desktop */
  desk?: boolean
}

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

/** A list of rows walked by the keys: the one Enter takes is blue, the pointer's grey (never the same look). */
function useKeyRow(count: number) {
  const [i, setI] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const at = Math.min(i, Math.max(0, count - 1))
  useLayoutEffect(() => {
    list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' })
  })
  return { at, setI, list }
}

export interface SwitchRow {
  slug: string
  title: string
  tone: string
  needs: number
  here: boolean
}

export function Switcher({ rows, loading, onOpen }: { rows: SwitchRow[]; loading: boolean; onOpen(slug: string): void }) {
  const [q, setQ] = useState('')
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
              <ProjTile title={p.title} tone={p.tone} cls="size-6 rounded-md text-xs" />
              <span className={`min-w-0 flex-1 truncate ${p.here ? 'font-semibold' : ''}`}>{p.title}</span>
              {p.here ? <span className={`text-xs ${MUTED}`}>this one</span> : null}
              {p.needs ? <NeedsCount n={p.needs} said /> : null}
            </a>
          ))
        ) : (
          loading ? <Skeleton shape="tile" /> : <p className="px-3 py-2 text-sm text-zinc-500">{noMatches(q)}</p>
        )}
      </div>
    </>
  )
}

/** `desk`: the desktop's palette (its keys, and what only the desktop has); the phone's has neither. */
export function Palette<Id extends string>({ items, code, open, commands: all, desk, onItem, onCommand }: { items: readonly Item[]; code(n: number): string; open: number | null; commands: readonly Command<Id>[]; desk: boolean; onItem(n: number): void; onCommand(id: Id): void }) {
  const [q0, setQ] = useState('')
  const q = q0.trim().toLowerCase()
  const has = (t: string) => !q || t.toLowerCase().includes(q)
  const commands = desk ? all : all.filter((c) => !c.desk)
  const found = q
    ? items
        .filter((it) => !it.mergedInto && hay(it).includes(q))
        .sort((a, b) => Number(closed(a.status)) - Number(closed(b.status)) || b.n - a.n)
        .slice(0, 6)
    : []
  const rows: { t: string; sub?: string; k?: string; id?: Id; it?: Item }[] = [
    ...(open ? commands.filter((c) => c.item && (has(c.label) || has(code(open)))).map((c) => ({ t: c.label, sub: code(open), k: c.keys, id: c.id })) : []),
    ...commands.filter((c) => !c.item && has(c.label)).map((c) => ({ t: c.label, k: c.keys, id: c.id })),
    ...found.map((it) => ({ t: it.title, it })),
  ]
  const { at, setI, list } = useKeyRow(rows.length)
  const run = (r: (typeof rows)[number] | undefined) => {
    if (!r) return
    if (r.it) return onItem(r.it.n)
    if (r.id) onCommand(r.id)
  }
  const kbd = (x: string, j: number): ReactNode => (
    <kbd key={j} className="hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-500 ring-1 ring-zinc-300 lg:grid dark:text-zinc-400 dark:ring-zinc-600">
      {x}
    </kbd>
  )
  return (
    <>
      <input
        autoFocus
        className={FIELD}
        placeholder="Command, code, or keywords…"
        aria-label="Command or item"
        autoComplete="off"
        value={q0}
        onChange={(e) => {
          setQ(e.target.value)
          setI(0)
        }}
        onKeyDown={(e) => {
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && rows.length) {
            e.preventDefault()
            setI((at + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length)
          } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            run(rows[at])
          }
        }}
      />
      <div ref={list} className="-mx-1 mt-2 flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto outline-none">
        {rows.length ? (
          rows.map((r, k) => (
            <button
              key={k}
              onClick={() => run(r)}
              aria-selected={k === at}
              className="flex h-10 w-full min-w-0 shrink-0 items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-zinc-100 aria-selected:bg-blue-50 dark:hover:bg-zinc-800 dark:aria-selected:bg-blue-400/15"
            >
              {r.it ? (
                <>
                  <StateIcon {...shownStatus(r.it)} cls="size-4" />
                  <span className={`font-mono text-xs font-bold ${TYPE_TEXT[r.it.type]}`}>{code(r.it.n)}</span>
                  <span className="min-w-0 flex-1 truncate">{r.t}</span>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate">
                    {r.t}
                    {r.sub ? <span className="ml-1.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">{r.sub}</span> : null}
                  </span>
                  {(r.k || '').split(' ').map(kbd)}
                </>
              )}
            </button>
          ))
        ) : (
          <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">{noMatches(q0)}</p>
        )}
      </div>
    </>
  )
}
