// T711 prototype (r1185): how the page could show the agent sessions connected to a project, in the three directions
// Gemini proposed (brief in the scratchpad, gemini-3.1-pro-preview). Each direction says what every place shows: the
// pill in the project's bar, the Agents sheet's top, the mark on an item row in progress, the sidebar card's agent
// part, and a line on the item page. Only for the stories; the page itself is unchanged.
//   a. Calm context: the pill names the blocked session; rows name their session, a blocked one says Blocked
//   b. Session threads: the pill counts ("3 sessions", "1 blocked"); the sheet's sessions are cards
//   c. Session stacks: the pill stacks the sessions' badges; rows carry a chip with the session's name

import type { ReactNode } from 'react'
import { AgentPill } from '../../pages/Header'
import { Avatar } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { MUTED } from '../../ui/tones'
import { AVATAR_LETTER, whoName } from '../../model/words'
import { ordered, type Session } from './sessions'

export type Way = 'a' | 'b' | 'c'

const AMBER = 'text-amber-700 dark:text-amber-400'
const AMBER_BOX = 'bg-amber-50 ring-1 ring-amber-600/20 ring-inset dark:bg-amber-400/10 dark:ring-amber-400/25'
const DOT_AMBER = 'size-1.5 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400'
const DOT_GREEN = 'size-1.5 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400'

const blockedOf = (s: readonly Session[]) => s.filter((x) => x.state === 'blocked')

/** The agent's letter badge, smaller than Avatar where the line is small (the card, the stacked pill). */
function Badge({ by }: { by: string }) {
  return (
    <span className="grid size-4 shrink-0 place-items-center rounded bg-zinc-900 text-[9px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
      {AVATAR_LETTER[by] || by[0].toUpperCase()}
    </span>
  )
}

/** Each session's badge, side by side (c). */
function Stack({ s }: { s: readonly Session[] }) {
  return (
    <span className="flex shrink-0 gap-0.5">
      {s.map((x) => (
        <Badge key={x.name} by={x.agent} />
      ))}
    </span>
  )
}

// ---- the pill in the project's bar ------------------------------------------------------------------------------

export function Pill({ way, s }: { way: Way; s: readonly Session[] }) {
  const b = blockedOf(s)
  if (way === 'a')
    return b.length ? (
      // the session's name gives way, "blocked" stays
      <span className="flex h-8 max-w-52 items-center gap-2 rounded-full bg-amber-50 px-3 text-[13px] font-medium text-amber-800 ring-1 ring-amber-600/20 ring-inset dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25">
        <span className="size-2 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400" />
        <span className="min-w-0 truncate">{b[0].name}</span>
        <span className="shrink-0">· blocked</span>
      </span>
    ) : (
      <AgentPill tone="recent" label={`${s.length} sessions`} offline={false} />
    )
  if (way === 'b') return <AgentPill tone={b.length ? 'blocked' : 'recent'} label={b.length ? `${b.length} blocked` : `${s.length} sessions`} offline={false} />
  return (
    <span
      className={`flex h-8 items-center gap-2 rounded-full pr-3 pl-1.5 text-[13px] font-medium ring-1 ring-inset ${
        b.length
          ? 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25'
          : 'bg-zinc-100 text-zinc-700 ring-zinc-900/5 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-white/5'
      }`}
    >
      <Stack s={s} />
      {b.length ? `${b.length} blocked` : 'working'}
    </span>
  )
}

// ---- the Agents sheet's top ---------------------------------------------------------------------------------------

/** What the session does, in a few words: the directions word it differently. */
const stateWords = (way: Way, x: Session): ReactNode => {
  if (x.state === 'blocked') return way === 'c' ? x.waitingFor : `Blocked: ${x.waitingFor}`
  if (x.state === 'working')
    return way === 'b' ? (
      <>
        Working on <span className="font-semibold text-zinc-800 dark:text-zinc-200">{x.item?.code}</span>
      </>
    ) : way === 'c' ? (
      'working'
    ) : (
      'Working'
    )
  return way === 'b' ? 'Idle, listening' : way === 'c' ? 'idle, waiting for work' : 'Idle, waiting for work'
}

/** a: one flat row per session; the blocked one tinted. */
function RowA({ x }: { x: Session }) {
  const blocked = x.state === 'blocked'
  return (
    <li className={`flex gap-3 rounded-xl px-3 py-3 ${blocked ? AMBER_BOX : ''}`}>
      <span className="mt-0.5">
        <Avatar by={x.agent} />
      </span>
      <div className="min-w-0 flex-1 text-[13px] leading-5">
        <p className="truncate text-[15px] font-medium">{x.name}</p>
        <p className={`flex items-center gap-1.5 ${blocked ? AMBER : MUTED}`}>
          {x.state === 'working' ? <span className={DOT_GREEN} /> : null}
          <span className="min-w-0 break-words">
            {stateWords('a', x)}
            <span className={blocked ? '' : 'text-zinc-400 dark:text-zinc-500'}> · {x.since ?? x.last}</span>
          </span>
        </p>
        {x.item ? (
          <p className={`truncate ${MUTED}`}>
            on {x.item.code} {x.item.title}
          </p>
        ) : null}
      </div>
    </li>
  )
}

/** b: a card per session, its time at the right; the blocked one shows its item's code. */
function CardB({ x }: { x: Session }) {
  const blocked = x.state === 'blocked'
  return (
    <li className={`rounded-xl px-4 py-3 text-[13px] leading-5 ${blocked ? AMBER_BOX : 'bg-zinc-50 ring-1 ring-zinc-900/5 ring-inset dark:bg-zinc-900 dark:ring-white/5'}`}>
      <div className="flex items-center gap-2.5">
        <Avatar by={x.agent} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{x.name}</span>
        <span className={`tabular-nums ${MUTED}`}>{x.since ?? x.last}</span>
      </div>
      <p className={`mt-1 break-words ${blocked ? AMBER : MUTED}`}>{stateWords('b', x)}</p>
      {blocked && x.item ? <span className="mt-2 inline-flex h-6 items-center rounded-md bg-white px-2 font-mono text-xs ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">{x.item.code}</span> : null}
    </li>
  )
}

/** c: a card per session: its time, what it does (a dot when it waits on you), its item as a link. */
function CardC({ x }: { x: Session }) {
  const blocked = x.state === 'blocked'
  return (
    <li className={`rounded-xl px-4 py-3 text-[13px] leading-5 ${blocked ? AMBER_BOX : 'ring-1 ring-zinc-200 ring-inset dark:ring-zinc-800'}`}>
      <div className="flex items-center gap-2.5">
        <Avatar by={x.agent} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{x.name}</span>
        <span className={`tabular-nums ${blocked ? AMBER : MUTED}`}>{x.since ?? x.last}</span>
      </div>
      <p className={`mt-1 flex items-center gap-1.5 ${blocked ? AMBER : MUTED}`}>
        {blocked ? <span className={DOT_AMBER} /> : null}
        <span className="min-w-0 break-words">{stateWords('c', x)}</span>
      </p>
      {x.item ? (
        <p className="truncate">
          <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{x.item.code}</span> <span className="text-zinc-600 dark:text-zinc-300">{x.item.title}</span>
        </p>
      ) : null}
    </li>
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

export function SheetBody({ way, s, queue }: { way: Way; s: readonly Session[]; queue: number }) {
  const list = ordered(s)
  const One = way === 'a' ? RowA : way === 'b' ? CardB : CardC
  return (
    <div className="flex flex-col gap-2 px-1 pt-1 pb-2">
      <p className={`-mt-1 mb-1 text-[13px] ${MUTED}`}>{way === 'a' ? `${queue} items in the queue` : `${queue} in the queue`}</p>
      <ul className={`flex flex-col ${way === 'a' ? 'gap-1' : 'gap-2'}`}>
        {list.map((x) => (
          <One key={x.name} x={x} />
        ))}
      </ul>
      <Below />
    </div>
  )
}


// ---- the mark on an item row in progress --------------------------------------------------------------------------

export function RowMark({ way, x }: { way: Way; x: Session }) {
  const blocked = x.state === 'blocked'
  const tip = `${whoName(x.agent)} · ${x.name}${blocked ? ` · blocked: ${x.waitingFor}` : ''}`
  if (way === 'a')
    return blocked ? (
      <span title={tip} className={`inline-flex h-5 shrink-0 items-center gap-1 rounded-md pr-1.5 ${AMBER_BOX} ${AMBER}`}>
        <Avatar by={x.agent} />
        Blocked
      </span>
    ) : (
      <span title={tip} className="inline-flex min-w-0 shrink items-center gap-1">
        <Avatar by={x.agent} />
        <span className="max-w-32 truncate">{x.name}</span>
      </span>
    )
  if (way === 'b')
    return (
      <span title={tip} className={`ml-auto inline-flex min-w-0 shrink items-center gap-1 ${blocked ? AMBER : ''}`}>
        {blocked ? <span className={DOT_AMBER} /> : null}
        <Avatar by={x.agent} />
        <span className="max-w-32 truncate">{x.name}</span>
      </span>
    )
  return (
    <span title={tip} className={`ml-auto inline-flex h-5 min-w-0 shrink items-center gap-1 rounded-md pr-1.5 pl-0.5 ${blocked ? `${AMBER_BOX} ${AMBER}` : 'bg-zinc-100 dark:bg-zinc-800'}`}>
      <Badge by={x.agent} />
      <span className="max-w-32 truncate">{x.name}</span>
      {blocked ? <span className={DOT_AMBER} /> : null}
    </span>
  )
}

// ---- the sidebar card's agent part (the desktop only) -------------------------------------------------------------

export function CardAgent({ way, s, queue }: { way: Way; s: readonly Session[]; queue: number }) {
  const b = blockedOf(s)
  const tone = b.length ? AMBER : 'text-emerald-700 dark:text-emerald-400'
  if (way === 'a')
    return (
      <span className={`inline-flex min-w-0 items-center gap-1 ${tone}`}>
        {b.length ? <Badge by={b[0].agent} /> : <Icon n="bot" c="size-3.5" sw="2" />}
        <span className="truncate">{b.length ? `${b[0].name} · blocked` : `${s.length} sessions`}</span>
      </span>
    )
  if (way === 'b')
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className={b.length ? DOT_AMBER : DOT_GREEN} />
        <span className={tone}>{b.length ? `${b.length} blocked` : `${s.length} sessions`}</span>
        <span>· {queue} in queue</span>
      </span>
    )
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Stack s={s} />
      <span className={tone}>{b.length ? `${b.length} blocked` : 'working'}</span>
    </span>
  )
}

// ---- the item page: who works on it ---------------------------------------------------------------------------------

export function ItemAgent({ way, x }: { way: Way; x: Session }) {
  const blocked = x.state === 'blocked'
  if (way === 'a')
    return blocked ? (
      <div className={`flex gap-2.5 rounded-xl px-3 py-2.5 text-[13px] leading-5 ${AMBER_BOX}`}>
        <span className="mt-px">
          <Avatar by={x.agent} />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            {whoName(x.agent)} · {x.name}
          </p>
          <p className={`break-words ${AMBER}`}>
            Blocked: {x.waitingFor} · {x.since}
          </p>
        </div>
      </div>
    ) : (
      <p className={`flex items-center gap-1.5 text-[13px] leading-5 ${MUTED}`}>
        <Avatar by={x.agent} />
        <span className="truncate">
          {whoName(x.agent)} · {x.name} · working
        </span>
      </p>
    )
  const box = blocked ? AMBER_BOX : 'bg-zinc-50 ring-1 ring-zinc-900/5 ring-inset dark:bg-zinc-900 dark:ring-white/5'
  return (
    <div className={`flex gap-2.5 rounded-xl px-3 py-2.5 text-[13px] leading-5 ${box}`}>
      <span className="mt-px">
        <Avatar by={x.agent} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className={`min-w-0 flex-1 truncate font-medium ${blocked ? 'text-amber-900 dark:text-amber-100' : ''}`}>{x.name}</span>
          {way === 'c' ? <span className={`tabular-nums ${blocked ? AMBER : MUTED}`}>{x.since ?? x.last}</span> : null}
        </p>
        <p className={`flex items-center gap-1.5 break-words ${blocked ? AMBER : MUTED}`}>
          {way === 'c' && blocked ? <span className={DOT_AMBER} /> : null}
          {blocked ? `Blocked: ${x.waitingFor}${way === 'b' ? ` (${x.since})` : ''}` : way === 'b' ? `Working · ${x.last}` : 'working'}
        </p>
      </div>
    </div>
  )
}
