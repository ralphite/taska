// Times as the page says them, in one place: a time (today's as 14:30, yesterday's as "Yesterday 14:30", older ones
// as "Oct 21 14:30", another year's as "Oct 21, 2025"), a day as lists group by it ("Today", "Yesterday", "Nov 5"),
// how long ago in the words of where it shows (`ago`), a length, the days of Later. Told against `now` (ms), which
// the caller gives (the model's time: rendering reads no clock).

export function when(t: string | number | undefined | null, now: number): string {
  if (t == null || t === '') return ''
  const d = new Date(t)
  const today = new Date(now)
  const hm = timeOf(t)
  if (d.toDateString() === today.toDateString()) return hm
  if (new Date(now - 864e5).toDateString() === d.toDateString()) return 'Yesterday ' + hm
  if (d.getFullYear() !== today.getFullYear()) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${hm}`
}

/** A time of day: 14:30. */
export const timeOf = (t: string | number) => new Date(t).toTimeString().slice(0, 5)

/** A date: Nov 5, another year's Nov 5, 2025. */
export function dateOf(t: string | number, now: number): string {
  const d = new Date(t)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) })
}

/** A day as a list groups by it: Today, Yesterday, else its date. */
export function dayLabel(t: string | number, now: number): string {
  const d = new Date(t)
  if (d.toDateString() === new Date(now).toDateString()) return 'Today'
  if (new Date(now - 864e5).toDateString() === d.toDateString()) return 'Yesterday'
  return dateOf(t, now)
}

/** How long ago, as where it shows says it:
 * - `short`, beside a name or a line (the agent pill, an agent's sessions, a row's news): now, 5m, 2h, 3d
 * - `ago`, a quiet line (an item's Updated): just now, 5m ago, 2h ago
 * - `long`, in a sentence (the agents' tip and sheet): just now, 5 min ago, 2 h ago, 3 days ago */
export type AgoStyle = 'short' | 'ago' | 'long'
export function ago(t: string | number, now: number, style: AgoStyle): string {
  const ms = Math.max(0, now - (typeof t === 'number' ? t : Date.parse(t)))
  const m = Math.round(ms / 60000)
  const h = Math.round(m / 60)
  const d = Math.round(m / 1440)
  if (style === 'long') return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${h} h ago` : `${d} day${d === 1 ? '' : 's'} ago`
  const short = m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${h}h` : `${d}d`
  if (style === 'short') return short
  return ms < 60e3 ? 'just now' : `${short} ago`
}

/** A length as a clock shows it: 1:05. */
export const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

// ---- Later until a day (D115 #21): days as YYYY-MM-DD, local, as the server keeps them

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dayOf = (day: string) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))

/** The days Later offers, from `now` (ms): tomorrow, and next week (its Monday; on a Sunday, the Monday after
 * tomorrow's, so the two are never the same day). */
export function laterDays(now: number): { tomorrow: string; nextWeek: string; today: string } {
  const d = new Date(now)
  const at = (k: number) => iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + k))
  const monday = ((8 - d.getDay()) % 7) || 7
  return { today: at(0), tomorrow: at(1), nextWeek: at(monday === 1 ? 8 : monday) }
}

/** A day Later ends on, as a row says it: within the week its weekday ("Mon"), further off its date ("Nov 21"). */
export function laterDay(day: string, now: number): string {
  const d = dayOf(day)
  const today = new Date(now)
  const days = Math.round((d.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 864e5)
  return days >= 0 && days < 7 ? d.toLocaleDateString('en-US', { weekday: 'short' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** The day an item is Later until, as its row and its page say it ("Mon"); none when it is not Later until a day. */
export const laterOn = (it: { when: string; later_until?: string | null }, now: number): string | undefined =>
  it.when === 'later' && it.later_until ? laterDay(it.later_until, now) : undefined

/** A day as the page says it: "Oct 21", today's too. */
export const dayShort = (t: string | null | undefined) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
