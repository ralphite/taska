// T711 prototype (r1186, then r1187): the project's one active session, almost without words, in the two directions
// Gemini drew (briefs in the scratchpad, gemini-3.1-pro-preview). State is the dot alone: emerald and softly pulsing
// while the session works, amber while it is blocked on Yadong; what it is blocked on shows nowhere (r1187). The agent
// is its app's own icon, not a letter. Rows are as today. Only for the stories.
//   a. Name: the pill is the icon, the session's name cut short, the dot
//   b. Badge: the pill is the icon alone, the dot on its corner

import { Avatar } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { MUTED } from '../../ui/tones'
import { whoName } from '../../model/words'
import CLAUDE_CODE from '../assets/agent-claude-code.png'
import CODEX from '../assets/agent-codex.png'
import type { Session } from './sessions'

export type Way = 'a' | 'b'

/** The dot: emerald, pulsing, while it works; amber while it is blocked on Yadong. */
const dot = (x: Session) => (x.blocked ? 'bg-amber-500 dark:bg-amber-400' : 'animate-pulse bg-emerald-500 dark:bg-emerald-400')

/** What the tip says: the agent and the session, nothing about its state. */
export const tipOf = (x: Session) => `${whoName(x.agent)} · ${x.name}`

const ICON: Record<string, string> = { 'claude-code': CLAUDE_CODE, codex: CODEX }

/** The agent's app icon (the product's letter badge for an agent without one). `size` is its Tailwind size. */
export function AgentIcon({ by, size = 'size-5' }: { by: string; size?: string }) {
  const src = ICON[by]
  if (!src) return <Avatar by={by} />
  // Codex's tile is near black: a faint edge keeps it on the dark page
  const edge = by === 'codex' ? 'dark:ring-1 dark:ring-white/15' : ''
  return <img src={src} alt={whoName(by)} draggable={false} className={`${size} shrink-0 rounded-[22%] select-none ${edge}`} />
}

/** b: the icon with the dot on its corner. */
function Dotted({ x, big = false }: { x: Session; big?: boolean }) {
  return (
    <span className="relative flex shrink-0">
      <AgentIcon by={x.agent} size={big ? 'size-6' : 'size-5'} />
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
      <AgentIcon by={x.agent} />
      <span className="min-w-0 truncate">{x.name}</span>
      <span className={`size-2 shrink-0 rounded-full ${dot(x)}`} />
    </span>
  )
}

export function CardMark({ way, x }: { way: Way; x: Session }) {
  if (way === 'b')
    return (
      <span title={tipOf(x)} className="relative inline-flex shrink-0">
        <AgentIcon by={x.agent} size="size-4" />
        <span className={`absolute -top-0.5 -right-0.5 size-1.5 rounded-full ring-1 ring-white dark:ring-zinc-900 ${dot(x)}`} />
      </span>
    )
  return (
    <span title={tipOf(x)} className="inline-flex min-w-0 items-center gap-1">
      <AgentIcon by={x.agent} size="size-4" />
      <span className="max-w-28 truncate">{x.name}</span>
      <span className={`size-1.5 shrink-0 rounded-full ${dot(x)}`} />
    </span>
  )
}

// ---- Who works here ---------------------------------------------------------------------------------------------

/** The active session: its icon, its name, the dot. */
function Active({ way, x }: { way: Way; x: Session }) {
  return (
    <div title={tipOf(x)} className="flex h-10 items-center gap-3">
      {way === 'b' ? <Dotted x={x} /> : <AgentIcon by={x.agent} />}
      <p className="min-w-0 flex-1 truncate text-[15px] font-medium">{x.name}</p>
      {way === 'a' ? <span className={`size-2 shrink-0 rounded-full ${dot(x)}`} /> : null}
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
            <AgentIcon by={x.agent} />
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
