// A document as it is read: who wrote it on which item, its title, its contents when it is long, its paragraphs with
// their comment threads (beside the text on the desktop, under the paragraph on the phone), the comments on the whole
// document, and those whose words changed since. On the phone a paragraph is tapped to comment on it. Props only.

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { plainQuote } from '../../model/markdown'
import { sameText, type Thread as DocThread } from '../../model/docs'
import type { Block, Doc } from '../../model/types'
import { plural } from '../../model/words'
import { Icon } from '../../ui/Icon'
import { RichFrame } from '../../ui/Markdown'
import type { SheetLook } from '../../ui/Sheet'
import { MUTED, NEEDS_PILL, PRIMARY } from '../../ui/tones'
import { BlockActs, type CountInfo } from './BlockActs'
import { DocBlock } from './DocBlock'
import { PlaceVoiceFloat, itemWords, listItemOf } from '../../ui/PlaceVoice'
import { DraftCard, NewDot, Thread, type DocEnv, type ThreadEvents } from './Thread'
import type { NotSent } from '../../model/voiceComments'

/** How the phone shows a document: a sheet over the whole screen down to the box. */
export const PHONE_DOC_LOOK: SheetLook = { full: true, aboveComposer: true }

export interface ShownThread {
  t: DocThread
  isNew: boolean
  done: boolean
  /** when it was resolved (the time Taska keeps; none yet while that is on its way) */
  doneAt?: string
}

export interface DocRow {
  b: Block
  /** which of the paragraphs with these words it is */
  tk: string
  /** its words as shown (ticked and not sent yet, or without the title line) */
  text: string
  /** its choices were sent and not changed since */
  sent: boolean
  title: boolean
  /** the desktop's counts beside it, and the thread open over it */
  counts: CountInfo[]
  open: string | null
  /** the phone's threads shown open under it */
  threads: ShownThread[]
  isNew: boolean
  picked: boolean
  /** words picked in it (the phone marks the item of a list) */
  quote: string | null
  skipped: boolean
  /** the phone's row to speak or write a comment, floating by the paragraph picked (B715 r1169) */
  say: boolean
  /** its own Voice is recording a comment about it */
  speaking: boolean
  /** voice comments on it not sent yet */
  drafts: readonly NotSent[]
  /** the phone's Not sent cards shown open under it */
  draftsShown: boolean
}

export interface DocFacts {
  d: Doc
  itemCode: string
  by: string
  when: string
  rows: DocRow[]
  showTitle: boolean
  outline: { key: string; text: string; deep: boolean }[]
  /** the desktop's comments on the whole document: open over the text, or closed */
  whole: { n: number; open: ShownThread | null }
  /** the phone's: under the text */
  wholeThreads: ShownThread[]
  detached: { key: string; quote: string; threads: ShownThread[] }[]
  /** choices ticked and not sent */
  waiting: string
  circle: boolean
  replying: string | null
  asking: string | null
}

export interface DocEvents extends ThreadEvents {
  goItem(): void
  toggle(tk: string): void
  away(tk: string): void
  /** a paragraph tapped, or its Comment pressed (`quote`: one item of its list) */
  pick(key: string, quote: string | null, by: 'button' | 'tap'): void
  /** a place's Voice; its recording strip's ✕, ✓ and ↑ (B498) */
  say(key: string, quote: string | null): void
  sayCancel(): void
  sayCheck(): void
  saySend(): void
  /** the phone's Comment under a part picked: the box opens to write about it */
  type(): void
  moveDoc(from?: HTMLElement): void
  deleteDoc(): void
  /** the whole text on the clipboard */
  copyDoc(): void
  circle(): void
  editDoc(): void
  tick(tk: string, i: number): void
  modifyTicks(tk: string): void
  /** the phone's Send choices, in the document's own line (it has no box over a document, B643) */
  sendTicks(): void
}

const TICKED_LINE = /^\s*[-*+]\s+[([][xX][)\]]/m
const CHOICE_LINE = /^\s*[-*+]\s+(\(|\[)[ xX]?(\)|\])\s+/m

/** The words a comment is on are marked in the text (when they sit in one run of text). */
function useMarkQuotes(root: React.RefObject<HTMLDivElement | null>, rows: DocRow[], resolved: (tk: string) => boolean) {
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    for (const r of rows)
      for (const c of r.counts) {
        const q = plainQuote(c.quote || '').trim()
        const sec = el.querySelector(`section[data-key="${CSS.escape(r.b.key)}"] [data-block]`)
        if (!q || !sec || sameText(q, plainQuote(r.b.text)) || q.length > 300) continue
        if (sec.querySelector(`mark[data-quote="${CSS.escape(c.tk)}"]`)) continue
        const walk = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT)
        while (walk.nextNode()) {
          const t = walk.currentNode as Text
          const at = t.data.indexOf(q)
          if (at < 0 || t.parentElement?.closest('mark, button')) continue
          const m = document.createElement('mark')
          const rest = t.splitText(at)
          rest.splitText(q.length)
          m.dataset.quote = c.tk
          m.className = `rounded-sm ${resolved(c.tk) ? 'bg-transparent text-inherit underline decoration-zinc-300 decoration-dotted' : 'bg-amber-100 text-inherit dark:bg-amber-400/25'}`
          rest.replaceWith(m)
          m.append(rest)
          break
        }
      }
  })
}

function Outline({ heads, onJump }: { heads: DocFacts['outline']; onJump(key: string): void }) {
  if (!heads.length) return null
  return (
    <details className="mt-3 rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
      <summary className="cursor-pointer text-xs font-semibold text-zinc-500 dark:text-zinc-400">Contents · {heads.length}</summary>
      <div className="mt-1 flex flex-col">
        {heads.map((h) => (
          <button
            key={h.key}
            onClick={() => onJump(h.key)}
            className={`truncate rounded-md py-1 text-left text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${h.deep ? 'pl-6' : 'pl-2'}`}
          >
            {h.text}
          </button>
        ))}
      </div>
    </details>
  )
}

export function DocView({ facts, env, on, lasso, page, meter, aim = null, onAimed }: {
  facts: DocFacts
  env: DocEnv
  on: DocEvents
  /** the passage to bring into view ("doc": the end, its comments on the whole document) */
  aim?: string | null
  onAimed?(): void
  /** the drafts not sent yet, beside a paragraph (the desktop) */
  /** drawing around an area */
  lasso?: ReactNode
  /** a web page's own view (WebPage) */
  page?: ReactNode
  /** the recording's time and level, for the strip of the place it is about (B498) */
  meter?: ReactNode
}) {
  const { d, rows, desk } = { ...facts, desk: env.desk }
  const web = d.fmt === 'html'
  const root = useRef<HTMLDivElement>(null)
  useMarkQuotes(root, rows, (tk) => !!d.resolved?.[tk])
  useLayoutEffect(() => {
    // come from the item's talk to a comment: its passage in view
    if (!aim) return
    const el = root.current
    const at = aim === 'doc' ? [...(el?.querySelectorAll('section') || [])].at(-1) : el?.querySelector(`[data-doc-blocks] [data-key="${CSS.escape(aim)}"]`)
    requestAnimationFrame(() => at?.scrollIntoView({ block: 'center' }))
    onAimed?.()
  }, [aim, onAimed])
  useLayoutEffect(() => {
    // the one item of a list you picked is marked, not the whole list
    const el = root.current
    if (!el) return
    for (const li of el.querySelectorAll('li[data-q]')) li.removeAttribute('data-q')
    const r = rows.find((x) => x.quote)
    if (!r) return
    // found as its buttons find it, so they sit by the item lit (B715 r1176)
    const sec = el.querySelector(`section[data-key="${CSS.escape(r.b.key)}"]`)
    if (sec && r.quote) listItemOf(sec, r.quote)?.setAttribute('data-q', '')
  })
  const thread = (s: ShownThread, blockText?: string, rail = false) => (
    <Thread key={s.t.tk} t={s.t} blockText={blockText} rail={rail} isNew={s.isNew} done={s.done} doneAt={s.doneAt} replying={facts.replying === s.t.tk} asking={facts.asking} env={env} on={on} />
  )
  // the phone's row to speak or write floats by the last paragraph picked (an area drawn picks several)
  const sayAt = rows.filter((r) => r.say).at(-1)?.tk
  return (
    <div ref={root} className="flex min-h-full flex-col">
      {/* a web page takes the pane's whole width, as a page in a browser does */}
      <div className={`relative flex min-w-0 flex-col lg:mx-auto lg:w-full ${web ? '' : 'lg:max-w-[min(46rem,calc(100%-5rem))]'}`}>
        {/* on the phone, what it is on, who wrote it and when take their own line, the buttons the next */}
        <div className={`relative flex flex-wrap items-center gap-1 text-xs text-zinc-500 ${web ? 'lg:absolute lg:top-2 lg:right-2 lg:z-10' : ''}`}>
          {desk && facts.whole.n ? (
            <>
              <button
                onClick={() => on.toggle('doc')}
                className="order-last flex h-7 items-center gap-1 rounded-md bg-amber-100 px-2 font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-800/70"
              >
                <Icon n="comment" c="size-3.5" />
                {plural(facts.whole.n, 'comment')} on the document
              </button>
              {/* opened, its thread takes its own line under the bar, at the right: it moves the words down, never covers them */}
              {facts.whole.open ? (
                <div className="order-last flex basis-full justify-end pt-1">
                  <div className="w-80 max-w-full text-sm">{thread(facts.whole.open, undefined, true)}</div>
                </div>
              ) : null}
            </>
          ) : null}
          <span hidden={web || d.kind === 'rules'} className="min-w-0 flex-1 basis-full truncate lg:basis-auto">
            on{' '}
            <button onClick={on.goItem} className="text-blue-600 hover:underline dark:text-blue-400">
              {facts.itemCode}
            </button>{' '}
            · {facts.by} · {facts.when}
          </span>
          {/* the phone's Copy, Move, Mark an area, Edit and Delete are in the ⋯ by its close button (D115 #41); the
              desktop's are in the pane's bar */}
        </div>
        {facts.waiting ? (
          // the phone sends them from here, having no box over a document (B643); the desktop's box line has Send choices
          <div className="mt-3 flex items-center gap-2">
            <span className={NEEDS_PILL}>{facts.waiting}</span>
            {desk ? null : (
              <button onClick={on.sendTicks} className={`${PRIMARY} ml-auto`}>
                Send choices
              </button>
            )}
          </div>
        ) : null}
        {facts.showTitle ? <div className="mt-3 text-2xl leading-tight font-bold tracking-tight">{d.title}</div> : null}
        {web ? page : null}
        {web ? null : <Outline heads={facts.outline} onJump={(key) => root.current?.querySelector(`section[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })} />}
        <div hidden={web} data-doc-blocks={facts.d.d} className={`relative mt-3 space-y-3 text-[15px] ${facts.circle ? 'select-none' : ''}`}>
          {(web ? [] : rows).map((r) => {
            const lv = (r.b.text.match(/^#+/) || ['#'])[0].length
            // the phone's count has the comments not sent yet too (the desktop's are BlockActs')
            const n = r.b.comments.length + r.drafts.length
            // every thread on it resolved: a quiet mark, as the desktop's
            const done = r.counts.length > 0 && r.counts.every((c) => c.done)
            return (
              <section
                key={r.tk}
                data-key={r.b.key}
                onClick={(e) => {
                  const t = e.target as Element
                  if (t.closest('button, a, [data-ref]')) return
                  // on the phone a tap on one item of a list picks that item, as pointing at it does on the desktop
                  const li = desk ? null : t.closest<HTMLElement>('li')
                  on.pick(r.b.key, li ? itemWords(li) : null, 'tap')
                }}
                {...(r.picked || r.speaking ? { 'data-picked': '' } : {})}
                className="group/blk relative -mx-2 rounded-lg px-2 py-1 transition-colors hover:bg-zinc-50 has-[li[data-hov]]:bg-transparent data-picked:bg-amber-50 data-picked:ring-2 data-picked:ring-amber-300 lg:cursor-text lg:after:absolute lg:after:inset-y-0 lg:after:left-full lg:after:w-18 dark:hover:bg-zinc-800/50 dark:data-picked:bg-amber-950/40 dark:data-picked:ring-amber-600 lg:[&_li[data-hov]]:rounded-md lg:[&_li[data-hov]]:bg-zinc-100 dark:lg:[&_li[data-hov]]:bg-zinc-800/70 [&_li[data-q]]:-mx-1 [&_li[data-q]]:rounded-md [&_li[data-q]]:bg-amber-50 [&_li[data-q]]:px-1 [&_li[data-q]]:ring-2 [&_li[data-q]]:ring-amber-300 dark:[&_li[data-q]]:bg-amber-950/40 dark:[&_li[data-q]]:ring-amber-600"
              >
                <div className="relative flex flex-col gap-1 lg:flex-row lg:items-start lg:gap-2">
                  <RichFrame text={r.text} data-block="" cls={`min-w-0 flex-1 break-words ${r.b.kind === 'heading' ? 'pr-14 lg:pr-0' : ''}`} onRef={on.ref} onPicture={on.picture}>
                    <DocBlock b={{ kind: r.b.kind, text: r.text }} title={r.title} world={env.world} ticking={{ sent: r.sent, tick: (i) => on.tick(r.tk, i), modify: () => on.modifyTicks(r.tk) }} />
                  </RichFrame>
                  {n ? (
                    <button
                      onClick={() => on.toggle(r.b.key)}
                      aria-label={plural(n, 'comment')}
                      className={`${r.b.kind === 'heading' ? `absolute right-0 lg:relative lg:top-0 ${r.title ? 'top-0.5' : lv <= 2 ? 'top-2.5' : 'top-1'}` : 'relative self-end'} flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium after:absolute after:-inset-2.5 lg:mt-0.5 lg:hidden lg:self-start ${done ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700' : 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-900'}`}
                    >
                      <Icon n={done ? 'check' : 'comment'} c="size-3.5" />
                      {n}
                      {r.isNew ? <NewDot /> : null}
                    </button>
                  ) : null}
                </div>
                {r.tk === sayAt ? (
                  // the phone's row on the place picked, floating under it over the text (over it when the screen
                  // has no room under it): it never moves the words (B715 r1169); speaking, its recording strip (B498)
                  <PlaceVoiceFloat
                    rec={r.speaking}
                    item={r.quote}
                    meter={meter}
                    say={{ 'data-part-say': '', 'data-key': r.b.key, 'data-quote': r.quote ?? '' }}
                    on={{ say: () => on.say(r.b.key, r.quote), comment: on.type, cancel: on.sayCancel, check: on.sayCheck }}
                  />
                ) : null}
                {r.skipped && CHOICE_LINE.test(r.b.text) && !TICKED_LINE.test(r.b.text) ? (
                  <div className="mt-1.5 flex items-center gap-1 text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
                    <Icon n="reply" c="size-3.5" />
                    Skipped · you replied on {facts.itemCode}
                  </div>
                ) : null}
                {desk ? null : r.threads.map((s) => thread(s, r.b.text))}
                {r.draftsShown ? (
                  <div className="mt-2 space-y-2">
                    {r.drafts.map((x) => (
                      <DraftCard key={x.label} words={x.words} voice={x.voice} transcribing={x.transcribing} />
                    ))}
                  </div>
                ) : null}
                {desk ? (
                  <BlockActs
                    counts={r.counts}
                    open={r.open}
                    rec={r.speaking}
                    picked={r.picked || r.quote != null}
                    meter={meter}
                    on={{ say: (q) => on.say(r.b.key, q), comment: (q) => on.pick(r.b.key, q, 'button'), cancel: on.sayCancel, check: on.sayCheck, send: on.saySend, toggle: on.toggle, away: on.away }}
                  >
                    {r.open ? (
                      <>
                        {r.threads.filter((s) => s.t.tk === r.open).map((s) => thread(s, r.b.text, true))}
                        {r.open === `${r.b.key}#new` ? r.drafts.map((x) => <DraftCard key={x.label} words={x.words} voice={x.voice} transcribing={x.transcribing} />) : null}
                      </>
                    ) : null}
                  </BlockActs>
                ) : null}
              </section>
            )
          })}
          {lasso}
        </div>
        {!desk && facts.wholeThreads.length ? (
          <section className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-500">Whole document</div>
            {facts.wholeThreads.map((s) => thread(s))}
          </section>
        ) : null}
        {!desk && facts.detached.length ? (
          <div className="mt-6 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-500">Original text changed</div>
            {facts.detached.map((t) => (
              <section key={t.key}>
                <div className={`text-sm line-through ${MUTED}`}>{t.quote}</div>
                {t.threads.map((s) => thread(s))}
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
