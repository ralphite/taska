// Words of a voice note that may be misheard (the two models heard them differently, or the main one was unsure):
// where they are in the draft now, swapping one side for the other everywhere it was heard, and a word corrected by
// hand inside the voice note's own words.

import type { Doubt } from './types'

/** A voice note as far as its words in the draft go. */
export interface HeardFile {
  key: string
  trAdded?: string
  doubts?: readonly Doubt[]
}

/** The model's "(?)" taken out. */
export const unmarked = (s: string) => s.replace(/\s*[(（][?？][)）]/g, '')

/** One place of a doubt in the draft's words: from `s` to `e`, the file and doubt it is, the two forms there. */
export interface Spot {
  s: number
  e: number
  fk: string
  k: number
  x: Doubt
  o: { was: string; alt: string }
}

const now = (x: Doubt, o: { was: string; alt: string }) => (x.pick === 'alt' ? o.alt : o.was)

/** Every place of every doubt in the words now, in order, none overlapping. */
export function spotsIn(text: string, files: readonly HeardFile[]): Spot[] {
  const out: Spot[] = []
  for (const f of files)
    (f.doubts || []).forEach((x, k) => {
      for (const o of [x, ...(x.also || [])]) {
        const cur = now(x, o)
        for (let at = cur ? text.indexOf(cur) : -1; at >= 0; at = text.indexOf(cur, at + cur.length)) out.push({ s: at, e: at + cur.length, fk: f.key, k, x, o })
      }
    })
  out.sort((a, b) => a.s - b.s)
  return out.filter((p, j) => !out.slice(0, j).some((q) => q.e > p.s))
}

/** The doubts not decided yet that are still in the words, each once: the list under the box. */
export function openDoubts(text: string, files: readonly HeardFile[]): { fk: string; k: number; x: Doubt }[] {
  return files.flatMap((f) => (f.doubts || []).map((x, k) => ({ fk: f.key, k, x }))).filter(({ x }) => !x.pick && text.includes(x.was))
}

/** Where each voice note's own words are in the draft. */
export function voiceStretches(text: string, files: readonly HeardFile[]): [number, number][] {
  const out: [number, number][] = []
  for (const f of files) {
    const at = f.trAdded ? text.indexOf(f.trAdded) : -1
    if (f.trAdded && at >= 0) out.push([at, at + f.trAdded.length])
  }
  return out
}

/** One side of a doubt picked: its words swapped for it everywhere they were heard. `changed` is false when the words
 * there were already that side's (or are gone). */
export function pickSide(text: string, f: HeardFile, k: number, side: 'was' | 'alt'): { text: string; trAdded?: string; doubts: Doubt[]; changed: boolean } {
  const x = f.doubts?.[k]
  const doubts = (f.doubts || []).map((d, i) => (i === k ? { ...d, pick: side } : d))
  if (!x) return { text, trAdded: f.trAdded, doubts: [...(f.doubts || [])], changed: false }
  const from = x.pick === 'alt' ? 'alt' : 'was'
  let vAt = f.trAdded ? text.indexOf(f.trAdded) : -1
  let vLen = f.trAdded?.length || 0
  let done = 0
  if (from !== side)
    for (const o of [x, ...(x.also || [])]) {
      const a = o[from]
      const b = o[side]
      for (let at = a ? text.indexOf(a) : -1; at >= 0; at = text.indexOf(a, at + b.length)) {
        text = text.slice(0, at) + b + text.slice(at + a.length)
        done++
        if (vAt >= 0 && at >= vAt && at < vAt + vLen) vLen += b.length - a.length
        else if (vAt >= 0 && at < vAt) vAt += b.length - a.length
      }
    }
  return { text, trAdded: done && vAt >= 0 ? text.slice(vAt, vAt + vLen) : f.trAdded, doubts, changed: done > 0 }
}

/** A doubt back to undecided. */
export const unpicked = (f: HeardFile, k: number): Doubt[] =>
  (f.doubts || []).map((d, i) => {
    if (i !== k) return d
    const rest = { ...d }
    delete rest.pick
    return rest
  })

/** Words selected inside a voice note's own words, without the spaces around them; too long or none: why. */
export function fixRange(text: string, s: number, e: number): { s: number; e: number; wrong: string } | { error: string } | null {
  while (s < e && /\s/.test(text[s])) s++
  while (e > s && /\s/.test(text[e - 1])) e--
  const wrong = text.slice(s, e)
  if (!wrong) return null
  if (wrong.length > 60) return { error: 'Select up to 60 characters to correct' }
  return { s, e, wrong }
}

/** The right words put in for the wrong ones; the voice note they were in keeps its stretch. */
export function fixIn(text: string, files: readonly HeardFile[], fix: { s: number; e: number; wrong: string }, right: string): { text: string; files: { key: string; trAdded: string }[] } | null {
  if (!right || right === fix.wrong || text.slice(fix.s, fix.e) !== fix.wrong) return null
  const touched: { key: string; trAdded: string }[] = []
  for (const f of files) {
    const at = f.trAdded ? text.indexOf(f.trAdded) : -1
    if (f.trAdded && at >= 0 && fix.s >= at && fix.e <= at + f.trAdded.length) touched.push({ key: f.key, trAdded: f.trAdded.slice(0, fix.s - at) + right + f.trAdded.slice(fix.e - at) })
  }
  return { text: text.slice(0, fix.s) + right + text.slice(fix.e), files: touched }
}
