// The home page: one table of the projects and what needs you in each; a search across every project; a new
// project made in place; a deleted project's old link says so (Restore), and so does a project that never was.
// Props only.

import { useState, type MouseEvent, type Ref } from 'react'
import type { SearchHit } from '../../model/types'
import { inputCode } from '../../model/words'
import { Icon } from '../../ui/Icon'
import { ProjTile } from '../../ui/bits'

export interface HomeRow {
  name: string
  title: string
  tone: string
  open: number
  needs: number
  /** the agent last heard of, and whether it is around */
  agent: { name: string; on: boolean } | null
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
  /** the last answer to the search (shown while words are typed) */
  hits: SearchHit[] | null
  /** the new project's row is open; why it was not made */
  making: { error: string } | null
}

export interface HomeEvents {
  query(q: string): void
  restore(): void
  closeGone(): void
  closeNone(): void
  startNew(): void
  cancelNew(): void
  create(title: string): void
  /** a place in Taska, opened in the page */
  open(url: string): void
}

const GRID = 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_5.5rem_minmax(0,2.4fr)]'
const NOTE = 'mb-3 rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'

const hitUrl = (x: SearchHit, q: string) => `/p/${encodeURIComponent(x.project)}/${x.kind === 'input' ? 'inputs?q=' + encodeURIComponent(q.trim()) : encodeURIComponent(x.code)}`
const hitWhere = (x: SearchHit) => (x.kind === 'input' ? ' · what you said' : x.archived ? ' · archived' : x.status === 'done' ? ' · done' : x.status === 'dropped' ? " · won't do" : '')

function AgentCell({ agent }: { agent: HomeRow['agent'] }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
      <span className={`size-1.5 shrink-0 rounded-full ${agent?.on ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
      <span className="truncate">{!agent ? 'No agent' : agent.on ? agent.name : agent.name + ' · idle'}</span>
    </span>
  )
}

function NewProject({ making, on }: { making: { error: string } | null; on: HomeEvents }) {
  const [title, setTitle] = useState('')
  const [field, setField] = useState<HTMLInputElement | null>(null)
  const create = () => (title.trim() ? on.create(title.trim()) : field?.focus()) // any name: spaces, Chinese, emoji
  if (!making)
    return (
      <button onClick={on.startNew} className="mt-1 flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium text-blue-600 dark:text-blue-400">
        <Icon n="plus" c="size-5" />
        New project
      </button>
    )
  return (
    <div className="mt-1 px-1">
      <div className="flex items-center gap-1.5">
        <input
          ref={setField}
          autoFocus
          className="h-11 w-full min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
          placeholder="Project name"
          aria-label="New project name"
          autoComplete="off"
          spellCheck={false}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              create()
            }
            if (e.key === 'Escape') on.cancelNew()
          }}
        />
        <button onClick={create} className="h-11 shrink-0 rounded-xl bg-zinc-900 px-4 text-[15px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
          Create
        </button>
        <button aria-label="Cancel" onClick={on.cancelNew} className="grid size-11 shrink-0 place-items-center rounded-xl text-zinc-500">
          <Icon n="x" c="size-4" sw="2" />
        </button>
      </div>
      {making.error ? (
        <p role="alert" className="px-2 pt-1.5 text-[13px] text-red-600 dark:text-red-400">
          {making.error}
        </p>
      ) : null}
    </div>
  )
}

export function Home({ facts, on, searchRef }: { facts: HomeFacts; on: HomeEvents; searchRef?: Ref<HTMLInputElement> }) {
  const { rows, needs, away, gone, none, q, hits } = facts
  // a link opens in the page; with Cmd or Ctrl, in a new tab as links do
  const follow = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    on.open(e.currentTarget.getAttribute('href') || '/')
  }
  return (
    <main className="mx-auto max-w-[1200px] px-3 pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:px-10 lg:pt-8">
      <header className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-1 py-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Icon n="logo" c="size-6 text-blue-600 dark:text-blue-400" sw="2.25" />
          Taska
        </h1>
        <span className="hidden text-sm text-zinc-500 sm:inline dark:text-zinc-400">{rows ? `${rows.length} projects · ${needs ? `${needs} need you` : 'nothing needs you'}` : ''}</span>
        <span className="flex-1" />
        <label className="order-last flex h-10 w-full items-center gap-2 rounded-xl bg-white px-3 text-sm text-zinc-400 ring-1 ring-zinc-900/10 focus-within:ring-2 focus-within:ring-blue-500 sm:order-none sm:w-72 dark:bg-zinc-800 dark:ring-white/10">
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
            className="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 sm:text-sm dark:text-zinc-100"
          />
          <kbd className="hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold ring-1 ring-zinc-300 lg:grid dark:ring-zinc-600">⌘K</kbd>
        </label>
      </header>
      {gone ? (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/25">
          <span className="min-w-0 flex-1">{gone.said || `Project “${gone.name}” deleted. Restore it, or pick another below.`}</span>
          <button onClick={on.restore} className="h-9 shrink-0 rounded-lg bg-white px-3 font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100 dark:bg-zinc-800 dark:text-amber-100 dark:ring-amber-400/30">
            Restore
          </button>
          <button aria-label="Close" onClick={on.closeGone} className="grid size-9 shrink-0 place-items-center rounded-lg text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-400/15">
            {'✕'}
          </button>
        </div>
      ) : null}
      {none ? (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
          <span className="min-w-0 flex-1">There is no project {`“${none}”`}. Pick one below.</span>
          <button aria-label="Close" onClick={on.closeNone} className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700">
            {'✕'}
          </button>
        </div>
      ) : null}
      {away && rows ? <div className={NOTE}>{'Taska is out of reach, retrying…'}</div> : null}
      {hits && q.trim() ? (
        <div className="mb-3 overflow-hidden rounded-xl bg-white ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
          {hits.length ? (
            hits.slice(0, 12).map((x) => (
              <a
                key={x.project + x.code}
                href={hitUrl(x, q)}
                onClick={follow}
                className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-2.5 text-sm last:border-b-0 hover:bg-zinc-50 dark:border-zinc-700/60 dark:hover:bg-zinc-700/40"
              >
                <span className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">{inputCode(x.code)}</span>
                <span className="min-w-0 flex-1 truncate">{x.title}</span>
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {x.ptitle || x.project}
                  {hitWhere(x)}
                </span>
              </a>
            ))
          ) : (
            <p className="px-4 py-3 text-sm text-zinc-500">Nothing found</p>
          )}
        </div>
      ) : null}
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
            <li className="px-4 py-3 text-sm text-zinc-500">{away ? 'Taska is out of reach, retrying…' : 'Loading…'}</li>
          ) : !rows.length ? (
            <li className="px-4 py-3 text-sm text-zinc-500">No projects yet.</li>
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
                    className={`flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-100 active:bg-zinc-200/70 lg:grid ${GRID} lg:px-4 lg:py-3 lg:text-[13px] dark:hover:bg-zinc-700/60`}
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
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">{p.needs}</span>
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
      <NewProject making={facts.making} on={on} />
    </main>
  )
}
