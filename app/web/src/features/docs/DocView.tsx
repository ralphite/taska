// A document as it is read: who wrote it on which item, its title, its contents when it is long, its paragraphs with
// their comment threads (beside the text on the desktop, under the paragraph on the phone), the comments on the whole
// document, and those whose words changed since. On the phone a paragraph is tapped to comment on it. Props only.

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { plainQuote } from '../../model/markdown'
import { sameText, type Thread as DocThread } from '../../model/docs'
import type { Block, Doc } from '../../model/types'
import { plural } from '../../model/words'
import { Icon } from '../../ui/Icon'
import { RichFrame } from '../../ui/Markdown'
import { BTN, HIT, NEEDS_PILL } from '../../ui/tones'
import { BlockActs, type CountInfo } from './BlockActs'
import { DocBlock } from './DocBlock'
import { DraftCard, NewDot, Thread, type DocEnv, type ThreadEvents } from './Thread'
import type { NotSent } from '../../model/voiceComments'

export interface ShownThread {
  t: DocThread
  isNew: boolean
  done: boolean
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
  /** the phone's row to speak or type a comment, under the paragraph picked */
  say: boolean
  /** its own mic is recording a comment about it */
  speaking: boolean
  /** voice comments on it not sent yet */
  drafts: readonly NotSent[]
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
  /** Delete waits for its second click */
  deleting: boolean
  replying: string | null
  asking: string | null
  /** the phone shows Comment on the whole document */
  wholeButton: boolean
  recording: boolean
}

export interface DocEvents extends ThreadEvents {
  goItem(): void
  toggle(tk: string): void
  away(tk: string): void
  /** a paragraph tapped, or its Comment pressed (`quote`: one item of its list) */
  pick(key: string, quote: string | null, by: 'button' | 'tap'): void
  say(key: string, quote: string | null): void
  sayCancel(): void
  type(): void
  moveDoc(from?: HTMLElement): void
  deleteDoc(): void
  circle(): void
  /** words selected in a paragraph: what a comment quotes */
  quote(key: string, text: string): void
  editDoc(): void
  whole(): void
  tick(tk: string, i: number): void
  modifyTicks(tk: string): void
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

/** On the phone, under the paragraph you tapped: speak (the same button stops and posts), or type. */
export function SayRow({ rec, on }: { rec: boolean; on: { say(): void; cancel(): void; type(): void } }) {
  return rec ? (
    <div className="mt-2 flex items-center gap-2">
      <button onClick={on.say} aria-label="Stop and post the comment" className="grid size-12 shrink-0 place-items-center rounded-full bg-red-600 text-white shadow-lg">
        <Icon n="stop" c="size-5" />
      </button>
      <span className="text-[13px] text-zinc-500 dark:text-zinc-400">· tap to post</span>
      <button onClick={on.cancel} className="ml-auto h-10 rounded-full px-3 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-300 dark:text-zinc-300 dark:ring-zinc-600">
        Cancel
      </button>
    </div>
  ) : (
    <div className="mt-2 flex items-center gap-2">
      <button onClick={on.say} aria-label="Dictate comment" className="grid size-12 shrink-0 place-items-center rounded-full bg-zinc-900 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
        <Icon n="mic" c="size-5" />
      </button>
      <span className="text-[13px] text-zinc-500 dark:text-zinc-400">Tap to speak, tap again to post</span>
      <button onClick={on.type} aria-label="Type instead" className="ml-auto h-10 rounded-full px-3 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-300 dark:text-zinc-300 dark:ring-zinc-600">
        Aa
      </button>
    </div>
  )
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

export function DocView({ facts, env, on, popover, lasso, page, aim = null, onAimed }: {
  facts: DocFacts
  env: DocEnv
  on: DocEvents
  /** the passage to bring into view ("doc": the end, its comments on the whole document) */
  aim?: string | null
  onAimed?(): void
  /** the drafts not sent yet, beside a paragraph (the desktop) */
  popover?(row: DocRow): ReactNode
  /** drawing around an area */
  lasso?: ReactNode
  /** a web page's own view (WebPage) */
  page?: ReactNode
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
    // on the phone the one item of a list you picked is marked, not the whole list
    const el = root.current
    if (!el) return
    for (const li of el.querySelectorAll('li[data-q]')) li.removeAttribute('data-q')
    const r = desk ? null : rows.find((x) => x.quote)
    if (!r) return
    const li = [...el.querySelectorAll<HTMLElement>(`section[data-key="${CSS.escape(r.b.key)}"] li`)].find((l) => l.innerText.trim() === r.quote)
    li?.setAttribute('data-q', '')
  })
  useEffect(() => {
    // words selected in a paragraph (not in a comment) are what a comment quotes; a collapsed selection keeps the last
    const seen = () => {
      const sel = getSelection()
      const text = sel?.toString().trim()
      if (facts.circle || !sel || !text || text.length < 2) return
      const node = sel.anchorNode
      const at = node?.nodeType === 1 ? (node as Element) : node?.parentElement
      const sec = at?.closest<HTMLElement>('section[data-key]')
      if (!sec || !root.current?.contains(sec) || at?.closest('[data-thread]')) return
      on.quote(sec.dataset.key || '', text.slice(0, 500))
    }
    document.addEventListener('selectionchange', seen)
    return () => document.removeEventListener('selectionchange', seen)
  }, [facts.circle, on])
  const thread = (s: ShownThread, blockText?: string, rail = false) => (
    <Thread key={s.t.tk} t={s.t} blockText={blockText} rail={rail} isNew={s.isNew} done={s.done} replying={facts.replying === s.t.tk} asking={facts.asking} env={env} on={on} />
  )
  const phoneBtn = `${HIT} ${BTN} text-sm lg:hidden`
  return (
    <div ref={root} className="flex min-h-full flex-col">
      {/* a web page takes the pane's whole width, as a page in a browser does */}
      <div className={`relative flex min-w-0 flex-col lg:mx-auto lg:w-full ${web ? '' : 'lg:max-w-[min(46rem,calc(100%-5rem))]'}`}>
        <div className={`relative flex items-center gap-1 text-xs text-zinc-500 ${web ? 'lg:absolute lg:top-2 lg:right-2 lg:z-10' : ''}`}>
          {desk && facts.whole.n ? (
            <>
              <button
                onClick={() => on.toggle('doc')}
                className="order-last flex h-7 items-center gap-1 rounded-md bg-amber-100 px-2 font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-800/70"
              >
                <Icon n="comment" c="size-3.5" />
                {plural(facts.whole.n, 'comment')} on the document
              </button>
              {facts.whole.open ? <div className="absolute top-full right-0 z-20 mt-1 w-80 text-sm">{thread(facts.whole.open, undefined, true)}</div> : null}
            </>
          ) : null}
          <span hidden={web} className="min-w-0 flex-1 truncate">
            on{' '}
            <button onClick={on.goItem} className="text-blue-600 hover:underline dark:text-blue-400">
              {facts.itemCode}
            </button>{' '}
            · {facts.by} · {facts.when}
          </span>
          <button onClick={() => on.moveDoc()} className={phoneBtn}>
            Move
          </button>
          <button onClick={on.deleteDoc} className={phoneBtn}>
            {facts.deleting ? `Delete D${d.d}?` : 'Delete'}
          </button>
          <button
            onClick={on.circle}
            hidden={web}
            aria-pressed={facts.circle}
            className={`${phoneBtn} aria-pressed:bg-amber-100 aria-pressed:text-amber-900 dark:aria-pressed:bg-amber-900/60 dark:aria-pressed:text-amber-100`}
          >
            {facts.circle ? 'Draw around it…' : 'Mark an area'}
          </button>
          <button onClick={on.editDoc} className={phoneBtn}>
            Edit
          </button>
        </div>
        {facts.waiting ? (
          <div className="mt-3 flex">
            <span className={NEEDS_PILL}>{facts.waiting}</span>
          </div>
        ) : null}
        {facts.showTitle ? <div className="mt-3 text-2xl leading-tight font-bold tracking-tight">{d.title}</div> : null}
        {web ? page : null}
        {web ? null : <Outline heads={facts.outline} onJump={(key) => root.current?.querySelector(`section[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })} />}
        <div hidden={web} data-doc-blocks={facts.d.d} className={`relative mt-3 space-y-3 text-[15px] ${facts.circle ? 'select-none' : ''}`}>
          {(web ? [] : rows).map((r) => {
            const lv = (r.b.text.match(/^#+/) || ['#'])[0].length
            const n = r.b.comments.length
            return (
              <section
                key={r.tk}
                data-key={r.b.key}
                onClick={(e) => {
                  const t = e.target as Element
                  if (t.closest('button, a, [data-ref]')) return
                  // on the phone a tap on one item of a list picks that item, as pointing at it does on the desktop
                  const li = desk ? null : t.closest<HTMLElement>('li')
                  on.pick(r.b.key, li ? li.innerText.trim().slice(0, 500) : null, 'tap')
                }}
                {...(r.picked ? { 'data-picked': '' } : {})}
                className="group/blk relative -mx-2 rounded-lg px-2 py-1 transition-colors hover:bg-zinc-50 has-[li[data-hov]]:bg-transparent data-hl:bg-amber-50 data-picked:bg-amber-50 data-picked:ring-2 data-picked:ring-amber-300 data-pressed:opacity-70 lg:cursor-text lg:after:absolute lg:after:inset-y-0 lg:after:left-full lg:after:w-18 dark:hover:bg-zinc-800/50 dark:data-hl:bg-amber-950/30 dark:data-picked:bg-amber-950/40 dark:data-picked:ring-amber-600 lg:[&_li[data-hov]]:rounded-md lg:[&_li[data-hov]]:bg-zinc-100 dark:lg:[&_li[data-hov]]:bg-zinc-800/70 [&_li[data-q]]:-mx-1 [&_li[data-q]]:rounded-md [&_li[data-q]]:bg-amber-50 [&_li[data-q]]:px-1 [&_li[data-q]]:ring-2 [&_li[data-q]]:ring-amber-300 dark:[&_li[data-q]]:bg-amber-950/40 dark:[&_li[data-q]]:ring-amber-600"
              >
                <div className="relative flex flex-col gap-1 lg:flex-row lg:items-start lg:gap-2">
                  <RichFrame text={r.text} data-block="" cls={`min-w-0 flex-1 break-words ${r.b.kind === 'heading' ? 'pr-14 lg:pr-0' : ''}`} onRef={on.ref} onPicture={on.picture}>
                    <DocBlock b={{ kind: r.b.kind, text: r.text }} title={r.title} world={env.world} ticking={{ sent: r.sent, tick: (i) => on.tick(r.tk, i), modify: () => on.modifyTicks(r.tk) }} />
                  </RichFrame>
                  {n ? (
                    <button
                      onClick={() => on.toggle(r.b.key)}
                      aria-label={plural(n, 'comment')}
                      className={`${r.b.kind === 'heading' ? `absolute right-0 lg:relative lg:top-0 ${r.title ? 'top-0.5' : lv <= 2 ? 'top-2.5' : 'top-1'}` : 'relative self-end'} flex h-6 shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 text-xs font-medium text-amber-900 after:absolute after:-inset-2.5 hover:bg-amber-200 lg:mt-0.5 lg:hidden lg:self-start dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-900`}
                    >
                      <Icon n="comment" c="size-3.5" />
                      {n}
                      {r.isNew ? <NewDot /> : null}
                    </button>
                  ) : null}
                </div>
                {r.skipped && CHOICE_LINE.test(r.b.text) && !TICKED_LINE.test(r.b.text) ? (
                  <div className="mt-1.5 flex items-center gap-1 text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
                    <Icon n="reply" c="size-3.5" />
                    Skipped · you replied on {facts.itemCode}
                  </div>
                ) : null}
                {r.say ? <SayRow rec={facts.recording} on={{ say: () => on.say(r.b.key, r.quote), cancel: on.sayCancel, type: on.type }} /> : null}
                {desk ? null : r.threads.map((s) => thread(s, r.b.text))}
                {desk ? (
                  <BlockActs
                    counts={r.counts}
                    open={r.open}
                    rec={r.speaking}
                    on={{ say: (q) => on.say(r.b.key, q), comment: (q) => on.pick(r.b.key, q, 'button'), toggle: on.toggle, away: on.away }}
                  >
                    {r.open ? (
                      <>
                        {r.threads.filter((s) => s.t.tk === r.open).map((s) => thread(s, r.b.text, true))}
                        {r.open === `${r.b.key}#new` ? r.drafts.map((x) => <DraftCard key={x.label} words={x.words} voice={x.voice} transcribing={x.transcribing} />) : null}
                        {popover?.(r)}
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
            <div className="text-xs font-medium text-zinc-500">On the whole document</div>
            {facts.wholeThreads.map((s) => thread(s))}
          </section>
        ) : null}
        {!desk && facts.detached.length ? (
          <div className="mt-6 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-500">Original text changed</div>
            {facts.detached.map((t) => (
              <section key={t.key}>
                <div className="text-sm text-zinc-400 line-through">{t.quote}</div>
                {t.threads.map((s) => thread(s))}
              </section>
            ))}
          </div>
        ) : null}
        {desk ? null : (
          <>
            <p className="mt-6 text-center text-xs text-zinc-400">{web ? 'Tap a part of the page to comment on it' : 'Tap a paragraph, select text or circle an area to comment on it'}</p>
            {facts.wholeButton ? (
              <button onClick={on.whole} className="mx-auto mt-1 flex h-11 items-center gap-1.5 px-3 text-sm font-semibold text-blue-600 dark:text-blue-400">
                <Icon n="comment" c="size-4" />
                Comment on the whole document
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
