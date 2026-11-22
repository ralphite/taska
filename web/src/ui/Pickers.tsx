// Picking a task by typing part of its words: to put one under another (Put under…, No parent), or any task a
// command needs. Props only.

import { useState, type ReactNode } from 'react'
import { closed } from '../model/tasks'
import { shownStatus } from '../model/needStates'
import type { Task } from '../model/types'
import { hay } from '../model/visible'
import { Icon, StateIcon } from './Icon'
import { CurrentMark } from './bits'
import type { SheetParts } from './Sheet'
import { FIELD, CODE_TEXT } from './tones'
import { noMatches } from '../model/words'

export function Picker({ tasks, code, placeholder, skip, sort, current, desk, extra, query = '', onPick }: {
  tasks: readonly Task[]
  code(n: number): string
  placeholder: string
  skip: ReadonlySet<number>
  sort(a: Task, b: Task): number
  current?: number | null
  desk: boolean
  extra?: ReactNode
  /** the words in its field when it opens */
  query?: string
  onPick(n: number): void
}) {
  const [q, setQ] = useState(query)
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const cands = tasks.filter((c) => !skip.has(c.n) && !c.mergedInto && !c.archived && words.every((w) => hay(c).includes(w))).sort(sort).slice(0, 40)
  return (
    <div className="flex flex-col gap-2">
      <input autoFocus={desk} className={`${FIELD} lg:h-9 lg:py-0 lg:text-sm`} placeholder={placeholder} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="-mx-1 max-h-[55dvh] overflow-y-auto outline-none lg:max-h-80 lg:scrollbar-thin">
        {cands.length ? (
          cands.map((c) => (
            <button
              key={c.n}
              onClick={() => onPick(c.n)}
              {...(current === c.n ? { 'aria-current': 'true' as const } : {})}
              className="flex h-12 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[15px] hover:bg-zinc-100 lg:h-9 lg:text-sm dark:hover:bg-zinc-800"
            >
              <StateIcon {...shownStatus(c)} cls="size-4" />
              <span className={`font-mono text-xs font-bold ${CODE_TEXT}`}>{code(c.n)}</span>
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              {current === c.n ? <CurrentMark /> : null}
            </button>
          ))
        ) : (
          <p className="px-2.5 py-2 text-sm text-zinc-500 dark:text-zinc-400">{q.trim() ? noMatches(q) : 'Nothing to pick'}</p>
        )}
        {extra}
      </div>
    </div>
  )
}

const closedLast = (a: Task, b: Task) => Number(closed(a.status)) - Number(closed(b.status))

/** Put a task under another (not under itself or what is under it), or on its own. */
export function moveParentSheet({ it, tasks, kids, code, desk, query }: { it: Task; tasks: readonly Task[]; kids: ReadonlyMap<number, Task[]>; code(n: number): string; desk: boolean; query?: string }, onPick: (to: number | null) => void): SheetParts {
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
        tasks={tasks}
        code={code}
        placeholder="Find a task"
        skip={below}
        sort={(a, b) => closedLast(a, b) || a.n - b.n}
        current={it.parent}
        desk={desk}
        query={query}
        onPick={onPick}
        extra={
          <button
            onClick={() => onPick(null)}
            {...(it.parent ? {} : { 'aria-current': 'true' as const })}
            className="mt-1 flex h-12 w-full items-center gap-2.5 rounded-lg border-t border-zinc-100 px-2.5 text-left text-[15px] hover:bg-zinc-100 lg:h-9 lg:text-sm dark:border-zinc-800 dark:hover:bg-zinc-800"
          >
            <Icon n="x" c="size-4 text-zinc-500" />
            <span className="min-w-0 flex-1">No parent</span>
            {it.parent ? null : <CurrentMark />}
          </button>
        }
      />
    ),
  }
}

/** Any task a command needs. */
export function pickSheet({ head, tasks, skip, code, desk }: { head: string; tasks: readonly Task[]; skip: readonly number[]; code(n: number): string; desk: boolean }, onPick: (n: number) => void): SheetParts {
  return {
    head: <span className="text-[15px] font-semibold lg:text-sm">{head}</span>,
    body: <Picker tasks={tasks} code={code} placeholder="Find a task" skip={new Set(skip)} sort={(a, b) => closedLast(a, b) || b.n - a.n} desk={desk} onPick={onPick} />,
  }
}
