// A voice note's words (B682): one record per note (Voice), named by its file wherever the note is: an input, a
// message, a comment. What was typed and each note's words together are what was said, as every place shows it; a
// note still being worked out says so, one with no words says why. Sending, the words of each note are taken out of
// what was typed and go to the note (changed by you: they are yours from then on).

import type { FileRef, Voice } from './types'

export const isVoice = (f: { mime?: string }) => (f.mime || '').startsWith('audio/')

/** What a note says now: its tidied words (yours, once you changed them), its first words while worked out. */
export const voiceWords = (v: Voice | null | undefined): string => (v ? v.tidied || (v.state === 'wait' ? v.early || '' : '') : '')

/** Why a note has no words to show: being worked out, nobody was heard, or it failed. */
export const voiceLacks = (v: Voice | null | undefined): string =>
  !v || v.state === 'wait' ? 'Transcribing…' : v.state === 'failed' ? 'Transcription failed' : 'No words heard'

/** Whether a voice note of these files is still being worked out (its record waits for its words). */
export const transcribing = (files: readonly FileRef[] | undefined) => !!files?.some((f) => isVoice(f) && f.voice?.state === 'wait')

/** A file with the words of its note (read from the note's record): what the parts that draw it take. */
export const withVoice = (f: FileRef, voices: ReadonlyMap<string, Voice>): FileRef => {
  const v = isVoice(f) ? voices.get(f.f) : undefined
  return v ? { ...f, voice: v } : f
}

/** What was said: the words typed, then each voice note's words. */
export function saidText(typed: string, files: readonly FileRef[] | undefined): string {
  const parts = [typed.trim(), ...(files || []).filter(isVoice).map((f) => voiceWords(f.voice))]
  return parts.filter(Boolean).join('\n')
}

/** A voice note as it was put in the text you write: its file and the words put there (`around`: the text before
 * and after them when they were put in, to find them again however you changed them). */
export interface VoiceInText {
  f: string
  words: string
  around?: readonly [string, string]
}

const cut = (text: string, start: number, end: number) => {
  const before = text.slice(0, start).replace(/[ \t]+$/, '')
  const after = text.slice(end).replace(/^[ \t]+/, '')
  return (before + (before.trim() && after.trim() ? '\n' : '') + after).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Where a note's words are in the text, changed by you: its first and last words still there, in order, about as
 * long as they were. */
function changedSpan(text: string, words: string): [number, number] | null {
  if (words.length < 6) return null
  for (let k = Math.min(12, Math.floor(words.length / 3)); k >= 3; k--) {
    const s = text.indexOf(words.slice(0, k))
    const e = text.lastIndexOf(words.slice(-k))
    if (s >= 0 && e >= s && e + k - s <= words.length * 2 + 20 && e + k - s >= words.length / 2) return [s, e + k]
  }
  return null
}

/** The text you wrote as what was typed and each voice note's words as they are in it now (`words`: by file; a note
 * whose words are not found keeps its own). `typed`: what was typed before the notes' words, when it is known (an
 * edit of something said: its words typed then). */
export function splitVoices(text: string, notes: readonly VoiceInText[], typed?: string): { text: string; words: Record<string, string> } {
  let rest = text
  const words: Record<string, string> = {}
  const left: VoiceInText[] = []
  for (const n of notes) {
    const w = n.words.trim()
    const at = w ? rest.indexOf(w) : -1
    if (at >= 0) {
      words[n.f] = w
      rest = cut(rest, at, at + w.length)
      continue
    }
    const span = w ? changedSpan(rest, w) : null
    if (span) {
      words[n.f] = rest.slice(span[0], span[1]).trim()
      rest = cut(rest, span[0], span[1])
      continue
    }
    left.push(n)
  }
  for (const n of left) {
    const [pre, post] = n.around || (typed != null && left.length === 1 ? [typed.trim(), ''] : [null, null])
    if (pre == null || post == null) continue
    const p = pre.trim()
    const q = post.trim()
    const r = rest.trim()
    if (r.startsWith(p) && r.endsWith(q) && r.length >= p.length + q.length) {
      const mid = r.slice(p.length, r.length - q.length).trim()
      if (!mid) continue
      words[n.f] = mid
      rest = cut(r, p.length, r.length - q.length)
    }
  }
  return { text: rest.trim(), words }
}

/** A draft's voice notes as they were put in its words (by the page's own key for each, as they may not be up yet). */
export const draftNotes = (files: readonly { key?: string; f: string; mime?: string; trAdded?: string; around?: readonly [string, string] }[]): VoiceInText[] =>
  files.filter((f) => isVoice(f) && f.trAdded).map((f) => ({ f: f.key || f.f, words: f.trAdded || '', ...(f.around ? { around: f.around } : {}) }))

/** What was said before (an input, a comment): its voice notes as their words show in it. */
export const shownNotes = (files: readonly FileRef[] | undefined): VoiceInText[] =>
  (files || []).filter((f) => isVoice(f) && voiceWords(f.voice)).map((f) => ({ f: f.f, words: voiceWords(f.voice) }))

/** The words by each note's file (`words` by the page's key for a note, or its file), for Taska. */
export function wordsByFile(words: Readonly<Record<string, string>> | undefined, files: readonly { key?: string; f: string }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of files) {
    const w = words?.[f.key || ''] ?? words?.[f.f]
    if (f.f && w) out[f.f] = w
  }
  return out
}
