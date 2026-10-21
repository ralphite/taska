// B412: choices ticked in a document wait on the page, and in this browser across reloads, until you send them;
// Send puts them all in the document at once and tells the item which ones you ticked.
import { ctx, docById } from './state'
import { CHOICE, isTicked, tickedBlock } from './markdown'
import type { Doc } from './types'

const DT = {
  at: '',
  all: {} as Record<string, Record<string, string>>, // document -> paragraph key -> its text as you ticked it
  going: {} as Record<string, Record<string, string>>, // the same, sent and not in the document yet: still shown
}
const storeKey = () => 'taska.docticks.' + ctx.HERE
function all() {
  if (DT.at !== ctx.HERE) {
    try {
      DT.all = JSON.parse(localStorage.getItem(storeKey()) || '{}') as typeof DT.all
    } catch {
      DT.all = {}
    }
    DT.at = ctx.HERE
  }
  return DT.all
}
function keep() {
  try {
    const live = Object.fromEntries(Object.entries(DT.all).filter(([, v]) => Object.keys(v).length))
    if (Object.keys(live).length) localStorage.setItem(storeKey(), JSON.stringify(live))
    else localStorage.removeItem(storeKey())
  } catch {
    /* no storage: they stay for this page */
  }
}
/** A paragraph's text as you ticked it (its own text when nothing is waiting). */
export const tickText = (d: number, key: string, text: string) => all()[d]?.[key] ?? DT.going[d]?.[key] ?? text
/** Tick or untick the i-th choice of a paragraph, on the page only. -> false when the paragraph is gone. */
export function tickDoc(d: number, key: string, i: number): boolean {
  const b = docById(d)?.blocks.find((x) => x.key === key)
  const next = b && tickedBlock(tickText(d, key, b.text), i)
  if (!b || next == null) return false
  const mine = (all()[d] ||= {})
  if (next === b.text) delete mine[key]
  else mine[key] = next
  keep()
  return true
}
/** The paragraphs of a document whose ticks wait to be sent (and are still in it). */
export function ticksOf(doc: Doc | undefined) {
  if (!doc) return []
  const mine = all()[doc.d] || {}
  return doc.blocks.flatMap((b) => (mine[b.key] != null && mine[b.key] !== b.text ? [{ b, now: mine[b.key] }] : []))
}
/** The document's text with what waits ticked in it. */
export const tickedDoc = (doc: Doc) => ticksOf(doc).reduce((md, { b, now }) => md.replace(b.text, now), doc.md)
/** What you chose, one line each: what is ticked in the paragraphs you changed. */
export const tickWords = (doc: Doc) =>
  ticksOf(doc).flatMap(({ now }) => now.split('\n').flatMap((l) => (isTicked(l) ? ['✓ ' + l.replace(CHOICE, '')] : [])))
/** Sent: they stay shown while they are on their way. */
export function ticksGoing(d: number, sent: Record<string, string>) {
  DT.going[d] = { ...DT.going[d], ...sent }
  clearTicks(d, sent)
}
/** In the document (ok), or not: then they wait again to be sent. */
export function ticksDone(d: number, sent: Record<string, string>, ok: boolean) {
  if (!ok) for (const [k, v] of Object.entries(sent)) (all()[d] ||= {})[k] ??= v
  for (const k of Object.keys(sent)) delete DT.going[d]?.[k]
  keep()
}
export function clearTicks(d: number, only?: Record<string, string>) {
  const mine = all()[d]
  if (!mine) return
  for (const k of Object.keys(mine)) if (!only || only[k] === mine[k]) delete mine[k]
  keep()
}
