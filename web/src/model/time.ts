// A time as the page says it: today's as 14:30, yesterday's as "Yesterday 14:30", older ones as "Oct 21". Told
// against `now` (ms), which the caller gives (the model's time: rendering reads no clock).

export function when(t: string | number | undefined | null, now: number): string {
  if (t == null || t === '') return ''
  const d = new Date(t)
  const today = new Date(now)
  const hm = d.toTimeString().slice(0, 5)
  if (d.toDateString() === today.toDateString()) return hm
  if (new Date(now - 864e5).toDateString() === d.toDateString()) return 'Yesterday ' + hm
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** A length as a clock shows it: 1:05. */
export const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

/** A day as the page says it: "Oct 21", today's too. */
export const dayShort = (t: string | null | undefined) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
