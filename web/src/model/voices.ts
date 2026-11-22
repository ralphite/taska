// A voice note's words (T682): one record per note (Voice), named by its file wherever the note is: an input, a
// message, a comment. What was typed and each note's words together are what was said, as every place shows it
// (what a note says while its words are worked out, or why it has none: model/voiceStates). Sending, the words of
// each note are taken out of what was typed and go to the note (changed by you: they are yours from then on).

import type { FileRef, PlacedFile, Voice } from './types'

export const isVoice = (f: { mime?: string }) => (f.mime || '').startsWith('audio/')

/** What a note says now: its tidied words (yours, once you changed them), its first words while worked out. */
export const voiceWords = (v: Voice | null | undefined): string => (v ? v.tidied || (v.state === 'wait' ? v.early || '' : '') : '')

/** A file with the words of its note (read from the note's record): what the parts that draw it take. */
export const withVoice = (f: FileRef, voices: ReadonlyMap<string, Voice>): FileRef => {
  const v = isVoice(f) ? voices.get(f.f) : undefined
  return v ? { ...f, voice: v } : f
}

/** What was said in order (T838): the words typed, each voice note where it was put in them (its place), the notes
 * with no place after all the words. */
export function inPlace(typed: string, files: readonly PlacedFile[] | undefined): (string | PlacedFile)[] {
  const notes = (files || []).filter(isVoice)
  const out: (string | PlacedFile)[] = []
  let pos = 0
  for (const f of notes.filter((x) => x.at != null).sort((x, y) => Math.min(x.at ?? 0, typed.length) - Math.min(y.at ?? 0, typed.length))) {
    const at = Math.max(pos, Math.min(f.at ?? 0, typed.length))
    if (typed.slice(pos, at).trim()) out.push(typed.slice(pos, at).trim())
    out.push(f)
    pos = at
  }
  if (typed.slice(pos).trim()) out.push(typed.slice(pos).trim())
  return [...out, ...notes.filter((x) => x.at == null)]
}

/** What was said: the words typed with each voice note's words where it was put in them (T838). */
export function saidText(typed: string, files: readonly PlacedFile[] | undefined): string {
  return inPlace(typed, files)
    .map((x) => (typeof x === 'string' ? x : voiceWords(x.voice)))
    .filter(Boolean)
    .join('\n')
}

/** A voice note as it was put in the text you write: its file and the words put there (`around`: the text before
 * and after them when they were put in, to find them again however you changed them). */
export interface VoiceInText {
  f: string
  words: string
  around?: readonly [string, string]
}

// T838: where a note's words were is kept as a mark in the text while the others are taken out (a character of the
// Private Use Area, never typed), then read as its place once the text is tidied
const MARK0 = 0xe000
const isMark = (c: string) => c.charCodeAt(0) >= MARK0 && c.charCodeAt(0) < MARK0 + 0x1000
const cut = (text: string, start: number, end: number, mark = '') => {
  let before = text.slice(0, start).replace(/[ \t]+$/, '')
  const after = text.slice(end).replace(/^[ \t]+/, '')
  // the mark right after the words before it (not among the line breaks, which are tidied as they would be)
  const core = before.replace(/\s+$/, '')
  before = core + mark + before.slice(core.length)
  return (before + (before.trim() && after.trim() ? '\n' : '') + after).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** The text with its marks taken out, and each mark's place in it (by the note it stands for). */
function places(text: string, keys: readonly string[]): { text: string; at: Record<string, number> } {
  let out = ''
  const at: Record<string, number> = {}
  for (const c of text) {
    if (isMark(c)) {
      const k = keys[c.charCodeAt(0) - MARK0]
      if (k != null) at[k] = out.length
    } else out += c
  }
  const trimmed = out.trim()
  const start = out.length - out.trimStart().length
  for (const k of Object.keys(at)) at[k] = Math.max(0, Math.min(at[k] - start, trimmed.length))
  return { text: trimmed, at }
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
export function splitVoices(text: string, notes: readonly VoiceInText[], typed?: string): { text: string; words: Record<string, string>; at: Record<string, number> } {
  let rest = text
  const words: Record<string, string> = {}
  const left: VoiceInText[] = []
  const keys: string[] = []
  // each note found leaves its mark where its words were (T838)
  const mark = (f: string) => String.fromCharCode(MARK0 + keys.push(f) - 1)
  for (const n of notes) {
    const w = n.words.trim()
    const at = w ? rest.indexOf(w) : -1
    if (at >= 0) {
      words[n.f] = w
      rest = cut(rest, at, at + w.length, mark(n.f))
      continue
    }
    const span = w ? changedSpan(rest, w) : null
    if (span) {
      words[n.f] = rest.slice(span[0], span[1]).trim()
      rest = cut(rest, span[0], span[1], mark(n.f))
      continue
    }
    left.push(n)
  }
  if (keys.length) {
    // the notes whose words were changed beyond finding are found by the words around them, without the marks
    const got = places(rest, keys)
    const said = splitLeft(got.text, left, typed, words, got.at)
    return { text: said, words, at: Object.fromEntries(Object.entries(got.at).map(([k, v]) => [k, Math.min(v, said.length)])) }
  }
  const at: Record<string, number> = {}
  return { text: splitLeft(rest, left, typed, words, at), words, at }
}

/** The notes whose words are not found as they were: found by the text around them when they were put in (each
 * placed where its words were). */
function splitLeft(text: string, left: readonly VoiceInText[], typed: string | undefined, words: Record<string, string>, at: Record<string, number>): string {
  let rest = text
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
      at[n.f] = r.slice(0, p.length).trimEnd().length
      rest = cut(r, p.length, r.length - q.length)
    }
  }
  return rest.trim()
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
