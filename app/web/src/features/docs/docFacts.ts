// What a document's view shows, from the model and how you have it open (pure: the container and the stories both
// use it).

import { blockKeys, outline, resolved, skipped, threadNew, threadsOf, titled, titleLine } from '../../model/docs'
import { codeOf, liveN, type ProjectModel } from '../../model/project'
import { clock, when } from '../../model/time'
import type { Doc } from '../../model/types'
import { whoName } from '../../model/words'
import type { DocViewState } from '../../stores/docView'
import { TICKED_LINE, tickText, ticksNotSent, type TickState } from '../../model/docTicks'
import type { DocFacts, ShownThread } from './DocView'
import type { PageThread } from './WebPage'
import type { NotSent } from '../../model/voiceComments'

export type DocLook = Pick<DocViewState, 'threads' | 'sel' | 'quote' | 'reply' | 'circle' | 'typing'>

export function factsOf(m: ProjectModel, d: Doc, v: DocLook, seen: Readonly<Record<string, string>>, desk: boolean, asked: Readonly<Record<string, number>>, speaking: { key: string | null; bar: boolean } | null, ticks: TickState, notSent: readonly NotSent[] = []): DocFacts {
  const shown = (t: ReturnType<typeof threadsOf>[number], key: string): ShownThread => ({ t, isNew: threadNew(seen, d, key, t.comments), done: resolved(d, t.tk) })
  const isOpen = (tk: string, key: string) => v.threads.has(tk) || v.threads.has(key)
  const tks = blockKeys(d)
  const first = titleLine(d)
  const isTitled = titled(d)
  const it = m.byN.get(liveN(m, d.n))
  const skip = skipped(d, it)
  const rows = d.blocks.map((b, i) => {
    const threads = threadsOf(b.comments)
    // voice comments on it not sent yet: a count of their own, opening their Not sent cards
    const drafts = notSent.filter((x) => x.key === b.key)
    const newKey = `${b.key}#new`
    // the thread opened over the text; a paragraph opened as a whole (just commented on) opens its latest thread
    const open = desk ? ([...threads.map((t) => t.tk), newKey].find((tk) => v.threads.has(tk)) ?? (v.threads.has(b.key) ? (threads.at(-1)?.tk ?? (drafts.length ? newKey : null)) : null)) : null
    const now = tickText(ticks, d.d, tks[i], b.text) // ticked here and not sent yet
    return {
      b,
      tk: tks[i],
      text: i === 0 && first != null ? first : now,
      sent: now === b.text && TICKED_LINE.test(b.text) && !ticks.open.has(`${d.d} ${tks[i]}`),
      title: i === 0 && isTitled,
      counts: [...threads.map((t) => ({ tk: t.tk, n: t.comments.length, done: resolved(d, t.tk), quote: t.quote })), ...(drafts.length ? [{ tk: newKey, n: drafts.length, done: false, quote: '' }] : [])],
      drafts,
      draftsShown: !desk && drafts.length > 0 && isOpen(newKey, b.key),
      open,
      threads: threads.filter((t) => (desk ? t.tk === open : isOpen(t.tk, b.key))).map((t) => shown(t, b.key)),
      isNew: threadNew(seen, d, b.key, b.comments),
      picked: v.sel.has(b.key),
      quote: v.quote?.key === b.key ? v.quote.text : null,
      skipped: skip,
      // recording: the row stays under the paragraph its own mic speaks about; else under the one picked
      say: !desk && !v.typing && (speaking ? !speaking.bar && speaking.key === b.key : v.sel.has(b.key) || v.quote?.key === b.key),
      speaking: speaking?.key === b.key,
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
    recording: speaking != null,
  }
}


/** What a web page's comments over it show: each thread's count in its part's corner (and the count of comments in the
 * box not sent yet on a part), the part picked or spoken about, the thread open, and what each count opens. */
export interface WebFacts {
  threads: PageThread[]
  held: { key: string; text: string } | null
  open: string | null
  cards: Readonly<Record<string, WebCard>>
  asking: string | null
}
export type WebCard = { kind: 'thread'; s: ShownThread } | { kind: 'drafts'; list: readonly NotSent[] }

export function webFacts(d: Doc, v: Pick<DocViewState, 'threads' | 'quote'>, seen: Readonly<Record<string, string>>, asked: Readonly<Record<string, number>>, notSent: readonly NotSent[], spoken: { key: string; text: string } | null): WebFacts {
  const all = d.blocks.flatMap((b) => threadsOf(b.comments).map((t) => ({ t, key: b.key })))
  // a comment not sent yet (its quote in the box, with what was said or written under it) shows where it will go
  const drafts = notSent.filter((x) => x.key.startsWith('h:'))
  const draftKeys = [...new Set(drafts.map((x) => x.key))]
  const cards: Record<string, WebCard> = {}
  for (const { t, key } of all) cards[t.tk] = { kind: 'thread', s: { t, isNew: threadNew(seen, d, key, t.comments), done: resolved(d, t.tk) } }
  for (const key of draftKeys) cards[`${key}#new`] = { kind: 'drafts', list: drafts.filter((x) => x.key === key) }
  return {
    threads: [
      ...all.map(({ t, key }) => ({ tk: t.tk, key, quote: t.quote, n: t.comments.length, done: resolved(d, t.tk) })),
      ...draftKeys.map((key) => ({ tk: `${key}#new`, key, quote: '', n: drafts.filter((x) => x.key === key).length, done: false, draft: true })),
    ],
    // the part spoken about: the mic pressed turns into Stop right there, and no other part lights
    held: spoken ?? (v.quote?.key.startsWith('h:') ? v.quote : null),
    open: all.find(({ t, key }) => v.threads.has(t.tk) || v.threads.has(key))?.t.tk ?? draftKeys.map((k) => `${k}#new`).find((tk) => v.threads.has(tk)) ?? null,
    cards,
    asking: Object.keys(asked).find((k) => k.startsWith(`unfile ${d.d} `))?.slice(`unfile ${d.d} `.length) ?? null,
  }
}

/** What the editor's line over the text says, and its Speak button: listening, working out the words of voice notes
 * said into it (`waiting` of them), or how the editor works. */
export function editFacts(rec: { ms: number } | null, waiting: number, desk: boolean) {
  return {
    hint: rec
      ? 'Listening. Words go at the mark; you can keep typing.'
      : waiting
        ? 'Transcribing\u2026'
        : desk
          ? 'First line is the title. Esc keeps it as a draft.'
          : 'The first line is the title.',
    mic: { on: !!rec, text: rec ? `Stop ${clock(rec.ms)}` : 'Speak' },
  }
}
