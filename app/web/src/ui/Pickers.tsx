// Picking an item by typing part of its words: to put one under another (Put under…, No parent), or any item a
// command needs. Props only.

import { useState, type ReactNode } from 'react'
import { closed, shownStatus } from '../model/items'
import type { Item } from '../model/types'
import { hay } from '../model/visible'
import { Icon, StateIcon } from './Icon'
import type { SheetParts } from './Sheet'
import { FIELD, TYPE_TEXT } from './tones'

export function Picker({ items, code, placeholder, skip, sort, current, desk, extra, onPick }: {
  items: readonly Item[]
  code(n: number): string
  placeholder: string
  skip: ReadonlySet<number>
  sort(a: Item, b: Item): number
  current?: number | null
  desk: boolean
  extra?: ReactNode
  onPick(n: number): void
}) {
  const [q, setQ] = useState('')
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const cands = items.filter((c) => !skip.has(c.n) && !c.mergedInto && !c.archived && c.type !== 'rule' && words.every((w) => hay(c).includes(w))).sort(sort).slice(0, 40)
  return (
    <div className="flex flex-col gap-2">
      <input autoFocus={desk} className={`${FIELD} lg:h-9 lg:py-0 lg:text-sm`} placeholder={placeholder} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="-mx-1 max-h-[55dvh] overflow-y-auto lg:max-h-80 lg:scrollbar-thin">
        {cands.length ? (
          cands.map((c) => (
            <button
              key={c.n}
              onClick={() => onPick(c.n)}
              {...(current === c.n ? { 'aria-current': 'true' as const } : {})}
              className="flex h-12 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[15px] hover:bg-zinc-100 aria-[current=true]:bg-blue-50 lg:h-9 lg:text-sm dark:hover:bg-zinc-800 dark:aria-[current=true]:bg-blue-400/10"
            >
              <StateIcon {...shownStatus(c)} cls="size-4" />
              <span className={`font-mono text-xs font-bold ${TYPE_TEXT[c.type]}`}>{code(c.n)}</span>
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
            </button>
          ))
        ) : (
          <p className="px-2.5 py-2 text-sm text-zinc-500 dark:text-zinc-400">Nothing matches</p>
        )}
        {extra}
      </div>
    </div>
  )
}

const closedLast = (a: Item, b: Item) => Number(closed(a.status)) - Number(closed(b.status))

/** Put an item under another (not under itself or what is under it), or on its own. */
export function moveParentSheet({ it, items, kids, code, desk }: { it: Item; items: readonly Item[]; kids: ReadonlyMap<number, Item[]>; code(n: number): string; desk: boolean }, onPick: (to: number | null) => void): SheetParts {
  const below = new Set([it.n])
  const walk = (k: number) => {
    for (const c of kids.get(k) || [])
      if (!below.has(c.n)) {
        below.add(c.n)
        walk(c.n)
      }
  }
  walk(it.n)
  return {
    head: <span className="text-[15px] font-semibold lg:text-sm">Move {code(it.n)} under…</span>,
    body: (
      <Picker
        items={items}
        code={code}
        placeholder={`Put ${code(it.n)} under…`}
        skip={below}
        sort={(a, b) => closedLast(a, b) || a.n - b.n}
        current={it.parent}
        desk={desk}
        onPick={onPick}
        extra={
          <button
            onClick={() => onPick(null)}
            className="mt-1 flex h-12 w-full items-center gap-2.5 rounded-lg border-t border-zinc-100 px-2.5 text-left text-[15px] hover:bg-zinc-100 lg:h-9 lg:text-sm dark:border-zinc-800 dark:hover:bg-zinc-800"
          >
            <Icon n={it.parent ? 'x' : 'check'} c="size-4 text-zinc-500" />
            No parent
          </button>
        }
      />
    ),
  }
}

/** Any item a command needs. */
export function pickSheet({ head, items, skip, code, desk }: { head: string; items: readonly Item[]; skip: readonly number[]; code(n: number): string; desk: boolean }, onPick: (n: number) => void): SheetParts {
  return {
    head: <span className="text-[15px] font-semibold lg:text-sm">{head}</span>,
    body: <Picker items={items} code={code} placeholder="Find an item" skip={new Set(skip)} sort={(a, b) => closedLast(a, b) || b.n - a.n} desk={desk} onPick={onPick} />,
  }
}
