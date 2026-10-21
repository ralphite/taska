// B412: choices ticked in a document wait on the page, and in this browser across reloads, until you send them;
// Send puts them all in the document at once and tells the item which ones you ticked.
import { ctx, docById } from './state'
import { CHOICE, isTicked, tickedBlock } from './markdown'
import type { Doc } from './types'

const DT = {
  open: new Set<string>(), // F428: sent forms you chose to change again ("d k")
  at: '',
  all: {} as Record<string, Record<string, string>>, // document -> paragraph key -> its text as you ticked it
  going: {} as Record<string, Record<string, string>>, // the same, sent and not in the document yet: still shown
}
const storeKey = () => 'taska.docticks.' + ctx.HERE
function all() {
  if (DT.at !== ctx.HERE) {
    try {
      DT.all = JSON.parse(localStorage.getItem(storeKey()) || '{}') as typeof DT.all
      for (const m of Object.values(DT.all))
        for (const k of Object.keys(m))
          if (!k.includes('~')) {
            m[k + '~0'] ??= m[k] // B420: ticks kept before paragraphs were told apart belong to the first one
            delete m[k]
          }
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
/** B420: paragraphs with the same text share a key, so each is told apart by which one it is: key~0, key~1, ... */
export function tickKeys(doc: Doc) {
  const seen: Record<string, number> = {}
  return doc.blocks.map((b) => ({ b, k: `${b.key}~${(seen[b.key] = (seen[b.key] ?? -1) + 1)}` }))
}
/** A paragraph's text as you ticked it (its own text when nothing is waiting). */
export const tickText = (d: number, k: string, text: string) => all()[d]?.[k] ?? DT.going[d]?.[k] ?? text
/** Tick or untick the i-th choice of a paragraph, on the page only. -> false when the paragraph is gone. */
export function tickDoc(d: number, k: string, i: number): boolean {
  const doc = docById(d),
    b = doc && tickKeys(doc).find((x) => x.k === k)?.b
  const next = b && tickedBlock(tickText(d, k, b.text), i)
  if (!b || next == null) return false
  const mine = (all()[d] ||= {})
  if (next === b.text) delete mine[k]
  else mine[k] = next
  keep()
  return true
}
/** The paragraphs of a document whose ticks wait to be sent (and are still in it), with the heading they are under. */
export function ticksOf(doc: Doc | undefined) {
  if (!doc) return []
  const mine = all()[doc.d] || {}
  let head = ''
  return tickKeys(doc).flatMap(({ b, k }, i) => {
    if (b.kind === 'heading' && i > 0) head = b.text.replace(/^#+\s*/, '')
    return mine[k] != null && mine[k] !== b.text ? [{ b, k, i, now: mine[k], head }] : []
  })
}
/** The document's text with what waits ticked in it: each paragraph changed where it stands, not where the same
 * words first come (B420). */
export function tickedDoc(doc: Doc) {
  const want = new Map(ticksOf(doc).map((x) => [x.i, x.now]))
  let md = doc.md,
    at = 0
  const spans: [number, number, string][] = []
  doc.blocks.forEach((b, i) => {
    const p = md.indexOf(b.text, at)
    if (p < 0) return
    at = p + b.text.length
    const now = want.get(i)
    if (now != null) spans.push([p, at, now])
  })
  for (const [p, e, now] of spans.reverse()) md = md.slice(0, p) + now + md.slice(e)
  return md
}
/** What you chose, one line each, with the part of the document it is in: what is ticked in the paragraphs you changed. */
export const tickWords = (doc: Doc) =>
  ticksOf(doc).flatMap(({ now, head }) =>
    now.split('\n').flatMap((l) => (isTicked(l) ? ['✓ ' + l.replace(CHOICE, '') + (head ? ` (${head})` : '')] : [])),
  )
/** F428: a sent form is shown as sent until you choose to change it. */
export const tickOpen = (d: number, k: string) => DT.open.has(`${d} ${k}`)
export function tickModify(d: number, k: string) {
  DT.open.add(`${d} ${k}`)
}
/** Sent: they stay shown while they are on their way. */
export function ticksGoing(d: number, sent: Record<string, string>) {
  DT.going[d] = { ...DT.going[d], ...sent }
  clearTicks(d, sent)
}
/** In the document (ok), or not: then they wait again to be sent. */
export function ticksDone(d: number, sent: Record<string, string>, ok: boolean) {
  if (!ok) for (const [k, v] of Object.entries(sent)) (all()[d] ||= {})[k] ??= v
  for (const k of Object.keys(sent)) {
    delete DT.going[d]?.[k]
    if (ok) DT.open.delete(`${d} ${k}`) // sent again: shown as sent
  }
  keep()
}
export function clearTicks(d: number, only?: Record<string, string>) {
  const mine = all()[d]
  if (!mine) return
  for (const k of Object.keys(mine)) if (!only || only[k] === mine[k]) delete mine[k]
  keep()
}
