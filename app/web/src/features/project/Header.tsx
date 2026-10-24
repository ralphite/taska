// The project's head: on the desktop the bar over the panes (the project's name, its tabs, whether an agent is
// around), and the list's head (its search, the filters button); on the phone one head (the menu with the project's
// name, the agent pill, search) and the tabs under it. Props only.

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { AgentTone } from '../../model/agents'
import { TAB_WORD, type Tab } from '../../model/words'
import { ProjTile } from '../../ui/bits'
import { Icon } from '../../ui/Icon'
import { HIT } from '../../ui/tones'

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
}

/** Whether an agent is around; "Offline, retrying…" while the server is away. */
export function AgentPill({ tone, label, offline }: { tone: AgentTone; label: string; offline: boolean }) {
  return offline ? (
    <span
      role="status"
      className="flex h-8 items-center gap-2 rounded-full bg-zinc-100 px-3 text-[13px] font-medium text-zinc-600 ring-1 ring-zinc-900/5 ring-inset dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-white/5"
    >
      <Icon n="spinner" c="size-3.5 animate-spin" sw="2.25" />
      Offline, retrying…
    </span>
  ) : (
    <span className={`flex h-8 max-w-44 items-center gap-2 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset ${PILL[tone][0]}`}>
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
            <span className="font-mono text-[11px] font-medium text-zinc-400 tabular-nums">{t.count}</span>
          </button>
        ))}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 pl-3">
        <NotSavedPill n={notSaved} onOpen={on.notSaved} />
        {agent ? (
          <button onClick={on.agents} title={agent.offline ? undefined : agent.tip} className="flex rounded-full hover:brightness-95 dark:hover:brightness-125">
            <AgentPill tone={agent.tone} label={agent.label} offline={agent.offline} />
          </button>
        ) : null}
      </div>
    </nav>
  )
}

/** The list's head: the phone's head (menu, name, agent, search) or, on the desktop and while searching, the search. */
export function ListHead({
  phone,
  title,
  otherNeeds,
  searching,
  q,
  placeholder,
  agent,
  notSaved,
  filtersSet,
  filtersOpen,
  place,
  hidden,
  searchRef,
  on,
}: {
  phone: boolean
  title: string
  otherNeeds: boolean
  searching: boolean
  q: string
  placeholder: string
  agent: AgentInfo | null
  notSaved: number
  filtersSet: boolean
  filtersOpen: boolean
  place: string
  hidden?: boolean
  /** the search field's element, for the keys (/ goes there) */
  searchRef?: (el: HTMLInputElement | null) => void
  on: {
    menu(): void
    agents(): void
    notSaved(from: HTMLElement): void
    search(on: boolean): void
    query(q: string): void
    clear(): void
    firstResult(): void
    filters(): void
  }
}) {
  const showSearch = !phone || searching || !!q
  const input = useRef<HTMLInputElement | null>(null)
  useLayoutEffect(() => {
    const el = input.current
    if (el && el.value !== q && document.activeElement !== el) el.value = q
  })
  return (
    <header data-tip-side="bottom" hidden={hidden} className={`flex h-14 shrink-0 items-center gap-1 px-2 lg:gap-2 lg:border-r lg:border-b lg:border-zinc-200 lg:px-3 dark:lg:border-zinc-800 ${place}`}>
      <div hidden={showSearch} className="contents">
        <button onClick={on.menu} aria-label="Projects and settings" className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-left data-pressed:bg-zinc-100 dark:data-pressed:bg-zinc-800">
          <span className="relative text-zinc-700 dark:text-zinc-300">
            <Icon n="menu" c="size-6" />
            <span
              hidden={!otherNeeds}
              title="Another project needs you"
              className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:bg-amber-400 dark:ring-zinc-950"
            />
          </span>
          <span className="truncate text-[19px] font-semibold tracking-tight">{title}</span>
        </button>
        <NotSavedPill n={notSaved} onOpen={on.notSaved} />
        <button onClick={on.agents} aria-label="Agents" title={agent?.tip} className="flex h-11 shrink-0 items-center px-1">
          {agent ? <AgentPill tone={agent.tone} label={agent.label} offline={agent.offline} /> : null}
        </button>
        <button
          onClick={() => {
            // the field takes the focus in the tap itself, or the phone's keyboard does not come up
            flushSync(() => on.search(true))
            input.current?.focus()
          }}
          aria-label="Search" className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-500 data-pressed:bg-zinc-100 dark:text-zinc-400 dark:data-pressed:bg-zinc-800">
          <Icon n="search" c="size-5.5" />
        </button>
      </div>
      <div hidden={!showSearch} className="contents">
        <label className="ml-1 flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-zinc-100 pl-3 text-zinc-400 lg:ml-0 lg:h-9 lg:ring-blue-500/40 lg:focus-within:bg-white lg:focus-within:ring-2 dark:bg-zinc-800 dark:text-zinc-500 dark:lg:focus-within:bg-zinc-900">
          <Icon n="search" c="size-4.5" />
          <input
            ref={(el) => {
              input.current = el
              searchRef?.(el)
            }}
            type="search"
            autoComplete="off"
            placeholder={placeholder}
            defaultValue={q}
            className="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 lg:text-sm dark:text-zinc-100 [&::-webkit-search-cancel-button]:hidden"
            onInput={(e) => on.query(e.currentTarget.value)}
            onFocus={() => phone && !searching && on.search(true)}
            onKeyDown={(e) => {
              if (phone || !(e.key === 'ArrowDown' || (e.key === 'Enter' && !e.nativeEvent.isComposing))) return
              e.preventDefault()
              e.currentTarget.blur()
              on.firstResult()
            }}
          />
          <kbd className={`mr-2 hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-600 ${q ? '' : 'lg:grid'}`}>/</kbd>
          <button onClick={on.clear} aria-label="Clear search" className={`group -mr-1 grid size-11 shrink-0 place-items-center rounded-full lg:size-9 ${q ? '' : 'lg:hidden'}`}>
            <span className="grid size-5 place-items-center rounded-full bg-zinc-400 text-white group-hover:bg-zinc-500 dark:bg-zinc-600 dark:text-zinc-900 dark:group-hover:bg-zinc-500">
              <Icon n="x" c="size-3" sw="3" />
            </span>
          </button>
        </label>
        <button onClick={() => on.search(false)} className="h-11 shrink-0 px-2.5 text-[15px] font-medium text-blue-600 lg:hidden dark:text-blue-400">
          Cancel
        </button>
      </div>
      <button
        onClick={on.filters}
        title="Filters · F"
        aria-label="Filters"
        aria-expanded={filtersOpen}
        className="relative hidden size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 aria-expanded:bg-zinc-100 lg:grid dark:text-zinc-400 dark:hover:bg-zinc-800 dark:aria-expanded:bg-zinc-800"
      >
        <Icon n="sliders" c="size-[18px]" />
        <FilterDot on={filtersSet} />
      </button>
    </header>
  )
}

export const FilterDot = ({ on }: { on: boolean }) =>
  on ? <span className="absolute top-2 right-2 size-2 rounded-full bg-blue-600 ring-2 ring-white dark:bg-blue-400 dark:ring-zinc-950" /> : null

/** The phone's tabs. From 400 px the four fit with their counts; narrower, only the open one keeps its count. */
export function PhoneTabs({ tabs, filtersSet, showFilter, pendingTitle, hidden, on }: {
  tabs: TabInfo[]
  filtersSet: boolean
  showFilter: boolean
  pendingTitle?: string
  hidden?: boolean
  on: { tab(t: Tab): void; filters(): void }
}) {
  return (
    <nav hidden={hidden} className="flex h-11 shrink-0 items-stretch border-b border-zinc-200 pr-1 pl-4 dark:border-zinc-800">
      <div role="tablist" className="flex min-w-0 [scrollbar-width:none] items-stretch gap-2 overflow-x-auto wide-phone:gap-4">
        {tabs.map((t) => (
          <button
            key={t.tab}
            role="tab"
            aria-selected={t.selected}
            onClick={() => on.tab(t.tab)}
            className="group -mb-px flex h-11 shrink-0 items-center gap-0.5 border-b-2 border-transparent text-[14px] font-medium text-zinc-500 aria-selected:border-zinc-900 aria-selected:font-semibold aria-selected:text-zinc-900 wide-phone:gap-1 wide-phone:text-[15px] dark:text-zinc-400 dark:aria-selected:border-zinc-100 dark:aria-selected:text-zinc-50"
          >
            {TAB_WORD[t.tab]}
            <span
              title={t.tab === 'inputs' ? pendingTitle : undefined}
              className="rounded-full px-1.5 py-px font-mono text-[11px] font-medium text-zinc-400 tabular-nums group-aria-selected:bg-zinc-900/7 group-aria-selected:text-zinc-600 group-aria-[selected=false]:px-0.5 empty:hidden wide-phone:group-aria-[selected=false]:px-1 dark:text-zinc-500 dark:group-aria-selected:bg-white/10 dark:group-aria-selected:text-zinc-300"
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
export function FilterChips({ set, onUnset }: { set: [string, ReactNode][]; onUnset(k: string): void }) {
  return (
    <>
      {set.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onUnset(k)}
          className={`${HIT} flex h-8 shrink-0 items-center gap-1 rounded-full bg-blue-50 pr-2 pl-3 text-[13px] font-medium text-blue-800 ring-1 ring-blue-200 ring-inset hover:bg-blue-100 lg:h-7 dark:bg-blue-400/10 dark:text-blue-200 dark:ring-blue-400/25 dark:hover:bg-blue-400/20`}
        >
          {label}
          <Icon n="x" c="size-3.5" sw="2.25" />
        </button>
      ))}
    </>
  )
}

/** The phone's row of the filters set, under the tabs, with Clear. */
export function FilterStrip({ set, hidden, onUnset, onReset }: { set: [string, ReactNode][]; hidden: boolean; onUnset(k: string): void; onReset(): void }) {
  return (
    <div hidden={hidden} className="flex h-11 shrink-0 [scrollbar-width:none] items-center gap-2 overflow-x-auto border-b border-zinc-100 px-4 lg:hidden dark:border-zinc-800/70">
      <FilterChips set={set} onUnset={onUnset} />
      <button onClick={onReset} className="ml-auto h-11 shrink-0 px-1 text-[13px] font-semibold text-blue-600 hover:underline dark:text-blue-400">
        Clear
      </button>
    </div>
  )
}
