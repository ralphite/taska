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
  panels: { name: string; updated: string; title: string; md: string }[]
  analyses: { name: string; date: string; title: string; md: string }[]
}

/** 3,620,181 -> 3.6M, 65,467 -> 65k */
export const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n))
