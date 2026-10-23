// A document (D1, D2 ...): its text in blocks, each with its comment threads (T274 #2), read in the item pane on the
// desktop (T110) and in a sheet on the phone. Comments are written in the one input box (I087). The editor is a
// plain textarea; the first line is the title.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { BTN, DC_BTN, HIT, MSG, NEEDS_PILL, PRIMARY, WHO } from '../lib/constants'
import {
  R_STATE as R,
  U,
  code,
  desk,
  docResolved,
  threadOpen,
  threadsOf,
  byN,
  userWord,
  els,
  liveN,
  plural,
  sameText,
  useArea,
  when,
  whoName,
} from '../lib/state'
import type { Comment, Doc } from '../lib/types'
import { blockHtml, clean, groups, plainQuote } from '../lib/markdown'
import { seeThreads, threadNew, renderDoc } from '../lib/docs'
import { tickKeys, tickOpen, tickText, ticksNotSent } from '../lib/doctick'

const TICKED_LINE = /^\s*[-*+]\s+[([][xX][)\]]/m // T415: a list with a choice sent in it
const CHOICE_LINE = /^\s*[-*+]\s+(\(|\[)[ xX]?(\)|\])\s+/m
/** T472 (D49): the item's latest question points at this document, and you replied on the item instead of picking */
function docSkipped(d: Doc) {
  const it = byN.get(d.n),
    asks = (it?.thread || []).filter((x) => x.kind === 'ask' && new RegExp(`\\bD${d.d}\\b`).test(x.text)),
    x = asks.at(-1)
  return !!(it && x && it.thread.slice(it.thread.indexOf(x) + 1).some(userWord))
}
import { toast } from '../lib/toast'
import { Armed, Icon, Kbd } from './ui'
import { Rich, Thumbs, VoiceLine } from './Talk'
import { RecTime } from './Composer'
import { WebPage } from './WebPage'
import { VC_MARK, docMicLabel } from '../lib/voice'

const NewDot = () => (
  <span className="ml-0.5 size-1.5 rounded-full bg-blue-600 dark:bg-blue-400" title="New from an agent" />
)
const isAudio = (f: { mime?: string }) => (f.mime || '').startsWith('audio/')

function DcActs({ d, c }: { d: Doc; c: Comment }) {
  return (
    // B14 (T422): on the desktop they float at the end of the line with who wrote it while you point at it, taking no
    // line of its own; D80 #16: not over the card's top corner, where the words it quotes are
    <div className="-mr-1.5 ml-auto flex gap-0.5 lg:invisible lg:absolute lg:top-0 lg:right-0 lg:z-10 lg:mr-0 lg:rounded-lg lg:bg-white lg:shadow-sm lg:ring-1 lg:ring-zinc-900/10 lg:group-hover:visible lg:focus-within:visible dark:lg:bg-zinc-800 dark:lg:ring-white/10">
      {c.by === 'you' ? (
        <button data-act="dc-edit" data-d={d.d} data-id={c.id} className={DC_BTN}>
          <Icon n="pencil" c="size-3.5" />
          Edit
        </button>
      ) : null}
      <button data-act="dc-move" data-d={d.d} data-id={c.id} className={DC_BTN}>
        <Icon n="arrow" c="size-3.5" />
        Move
      </button>
      {c.by === 'you'
        ? (c.files || []).map((f) => (
            <button
              key={f.f}
              data-act="sent-unfile"
              data-d={d.d}
              data-id={c.id}
              data-f={f.f}
              title={`Take off ${f.name || 'the file'}`}
              className={DC_BTN}
            >
              <Icon n="x" c="size-3.5" />
              <Armed k={`unfile ${d.d} ${c.id} ${f.f}`} ask="Take it off?">
                File
              </Armed>
            </button>
          ))
        : null}
      <button data-act="dc-delete" data-d={d.d} data-id={c.id} className={DC_BTN}>
        <Icon n="trash" c="size-3.5" />
        Delete
      </button>
    </div>
  )
}
export function Thread({
  d,
  k,
  comments,
  blockText,
  rail = false,
}: {
  d: Doc
  k: string
  comments: Comment[]
  blockText?: string
  rail?: boolean
}) {
  return (
    <div
      data-thread={k}
      className={
        rail
          ? 'space-y-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900'
          : 'mt-2 space-y-2 border-l-2 border-amber-300 pl-3 dark:border-amber-600'
      }
    >
      {threadNew(d, k, comments) ? (
        <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
          <NewDot />
          New
        </div>
      ) : null}
      {comments.map((c) => (
        <div key={c.id} data-dc={c.id} className={`group relative text-sm ${MSG(c.by).replace(/\b(ml|mr)-8\b/, '')}`}>
          {blockText !== undefined && !sameText(c.quote, blockText) ? (
            <div className="mb-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-300">“{plainQuote(c.quote)}”</div>
          ) : null}
          <div className="flex min-h-6 flex-wrap items-center gap-1 lg:relative">
            <span className={WHO(c.by)}>{whoName(c.by)}</span>{' '}
            <span className="text-xs text-zinc-400">
              {when(c.t)}
              {c.edited ? ` · edited ${when(c.edited)}` : ''}
            </span>
            {/* r799: a comment shown while it is being saved (its words still coming) has nothing to edit or delete yet */}
            {c.id > 0 ? <DcActs d={d} c={c} /> : null}
          </div>
          <Rich text={c.text} gid={'dc' + c.t} />
          {c.files?.some((f) => !isAudio(f)) ? (
            <div className="mt-1.5 flex gap-2 overflow-x-auto">
              <Thumbs files={c.files.filter((f) => !isAudio(f))} gid={'dcf' + c.id} size="size-11" />
            </div>
          ) : null}
          <VoiceLine files={c.files} />
        </div>
      ))}
      <button
        data-act="doc-resolve"
        data-key={k}
        data-on={docResolved(d, k) ? 0 : 1}
        className={`${HIT} float-right flex h-8 items-center gap-1 rounded-lg px-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800`}
      >
        <Icon n={docResolved(d, k) ? 'reopen' : 'check'} c="size-3.5" />
        {docResolved(d, k) ? 'Reopen' : 'Resolve'}
      </button>
      {U.docReply === k ? null : (
        <button
          data-act="doc-reply"
          data-key={k}
          className={`${HIT} -mx-1.5 flex h-8 items-center gap-1 rounded-lg px-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 aria-pressed:underline dark:text-blue-400 dark:hover:bg-blue-400/10`}
        >
          <Icon n="reply" c="size-3.5" />
          Reply
        </button>
      )}
    </div>
  )
}
// B469: how far down the paragraph the words a thread quotes start (an item of a list, or words inside the text)
function quoteTop(sec: HTMLElement, quote: string) {
  const norm = (x: string) => x.replace(/\s+/g, ' ').trim(),
    q = norm(quote),
    top = (r: DOMRect) => Math.round(r.top - sec.getBoundingClientRect().top)
  if (!q) return 0
  const li = [...sec.querySelectorAll<HTMLElement>('li')].find((l) => norm(l.innerText).includes(q))
  if (li) return top(li.getBoundingClientRect())
  const head = q.slice(0, 16)
  const w = document.createTreeWalker(sec.querySelector('[data-block]') || sec, NodeFilter.SHOW_TEXT)
  while (w.nextNode()) {
    const t = w.currentNode as Text,
      i = t.data.indexOf(head)
    if (i < 0) continue
    const r = document.createRange()
    r.setStart(t, i)
    r.setEnd(t, Math.min(t.data.length, i + head.length))
    return top(r.getBoundingClientRect())
  }
  return 0
}
/** On the phone, under the paragraph or the part of a web page you tapped: speak (the same button stops and posts), or
 * type. B498: recording, it is here that the button turns into Stop and the time runs. */
export function SayRow({
  act,
  k,
  quote,
  rec,
  at = 'mt-2',
}: {
  act: 'doc-say' | 'page-say'
  k: string
  quote?: string
  rec: boolean
  at?: string
}) {
  return rec ? (
    // B300: recording, the same button stops and posts, where it was
    <div className={`${at} flex items-center gap-2`}>
      <button
        data-act={act}
        data-key={k}
        {...(quote !== undefined ? { 'data-quote': quote } : {})}
        aria-label="Stop and post the comment"
        className="grid size-12 shrink-0 place-items-center rounded-full bg-red-600 text-white shadow-lg"
      >
        <Icon n="stop" c="size-5" />
      </button>
      <span className="text-[13px] text-zinc-500 dark:text-zinc-400">
        <span data-rec-time className="font-mono text-red-600 tabular-nums dark:text-red-400">
          <RecTime />
        </span>{' '}
        · tap to post
      </span>
      <button
        data-act="doc-say-cancel"
        className="ml-auto h-10 rounded-full px-3 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-300 dark:text-zinc-300 dark:ring-zinc-600"
      >
        Cancel
      </button>
    </div>
  ) : (
    <div className={`${at} flex items-center gap-2`}>
      <button
        data-act={act}
        data-key={k}
        {...(quote !== undefined ? { 'data-quote': quote } : {})}
        aria-label="Dictate comment"
        className="grid size-12 shrink-0 place-items-center rounded-full bg-zinc-900 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
      >
        <Icon n="mic" c="size-5" />
      </button>
      <span className="text-[13px] text-zinc-500 dark:text-zinc-400">Tap to speak, tap again to post</span>
      <button
        data-act="doc-type"
        className="ml-auto h-10 rounded-full px-3 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-300 dark:text-zinc-300 dark:ring-zinc-600"
        aria-label="Type instead"
      >
        Aa
      </button>
    </div>
  )
}
// B340: beside a paragraph, on the desktop: comment (in the box below) or speak (the icon itself records, and stops)
function BlockActs({ d, k, float = false }: { d: Doc; k: string; float?: boolean }) {
  useArea('vc')
  const rec = !!(R.rec && R.vc?.d === d.d && R.vc.key === k)
  // B355: in a list each item is its own place to comment on: pointing at one puts the buttons beside it, and what
  // you say about it quotes it (the paragraph stays the same one for agents)
  const box = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ top: number; quote: string } | null>(null)
  useEffect(() => {
    const sec = box.current?.closest('section')
    if (!sec) return
    let lit: HTMLElement | null = null
    const light = (li: HTMLElement | null) => {
      if (lit === li) return
      lit?.removeAttribute('data-hov')
      li?.setAttribute('data-hov', '')
      lit = li
    }
    const move = (e: MouseEvent) => {
      const li = (e.target as Element).closest<HTMLElement>('li')
      if (!li || !sec.contains(li) || box.current?.contains(li)) return // between items or on the buttons: it stays
      light(li)
      const top = Math.round(li.getBoundingClientRect().top - sec.getBoundingClientRect().top)
      setAt((a) => (a && a.top === top ? a : { top, quote: li.innerText.trim().slice(0, 500) }))
    }
    const leave = () => {
      light(null)
      setAt(null)
    }
    sec.addEventListener('mousemove', move)
    sec.addEventListener('mouseleave', leave)
    return () => {
      sec.removeEventListener('mousemove', move)
      sec.removeEventListener('mouseleave', leave)
      light(null)
    }
  }, [])
  const b = d.blocks.find((x) => x.key === k),
    drafts = U.vcMarks.filter((m) => m.d === d.d && m.key === k && markLive(m.label)),
    threads = b ? threadsOf(b.comments) : [], // B469: each place selected in the paragraph has its own thread
    newKey = `${k}#new`,
    // the thread opened; a paragraph opened as a whole (just commented on) opens its latest thread
    openTk = !float
      ? null
      : ([...threads.map((t) => t.tk), newKey].find((tk) => U.docThreads.has(tk)) ??
        (U.docThreads.has(k) ? (threads.at(-1)?.tk ?? (drafts.length ? newKey : null)) : null))
  // B5 (T422), B469: each thread's count sits level with the words it quotes, never on top of another
  const pop = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const sec = box.current?.closest('section')
    if (!sec) return
    let last = -40
    const place = (tk: string, want: number) => {
      last = Math.max(want, last + 32)
      const btn = sec.querySelector<HTMLElement>(`[data-act="doc-thread"][data-key="${CSS.escape(tk)}"]`)
      if (btn) btn.style.top = last + 2 + 'px'
      if (tk === openTk && pop.current) pop.current.style.top = last + 36 + 'px'
    }
    const taken: number[] = []
    for (const t of threads) taken.push((place(t.tk, quoteTop(sec, t.quote)), last))
    if (drafts.length) taken.push((place(newKey, 0), last))
    // the speak and comment buttons go where you point, never over a count (B469)
    let y = at?.top ?? 0
    for (const top of taken) if (Math.abs(top - y) < 30) y = top + 32
    if (box.current) box.current.style.top = y + 2 + 'px'
  })
  // B6 (T422): an open comment popup closes on a click anywhere else, so it never sits over the paragraphs below
  useEffect(() => {
    if (!openTk) return
    const away = (e: MouseEvent) => {
      const t = e.target as Element
      if (pop.current?.contains(t) || t.closest(`[data-act="doc-thread"][data-key="${CSS.escape(openTk)}"]`)) return
      U.docThreads.delete(openTk)
      U.docThreads.delete(k)
      renderDoc()
    }
    document.addEventListener('mousedown', away, true)
    return () => document.removeEventListener('mousedown', away, true)
  }, [openTk, k])
  const counts = [
    ...threads.map((t) => ({ tk: t.tk, n: t.comments.length, done: docResolved(d, t.tk) })),
    ...(drafts.length ? [{ tk: newKey, n: drafts.length, done: false }] : []),
  ]
  const opened = threads.find((t) => t.tk === openTk)
  return (
    <>
      {float
        ? counts.map((c) => (
            // B349: no room for the column: the count stays beside the paragraph, and opens its comments over the text
            <button
              key={c.tk}
              data-act="doc-thread"
              data-key={c.tk}
              className={`absolute left-[calc(100%+0.25rem)] z-10 flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-lg px-1.5 text-xs font-semibold ${
                c.done // B12 (T422): a resolved thread looks done, not waiting
                  ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-800/70'
              }`}
            >
              {c.done ? <Icon n="check" c="size-3.5" /> : null}
              {c.n}
            </button>
          ))
        : null}
      {openTk && b ? (
        <div ref={pop} className="absolute -right-10 z-20 flex w-80 max-w-full flex-col gap-2 text-sm shadow-xl">
          {opened ? <Thread d={d} k={opened.tk} comments={opened.comments} blockText={b.text} rail /> : null}
          {openTk === newKey ? drafts.map((m) => <DraftCard key={m.label} label={m.label} />) : null}
        </div>
      ) : null}
      {/* B355: side by side, the voice first; from the edge of the paragraph, so the pointer gets there without a gap.
          B392: the paragraph's pointing area reaches over this column top to bottom (its after:), so the pointer can
          leave the text anywhere along it and go up or down to the buttons */}
      <div
        ref={box}
        className={`absolute left-full z-10 flex-row gap-1 pl-1 ${rec ? 'flex' : 'hidden group-hover/blk:flex'}`}
      >
        <button
          data-act="doc-say"
          data-key={k}
          {...(at ? { 'data-quote': at.quote } : {})}
          title={rec ? 'Stop' : 'Speak a comment'}
          className={`grid size-7 place-items-center rounded-lg shadow-sm ring-1 ${rec ? 'bg-red-600 text-white ring-red-700' : 'bg-white text-zinc-500 ring-zinc-900/10 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white'}`}
        >
          <Icon n={rec ? 'stop' : 'mic'} c="size-4" />
        </button>
        {rec ? null : (
          <button
            data-act="doc-pick"
            data-key={k}
            data-pick-btn
            {...(at ? { 'data-quote': at.quote } : {})}
            title="Comment"
            className="grid size-7 place-items-center rounded-lg bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-900/10 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white"
          >
            <Icon n="comment" c="size-4" />
          </button>
        )}
      </div>
    </>
  )
}
// B7 (T422): a comment not sent yet is there while the box still holds its words or its voice note; emptied, it is gone
export const markLive = (label: string) =>
  (els.text?.value || '').split('\n').some((l) => VC_MARK.exec(l)?.[1] === label) || U.files.some((f) => f.vc === label)
// B340: a comment not sent yet, where it will go: its words under its quote in the box, and its voice notes
export function DraftCard({ label }: { label: string }) {
  useArea('composer')
  useArea('vc')
  const lines = (els.text?.value || '').split('\n')
  const at = lines.findIndex((l) => VC_MARK.exec(l)?.[1] === label)
  const words: string[] = []
  for (const l of at < 0 ? [] : lines.slice(at + 1)) {
    if (VC_MARK.test(l)) break
    words.push(l)
  }
  const said = words.join('\n').trim()
  const voice = U.files.filter((f) => f.vc === label)
  return (
    <div className="space-y-1 rounded-xl border border-dashed border-amber-400 bg-amber-50/70 p-3 text-sm dark:border-amber-500/60 dark:bg-amber-400/10">
      <div className="text-[11px] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
        Not sent
      </div>
      {said ? <div className="whitespace-pre-wrap">{said}</div> : null}
      {voice.length ? (
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {voice.some((f) => f.transcribing) ? 'Transcribing…' : plural(voice.length, 'voice note')}
        </div>
      ) : null}
    </div>
  )
}
// B340: the comments, beside the text. Each sits level with its paragraph; when they would overlap they move down in
// T274 #18: a long document (three headings or more) starts with its contents
function Outline({ d }: { d: Doc }) {
  const hs = d.blocks.slice(1).filter((b) => b.kind === 'heading')
  if (hs.length < 3) return null
  return (
    <details className="mt-3 rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
      <summary className="cursor-pointer text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        Contents · {hs.length}
      </summary>
      <div className="mt-1 flex flex-col">
        {hs.map((b) => {
          const lv = (b.text.match(/^#+/) || ['#'])[0].length
          return (
            <button
              key={b.key}
              data-act="doc-jump"
              data-key={b.key}
              className={`truncate rounded-md py-1 text-left text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${lv > 2 ? 'pl-6' : 'pl-2'}`}
            >
              {b.text.replace(/^#+\s*/, '')}
            </button>
          )
        })}
      </div>
    </details>
  )
}
// T274 #2: the words a comment is on are marked in the text (when they sit in one run of text)
function useMarkQuotes(ref: RefObject<HTMLElement | null>, d: Doc) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    for (const b of d.blocks)
      for (const th of threadsOf(b.comments)) {
        // B469: every thread's words are marked, each once
        const q = plainQuote(th.quote || '').trim(),
          sec = root.querySelector(`#docBlocks > section[data-key="${CSS.escape(b.key)}"] [data-block]`)
        if (!q || !sec || sameText(q, plainQuote(b.text)) || q.length > 300) continue
        if (sec.querySelector(`mark[data-quote="${CSS.escape(th.tk)}"]`)) continue
        const walk = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT)
        while (walk.nextNode()) {
          const t = walk.currentNode as Text,
            at = t.data.indexOf(q)
          if (at < 0 || t.parentElement?.closest('mark, button')) continue
          const m = document.createElement('mark'),
            rest = t.splitText(at)
          rest.splitText(q.length)
          m.dataset.quote = th.tk
          m.className = `rounded-sm ${docResolved(d, th.tk) ? 'bg-transparent text-inherit underline decoration-zinc-300 decoration-dotted' : 'bg-amber-100 text-inherit dark:bg-amber-400/25'}`
          rest.replaceWith(m)
          m.append(rest)
          break
        }
      }
    seeThreads(d) // what the document shows now counts as seen
  })
}
// Circle to select: the paragraphs the loop goes around become the selection.
function Lasso() {
  const ref = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  useLayoutEffect(() => {
    const svg = ref.current,
      path = pathRef.current
    if (!svg || !path) return
    const pts: [number, number][] = []
    const add = (e: PointerEvent) => {
      const b = svg.getBoundingClientRect()
      pts.push([e.clientX - b.left, e.clientY - b.top])
      path.setAttribute('d', 'M' + pts.map((p) => p.join(' ')).join(' L') + (pts.length > 2 ? ' Z' : ''))
    }
    const down = (e: PointerEvent) => {
      pts.length = 0
      add(e)
      try {
        svg.setPointerCapture(e.pointerId)
      } catch {
        /* no capture */
      }
    }
    const move = (e: PointerEvent) => {
      if (pts.length) add(e)
    }
    const up = () => {
      const box = svg.getBoundingClientRect(),
        poly = pts.map(([x, y]) => [x + box.left, y + box.top] as const)
      const inside = (x: number, y: number) =>
        poly.reduce((c, [xi, yi], i) => {
          const [xj, yj] = poly[(i + poly.length - 1) % poly.length]
          return yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi ? !c : c
        }, false)
      const ys = poly.map((p) => p[1])
      const picked = [...document.querySelectorAll<HTMLElement>('#docBlocks > section[data-key]')]
        .filter((el) => {
          const r = el.getBoundingClientRect(),
            cy = (r.top + r.bottom) / 2
          return (
            inside((r.left + r.right) / 2, cy) ||
            inside(r.left + 24, cy) ||
            (cy > Math.min(...ys) && cy < Math.max(...ys) && pts.length > 8)
          )
        })
        .map((el) => el.dataset.key as string)
      U.docCircle = false
      U.docQuote = null
      U.docSel = new Set(picked)
      renderDoc()
      if (!picked.length) toast('Nothing inside the circle')
    }
    svg.addEventListener('pointerdown', down)
    svg.addEventListener('pointermove', move)
    svg.addEventListener('pointerup', up)
    return () => {
      svg.removeEventListener('pointerdown', down)
      svg.removeEventListener('pointermove', move)
      svg.removeEventListener('pointerup', up)
    }
  }, [])
  return (
    <svg
      ref={ref}
      id="lasso"
      className="absolute inset-0 z-10 h-full w-full touch-none"
      aria-label="Draw around the part to comment on"
    >
      <path
        ref={pathRef}
        id="lassoPath"
        d=""
        fill="rgba(251,191,36,.15)"
        stroke="rgb(245,158,11)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
// A document's text with its comment threads: in a sheet on the phone, in the item pane on the desktop (T110).
export function DocView({ d }: { d: Doc }) {
  useArea('rec')
  const skipped = docSkipped(d)
  const ref = useRef<HTMLDivElement>(null)
  useMarkQuotes(ref, d)
  useLayoutEffect(() => {
    // B9 (T422): on the phone the one item of a list you picked is marked, not the whole list
    const root = ref.current
    if (!root) return
    for (const li of root.querySelectorAll('li[data-q]')) li.removeAttribute('data-q')
    const q = !desk() && U.docQuote
    if (!q) return
    const li = [...root.querySelectorAll<HTMLElement>(`section[data-key="${CSS.escape(q.key)}"] li`)].find(
      (l) => l.innerText.trim() === q.text,
    )
    li?.setAttribute('data-q', '')
  })
  const titled = !!d.blocks[0] && sameText(d.blocks[0].text.replace(/^#+\s*/, ''), d.title)
  const tks = tickKeys(d).map((x) => x.k),
    waiting = ticksNotSent(d)
  const [line0, ...rest0] = (d.blocks[0]?.text || '').split('\n'),
    titleLine =
      !titled && d.blocks[0]?.kind === 'para' && rest0.length > 0 && sameText(line0.replace(/^#+\s*/, ''), d.title) // T227 #4
  groups.delete('doc' + d.d) // its images, refilled as the blocks render
  const phoneBtn = `${HIT} ${BTN} text-sm lg:hidden`
  const side = desk() // B340: on the desktop the text never moves for a comment
  // B505 (#6505): on the desktop a document's comments are its item's conversation, the column beside it (the comments
  // are the conversation: no column of their own); each commented paragraph shows its count, which opens them over it
  const float = side
  return (
    <div ref={ref} className="flex min-h-full flex-col">
      {/* B492: a web page takes the pane's whole width, as a page in a browser does */}
      <div
        className={`relative flex min-w-0 flex-col lg:mx-auto lg:w-full ${d.fmt === 'html' ? '' : 'lg:max-w-[min(46rem,calc(100%-5rem))]'}`}
      >
        {/* B492: over a web page (desktop) this row holds only its comments on the whole page: in the page's corner */}
        <div
          className={`relative flex items-center gap-1 text-xs text-zinc-500 ${d.fmt === 'html' ? 'lg:absolute lg:top-2 lg:right-2 lg:z-10' : ''}`}
        >
          {float && d.whole?.length ? (
            <>
              <button
                data-act="doc-thread"
                data-key="doc"
                className="order-last flex h-7 items-center gap-1 rounded-md bg-amber-100 px-2 font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-800/70"
              >
                <Icon n="comment" c="size-3.5" />
                {plural(d.whole.length, 'comment')} on the document
              </button>
              {U.docThreads.has('doc') ? (
                <div className="absolute top-full right-0 z-20 mt-1 w-80 text-sm">
                  <Thread d={d} k="doc" comments={d.whole} rail />
                </div>
              ) : null}
            </>
          ) : null}
          {/* B492: nothing written over a web page: it is the page alone */}
          <span hidden={d.fmt === 'html'} className="min-w-0 flex-1 truncate">
            on{' '}
            <button data-act="goto" data-n={d.n} className="text-blue-600 hover:underline dark:text-blue-400">
              {code(d.n)}
            </button>{' '}
            · {whoName(d.by)} · {when(d.t1)}
          </span>
          <button data-act="doc-move" className={phoneBtn}>
            Move
          </button>
          <button data-act="doc-delete" className={phoneBtn}>
            <Armed k={'doc-delete ' + d.d} ask={`Delete D${d.d}?`}>
              Delete
            </Armed>
          </button>
          <button
            data-act="doc-circle"
            hidden={d.fmt === 'html'}
            aria-pressed={!!U.docCircle}
            className={`${phoneBtn} aria-pressed:bg-amber-100 aria-pressed:text-amber-900 dark:aria-pressed:bg-amber-900/60 dark:aria-pressed:text-amber-100`}
          >
            {U.docCircle ? 'Draw around it…' : 'Mark an area'}
          </button>
          <button data-act="doc-edit" className={phoneBtn}>
            Edit
          </button>
        </div>
        {waiting ? (
          // B524 (r736): choices ticked and not sent are said at the top too, so they are not forgotten; the box's line
          // sends them
          <div className="mt-3 flex">
            <span className={NEEDS_PILL}>{waiting}</span>
          </div>
        ) : null}
        {titled || d.fmt === 'html' ? null : (
          <div className="mt-3 text-2xl leading-tight font-bold tracking-tight">{d.title}</div>
        )}
        {d.fmt === 'html' ? <WebPage d={d} /> : null}
        {d.fmt === 'html' ? null : <Outline d={d} />}
        <div
          hidden={d.fmt === 'html'}
          id="docBlocks"
          className={`relative mt-3 space-y-3 text-[15px] ${U.docCircle ? 'select-none' : ''}`}
        >
          {/* B503: a web page's parts are drawn by WebPage alone (their hidden copies here closed its open comments) */}
          {(d.fmt === 'html' ? [] : d.blocks).map((b0, i) => {
            const tk = tks[i] // B420: which of the paragraphs with these words it is
            const now = tickText(d.d, tk, b0.text) // B412: ticked here and not sent yet
            const b =
              i === 0 && titleLine ? { ...b0, text: rest0.join('\n') } : now === b0.text ? b0 : { ...b0, text: now }
            const lv = (b0.text.match(/^#+/) || ['#'])[0].length
            const here =
              !desk() &&
              !U.docType &&
              (R.rec
                ? R.vc?.d === d.d && R.vc.key === b0.key && !R.vc.range
                : U.docSel.has(b0.key) || U.docQuote?.key === b0.key) // B9 (T422): one item of a list picked
            return (
              <section
                key={tk}
                data-act="doc-pick"
                data-key={b0.key}
                {...(U.docSel.has(b0.key) ? { 'data-picked': '' } : {})}
                className={`group/blk relative -mx-2 rounded-lg px-2 py-1 transition-colors hover:bg-zinc-50 has-[li[data-hov]]:bg-transparent data-hl:bg-amber-50 data-picked:bg-amber-50 data-picked:ring-2 data-picked:ring-amber-300 data-pressed:opacity-70 lg:cursor-text lg:after:absolute lg:after:inset-y-0 lg:after:left-full lg:after:w-18 dark:hover:bg-zinc-800/50 dark:data-hl:bg-amber-950/30 dark:data-picked:bg-amber-950/40 dark:data-picked:ring-amber-600 lg:[&_li[data-hov]]:rounded-md lg:[&_li[data-hov]]:bg-zinc-100 dark:lg:[&_li[data-hov]]:bg-zinc-800/70 [&_li[data-q]]:-mx-1 [&_li[data-q]]:rounded-md [&_li[data-q]]:bg-amber-50 [&_li[data-q]]:px-1 [&_li[data-q]]:ring-2 [&_li[data-q]]:ring-amber-300 dark:[&_li[data-q]]:bg-amber-950/40 dark:[&_li[data-q]]:ring-amber-600`}
              >
                <div className="relative flex flex-col gap-1 lg:flex-row lg:items-start lg:gap-2">
                  <div
                    data-block
                    className={`min-w-0 flex-1 break-words ${b0.kind === 'heading' ? 'pr-14 lg:pr-0' : ''}`}
                    dangerouslySetInnerHTML={{
                      __html: clean(
                        blockHtml(b, i === 0 && titled, 'doc' + d.d, {
                          d: d.d,
                          key: tk,
                          sent: now === b0.text && TICKED_LINE.test(b0.text) && !tickOpen(d.d, tk),
                        }),
                      ),
                    }}
                  />
                  {b0.comments.length ? (
                    <button
                      data-act="doc-thread"
                      data-key={b0.key}
                      aria-label={plural(b0.comments.length, 'comment')}
                      className={`${b0.kind === 'heading' ? `absolute right-0 lg:relative lg:top-0 ${i === 0 && titled ? 'top-0.5' : lv <= 2 ? 'top-2.5' : 'top-1'}` : 'relative self-end'} flex h-6 shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 text-xs font-medium text-amber-900 after:absolute after:-inset-2.5 hover:bg-amber-200 lg:mt-0.5 lg:hidden lg:self-start dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-900`}
                    >
                      <Icon n="comment" c="size-3.5" />
                      {b0.comments.length}
                      {threadNew(d, b0.key, b0.comments) ? <NewDot /> : null}
                    </button>
                  ) : null}
                </div>
                {skipped && CHOICE_LINE.test(b0.text) && !TICKED_LINE.test(b0.text) ? (
                  // T472 (D49): the item asked you to pick here, you replied on the item instead
                  <div className="mt-1.5 flex items-center gap-1 text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
                    <Icon n="reply" c="size-3.5" />
                    Skipped · you replied on {code(d.n)}
                  </div>
                ) : null}
                {here ? (
                  <SayRow
                    act="doc-say"
                    k={b0.key}
                    rec={!!R.rec}
                    quote={U.docQuote?.key === b0.key ? U.docQuote.text : undefined}
                  />
                ) : null}
                {!side && b0.comments.length
                  ? threadsOf(b0.comments)
                      .filter((t) => threadOpen(t.tk))
                      .map((t) => <Thread key={t.tk} d={d} k={t.tk} comments={t.comments} blockText={b0.text} />)
                  : null}
                {side ? <BlockActs d={d} k={b0.key} float={float} /> : null}
              </section>
            )
          })}
          {U.docCircle ? <Lasso /> : null}
        </div>
        {!side && d.whole?.length ? (
          <section className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-500">On the whole document</div>
            {threadsOf(d.whole).map((t) => (
              <Thread key={t.tk} d={d} k={t.tk} comments={t.comments} />
            ))}
          </section>
        ) : null}
        {!side && d.detached.length ? (
          <div className="mt-6 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-500">Original text changed</div>
            {d.detached.map((t) => (
              <section key={t.key}>
                <div className="text-sm text-zinc-400 line-through">{t.quote}</div>
                {threadsOf(t.comments).map((x) => (
                  <Thread key={x.tk} d={d} k={x.tk} comments={x.comments} />
                ))}
              </section>
            ))}
          </div>
        ) : null}
        {side ? null : (
          <>
            <p className="mt-6 text-center text-xs text-zinc-400">
              {/* B502 (r687): in a web page selected words are only selected, and there is no circling: a tap picks */}
              {d.fmt === 'html'
                ? 'Tap a part of the page to comment on it'
                : 'Tap a paragraph, select text or circle an area to comment on it'}
            </p>
            {U.docType && !U.docSel.size && !U.docQuote && !U.docReply ? null : (
              <button
                data-act="doc-whole"
                className="mx-auto mt-1 flex h-11 items-center gap-1.5 px-3 text-sm font-semibold text-blue-600 dark:text-blue-400"
              >
                <Icon n="comment" c="size-4" />
                Comment on the whole document
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
// The editor: the first line is the title; Esc keeps it as a draft (T113 B6). Speak puts words where the caret is (F208).
export function DocEdit({ d, md }: { d: Doc | undefined; md: string }) {
  useArea('rec')
  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky -top-2 z-10 -mx-4 -mt-2 mb-2 flex items-center gap-2 bg-white px-4 py-2 text-xs text-zinc-500 dark:bg-zinc-900">
        <DocHint />
        <DocMic />
        <button
          data-act="doc-discard"
          className="h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Discard
        </button>
        <button data-act="doc-done" className={PRIMARY}>
          {d ? 'Save' : 'Create'}
        </button>
      </div>
      <textarea
        id="docMd"
        defaultValue={md}
        placeholder={'Title on the first line\n\nNotes, plans, or designs (Markdown supported)'}
        className="min-h-[40dvh] w-full flex-1 resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-zinc-400"
      />
    </div>
  )
}
function DocHint() {
  useArea('vc')
  useArea('rec')
  return (
    <span id="docHint" className="min-w-0 flex-1">
      {docMicLabel().hint}
    </span>
  )
}
function DocMic() {
  useArea('vc')
  useArea('rec')
  const { on, text } = docMicLabel()
  return (
    <button
      id="docMic"
      data-act="doc-mic"
      {...(on ? { 'data-on': '' } : {})}
      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-zinc-600 tabular-nums hover:bg-zinc-100 data-on:bg-red-600 data-on:text-white data-on:hover:bg-red-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:data-on:bg-red-600 dark:data-on:text-white"
    >
      <Icon n="mic" />
      <span>{text}</span>
    </button>
  )
}
// The desktop's pane header for a document, and its way back (T110)
const PaneBtn = ({ act, children, pressed }: { act: string; children: ReactNode; pressed?: boolean }) => (
  <button
    data-act={act}
    {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
    className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-100 aria-pressed:bg-amber-100 aria-pressed:text-amber-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:aria-pressed:bg-amber-900/60 dark:aria-pressed:text-amber-100"
  >
    {children}
  </button>
)
export const DocPaneHead = ({ d, editing }: { d: Doc; editing: boolean }) => (
  <span className="flex min-w-0 items-center gap-2 text-sm">
    <Icon n={editing ? 'pencil' : d.fmt === 'html' ? 'web' : 'doc'} c="size-[18px] text-zinc-500 dark:text-zinc-400" />
    {editing ? <span className="font-semibold">Editing</span> : null}
    <span className="font-mono font-bold text-zinc-700 dark:text-zinc-200">D{d.d}</span>
    <span className={`truncate ${editing ? '' : 'font-semibold'}`}>{d.title}</span>
  </span>
)
export const DocPaneActs = ({ d }: { d: Doc }) => (
  <>
    {d.fmt === 'html' ? (
      // F432 (D50 #2): Comment mode: pointing outlines a part, the buttons beside it comment; Esc leaves
      <PaneBtn act="doc-inspect" pressed={!!U.docInspect}>
        <Icon n="comment" c="size-4" />
        Comment
        {U.docInspect ? <Kbd k="Esc" /> : null}
      </PaneBtn>
    ) : null}
    <PaneBtn act="doc-edit">
      <Icon n="pencil" c="size-4" />
      Edit
    </PaneBtn>
    <PaneBtn act="doc-move">
      <Icon n="arrow" c="size-4" />
      Move
    </PaneBtn>
    <PaneBtn act="doc-delete">
      <Icon n="trash" c="size-4" />
      <Armed k={'doc-delete ' + d.d} ask={`Delete D${d.d}?`}>
        Delete
      </Armed>
    </PaneBtn>
  </>
)
// B340 (D24 #1): the way back, first in the header and plain to see
export const DocPaneNav = ({ d }: { d: Doc }) => (
  <button
    data-act="doc-close"
    className="flex h-9 items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
  >
    <Icon n="left" c="size-4" sw="2.25" />
    {/* T438 #16: back to where you came from: Documents, Activity or Deleted, else its item */}
    Back to {U.side ? { docs: 'Documents', log: 'Activity', deleted: 'Deleted' }[U.side] : code(liveN(d.n))}
    <Kbd k="Esc" />
  </button>
)
