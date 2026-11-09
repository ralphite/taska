// The project's head: on the desktop the bar over the panes (the project's name, its tabs, whether an agent is
// around) and the Filters button the list's views end with; on the phone one head (the menu with the project's name,
// the agent pill, search) and the tabs under it. Props only.

import type { AgentTone } from '../model/agents'
import { TAB_WORD, type Tab } from '../model/words'
import { REACH_WORDS } from '../model/reach'
import { Avatar, ProjTile, pressedMark } from '../ui/bits'
import { Icon, StateIcon } from '../ui/Icon'
import { FilterDot } from '../features/list/Filters'
import { MUTED } from '../ui/tones'

const PILL: Record<AgentTone, [string, string]> = {
  ready: [
    'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25',
    'bg-emerald-500 ring-3 ring-emerald-500/25 dark:bg-emerald-400 dark:ring-emerald-400/25',
  ],
  recent: [
    'bg-zinc-100 text-zinc-700 ring-zinc-900/5 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-white/5',
    'bg-emerald-500 dark:bg-emerald-400',
  ],
  idle: ['bg-zinc-100 text-zinc-600 ring-zinc-900/5 dark:bg-zinc-800/80 dark:text-zinc-400 dark:ring-white/5', 'bg-zinc-300 dark:bg-zinc-600'],
  bad: ['bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/25', 'bg-red-500 dark:bg-red-400'],
  blocked: ['bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25', 'bg-amber-500 dark:bg-amber-400'],
}

/** "Out of reach, retrying…" while the server is away: in the agent pill's place, and on the phone over an item's page. */
export function OfflinePill() {
  return (
    <span
      role="status"
      className="flex h-8 items-center gap-2 rounded-full bg-zinc-100 px-3 text-[13px] font-medium text-zinc-600 ring-1 ring-zinc-900/5 ring-inset dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-white/5"
    >
      <Icon n="spinner" c="size-3.5 animate-spin" sw="2.25" />
      {REACH_WORDS.pill}
    </span>
  )
}

/** Whether an agent is around; "Out of reach, retrying…" while the server is away. `by`: the agent's icon alone, the
 * dot on its corner, in place of the words (T711 proposal b). */
export function AgentPill({ tone, label, offline, by }: { tone: AgentTone; label: string; offline: boolean; by?: string }) {
  return offline ? (
    <OfflinePill />
  ) : by ? (
    <span className="grid size-8 place-items-center">
      <Avatar by={by} dot={PILL[tone][1]} />
    </span>
  ) : (
    <span className={`flex h-8 max-w-52 items-center gap-2 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset ${PILL[tone][0]}`}>
      <span className={`size-2 shrink-0 rounded-full ${PILL[tone][1]}`} />
      <span className="truncate">{label}</span>
    </span>
  )
}

/** The changes that could not be saved, in one place until each is let go. */
export function NotSavedPill({ n, onOpen }: { n: number; onOpen(from: HTMLElement): void }) {
  if (!n) return null
  return (
    <button
      onClick={(e) => onOpen(e.currentTarget)}
      aria-label={`${n} not saved`}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-2.5 text-[13px] font-semibold text-red-700 ring-1 ring-red-600/20 ring-inset hover:bg-red-100 lg:px-3 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/25 dark:hover:bg-red-400/20"
    >
      <Icon n="alert" c="size-3.5" sw="2.25" />
      {n}
      <span className="hidden lg:inline">not saved</span>
    </button>
  )
}

export interface TabInfo {
  tab: Tab
  count: string | number
  selected: boolean
}

export interface AgentInfo {
  tone: AgentTone
  label: string
  tip?: string
  offline: boolean
  /** the agent's icon alone in place of the words (T711 proposal b) */
  by?: string
}

export function ProjectBar({
  title,
  tone,
  tabs,
  agent,
  notSaved,
  place,
  hidden,
  on,
}: {
  title: string
  tone: string
  tabs: TabInfo[]
  /** null: the project's data has not come yet */
  agent: AgentInfo | null
  notSaved: number
  place: string
  hidden?: boolean
  on: { tab(t: Tab): void; agents(): void; notSaved(from: HTMLElement): void }
}) {
  return (
    <nav hidden={hidden} aria-label="This project" className={`flex h-12 min-w-0 items-stretch gap-1 border-b border-zinc-200 pr-3 pl-2 dark:border-zinc-800 ${place}`}>
      <div className="my-1.5 flex max-w-72 min-w-0 items-center gap-2 px-2">
        <ProjTile title={title} tone={tone} cls="size-6 rounded-md text-xs" />
        <span className="truncate text-[15px] font-semibold">{title}</span>
      </div>
      <span className="mx-2 my-3.5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-800" />
      <div role="tablist" className="flex min-w-0 items-stretch gap-5">
        {tabs.map((t) => (
          <button
            key={t.tab}
            role="tab"
            aria-selected={t.selected}
            onClick={() => on.tab(t.tab)}
            className="group -mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-0.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50"
          >
            {TAB_WORD[t.tab]}
            <span className={`font-mono text-[11px] font-medium tabular-nums ${MUTED}`}>{t.count}</span>
          </button>
        ))}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 pl-3">
        <NotSavedPill n={notSaved} onOpen={on.notSaved} />
        {agent ? (
          <button onClick={on.agents} aria-label="Agents" title={agent.offline ? undefined : agent.tip} className="flex rounded-full hover:brightness-95 dark:hover:brightness-125">
            <AgentPill tone={agent.tone} label={agent.label} offline={agent.offline} by={agent.by} />
          </button>
        ) : null}
      </div>
    </nav>
  )
}

/** The phone's head over the list: menu, name, agent, and Search, which opens the search page (the desktop has no
 * head over the list: its search is the dialog, its filter at the end of the views' row, F479). */
export function ListHead({
  title,
  otherNeeds,
  agent,
  notSaved,
  hidden,
  pressed = false,
  on,
}: {
  title: string
  otherNeeds: boolean
  agent: AgentInfo | null
  notSaved: number
  hidden?: boolean
  /** its menu and Search pressed (a finger on them) */
  pressed?: boolean
  on: {
    menu(): void
    agents(): void
    notSaved(from: HTMLElement): void
    search(): void
  }
}) {
  return (
    <header data-part="list-head" data-tip-side="bottom" hidden={hidden} className="flex h-14 shrink-0 items-center gap-1 px-2">
      <button onClick={on.menu} aria-label="Projects and settings" {...pressedMark(pressed)} className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-left data-pressed:bg-zinc-100 dark:data-pressed:bg-zinc-800">
        <span className="relative text-zinc-700 dark:text-zinc-300">
          <Icon n="menu" c="size-6" />
          <span hidden={!otherNeeds} title="Another project needs you" className="absolute -top-1 -right-1 rounded-full bg-white dark:bg-zinc-950">
            <StateIcon s="wait" cls="size-3" />
          </span>
        </span>
        <span className="truncate text-[19px] font-semibold tracking-tight">{title}</span>
      </button>
      <NotSavedPill n={notSaved} onOpen={on.notSaved} />
      <button onClick={on.agents} aria-label="Agents" title={agent?.tip} className="flex h-11 shrink-0 items-center px-1">
        {agent ? <AgentPill tone={agent.tone} label={agent.label} offline={agent.offline} by={agent.by} /> : null}
      </button>
      <button onClick={on.search} aria-label="Search" {...pressedMark(pressed)} className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 data-pressed:bg-zinc-100 dark:text-zinc-400 dark:data-pressed:bg-zinc-800">
        <Icon n="search" c="size-5.5" />
      </button>
    </header>
  )
}

/** The phone's tabs. From 400 px the four fit with their counts; narrower, only the open one keeps its count. */
export function PhoneTabs({ tabs, filtersSet, showFilter, hidden, on }: {
  tabs: TabInfo[]
  filtersSet: boolean
  showFilter: boolean
  hidden?: boolean
  on: { tab(t: Tab): void; filters(): void }
}) {
  return (
    <nav data-part="tabs" hidden={hidden} className="flex h-11 shrink-0 items-stretch border-b border-zinc-200 pr-1 pl-4 dark:border-zinc-800">
      <div role="tablist" className="flex min-w-0 [scrollbar-width:none] items-stretch gap-2 overflow-x-auto wide-phone:gap-4">
        {tabs.map((t) => (
          <button
            key={t.tab}
            role="tab"
            aria-selected={t.selected}
            onClick={() => on.tab(t.tab)}
            className="group -mb-px flex h-11 shrink-0 items-center gap-0.5 border-b-2 border-transparent text-[14px] font-medium text-zinc-500 aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 wide-phone:gap-1 wide-phone:text-[15px] dark:text-zinc-400 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50"
          >
            {/* as wide picked as not (its bold word held unseen under it): the tabs keep their places */}
            <span className="grid">
              <span className="col-start-1 row-start-1">{TAB_WORD[t.tab]}</span>
              <span aria-hidden className="invisible col-start-1 row-start-1 font-semibold">
                {TAB_WORD[t.tab]}
              </span>
            </span>
            <span
              className={`rounded-full px-1.5 py-px font-mono text-[11px] font-medium tabular-nums group-aria-selected:bg-zinc-900/7 group-aria-selected:text-zinc-600 empty:hidden dark:group-aria-selected:bg-white/10 dark:group-aria-selected:text-zinc-300 ${MUTED}`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>
      <button onClick={on.filters} aria-label="Filters" hidden={!showFilter} className="relative ml-auto grid size-11 shrink-0 place-items-center text-zinc-500 dark:text-zinc-400">
        <Icon n="sliders" c="size-5" />
        <FilterDot on={filtersSet} />
      </button>
    </nav>
  )
}

/** The filters set, each a chip that takes it off. */
