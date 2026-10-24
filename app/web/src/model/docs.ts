// Documents (D1, D2 ...) as the page reads them: their comment threads (each place quoted in a paragraph has its own,
// "key#12"), which are resolved, which hold an agent's word you have not seen, the contents of a long one, whether its
// first paragraph is its title, and what a comment written now goes to.

import { userWord } from './items'
import type { Block, Comment, Doc, Item } from './types'

export const threadKey = (c: { key: string; th?: number }) => (c.th ? `${c.key}#${c.th}` : c.key)

export function splitThread(tk: string): { key: string; th?: number } {
  const [key, th] = tk.split('#')
  return th ? { key, th: Number(th) } : { key }
}

export interface Thread {
  tk: string
  comments: Comment[]
  /** the words the thread is about */
  quote: string
}

/** A paragraph's comments, one list per thread, in the order the threads began. */
export function threadsOf(comments: readonly Comment[]): Thread[] {
  const by = new Map<string, Comment[]>()
  for (const c of comments) by.set(threadKey(c), [...(by.get(threadKey(c)) || []), c])
  return [...by].map(([tk, list]) => ({ tk, comments: list, quote: list[0].quote }))
}

export const resolved = (d: Doc, tk: string) => !!d.resolved?.[tk]

/** The same words, whatever the spaces and line breaks between them. */
export const sameText = (a: string, b: string) => a.split(/\s+/).join(' ') === b.split(/\s+/).join(' ')

export const allComments = (d: Doc): Comment[] => [...(d.whole || []), ...d.blocks.flatMap((b) => b.comments), ...d.detached.flatMap((t) => t.comments)]

/** An agent's word in the thread that came after you last saw it (`seen`: its time per "D4:key", or `since`). */
export function threadNew(seen: Readonly<Record<string, string>>, d: Doc, key: string, comments: readonly Comment[]): boolean {
  const c = comments.at(-1)
  return !!c && c.by !== 'you' && Date.parse(c.t) > Date.parse(seen[`D${d.d}:${key}`] || seen.since)
}

/** What the document shows now, to count as seen: per paragraph (and the whole document), its last comment's time. */
export function seenNow(seen: Readonly<Record<string, string>>, d: Doc): [string, string][] {
  const out: [string, string][] = []
  for (const [key, cs] of [...d.blocks.map((b) => [b.key, b.comments] as const), ['doc', d.whole || []] as const]) {
    const c = cs.at(-1)
    if (c && threadNew(seen, d, key, cs)) out.push([`D${d.d}:${key}`, c.t])
  }
  return out
}

/** Its first paragraph is its title (it is not said again above it). */
export const titled = (d: Doc) => !!d.blocks[0] && sameText(d.blocks[0].text.replace(/^#+\s*/, ''), d.title)

/** Its first paragraph begins with its title on a line of its own: the rest of it shows as the paragraph. */
export function titleLine(d: Doc): string | null {
  const b = d.blocks[0]
  if (!b || titled(d) || b.kind !== 'para') return null
  const [first, ...rest] = b.text.split('\n')
  return rest.length > 0 && sameText(first.replace(/^#+\s*/, ''), d.title) ? rest.join('\n') : null
}

/** A long document (three headings or more after its title) starts with its contents. */
export function outline(d: Doc): { key: string; text: string; deep: boolean }[] {
  const hs = d.blocks.slice(1).filter((b) => b.kind === 'heading')
  if (hs.length < 3) return []
  return hs.map((b) => ({ key: b.key, text: b.text.replace(/^#+\s*/, ''), deep: (b.text.match(/^#+/) || ['#'])[0].length > 2 }))
}

/** Paragraphs with the same words share a key, so each is told apart by which one it is: key~0, key~1, ... */
export function blockKeys(d: Doc): string[] {
  const seen: Record<string, number> = {}
  return d.blocks.map((b) => `${b.key}~${(seen[b.key] = (seen[b.key] ?? -1) + 1)}`)
}

/** The item's latest question points at this document, and you replied on the item instead of picking in it. */
export function skipped(d: Doc, it: Item | undefined): boolean {
  const asks = (it?.thread || []).filter((x) => x.kind === 'ask' && new RegExp(`\\bD${d.d}\\b`).test(x.text))
  const x = asks.at(-1)
  return !!(it && x && it.thread.slice(it.thread.indexOf(x) + 1).some(userWord))
}

/** The document's text as its editor shows it: its title as the first line (a web page is its HTML). */
export const noteText = (d: Doc) => (d.fmt === 'html' || sameText(d.md.split('\n')[0].replace(/^#+\s*/, ''), d.title) ? d.md : `# ${d.title}\n\n${d.md}`)

/** What a comment written now goes to: a thread you reply in, words you picked in a paragraph, or paragraphs. */
export interface DocTarget {
  key: string
  quote: string
  reply?: boolean
  th?: number
  many?: number
}

export function docTarget(d: Doc, pick: { reply: string | null; quote: { key: string; text: string } | null; sel: ReadonlySet<string> }): DocTarget | null {
  if (pick.reply) {
    const { key, th } = splitThread(pick.reply)
    const b = d.blocks.find((x) => x.key === key)
    const t = d.detached.find((x) => x.key === key)
    const first = [...(b?.comments || []), ...(t?.comments || []), ...(d.whole || [])].find((c) => threadKey(c) === pick.reply)
    return { key, ...(th ? { th } : {}), reply: true, quote: first?.quote || b?.text || t?.quote || '' }
  }
  if (pick.quote) return { key: pick.quote.key, quote: pick.quote.text }
  const picked: Block[] = d.blocks.filter((b) => pick.sel.has(b.key))
  return picked.length ? { key: picked[0].key, quote: picked.map((b) => b.text).join('\n'), many: picked.length } : null
}

/** Every comment the document has (on its paragraphs, on the whole of it, on words changed since). */
export const commentCount = (d: Doc) =>
  d.blocks.reduce((k, b) => k + b.comments.length, 0) + (d.whole?.length || 0) + d.detached.reduce((k, t) => k + t.comments.length, 0)
