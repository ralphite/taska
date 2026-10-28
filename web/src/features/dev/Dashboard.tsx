// The dashboard for making Taska, on this computer only (/dev/dashboard): what you did in Taska, from its log, worked
// out each time it opens; the panels agents and scripts keep up to date, how long each item took and its tokens (F576),
// what each item cost to make and the analyses agents wrote. Counts and times only, never your words. Props only.

import type { ReactNode } from 'react'
import { minutes, ROUND_RANGES, roundFacts, roundsIn, short, type Dash, type Pair, type Round } from '../../model/dashboard'
import { SegCtl } from '../../ui/Segments'
import { Rich } from '../../ui/Markdown'
import type { InlineWorld } from '../../ui/markdown/inline'

export const RANGES: [string, string][] = [
  ['0', 'Today'],
  ['7', '7 days'],
  ['all', 'All'],
]
const CARD = 'min-w-0 rounded-xl bg-white p-4 ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10'
const HEAD = 'mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100'
const MUTED = 'text-zinc-500 dark:text-zinc-400'
const NO_WORLD: InlineWorld = { find: () => null, url: (f) => f, size: () => undefined }

function Card({ title, children, wide = false, note, cls = '' }: { title: string; children: ReactNode; wide?: boolean; note?: string; cls?: string }) {
  return (
    <section className={`${CARD} ${wide ? 'lg:col-span-2' : ''} ${cls}`}>
      <h2 className={HEAD}>{title}</h2>
      {note ? <p className={`-mt-2 mb-3 text-xs ${MUTED}`}>{note}</p> : null}
      {children}
    </section>
  )
}

/** A list of names with a bar each, the longest the largest. */
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

/** Rounds of work, each a row: the item, a bar as long as its time (or tokens) against the longest shown, the number. */
function RoundBars({ rows, value, label }: { rows: Round[]; value(r: Round): number; label(r: Round): string }) {
  const max = Math.max(1, ...rows.map(value))
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {rows.map((r, i) => (
        <li key={`${r.project} ${r.code} ${r.end} ${i}`} className="grid grid-cols-[3.5rem_minmax(0,1fr)_3rem_5.5rem] items-center gap-2 lg:grid-cols-[3.5rem_minmax(0,18rem)_1fr_6rem_5.5rem]">
          <a href={`/p/${encodeURIComponent(r.project)}/${r.code}`} className="font-mono text-xs font-bold text-blue-600 hover:underline dark:text-blue-400">
            {r.code}
          </a>
          <span className="truncate" title={r.title}>
            {r.title}
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
            <span className="block h-full rounded-full bg-blue-500" style={{ width: `${(value(r) / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{label(r)}</span>
          <span className={`hidden text-right text-xs tabular-nums lg:block ${MUTED}`}>{r.at}</span>
        </li>
      ))}
    </ul>
  )
}

/** How long each item took, from started to handed over, and its tokens (F576): the rounds of the time picked, how
 * they spread over groups of time, and each one. */
function Rounds({ all, range, now, onRange }: { all: Round[]; range: string; now: number; onRange(r: string): void }) {
  const rs = roundsIn(all, range, now)
  const f = roundFacts(rs)
  const most = Math.max(1, ...f.groups.map((g) => g[1]))
  const SHOWN = 30
  const withTokens = rs.filter((r) => r.tokens != null)
  const more = (n: number) => (n > SHOWN ? <p className={`mt-2 text-xs ${MUTED}`}>And {n - SHOWN} more before these.</p> : null)
  return (
    <>
      <section className={`${CARD} lg:col-span-2`}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">How long each item took</h2>
            <p className={`text-xs ${MUTED}`}>From started (In progress) to handed to you (Waits for review) or done; an item sent back counts again.</p>
          </div>
          <div className="w-full lg:w-[28rem]">
            <SegCtl small opts={ROUND_RANGES} on={range} pick={onRange} />
          </div>
        </div>
        {f.n ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat n={f.n} label="handed over" />
              <Stat n={minutes(f.middle)} label="middle (half took less)" />
              <Stat n={minutes(f.average)} label="average" />
              <Stat n={minutes(f.slowTenth)} label="or more: the slowest one in ten" />
            </div>
            <div className="flex h-36 items-end gap-1 lg:gap-2">
              {f.groups.map(([k, n]) => (
                <div key={k} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${k}: ${n}`}>
                  <span className={`mb-1 text-center text-xs tabular-nums ${MUTED}`}>{n || ''}</span>
                  <div className="rounded-t bg-blue-500/80 dark:bg-blue-400/70" style={{ height: `${(n / most) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className={`mt-1 mb-5 flex gap-1 text-[11px] tabular-nums lg:gap-2 ${MUTED}`}>
              {f.groups.map(([k]) => (
                <span key={k} className="min-w-0 flex-1 truncate text-center">
                  {k}
                </span>
              ))}
            </div>
            <h3 className={`mb-2 text-xs font-semibold tracking-wider uppercase ${MUTED}`}>Each one, the latest first</h3>
            <RoundBars rows={rs.slice(0, SHOWN)} value={(r) => r.minutes} label={(r) => minutes(r.minutes)} />
            {more(rs.length)}
          </>
        ) : (
          <p className={`text-sm ${MUTED}`}>Nothing handed over in this time.</p>
        )}
      </section>
      <section className={`${CARD} lg:col-span-2`}>
        <h2 className={HEAD}>Tokens for each item</h2>
        <p className={`-mt-2 mb-3 text-xs ${MUTED}`}>
          {withTokens.length
            ? `${withTokens.length} of ${f.n} say their tokens (their agent's cost line) · middle ${short(f.tokens.middle)} · average ${short(f.tokens.average)} · ${short(f.tokens.total)} in all`
            : f.n
              ? `None of these ${f.n} says its tokens: an agent writes them in the cost line it ends a done message with.`
              : 'Nothing handed over in this time.'}
        </p>
        {withTokens.length ? (
          <>
            <RoundBars rows={withTokens.slice(0, SHOWN)} value={(r) => r.tokens ?? 0} label={(r) => `${short(r.tokens ?? 0)} token`} />
            {more(withTokens.length)}
          </>
        ) : null}
      </section>
    </>
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

export function Dashboard({ d, err, range, onRange, rounds, now, onRounds }: {
  d: Dash | null
  err: string
  range: string
  onRange(r: string): void
  /** which rounds of work to show (ROUND_RANGES), and the time it is now */
  rounds: string
  now: number
  onRounds(r: string): void
}) {
  const max = Math.max(1, ...(d?.span || []).map((s) => s[1]))
  return (
    <main className="mx-auto max-w-[1200px] px-3 pt-[env(safe-area-inset-top)] pb-10 lg:px-10 lg:pt-8">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className={`text-sm ${MUTED}`}>
            What you did in Taska, from its log{d?.from ? ` · ${d.from} to ${d.to}` : ''}. Counts and times only. On this computer only.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
          {RANGES.map(([v, label]) => (
            <button
              key={v}
              aria-pressed={range === v}
              onClick={() => onRange(v)}
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
            <Stat n={d.voice.n.toLocaleString()} label="voice notes" sub={`${d.voice.minutes} min · about ${d.voice.median} s each`} />
            <Stat n={d.opens.toLocaleString()} label="items opened" sub={`${d.opened} different items`} />
            <Stat n={d.slow.n.toLocaleString()} label="answers over 1 s" sub={`middle ${(d.slow.median / 1000).toFixed(1)} s`} />
            <Stat n={d.reloads.toLocaleString()} label="reloads by hand" sub={`“Taska has an update” ${d.updates}×`} />
          </div>
          {d.panels.length ? (
            // what agents and scripts keep up to date: first, as it is live
            <div className="mb-3 grid gap-3 lg:grid-cols-2">
              {d.panels.map((p) => (
                <Card key={p.name} title={p.title} note={`updated ${p.updated}`} cls="lg:last:odd:col-span-2">
                  <Rich text={p.md} world={NO_WORLD} cls="text-sm" />
                </Card>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-2">
            <Rounds all={d.rounds} range={rounds} now={now} onRange={onRounds} />
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
                      <a href={`/p/${encodeURIComponent(i.project)}/${i.code}`} className="shrink-0 font-mono text-xs font-bold text-blue-600 hover:underline dark:text-blue-400">
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
              <h3 className={`mt-4 mb-2 text-xs font-semibold tracking-wider uppercase ${MUTED}`}>Projects</h3>
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
              note={d.costs.items.length ? `${d.costs.items.length} items · ${d.costs.minutes} min · ${short(d.costs.tokens)} token · middle ${d.costs.median_minutes} min, ${short(d.costs.median_tokens)} token` : undefined}
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
                          <a href={`/p/${encodeURIComponent(c.project)}/${c.code}`} className="font-mono text-xs font-bold text-blue-600 hover:underline dark:text-blue-400">
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
                      <Rich text={a.md} world={NO_WORLD} cls="mt-1 text-sm" />
                    </article>
                  ))}
                </div>
              ) : (
                <p className={`text-sm ${MUTED}`}>None yet. An agent adds one as a Markdown file in dev/analyses in Taska&apos;s data folder.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </main>
  )
}
