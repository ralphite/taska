// The page's rules about inputs: where one stands (in words, with its tone), whether its filing can be undone, the
// order lists show them in, and what is still on its way.

import type { Input } from './types'

export type InputTone = 'moved' | 'busy' | 'quiet' | 'muted' | 'done' | 'failed' | 'agent' | 'waiting'

export interface InputStanding {
  label: string
  tone: string
  icon: 'arrow' | 'dot' | 'undo' | 'check' | 'alert' | 'bot' | 'hourglass'
}

const TONE = {
  muted: 'text-zinc-500 dark:text-zinc-400',
  quiet: 'text-zinc-400 dark:text-zinc-500',
  busy: 'text-blue-600 dark:text-blue-400',
  done: 'text-emerald-700 dark:text-emerald-400',
  failed: 'text-red-600 dark:text-red-400',
  plain: 'text-zinc-600 dark:text-zinc-300',
}

export function standing(r: Input, organizer: { on: boolean; busy: string | null }, projectTitle: (slug: string) => string): InputStanding {
  if (r.moved) return { label: `Moved to ${projectTitle(r.moved.to)}`, tone: TONE.muted, icon: 'arrow' }
  if (r.trWait) return { label: 'Transcribing…', tone: TONE.busy, icon: 'dot' }
  if (organizer.busy === r.id) return { label: 'Organizing…', tone: TONE.busy, icon: 'dot' }
  if (r.org?.undone) return { label: 'Undone', tone: TONE.muted, icon: 'undo' }
  if (r.kind === 'answer') return { label: 'Answer', tone: TONE.muted, icon: 'check' }
  if (r.acked)
    return r.org?.keep
      ? { label: 'Handled by your agent', tone: TONE.quiet, icon: 'check' }
      : !r.org && !r.touched.length
        ? { label: 'Seen by your agent', tone: TONE.muted, icon: 'check' }
        : { label: 'Organized', tone: TONE.done, icon: 'check' }
  if (r.org && !r.org.ok) return { label: 'Organizer failed', tone: TONE.failed, icon: 'alert' }
  if (r.org) return { label: 'Left for your agent', tone: TONE.plain, icon: 'bot' }
  return { label: organizer.on ? 'Queued' : 'Waiting for your agent', tone: TONE.plain, icon: 'hourglass' }
}

/** Where an input stands in a word, as the New input page's list says it. */
export const SHORT_STANDING: Record<string, string> = {
  'Waiting for your agent': 'For your agent',
  'Handled by your agent': 'Handled',
  'Seen by your agent': 'Seen',
  'Left for your agent': 'Left for agent',
}

export const organizing = (r: Input, organizer: { on: boolean; busy: string | null }) => organizer.busy === r.id || (!r.acked && organizer.on && !r.org)

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
