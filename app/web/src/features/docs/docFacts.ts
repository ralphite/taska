// What a document's view shows, from the model and how you have it open (pure: the container and the stories both
// use it).

import { blockKeys, outline, resolved, skipped, threadNew, threadsOf, titled, titleLine } from '../../model/docs'
import { codeOf, liveN, type ProjectModel } from '../../model/project'
import { when } from '../../model/time'
import type { Doc } from '../../model/types'
import { whoName } from '../../model/words'
import type { DocViewState } from '../../stores/docView'
import { TICKED_LINE, tickText, ticksNotSent, type TickState } from '../../model/docTicks'
import type { DocFacts, ShownThread } from './DocView'

export type DocLook = Pick<DocViewState, 'threads' | 'sel' | 'quote' | 'reply' | 'circle' | 'typing'>


export function factsOf(m: ProjectModel, d: Doc, v: DocLook, seen: Readonly<Record<string, string>>, desk: boolean, asked: Readonly<Record<string, number>>, recording: boolean, ticks: TickState): DocFacts {
  const shown = (t: ReturnType<typeof threadsOf>[number], key: string): ShownThread => ({ t, isNew: threadNew(seen, d, key, t.comments), done: resolved(d, t.tk) })
  const isOpen = (tk: string, key: string) => v.threads.has(tk) || v.threads.has(key)
  const tks = blockKeys(d)
  const first = titleLine(d)
  const isTitled = titled(d)
  const it = m.byN.get(liveN(m, d.n))
  const skip = skipped(d, it)
  const rows = d.blocks.map((b, i) => {
    const threads = threadsOf(b.comments)
    // the thread opened over the text; a paragraph opened as a whole (just commented on) opens its latest thread
    const open = desk ? (threads.map((t) => t.tk).find((tk) => v.threads.has(tk)) ?? (v.threads.has(b.key) ? (threads.at(-1)?.tk ?? null) : null)) : null
    const now = tickText(ticks, d.d, tks[i], b.text) // ticked here and not sent yet
    return {
      b,
      tk: tks[i],
      text: i === 0 && first != null ? first : now,
      sent: now === b.text && TICKED_LINE.test(b.text) && !ticks.open.has(`${d.d} ${tks[i]}`),
      title: i === 0 && isTitled,
      counts: threads.map((t) => ({ tk: t.tk, n: t.comments.length, done: resolved(d, t.tk), quote: t.quote })),
      open,
      threads: threads.filter((t) => (desk ? t.tk === open : isOpen(t.tk, b.key))).map((t) => shown(t, b.key)),
      isNew: threadNew(seen, d, b.key, b.comments),
      picked: v.sel.has(b.key),
      quote: v.quote?.key === b.key ? v.quote.text : null,
      skipped: skip,
      say: !desk && !v.typing && (v.sel.has(b.key) || v.quote?.key === b.key),
    }
  })
  const wholeThreads = threadsOf(d.whole || [])
  return {
    d,
    itemCode: codeOf(m, d.n),
    by: whoName(d.by),
    when: when(d.t1, m.at),
    rows,
    showTitle: !isTitled && d.fmt !== 'html',
    outline: d.fmt === 'html' ? [] : outline(d),
    whole: { n: (d.whole || []).length, open: desk && v.threads.has('doc') && d.whole.length ? { t: { tk: 'doc', comments: d.whole, quote: '' }, isNew: threadNew(seen, d, 'doc', d.whole), done: resolved(d, 'doc') } : null },
    wholeThreads: desk ? [] : wholeThreads.map((t) => shown(t, 'doc')),
    detached: desk ? [] : d.detached.map((t) => ({ key: t.key, quote: t.quote, threads: threadsOf(t.comments).map((x) => shown(x, t.key)) })),
    waiting: ticksNotSent(ticks, d),
    circle: v.circle,
    deleting: !!asked['doc-delete ' + d.d],
    replying: v.reply,
    asking: Object.keys(asked).find((k) => k.startsWith(`unfile ${d.d} `))?.slice(`unfile ${d.d} `.length) ?? null,
    wholeButton: !(v.typing && !v.sel.size && !v.quote && !v.reply),
    recording,
  }
}

