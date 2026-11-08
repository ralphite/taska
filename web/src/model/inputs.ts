// The page's rules about inputs: the order lists show them in, their days and times. (What became of one: became.ts
// works it out, inputStates.ts says it in every place.)

import type { Input } from './types'

const num = (id: string) => Number(id.replace(/\D/g, '')) || 0
/** Newest first by when it was said, so one restored or moved back keeps its place. */
export const newestFirst = (list: readonly Input[]) => [...list].sort((a, b) => Date.parse(b.t) - Date.parse(a.t) || num(b.id) - num(a.id))

/** "Today", "Yesterday", or the date. */
export function dayOf(t: string, now = new Date()): string {
  const d = new Date(t)
  if (d.toDateString() === now.toDateString()) return 'Today'
  if (new Date(+now - 864e5).toDateString() === d.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const timeOf = (t: string) => new Date(t).toTimeString().slice(0, 5)

/** The words of a voice note's input can be selected to correct them: their element says whose they are. */
export const voiceMark = (r: { id: string; files?: readonly { mime?: string }[] } | null | undefined): { 'data-voice'?: string } => (r?.files?.some((f) => (f.mime || '').startsWith('audio/')) ? { 'data-voice': r.id } : {})
