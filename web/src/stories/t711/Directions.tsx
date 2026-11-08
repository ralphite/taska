// T711 prototype (r1186): the project's one active session, almost without words, in the two directions Gemini drew
// (briefs in the scratchpad, gemini-3.1-pro-preview). State is the dot alone: emerald and softly pulsing while the
// session works, amber while it waits on Yadong; the rest is in the tip. Rows are as today. Only for the stories.
//   a. Name: the pill is the badge, the session's name cut short, the dot
//   b. Badge: the pill is the badge alone, the dot on its corner

import { Avatar } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { MUTED } from '../../ui/tones'
import { AVATAR_LETTER, whoName } from '../../model/words'
import type { Session } from './sessions'

export type Way = 'a' | 'b'

const AMBER = 'text-amber-700 dark:text-amber-400'

/** The dot: emerald, pulsing, while it works; amber while it waits on Yadong. */
const dot = (x: Session) => (x.waitingFor ? 'bg-amber-500 dark:bg-amber-400' : 'animate-pulse bg-emerald-500 dark:bg-emerald-400')

/** What the tip says (never on the screen). */
export const tipOf = (x: Session) => [whoName(x.agent), x.name, x.waitingFor, x.waitingFor ? x.when : null].filter(Boolean).join(' · ')

/** The agent's letter badge, smaller than Avatar where the line is small. */
function Badge({ by }: { by: string }) {
  return (
    <span className="grid size-4 shrink-0 place-items-center rounded bg-zinc-900 text-[9px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
      {AVATAR_LETTER[by] || by[0].toUpperCase()}
    </span>
  )
}

/** b: the badge with the dot on its corner. */
function Dotted({ x, big = false }: { x: Session; big?: boolean }) {
  return (
    <span className="relative flex shrink-0">
      {big ? (
        <span className="grid size-6 place-items-center rounded-md bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">{AVATAR_LETTER[x.agent]}</span>
      ) : (
        <Avatar by={x.agent} />
      )}
      <span className={`absolute -top-1 -right-1 size-2.5 rounded-full ring-2 ring-white dark:ring-zinc-950 ${dot(x)}`} />
    </span>
  )
}

// ---- the top bar (and the sidebar card, the same mark smaller) ------------------------------------------------------

export function Pill({ way, x }: { way: Way; x: Session }) {
  if (way === 'b')
    return (
      <span title={tipOf(x)} className="grid size-8 place-items-center">
        <Dotted x={x} big />
      </span>
    )
  return (
    <span title={tipOf(x)} className="flex h-8 max-w-40 items-center gap-2 rounded-full bg-zinc-100 pr-3 pl-1.5 text-[13px] font-medium text-zinc-700 ring-1 ring-zinc-900/5 ring-inset dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-white/5">
      <Avatar by={x.agent} />
      <span className="min-w-0 truncate">{x.name}</span>
      <span className={`size-2 shrink-0 rounded-full ${dot(x)}`} />
    </span>
  )
}

export function CardMark({ way, x }: { way: Way; x: Session }) {
  if (way === 'b')
    return (
      <span title={tipOf(x)} className="relative inline-flex shrink-0">
        <Badge by={x.agent} />
        <span className={`absolute -top-0.5 -right-0.5 size-1.5 rounded-full ring-1 ring-white dark:ring-zinc-900 ${dot(x)}`} />
      </span>
    )
  return (
    <span title={tipOf(x)} className="inline-flex min-w-0 items-center gap-1">
      <Badge by={x.agent} />
      <span className="max-w-28 truncate">{x.name}</span>
      <span className={`size-1.5 shrink-0 rounded-full ${dot(x)}`} />
    </span>
  )
}

// ---- Who works here ---------------------------------------------------------------------------------------------

/** The active session: its badge, its name, and what it waits on while it waits. */
function Active({ way, x }: { way: Way; x: Session }) {
  return (
    <div title={tipOf(x)} className="flex gap-3 py-2">
      <span className="mt-0.5">{way === 'b' ? <Dotted x={x} /> : <Avatar by={x.agent} />}</span>
      <div className="min-w-0 flex-1 leading-6">
        <p className="truncate text-[15px] font-medium">{x.name}</p>
        {x.waitingFor ? <p className={`text-[13px] leading-5 break-words ${AMBER}`}>{x.waitingFor}</p> : null}
      </div>
      {way === 'a' ? <span className={`mt-2 size-2 shrink-0 rounded-full ${dot(x)}`} /> : null}
    </div>
  )
}

/** The old sessions, folded under one line. */
function Old({ way, old }: { way: Way; old: readonly Session[] }) {
  return (
    <details className="group">
      <summary className={`flex h-10 w-fit cursor-pointer list-none items-center gap-1 text-[13px] ${MUTED} hover:text-zinc-700 dark:hover:text-zinc-200`}>
        {way === 'b' ? <Icon n="right" c="size-3.5 transition-transform group-open:rotate-90" sw="2" /> : null}
        {old.length} earlier
        {way === 'a' ? <Icon n="right" c="size-3.5 transition-transform group-open:rotate-90" sw="2" /> : null}
      </summary>
      <ul className="pb-1">
        {old.map((x) => (
          <li key={x.name} title={tipOf(x)} className="flex h-9 items-center gap-3 text-sm opacity-60">
            <Avatar by={x.agent} />
            <span className="min-w-0 flex-1 truncate">{x.name}</span>
            <span className={`text-xs tabular-nums ${MUTED}`}>{x.when}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

/** Connect an agent and What the agent reads, folded under the sessions (their contents as today). */
function Below() {
  const row = (title: string) => (
    <div className="flex min-h-12 items-center justify-between border-t border-zinc-100 text-sm font-semibold dark:border-zinc-800">
      {title}
      <Icon n="down" c="size-4 text-zinc-400" sw="2" />
    </div>
  )
  return (
    <div className="mt-2">
      {row('Connect an agent')}
      {row('What the agent reads')}
    </div>
  )
}

export function SheetBody({ way, x, old }: { way: Way; x: Session; old: readonly Session[] }) {
  return (
    <div className="flex flex-col px-1 pb-2">
      <Active way={way} x={x} />
      <Old way={way} old={old} />
      <Below />
    </div>
  )
}

// ---- the item page: only while the active session waits on something about it ------------------------------------

export function ItemWait({ x }: { x: Session }) {
  if (!x.waitingFor) return null
  return (
    <p title={tipOf(x)} className={`inline-flex h-6 w-fit max-w-full items-center gap-1.5 rounded-md bg-amber-50 pr-2 pl-1 text-[13px] ring-1 ring-amber-600/20 ring-inset dark:bg-amber-400/10 dark:ring-amber-400/25 ${AMBER}`}>
      <Badge by={x.agent} />
      <span className="min-w-0 truncate">{x.waitingFor}</span>
    </p>
  )
}
