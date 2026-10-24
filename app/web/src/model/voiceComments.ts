// Voice comments on a document: each one starts with a quote line ("> “…”") of what it is about, put into the box,
// and its voice note's words go right under it; one Send posts each quote's words as a comment on its passage.

import { plainQuote } from './markdown'
import type { Doc } from './types'

export const VC_MARK = /^> “(.+)”[ \t]*$/

/** What a voice comment is about: the passage of the document (its key, its words). */
export interface VcMark {
  label: string
  d: number
  key: string
  quote: string
}

/** How many quote lines the words have. */
export const vcCount = (text: string) => text.split('\n').filter((l) => VC_MARK.test(l)).length

/** Where a quote's words go: right under its line, or -1. */
export function vcLineEnd(text: string, label: string): number {
  let at = 0
  for (const l of text.split('\n')) {
    at += l.length + 1
    if (VC_MARK.exec(l)?.[1] === label) return Math.min(at, text.length)
  }
  return -1
}

/** The quote line's words for a passage. */
export function vcLabel(quote: string): string {
  const label = plainQuote(quote).replace(/\s+/g, ' ')
  return label.length > 300 ? label.slice(0, 300) + '…' : label
}

/** The words with a quote line put after them. */
export const withQuote = (text: string, label: string) => (text.trim() ? text.trimEnd() + '\n\n' : '') + `> “${label}”\n`

export interface VcSegment {
  label: string
  key: string
  quote: string
  text: string
}

/** The box as comments: each quote line and the words under it (words above the first quote go with the first). */
export function vcSegments(text: string, d: Doc, marks: readonly VcMark[]): { segs: VcSegment[] } | { err: string } {
  const raw: { label: string; lines: string[] }[] = []
  const pre: string[] = []
  for (const l of text.split('\n')) {
    const m = VC_MARK.exec(l)
    if (m) raw.push({ label: m[1], lines: [] })
    else (raw.at(-1)?.lines || pre).push(l)
  }
  if (pre.join('').trim() && raw[0]) raw[0].lines.unshift(...pre, '')
  const segs: VcSegment[] = []
  for (const s of raw) {
    const m = marks.find((x) => x.label === s.label && x.d === d.d)
    const b = !m && d.blocks.find((x) => plainQuote(x.text).replace(/\s+/g, ' ').includes(s.label.replace(/…$/, '')))
    if (!m && !b) return { err: `“${s.label.slice(0, 60)}” is no longer in D${d.d}: change or remove the quote line` }
    segs.push({ label: s.label, key: m ? m.key : (b as { key: string }).key, quote: m ? m.quote : s.label, text: s.lines.join('\n').trim() })
  }
  return { segs }
}

/** A voice comment not sent yet, where it will go: its words under its quote in the box, and its voice notes. */
export interface NotSent {
  label: string
  key: string
  words: string
  voice: number
  transcribing: boolean
}

/** The voice comments on document `d` the box still holds (its words or its voice notes); emptied, they are gone. */
export function notSent(text: string, files: readonly { vc?: string; transcribing?: boolean }[], marks: readonly VcMark[], d: number): NotSent[] {
  const lines = text.split('\n')
  return marks
    .filter((m) => m.d === d)
    .map((m) => {
      const at = lines.findIndex((l) => VC_MARK.exec(l)?.[1] === m.label)
      const words: string[] = []
      for (const l of at < 0 ? [] : lines.slice(at + 1)) {
        if (VC_MARK.test(l)) break
        words.push(l)
      }
      const voice = files.filter((f) => f.vc === m.label)
      return { label: m.label, key: m.key, words: words.join('\n').trim(), voice: voice.length, transcribing: voice.some((f) => f.transcribing), live: at >= 0 || voice.length > 0 }
    })
    .filter((x) => x.live)
    .map(({ label, key, words, voice, transcribing }) => ({ label, key, words, voice, transcribing }))
}
