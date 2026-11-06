// The page's rules about inputs: whether one is being organized, can be sent after all or have its filing undone, the
// order lists show them in, their days and times. (What became of one, in words: became.ts.)

import type { Input } from './types'

export const organizing = (r: Input, organizer: { on: boolean; busy: readonly string[] }) => organizer.busy.includes(r.id) || (!r.acked && organizer.on && !r.org && r.kind !== 'cancelled')

/** A recording cancelled with Esc, kept in the inputs: it can be sent after all (B627). */
export const canSend = (r: Input) => r.kind === 'cancelled' && !r.moved

export const canUndoFiling = (r: Input) =>
  !!r.org && r.org.ok && !r.org.undone && !!r.touched.length && (!r.org.keep || (!!r.history?.length && !!r.org.changed)) && !!r.filing?.can

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
