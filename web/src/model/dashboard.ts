// The dashboard for making Taska, as the server works it out from its log (counts and times only, never your words).

export type Pair = [string, number]

export interface Dash {
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
    items: { project: string; code: string; title: string; rounds: number; minutes: number; tokens: number; cache: number; steps: number; t: string }[]
    minutes: number
    tokens: number
    cache: number
    median_minutes: number
    median_tokens: number
  }
  /** each round of work on an item, the latest first (F576) */
  rounds: Round[]
  panels: { name: string; updated: string; title: string; md: string }[]
  analyses: { name: string; date: string; title: string; md: string }[]
}

/** 3,620,181 -> 3.6M, 65,467 -> 65k */
export const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n))

/** A round of work on an item: from started to handed over (review) or done. `tokens`: what its agent's cost line
 * says (null: it says nothing). */
export interface Round {
  project: string
  code: string
  title: string
  /** when it was handed over */
  end: string
  at: string
  minutes: number
  tokens: number | null
}

/** Which rounds to show: the last hour's, today's, the last 7 days', the last 20, all. */
export const ROUND_RANGES: [string, string][] = [
  ['hour', 'Last hour'],
  ['today', 'Today'],
  ['7', '7 days'],
  ['last20', 'Last 20'],
  ['all', 'All'],
]

export function roundsIn(all: readonly Round[], range: string, now: number): Round[] {
  if (range === 'last20') return all.slice(0, 20)
  if (range === 'all') return [...all]
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  const from = range === 'hour' ? now - 3600_000 : range === 'today' ? day.getTime() : day.getTime() - 7 * 86400_000
  return all.filter((r) => Date.parse(r.end) >= from)
}

/** How long rounds took, grouped: each group's upper end in minutes. */
const BUCKETS: [string, number][] = [
  ['<5m', 5],
  ['5–15m', 15],
  ['15–30m', 30],
  ['30–60m', 60],
  ['1–2h', 120],
  ['2–4h', 240],
  ['>4h', Infinity],
]

const middle = (xs: readonly number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}
const average = (xs: readonly number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)

/** What the rounds shown say: how many, the middle and average minutes, the time the slowest one in ten take, how
 * many fall in each group of time; and of those whose cost line gives tokens, how many and their middle, average and
 * total. */
export function roundFacts(rs: readonly Round[]) {
  const mins = rs.map((r) => r.minutes)
  const toks = rs.flatMap((r) => (r.tokens == null ? [] : [r.tokens]))
  const sorted = [...mins].sort((a, b) => a - b)
  let lo = 0
  const groups: Pair[] = BUCKETS.map(([label, hi]) => {
    const n = mins.filter((m) => m >= lo && m < hi).length
    lo = hi
    return [label, n]
  })
  return {
    n: rs.length,
    middle: middle(mins),
    average: average(mins),
    slowTenth: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] : 0,
    groups,
    tokens: { n: toks.length, middle: middle(toks), average: average(toks), total: toks.reduce((a, b) => a + b, 0) },
  }
}

/** 45 -> 45 min, 95 -> 1 h 35 min, 3114 -> 51 h 54 min */
export const minutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`)
