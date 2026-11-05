// A time as the page says it, one way everywhere: today's as 14:30, yesterday's as "Yesterday 14:30", older ones as
// "Oct 21 14:30" (another year's as "Oct 21, 2025"). Told against `now` (ms), which the caller gives (the model's
// time: rendering reads no clock).

export function when(t: string | number | undefined | null, now: number): string {
  if (t == null || t === '') return ''
  const d = new Date(t)
  const today = new Date(now)
  const hm = d.toTimeString().slice(0, 5)
  if (d.toDateString() === today.toDateString()) return hm
  if (new Date(now - 864e5).toDateString() === d.toDateString()) return 'Yesterday ' + hm
  if (d.getFullYear() !== today.getFullYear()) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${hm}`
}

/** A length as a clock shows it: 1:05. */
export const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

// ---- Later until a day (D115 #21): days as YYYY-MM-DD, local, as the server keeps them

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dayOf = (day: string) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))

/** The days Later offers, from `now` (ms): tomorrow, and next week (its Monday). */
export function laterDays(now: number): { tomorrow: string; nextWeek: string; today: string } {
  const d = new Date(now)
  const at = (k: number) => iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + k))
  return { today: at(0), tomorrow: at(1), nextWeek: at(((8 - d.getDay()) % 7) || 7) }
}

/** A day Later ends on, as a row says it: within the week its weekday ("Mon"), further off its date ("Nov 21"). */
export function laterDay(day: string, now: number): string {
  const d = dayOf(day)
  const today = new Date(now)
  const days = Math.round((d.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 864e5)
  return days >= 0 && days < 7 ? d.toLocaleDateString('en-US', { weekday: 'short' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** A day as the page says it: "Oct 21", today's too. */
export const dayShort = (t: string | null | undefined) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
