// The home page (F251 B): one table of the projects, what needs you in each, and one button that goes through all of
// it; search across every project; a new project in place (B131); a deleted project's old link says so (B287).
import { useEffect, useRef, useState } from 'react'
import { AGENT_NAME, PROJ_TONES } from '../lib/constants'
import { projHash } from '../lib/state'
import type { Need, ProjectRow } from '../lib/types'
import { navigate } from '../lib/switch'

// The same colour per project as inside it (B78): from the name, the next free one when two would share
function tones(names: string[]) {
  const taken = new Set<number>(),
    m = new Map<string, string>()
  for (const n of [...new Set(names)].sort()) {
    let i = projHash(n) % PROJ_TONES.length
    for (let k = 0; k < PROJ_TONES.length && taken.has(i); k++) i = (i + 1) % PROJ_TONES.length
    taken.add(i)
    m.set(n, PROJ_TONES[i])
  }
  return m
}
function AgentCell({ p }: { p: ProjectRow }) {
  // the agent last heard of: green while it is around, gray once it went quiet
  const a = [...(p.agents || [])].sort((x, y) => y.t - x.t)[0]
  const on = !!a && (a.waiting || Date.now() - a.t < 10 * 60e3),
    name = a ? AGENT_NAME[a.name] || a.name : 'No agent'
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
      <span className={`size-1.5 shrink-0 rounded-full ${on ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
      <span className="truncate">{on ? name : a ? name + ' · idle' : name}</span>
    </span>
  )
}
interface Hit {
  project: string
  ptitle?: string
  kind: string
  code: string
  title: string
  archived?: boolean
  status?: string
}
const json = async <T,>(url: string, init?: RequestInit): Promise<T> =>
  (await fetch(url, { cache: 'no-store', ...init })).json() as Promise<T>
const POST = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const order = (l: ProjectRow[]) => l.sort((a, b) => (a.pos ?? 1e9) - (b.pos ?? 1e9) || (b.t || 0) - (a.t || 0)) // your order (F253), else the latest first
/** T293: the last list this browser saw, drawn at once while Taska is asked. */
function keptHome(): { list: ProjectRow[]; needs: Need[] } | null {
  try {
    const k = JSON.parse(localStorage.getItem('taska.home') || 'null') as { list: ProjectRow[]; needs: Need[] } | null
    return k && Array.isArray(k.list) ? { list: order(k.list), needs: k.needs || [] } : null
  } catch {
    return null
  }
}

export function Home() {
  const [list, setList] = useState<ProjectRow[] | null>(() => keptHome()?.list ?? null)
  const [needs, setNeeds] = useState<Need[]>(() => keptHome()?.needs ?? [])
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [np, setNp] = useState(false)
  const [npErr, setNpErr] = useState('')
  const [gone, setGone] = useState(() => new URLSearchParams(location.search).get('gone'))
  const [goneText, setGoneText] = useState('')
  const qRef = useRef<HTMLInputElement>(null),
    npRef = useRef<HTMLInputElement>(null)
  const load = () =>
    Promise.all([json<ProjectRow[]>('/api/projects'), json<Need[]>('/api/needs').catch(() => [] as Need[])]).then(
      ([l, n]) => {
        try {
          localStorage.setItem('taska.home', JSON.stringify({ list: l, needs: n }))
        } catch {
          /* no room */
        }
        setList(order(l))
        setNeeds(n)
      },
    )
  useEffect(() => {
    load().catch(() => {})
    if (gone) history.replaceState(null, '', '/')
    const show = (e: PageTransitionEvent) => {
      if (e.persisted) void load()
    } // back from a project: fresh counts
    const key = (e: KeyboardEvent) => {
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') ||
        (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || ''))
      ) {
        e.preventDefault()
        qRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === qRef.current) {
        setQ('')
        qRef.current?.blur()
      }
    }
    addEventListener('pageshow', show)
    addEventListener('keydown', key)
    return () => {
      removeEventListener('pageshow', show)
      removeEventListener('keydown', key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Search every project (F196): asked once the typing pauses
  useEffect(() => {
    const s = q.trim()
    if (!s) return
    const t = setTimeout(async () => {
      let r: Hit[] = []
      try {
        r = await json<Hit[]>(`/api/search?q=${encodeURIComponent(s)}`)
      } catch {
        /* none */
      }
      setHits(r)
    }, 250)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => {
    if (np) npRef.current?.focus()
  }, [np])
  const tone = tones((list || []).map((p) => p.name)),
    top = (name: string) => needs.find((x) => x.project === name)
  const total = needs.length
  const npCreate = async () => {
    const title = (npRef.current?.value || '').trim() // any name: spaces, Chinese, emoji (F173)
    if (!title) return npRef.current?.focus()
    try {
      const d = await json<{ ok: boolean; name: string; error?: string }>('/api/projects', POST({ title }))
      if (d.ok) navigate(`/p/${d.name}/`)
      else setNpErr(d.error || 'Not created')
    } catch {
      setNpErr('Connection lost; try again')
    }
  }
  return (
    <main className="mx-auto max-w-[1200px] px-3 pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:px-10 lg:pt-8">
      <header className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-1 py-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <svg
            className="size-6 text-blue-600 dark:text-blue-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M13 5h8M13 12h8M13 19h8M3 17l2 2 4-4M3 7l2 2 4-4" />
          </svg>
          Taska
        </h1>
        <span id="sum" className="hidden text-sm text-zinc-500 sm:inline dark:text-zinc-400">
          {list ? `${list.length} projects · ${total ? `${total} need you` : 'nothing needs you'}` : ''}
        </span>
        <span className="flex-1" />
        <label className="order-last flex h-10 w-full items-center gap-2 rounded-xl bg-white px-3 text-sm text-zinc-400 ring-1 ring-zinc-900/10 focus-within:ring-2 focus-within:ring-blue-500/40 sm:order-none sm:w-72 dark:bg-zinc-800 dark:ring-white/10">
          <svg
            className="size-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="q"
            ref={qRef}
            type="search"
            autoComplete="off"
            placeholder="Search every project"
            aria-label="Search every project"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 sm:text-sm dark:text-zinc-100"
          />
          <kbd className="hidden h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold ring-1 ring-zinc-300 lg:grid dark:ring-zinc-600">
            ⌘K
          </kbd>
        </label>
        <button
          id="goAll"
          hidden={!total}
          onClick={() => {
            // Go through everything that needs you: it starts in the project of the first one and goes on project by project
            const x = needs[0]
            if (!x) return
            try {
              sessionStorage.setItem('taska.go.start', x.project)
              sessionStorage.setItem('taska.go.all', '1')
            } catch {
              /* no storage */
            }
            navigate(`/p/${encodeURIComponent(x.project)}/`)
          }}
          className="h-10 shrink-0 rounded-xl bg-amber-500 px-3.5 text-sm font-semibold text-amber-950 hover:brightness-95 dark:bg-amber-400"
        >
          Go through {total}
        </button>
      </header>
      {gone ? (
        <div
          id="gone"
          className="mb-3 flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/25"
        >
          <span id="goneText" className="min-w-0 flex-1">
            {goneText || `The project “${gone}” was deleted. Restore it, or pick another project below.`}
          </span>
          <button
            id="goneRestore"
            onClick={async () => {
              try {
                const d = await json<{ ok: boolean; error?: string }>('/api/projects/restore', POST({ name: gone }))
                if (d.ok) navigate(`/p/${encodeURIComponent(gone)}/`)
                else setGoneText(d.error || 'Not restored')
              } catch {
                setGoneText('Connection lost; try again')
              }
            }}
            className="h-9 shrink-0 rounded-lg bg-white px-3 font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100 dark:bg-zinc-800 dark:text-amber-100 dark:ring-amber-400/30"
          >
            Restore
          </button>
          <button
            id="goneClose"
            aria-label="Close"
            onClick={() => setGone(null)}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-400/15"
          >
            ✕
          </button>
        </div>
      ) : null}
      {hits && q.trim() ? (
        <div
          id="hits"
          className="mb-3 overflow-hidden rounded-xl bg-white ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10"
        >
          {hits.length ? (
            hits.slice(0, 12).map((x) => (
              <a
                key={x.project + x.code}
                href={`/p/${encodeURIComponent(x.project)}/${x.kind === 'input' ? 'inputs?q=' + encodeURIComponent(q.trim()) : encodeURIComponent(x.code)}`}
                className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-2.5 text-sm last:border-b-0 hover:bg-zinc-50 dark:border-zinc-700/60 dark:hover:bg-zinc-700/40"
              >
                <span className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  {String(x.code).replace(/^r(\d+)$/, '#$1')}
                </span>
                <span className="min-w-0 flex-1 truncate">{x.title}</span>
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {x.ptitle || x.project}
                  {x.kind === 'input'
                    ? ' · what you said'
                    : x.archived
                      ? ' · archived'
                      : x.status === 'done'
                        ? ' · done'
                        : x.status === 'dropped'
                          ? " · won't do"
                          : ''}
                </span>
              </a>
            ))
          ) : (
            <p className="px-4 py-3 text-sm text-zinc-500">Nothing found</p>
          )}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_5.5rem_minmax(0,2.4fr)] gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-500 lg:grid dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
          <span>Project</span>
          <span>Agent</span>
          <span>Open</span>
          <span>Needs you</span>
          <span>Next for you</span>
        </div>
        <ul id="list">
          {!list ? (
            <li className="px-4 py-3 text-sm text-zinc-500">Loading…</li>
          ) : !list.length ? (
            <li className="px-4 py-3 text-sm text-zinc-500">No projects yet.</li>
          ) : (
            list.map((p) => {
              const x = top(p.name)
              const next = x ? (
                <>
                  <span className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">{x.code}</span>{' '}
                  {x.title}
                </>
              ) : (
                <span className="text-zinc-300 dark:text-zinc-600">—</span>
              )
              // B324: a project opens on its New input page, not on one of its items
              return (
                <li key={p.name} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-700/60">
                  <a
                    href={`/p/${encodeURIComponent(p.name)}/`}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 active:bg-zinc-100 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_5.5rem_minmax(0,2.4fr)] lg:px-4 lg:py-3 lg:text-[13px] dark:hover:bg-zinc-700/40"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-white uppercase lg:size-6 lg:rounded-md lg:text-xs ${tone.get(p.name)}`}
                      >
                        {[...(p.title || p.name)][0] || '?'}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold lg:text-[13px]">
                          {p.title || p.name}
                        </span>
                        <span className="block truncate text-xs text-zinc-500 lg:hidden dark:text-zinc-400">
                          {x ? next : `${p.open} open`}
                        </span>
                      </span>
                    </span>
                    <span className="hidden lg:flex">
                      <AgentCell p={p} />
                    </span>
                    <span className="hidden tabular-nums lg:block">{p.open}</span>
                    <span className="ml-auto shrink-0 lg:ml-0">
                      {p.needs ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">
                          {p.needs}
                        </span>
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
      {np ? (
        <div id="npRow" className="mt-1 px-1">
          <div className="flex items-center gap-1.5">
            <input
              id="npName"
              ref={npRef}
              className="h-11 w-full min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="Project name"
              aria-label="New project name"
              autoComplete="off"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void npCreate()
                }
                if (e.key === 'Escape') setNp(false)
              }}
            />
            <button
              id="npCreate"
              onClick={() => void npCreate()}
              className="h-11 shrink-0 rounded-xl bg-zinc-900 px-4 text-[15px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Create
            </button>
            <button
              id="npCancel"
              aria-label="Cancel"
              onClick={() => setNp(false)}
              className="grid size-11 shrink-0 place-items-center rounded-xl text-zinc-500"
            >
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          {npErr ? (
            <p id="npErr" role="alert" className="px-2 pt-1.5 text-[13px] text-red-600 dark:text-red-400">
              {npErr}
            </p>
          ) : null}
        </div>
      ) : (
        <button
          id="new"
          onClick={() => {
            setNp(true)
            setNpErr('')
          }}
          className="mt-1 flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium text-blue-600 dark:text-blue-400"
        >
          <svg
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          New project
        </button>
      )}
    </main>
  )
}
