// The home page: one table of the projects and what needs you in each; a search across every project (the phone: a
// field; the desktop: the search dialog, F479); New project in a popover (the phone: a sheet), and with no projects yet one line and its button; a deleted project's old link says so
// (Restore), and so does a project that never was. Props only.

import type { MouseEvent, Ref } from 'react'
import { foundLine, foundPath, type FindAnswer, type FindPhase } from '../../model/find'
import { REACH_WORDS } from '../../model/reach'
import { noMatches, plural } from '../../model/words'
import { Icon } from '../../ui/Icon'
import { Hit, NeedsCount, ProjTile, Skeleton } from '../../ui/bits'
import { MUTED, PRIMARY } from '../../ui/tones'

export interface HomeRow {
  name: string
  title: string
  tone: string
  open: number
  needs: number
  /** the agent last heard of, and whether it is around */
  agent: { name: string; on: boolean; blocked: boolean } | null
  /** the first of what needs you there */
  next: { code: string; title: string } | null
}

export interface HomeFacts {
  /** null: not listed yet */
  rows: HomeRow[] | null
  needs: number
  /** Taska does not answer: what shows was kept from before */
  away: boolean
  /** a deleted project's link: its name, and what Restore came to */
  gone: { name: string; said: string } | null
  /** a project that never was */
  none: string | null
  q: string
  /** where the search is (the Finder's, app/search), and its last answer (faded while the next words are asked) */
  search: { phase: FindPhase; answer: FindAnswer | null }
}

export interface HomeEvents {
  /** the phone's search field */
  query(q: string): void
  /** the desktop's search (F479): the dialog, as ⌘K */
  search(): void
  restore(): void
  closeGone(): void
  closeNone(): void
  /** New project, from its button: a popover there on the desktop, a sheet on the phone (D115 #7) */
  startNew(from: HTMLElement): void
  /** a place in Taska, opened in the page */
  open(url: string): void
}

const GRID = 'lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)_4.5rem_5.5rem_minmax(0,2.1fr)]'
const NOTE = 'mb-3 rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
/** A notice about the link you came by (a deleted project, none of that name): one bar, its × at its end. */
const NOTICE = 'mb-3 flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-950 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/25'
const NOTICE_X = 'relative grid size-9 shrink-0 place-items-center rounded-lg after:absolute after:-inset-1 text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-400/15'

function AgentCell({ agent }: { agent: HomeRow['agent'] }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
      <span className={`size-1.5 shrink-0 rounded-full ${agent?.blocked ? 'bg-amber-500' : agent?.on ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
      <span className="truncate">{!agent ? 'No agent' : agent.blocked ? agent.name + ' · blocked' : agent.on ? agent.name : agent.name + ' · idle'}</span>
    </span>
  )
}

export function Home({ facts, on, searchRef }: { facts: HomeFacts; on: HomeEvents; searchRef?: Ref<HTMLInputElement> }) {
  const { rows, needs, away, gone, none, q, search } = facts
  const { phase, answer } = search
  // what shows under the box: the results (faded while the next words are asked), nothing found, refused, out of reach
  const card = !!q.trim() && (phase === 'searching' ? !!answer : phase === 'found' || phase === 'nothing' || phase === 'failed' || phase === 'offline')
  // a link opens in the page; with Cmd or Ctrl, in a new tab as links do
  const follow = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    on.open(e.currentTarget.getAttribute('href') || '/')
  }
  return (
    <main className="mx-auto max-w-[1200px] px-3 pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:px-10 lg:pt-8">
      <header data-tip-side="bottom" className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-1 py-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Icon n="logo" c="size-6 text-blue-600 dark:text-blue-400" sw="2.25" />
          Taska
        </h1>
        <span className="hidden text-sm text-zinc-500 sm:inline dark:text-zinc-400">{rows?.length ? `${plural(rows.length, 'project')} · ${needs ? `${needs} need you` : 'nothing needs you'}` : ''}</span>
        <span className="flex-1" />
        <button
          hidden={!!rows && !rows.length}
          onClick={on.search}
          title="Search · ⌘K"
          aria-label="Search"
          className="hidden size-10 place-items-center rounded-xl bg-white text-zinc-600 ring-1 ring-zinc-900/10 hover:bg-zinc-50 hover:text-zinc-900 lg:grid dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-zinc-700 dark:hover:text-white"
        >
          <Icon n="search" c="size-[18px]" />
        </button>
        {/* no projects: nothing to search, only New project below */}
        <label hidden={!!rows && !rows.length} className={`order-last flex h-10 w-full items-center gap-2 rounded-xl bg-white px-3 text-sm ring-1 ring-zinc-900/10 focus-within:ring-2 focus-within:ring-blue-500 sm:order-none sm:w-72 lg:hidden dark:bg-zinc-800 dark:ring-white/10 ${MUTED}`}>
          <Icon n="find" c="size-4" sw="2" />
          <input
            ref={searchRef}
            type="search"
            autoComplete="off"
            placeholder="Search every project"
            aria-label="Search every project"
            value={q}
            onChange={(e) => on.query(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return
              on.query('')
              e.currentTarget.blur()
            }}
            className="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-400 sm:text-sm dark:text-zinc-100"
          />
        </label>
      </header>
      {gone ? (
        <div className={NOTICE}>
          <span className="min-w-0 flex-1">{gone.said || `“${gone.name}” deleted`}</span>
          {/* refused (its reason said): Restore again would not help */}
          {gone.said ? null : (
            <button onClick={on.restore} className="h-9 shrink-0 rounded-lg bg-white px-3 font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100 dark:bg-zinc-800 dark:text-amber-100 dark:ring-amber-400/30">
              Restore
            </button>
          )}
          <button aria-label="Close" onClick={on.closeGone} className={NOTICE_X}>
            <Icon n="x" c="size-4" />
          </button>
        </div>
      ) : null}
      {none ? (
        <div className={NOTICE}>
          <span className="min-w-0 flex-1">No project {`“${none}”`}</span>
          <button aria-label="Close" onClick={on.closeNone} className={NOTICE_X}>
            <Icon n="x" c="size-4" />
          </button>
        </div>
      ) : null}
      {away && rows ? <div className={NOTE}>{REACH_WORDS.out}</div> : null}
      {card ? (
        <div className={`mb-3 overflow-hidden rounded-xl ${phase === 'searching' ? 'opacity-60' : ''} bg-white ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10`}>
          {phase === 'failed' || phase === 'offline' ? (
            <p className="px-4 py-3 text-sm text-zinc-500">{phase === 'failed' ? 'Search failed' : REACH_WORDS.out}</p>
          ) : answer?.found.length ? (
            answer.found.slice(0, 12).map((x) => {
              const line = foundLine(x)
              return (
                <a
                  key={x.project + x.key}
                  href={foundPath(x)}
                  onClick={follow}
                  className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-2.5 text-sm last:border-b-0 hover:bg-zinc-50 dark:border-zinc-700/60 dark:hover:bg-zinc-700/40"
                >
                  <span className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">{line.code}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <Hit text={line.title} words={answer.marks} />
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {answer.titles[x.project] || x.project}
                    {line.where}
                  </span>
                </a>
              )
            })
          ) : (
            <p className="px-4 py-3 text-sm text-zinc-500">{noMatches(q)}</p>
          )}
        </div>
      ) : null}
      {rows && !rows.length ? (
        // no projects yet: one line and one button, no table (D115 #7)
        <div className="flex flex-col items-center gap-4 rounded-xl bg-white px-4 py-12 text-center ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
          <p className="text-[15px] text-zinc-600 dark:text-zinc-300">No projects yet</p>
          <button onClick={(e) => on.startNew(e.currentTarget)} className={PRIMARY}>
            <Icon n="plus" c="size-4" sw="2" />
            New project
          </button>
        </div>
      ) : (
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
        <div className={`hidden ${GRID} gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-500 lg:grid dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400`}>
          <span>Project</span>
          <span>Agent</span>
          <span>Open</span>
          <span>Needs you</span>
          <span>Next for you</span>
        </div>
        <ul>
          {!rows ? (
            <li className={away ? 'px-4 py-3 text-sm text-zinc-500' : ''}>{away ? REACH_WORDS.out : <Skeleton shape="tile" cls="px-1 py-1.5" />}</li>
          ) : (
            rows.map((p) => {
              const next = p.next ? (
                <>
                  <span className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">{p.next.code}</span> {p.next.title}
                </>
              ) : (
                <span className="text-zinc-300 dark:text-zinc-600">—</span>
              )
              return (
                <li key={p.name} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-700/60">
                  <a
                    href={`/p/${encodeURIComponent(p.name)}/`}
                    onClick={follow}
                    className={`flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-100 active:bg-zinc-200/70 lg:grid ${GRID} lg:px-4 lg:py-3 lg:text-[13px] dark:hover:bg-zinc-700/60 dark:active:bg-zinc-700`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <ProjTile title={p.title || p.name} tone={p.tone} cls="size-8 rounded-lg text-sm lg:size-6 lg:rounded-md lg:text-xs" />
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold lg:text-[13px]">{p.title || p.name}</span>
                        <span className="block truncate text-xs text-zinc-500 lg:hidden dark:text-zinc-400">{p.next ? next : `${p.open} open`}</span>
                      </span>
                    </span>
                    <span className="hidden lg:flex">
                      <AgentCell agent={p.agent} />
                    </span>
                    <span className="hidden tabular-nums lg:block">{p.open}</span>
                    <span className="ml-auto shrink-0 lg:ml-0">
                      {p.needs ? (
                        <NeedsCount n={p.needs} />
                      ) : (
                        <span className="hidden text-zinc-300 lg:inline dark:text-zinc-600">—</span>
                      )}
                    </span>
                    <span className="hidden min-w-0 truncate text-zinc-600 lg:block dark:text-zinc-300">{next}</span>
                  </a>
                </li>
              )
            })
          )}
        </ul>
      </div>
      )}
      {rows?.length ? (
        <button onClick={(e) => on.startNew(e.currentTarget)} className="mt-1 flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium text-blue-600 lg:w-auto dark:text-blue-400">
          <Icon n="plus" c="size-5" />
          New project
        </button>
      ) : null}
    </main>
  )
}
