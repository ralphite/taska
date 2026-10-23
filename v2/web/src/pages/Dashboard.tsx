// F448 (r696, D71): the dashboard for making Taska, on this computer only (/dev/dashboard): what you did in Taska, from
// its log, worked out each time it opens; the panels agents and scripts keep up to date, what each item cost to make
// (I447) and the analyses agents wrote. Counts and times only, never your words.
import { useEffect, useState, type ReactNode } from 'react'
import { Rich } from '../components/Talk'

type Pair = [string, number]
interface Dash {
  days: number | null
  from: string
  to: string
  actions: number
  tabs: number
  top: Pair[]
  span: Pair[]
  hourly: boolean
  via: Pair[]
  projects: Pair[]
  items: { project: string; code: string; title: string; n: number }[]
  opens: number
  opened: number
  voice: { n: number; ends: Pair[]; median: number; minutes: number }
  errors: Pair[]
  slow: { n: number; timeouts: number; median: number; via: [string, number, number][]; where: Pair[] }
  reloads: number
  updates: number
  costs: {
    items: {
      project: string
      code: string
      title: string
      rounds: number
      minutes: number
      tokens: number
      cache: number
      steps: number
      t: string
    }[]
    minutes: number
    tokens: number
    cache: number
    median_minutes: number
    median_tokens: number
  }
  panels: { name: string; updated: string; title: string; md: string }[]
  analyses: { name: string; date: string; title: string; md: string }[]
}

const RANGES: [string, string][] = [
  ['0', 'Today'],
  ['7', '7 days'],
  ['all', 'All'],
]
/** 3,620,181 -> 3.6M, 65,467 -> 65k */
const short = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n)
const CARD = 'min-w-0 rounded-xl bg-white p-4 ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10'
const HEAD = 'mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100'
const MUTED = 'text-zinc-500 dark:text-zinc-400'

function Card({
  title,
  children,
  wide = false,
  note,
  cls = '',
}: {
  title: string
  children: ReactNode
  wide?: boolean
  note?: string
  cls?: string
}) {
  return (
    <section className={`${CARD} ${wide ? 'lg:col-span-2' : ''} ${cls}`}>
      <h2 className={HEAD}>{title}</h2>
      {note ? <p className={`-mt-2 mb-3 text-xs ${MUTED}`}>{note}</p> : null}
      {children}
    </section>
  )
}
/** A list of names with a bar each, the longest the largest */
function Bars({ rows, unit = '' }: { rows: Pair[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  if (!rows.length) return <p className={`text-sm ${MUTED}`}>Nothing yet.</p>
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {rows.map(([k, n]) => (
        <li key={k} className="grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-3">
          <span className="truncate" title={k}>
            {k}
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
            <span className="block h-full rounded-full bg-blue-500" style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className={`text-right tabular-nums ${MUTED}`}>
            {n.toLocaleString()}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  )
}
function Stat({ n, label, sub }: { n: string | number; label: string; sub?: string }) {
  return (
    <div className={CARD}>
      <div className="text-2xl font-semibold tracking-tight tabular-nums">{n}</div>
      <div className={`mt-0.5 text-sm ${MUTED}`}>{label}</div>
      {sub ? <div className={`mt-0.5 text-xs ${MUTED}`}>{sub}</div> : null}
    </div>
  )
}

export function Dashboard() {
  const [range, setRange] = useState(() => new URLSearchParams(location.search).get('days') || '7')
  const [d, setD] = useState<Dash | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    document.title = 'Dashboard · Taska'
    let gone = false
    fetch(`/dev/api/dashboard?days=${range}`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Dash>) : Promise.reject(new Error(`Taska answered ${r.status}`))))
      .then((x) => {
        if (gone) return
        setD(x)
        setErr('')
      })
      .catch((e: Error) => !gone && setErr(e.message))
    history.replaceState(null, '', `?days=${range}`)
    return () => {
      gone = true
    }
  }, [range])
  const max = Math.max(1, ...(d?.span || []).map((s) => s[1]))
  return (
    <main className="mx-auto max-w-[1200px] px-3 pt-[env(safe-area-inset-top)] pb-10 lg:px-10 lg:pt-8">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className={`text-sm ${MUTED}`}>
            What you did in Taska, from its log{d?.from ? ` · ${d.from} to ${d.to}` : ''}. Counts and times only. On
            this computer only.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
          {RANGES.map(([v, label]) => (
            <button
              key={v}
              aria-pressed={range === v}
              onClick={() => setRange(v)}
              className="h-8 rounded-lg px-3 text-sm font-medium text-zinc-600 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:text-zinc-300 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900"
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {err ? <p className="mb-4 text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      {!d ? (
        <p className={`text-sm ${MUTED}`}>Working it out…</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat n={d.actions.toLocaleString()} label="things you did" sub={`in ${d.tabs} tabs`} />
            <Stat
              n={d.voice.n.toLocaleString()}
              label="voice notes"
              sub={`${d.voice.minutes} min · about ${d.voice.median} s each`}
            />
            <Stat n={d.opens.toLocaleString()} label="items opened" sub={`${d.opened} different items`} />
            <Stat
              n={d.slow.n.toLocaleString()}
              label="answers over 1 s"
              sub={`middle ${(d.slow.median / 1000).toFixed(1)} s`}
            />
            <Stat n={d.reloads.toLocaleString()} label="reloads by hand" sub={`“Taska has an update” ${d.updates}×`} />
          </div>
          {d.panels.length ? (
            // what agents and scripts keep up to date, e.g. how the Storybook server is doing: first, as it is live
            <div className="mb-3 grid gap-3 lg:grid-cols-2">
              {d.panels.map((p) => (
                <Card key={p.name} title={p.title} note={`updated ${p.updated}`} cls="lg:last:odd:col-span-2">
                  <Rich text={p.md} cls="text-sm" />
                </Card>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title={d.hourly ? 'By hour' : 'By day'} wide>
              <div className="flex h-36 items-end gap-0.5">
                {d.span.map(([k, n]) => (
                  <div key={k} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${k}: ${n}`}>
                    <div className="rounded-t bg-blue-500/80 dark:bg-blue-400/70" style={{ height: `${(n / max) * 100}%` }} />
                  </div>
                ))}
              </div>
              {/* each day under its bar; by hour, every third hour */}
              <div className={`mt-1 flex gap-0.5 text-[11px] tabular-nums ${MUTED}`}>
                {d.span.map(([k], i) => (
                  <span key={k} className="min-w-0 flex-1 truncate text-center">
                    {d.hourly && i % 3 ? '' : k}
                  </span>
                ))}
              </div>
            </Card>
            <Card title="What you did most">
              <Bars rows={d.top} />
            </Card>
            <Card title="Items opened most">
              {d.items.length ? (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {d.items.map((i) => (
                    <li key={i.project + i.code} className="flex items-baseline gap-2">
                      <a
                        href={`/p/${encodeURIComponent(i.project)}/${i.code}`}
                        className="shrink-0 font-mono text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {i.code}
                      </a>
                      <span className="min-w-0 flex-1 truncate">{i.title || i.project}</span>
                      <span className={`shrink-0 tabular-nums ${MUTED}`}>{i.n}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={`text-sm ${MUTED}`}>Nothing yet.</p>
              )}
            </Card>
            <Card title="Where">
              <Bars rows={d.via} />
              <h3 className={`mt-4 mb-2 text-xs font-semibold uppercase tracking-wider ${MUTED}`}>Projects</h3>
              <Bars rows={d.projects} />
            </Card>
            <Card title="Voice notes: how they ended">
              <Bars rows={d.voice.ends} />
            </Card>
            <Card title="Slow answers (over 1 s), where">
              <Bars rows={d.slow.where} />
              <p className={`mt-3 text-xs ${MUTED}`}>
                {d.slow.via.map(([k, n, ms]) => `${k}: ${n}, middle ${(ms / 1000).toFixed(1)} s`).join(' · ')}
                {d.slow.timeouts ? ` · ${d.slow.timeouts} gave up` : ''}
              </p>
            </Card>
            <Card title="What the page said went wrong">
              <Bars rows={d.errors} />
            </Card>
            <Card
              title="What each item cost"
              wide
              note={
                d.costs.items.length
                  ? `${d.costs.items.length} items · ${d.costs.minutes} min · ${short(d.costs.tokens)} token · middle ${d.costs.median_minutes} min, ${short(d.costs.median_tokens)} token`
                  : undefined
              }
            >
              {d.costs.items.length ? (
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-14" />
                    <col />
                    <col className="w-14" />
                    <col className="w-16" />
                    <col className="hidden w-20 lg:table-column" />
                    <col className="hidden w-14 lg:table-column" />
                    <col className="hidden w-24 lg:table-column" />
                  </colgroup>
                  <thead className={`text-left text-xs ${MUTED}`}>
                    <tr>
                      <th colSpan={2} className="pb-2 font-medium">
                        Item
                      </th>
                      <th className="pb-2 text-right font-medium">min</th>
                      <th className="pb-2 text-right font-medium">token</th>
                      <th className="hidden pb-2 text-right font-medium lg:table-cell">cache read</th>
                      <th className="hidden pb-2 text-right font-medium lg:table-cell">steps</th>
                      <th className="hidden pb-2 text-right font-medium lg:table-cell">last</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {d.costs.items.map((c) => (
                      <tr key={c.project + c.code} className="border-t border-zinc-100 dark:border-zinc-700">
                        <td className="py-1.5">
                          <a
                            href={`/p/${encodeURIComponent(c.project)}/${c.code}`}
                            className="font-mono text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {c.code}
                          </a>
                        </td>
                        <td className="truncate py-1.5 pr-2" title={c.title}>
                          {c.title}
                          {c.rounds > 1 ? <span className={MUTED}> · {c.rounds} rounds</span> : null}
                        </td>
                        <td className="py-1.5 text-right">{c.minutes}</td>
                        <td className="py-1.5 text-right">{short(c.tokens)}</td>
                        <td className={`hidden py-1.5 text-right lg:table-cell ${MUTED}`}>{short(c.cache)}</td>
                        <td className={`hidden py-1.5 text-right lg:table-cell ${MUTED}`}>{c.steps}</td>
                        <td className={`hidden py-1.5 text-right lg:table-cell ${MUTED}`}>{c.t}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className={`text-sm ${MUTED}`}>Nothing yet.</p>
              )}
            </Card>
            <Card title="Analyses" wide>
              {d.analyses.length ? (
                <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-700">
                  {d.analyses.map((a) => (
                    <article key={a.name} className="py-3 first:pt-0 last:pb-0">
                      <h3 className="text-sm font-semibold">
                        {a.title} <span className={`font-normal ${MUTED}`}>· {a.date}</span>
                      </h3>
                      <Rich text={a.md} cls="mt-1 text-sm" />
                    </article>
                  ))}
                </div>
              ) : (
                <p className={`text-sm ${MUTED}`}>
                  None yet. An agent adds one as a Markdown file in dev/analyses in Taska's data folder.
                </p>
              )}
            </Card>
          </div>
        </>
      )}
    </main>
  )
}
