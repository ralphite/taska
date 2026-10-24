// Finding by typing: the project switcher (G P: Up and Down choose, Enter opens), the command palette (Cmd-K: an
// item, or anything the keys do here), and the sheet of every key (?). Props only.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { closed, shownStatus } from '../../model/items'
import type { Item } from '../../model/types'
import { hay } from '../../model/visible'
import { ProjTile } from '../../ui/bits'
import { StateIcon } from '../../ui/Icon'
import type { SheetParts } from '../../ui/Sheet'
import { FIELD, TYPE_TEXT } from '../../ui/tones'

export const KEYS: [string, [string, string][]][] = [
  [
    'Move',
    [
      ['J / K', 'Next or previous item'],
      ['O or ↵', 'Full width; Esc goes back'],
      ['Space', 'Scroll the item'],
      ['G then I N A R', 'Items, Inputs, Archive, Rules'],
      ['G then P', 'Switch project'],
      ['G then S', 'Settings'],
      ['[', 'Toggle sidebar'],
    ],
  ],
  [
    'Act on the selected item',
    [
      ['A', "The item's next step: Accept, Approve, Answer or Reply"],
      ['R', 'Reply or add to it'],
      ['N', 'Not yet: back to in progress at once'],
      ['1–9, ⌘↵', 'Pick a choice, send the answer'],
      ['D · W · L', "Done · Won't do · Later / Now"],
      ['E / ⇧E', 'Archive or unarchive / archive every finished item'],
      ['S · P · T', "Status, priority, type (then the menu's digit)"],
      ['M · ⇧C', 'Put under… · Copy for agent'],
      ['I · ⇧D · ⇧A', 'Edit · New doc · Add subitem'],
      ['.', 'All actions'],
      ['Z', 'Undo last action; older changes in Change log'],
    ],
  ],
  [
    'Mouse',
    [
      ['Hover a row', 'Quick actions'],
      ['Right-click a row', 'Item menu'],
      ['Click cut-off words', 'Show them all'],
      ['Drag a pane edge', 'Resize; double-click for the default'],
    ],
  ],
  [
    'Write and find',
    [
      ['⌘K', 'Go to an item or do anything here'],
      ['⌘ / ⇧ click', 'Select multiple rows to act on together'],
      ['C', 'New input'],
      ['V', 'Voice note for the selected item; V again stops'],
      ['⇧V', 'New input by voice; ⇧V again stops and sends'],
      ['⌥V', 'Voice note while typing'],
      ['↵', 'While recording: stop, into the box'],
      ['⇧↵ or ⌘↵', 'Send; while recording: stop and send'],
      ['/', 'Search'],
      ['F', 'Filters'],
      ['?', 'This sheet'],
      ['Esc', 'Step back one level'],
    ],
  ],
]

/** The palette's rows: a command replays its keys, so it does exactly what the key does where you are. */
export const CP_PAGE: [string, string][] = [
  ['New input', 'c'],
  ['Search', '/'],
  ['Filters', 'f'],
  ['Record voice input', 'V'],
  ['Items', 'g i'],
  ['Inputs', 'g n'],
  ['Archive', 'g a'],
  ['Rules', 'g r'],
  ['Switch project', 'g p'],
  ['Settings', 'g s'],
  ['Toggle sidebar', '['],
  ['Undo', 'z'],
  ['Keyboard shortcuts', '?'],
]
export const CP_ITEM: [string, string][] = [
  ['Accept or approve', 'a'],
  ['Reply', 'r'],
  ['Not yet', 'n'],
  ['Done', 'd'],
  ['Later or back to now', 'l'],
  ['Archive', 'e'],
  ["Won't do", 'w'],
  ['Edit', 'i'],
  ['Status…', 's'],
  ['Priority…', 'p'],
  ['Type…', 't'],
  ['Put under…', 'm'],
  ['Add subitem', 'A'],
  ['New doc', 'D'],
  ['Copy for agent', 'C'],
  ['Full width', 'o'],
]

export function keysSheet(): SheetParts {
  const sec = ([group, keys]: (typeof KEYS)[number]) => (
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
          {sec(KEYS[0])}
          {sec(KEYS[3])}
        </div>
        <div>
          {sec(KEYS[1])}
          {sec(KEYS[2])}
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
              {p.here ? <span className="text-xs text-zinc-400">this one</span> : null}
              {p.needs ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">{p.needs} need you</span> : null}
            </a>
          ))
        ) : (
          <p className="px-3 py-2 text-sm text-zinc-500">{loading ? 'Loading…' : 'No project matches'}</p>
        )}
      </div>
    </>
  )
}

export function Palette({ items, code, open, onItem, onKeys }: { items: readonly Item[]; code(n: number): string; open: number | null; onItem(n: number): void; onKeys(keys: string): void }) {
  const [q0, setQ] = useState('')
  const q = q0.trim().toLowerCase()
  const has = (t: string) => !q || t.toLowerCase().includes(q)
  const found = q
    ? items
        .filter((it) => !it.mergedInto && hay(it).includes(q))
        .sort((a, b) => Number(closed(a.status)) - Number(closed(b.status)) || b.n - a.n)
        .slice(0, 6)
    : []
  const rows: { t: string; sub?: string; k?: string; it?: Item }[] = [
    ...(open ? CP_ITEM.filter(([t]) => has(t) || has(code(open))).map(([t, k]) => ({ t, sub: code(open), k })) : []),
    ...CP_PAGE.filter(([t]) => has(t)).map(([t, k]) => ({ t, k })),
    ...found.map((it) => ({ t: it.title, it })),
  ]
  const { at, setI, list } = useKeyRow(rows.length)
  const run = (r: (typeof rows)[number] | undefined) => {
    if (!r) return
    if (r.it) return onItem(r.it.n)
    onKeys(r.k || '')
  }
  const kbd = (x: string, j: number): ReactNode => (
    <kbd key={j} className="grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-500 ring-1 ring-zinc-300 dark:text-zinc-400 dark:ring-zinc-600">
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
      <div ref={list} className="-mx-1 mt-2 flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto">
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
          <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">Nothing matches</p>
        )}
      </div>
    </>
  )
}
