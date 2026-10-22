// A document (D1, D2 ...): its text in blocks, each with its comment threads (T274 #2), read in the item pane on the
// desktop (T110) and in a sheet on the phone. Comments are written in the one input box (I087). The editor is a
// plain textarea; the first line is the title.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { BTN, DC_BTN, HIT, MSG, PRIMARY, WHO } from '../lib/constants'
import {
  R_STATE as R,
  U,
  code,
  desk,
  docResolved,
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
import { tickKeys, tickOpen, tickText } from '../lib/doctick'

const TICKED_LINE = /^\s*[-*+]\s+[([][xX][)\]]/m // T415: a list with a choice sent in it
import { toast } from '../lib/toast'
import { Armed, Icon, Kbd } from './ui'
import { Rich, Thumbs, VoiceLine } from './Talk'
import { RecTime } from './Composer'
import { VC_MARK, docMicLabel } from '../lib/voice'

const NewDot = () => (
  <span className="ml-0.5 size-1.5 rounded-full bg-blue-600 dark:bg-blue-400" title="New from an agent" />
)
const isAudio = (f: { mime?: string }) => (f.mime || '').startsWith('audio/')

function DcActs({ d, c }: { d: Doc; c: Comment }) {
  return (
    <div className="-mr-1.5 ml-auto flex gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100">
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
function Thread({
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
        <div key={c.id} data-dc={c.id} className={`group text-sm ${MSG(c.by).replace(/\b(ml|mr)-8\b/, '')}`}>
          {blockText !== undefined && !sameText(c.quote, blockText) ? (
            <div className="mb-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-300">“{plainQuote(c.quote)}”</div>
          ) : null}
          <div className="flex min-h-6 flex-wrap items-center gap-1">
            <span className={WHO(c.by)}>{whoName(c.by)}</span>{' '}
            <span className="text-xs text-zinc-400">
              {when(c.t)}
              {c.edited ? ` · edited ${when(c.edited)}` : ''}
            </span>
            <DcActs d={d} c={c} />
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
        <Icon n="check" c="size-3.5" />
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
    n = (b?.comments.length || 0) + drafts.length,
    open = float && n > 0 && U.docThreads.has(k)
  // B5 (T422): in a list, the count sits level with the item its comments quote, not with the list's first item
  const quote = b?.comments[0]?.quote || ''
  const [countTop, setCountTop] = useState(0)
  useLayoutEffect(() => {
    const sec = box.current?.closest('section'),
      norm = (x: string) => x.replace(/\s+/g, ' ').trim()
    const li =
      sec && quote ? [...sec.querySelectorAll<HTMLElement>('li')].find((l) => norm(l.innerText) === norm(quote)) : null
    const top = li && sec ? Math.round(li.getBoundingClientRect().top - sec.getBoundingClientRect().top) : 0
    if (top !== countTop) setCountTop(top)
  }, [quote, n, float, countTop])
  // B6 (T422): an open comment popup closes on a click anywhere else, so it never sits over the paragraphs below
  const pop = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      const t = e.target as Element
      if (pop.current?.contains(t) || t.closest(`[data-act="doc-thread"][data-key="${k}"]`)) return
      U.docThreads.delete(k)
      renderDoc()
    }
    document.addEventListener('mousedown', away, true)
    return () => document.removeEventListener('mousedown', away, true)
  }, [open, k])
  return (
    <>
      {float && n ? (
        // B349: no room for the column: the count stays beside the paragraph, and opens its comments over the text
        <button
          data-act="doc-thread"
          data-key={k}
          title={open ? 'Hide the comments' : 'Show the comments'}
          style={{ top: countTop + 2 }}
          className="absolute left-[calc(100%+0.25rem)] z-10 flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-lg bg-amber-100 px-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-100"
        >
          {n}
        </button>
      ) : null}
      {open && b ? (
        <div
          ref={pop}
          style={{ top: countTop + 36 }}
          className="absolute -right-10 z-20 flex w-80 max-w-full flex-col gap-2 text-sm shadow-xl"
        >
          {b.comments.length ? <Thread d={d} k={k} comments={b.comments} blockText={b.text} rail /> : null}
          {drafts.map((m) => (
            <DraftCard key={m.label} label={m.label} />
          ))}
        </div>
      ) : null}
      {/* B355: side by side, the voice first; from the edge of the paragraph, so the pointer gets there without a gap.
          B392: the paragraph's pointing area reaches over this column top to bottom (its after:), so the pointer can
          leave the text anywhere along it and go up or down to the buttons */}
      <div
        ref={box}
        style={{ top: Math.max(at?.top ?? 0, float && n ? 36 : 0) + 2 }}
        className={`absolute left-full z-10 flex-row gap-1 pl-1 ${rec ? 'flex' : 'hidden group-hover/blk:flex'}`}
      >
        <button
          data-act="doc-say"
          data-key={k}
          {...(at ? { 'data-quote': at.quote } : {})}
          title={
            rec
              ? 'Stop: the comment waits beside it, not sent'
              : at
                ? 'Speak a comment on this item'
                : 'Speak a comment on this paragraph'
          }
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
            title={
              at
                ? 'Comment on this item (write in the box below)'
                : 'Comment on this paragraph (write in the box below)'
            }
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
const markLive = (label: string) =>
  (els.text?.value || '').split('\n').some((l) => VC_MARK.exec(l)?.[1] === label) || U.files.some((f) => f.vc === label)
// B340: a comment not sent yet, where it will go: its words under its quote in the box, and its voice notes
function DraftCard({ label }: { label: string }) {
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
          {voice.some((f) => f.transcribing)
            ? 'Voice note · writing down its words…'
            : plural(voice.length, 'voice note')}
        </div>
      ) : null}
    </div>
  )
}
// B340: the comments, beside the text. Each sits level with its paragraph; when they would overlap they move down in
// this column only, never the text. Pointing at one marks its paragraph.
function DocRail({ d }: { d: Doc }) {
  useArea('vc')
  useArea('composer')
  const ref = useRef<HTMLElement>(null)
  const marks = U.vcMarks.filter((m) => m.d === d.d && markLive(m.label))
  const entries: { k: string; node: ReactNode }[] = []
  if (d.whole?.length)
    entries.push({
      k: 'doc',
      node: (
        <div>
          <div className="mb-1 text-[11px] font-medium text-zinc-500">On the whole document</div>
          <Thread d={d} k="doc" comments={d.whole} rail />
        </div>
      ),
    })
  for (const b of d.blocks) {
    if (b.comments.length)
      entries.push({
        k: b.key,
        node:
          !docResolved(d, b.key) || U.docThreads.has(b.key) ? (
            <Thread d={d} k={b.key} comments={b.comments} blockText={b.text} rail />
          ) : (
            <button
              data-act="doc-thread"
              data-key={b.key}
              className="flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <Icon n="check" c="size-3.5" />
              Resolved · {plural(b.comments.length, 'comment')}
            </button>
          ),
      })
    for (const m of marks.filter((x) => x.key === b.key))
      entries.push({ k: b.key, node: <DraftCard label={m.label} /> })
  }
  if (d.detached.length)
    entries.push({
      k: 'end',
      node: (
        <div className="space-y-3">
          <div className="text-[11px] font-medium text-zinc-500">Original text changed</div>
          {d.detached.map((t) => (
            <section key={t.key}>
              <div className="text-sm text-zinc-400 line-through">{t.quote}</div>
              <Thread d={d} k={t.key} comments={t.comments} rail />
            </section>
          ))}
        </div>
      ),
    })
  useLayoutEffect(() => {
    const rail = ref.current
    if (!rail) return
    const place = () => {
      const base = rail.getBoundingClientRect().top
      let y = 0
      for (const el of rail.children as HTMLCollectionOf<HTMLElement>) {
        const k = el.dataset.for || ''
        const sec =
          k && k !== 'doc' && k !== 'end'
            ? document.querySelector<HTMLElement>(`#docBlocks > section[data-key="${CSS.escape(k)}"]`)
            : null
        const want = sec ? sec.getBoundingClientRect().top - base : k === 'doc' ? 0 : y
        const top = Math.max(want, y)
        el.style.top = top + 'px'
        y = top + el.offsetHeight + 12
      }
      rail.style.minHeight = y + 'px'
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(rail)
    const blocks = document.getElementById('docBlocks')
    if (blocks) ro.observe(blocks)
    for (const el of rail.children) ro.observe(el)
    return () => ro.disconnect()
  })
  const mark = (k: string, on: boolean) =>
    document.querySelector(`#docBlocks > section[data-key="${CSS.escape(k)}"]`)?.toggleAttribute('data-hl', on)
  return (
    <aside ref={ref} aria-label="Comments" className="relative">
      {entries.map((e, i) => (
        <div
          key={e.k + i}
          data-for={e.k}
          onMouseEnter={() => mark(e.k, true)}
          onMouseLeave={() => mark(e.k, false)}
          className="absolute inset-x-0"
        >
          {e.node}
        </div>
      ))}
    </aside>
  )
}
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
      for (const c of b.comments) {
        const q = plainQuote(c.quote || '').trim(),
          sec = root.querySelector(`#docBlocks > section[data-key="${CSS.escape(b.key)}"] [data-block]`)
        if (!q || !sec || sameText(q, plainQuote(b.text)) || q.length > 300) continue
        if (sec.querySelector('mark[data-quote]')) continue
        const walk = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT)
        while (walk.nextNode()) {
          const t = walk.currentNode as Text,
            at = t.data.indexOf(q)
          if (at < 0 || t.parentElement?.closest('mark, button')) continue
          const m = document.createElement('mark'),
            rest = t.splitText(at)
          rest.splitText(q.length)
          m.dataset.quote = ''
          m.className = `rounded-sm ${docResolved(d, b.key) ? 'bg-transparent text-inherit underline decoration-zinc-300 decoration-dotted' : 'bg-amber-100 text-inherit dark:bg-amber-400/25'}`
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
      aria-label="Draw around the part you want to comment on"
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
  const ref = useRef<HTMLDivElement>(null)
  useMarkQuotes(ref, d)
  useLayoutEffect(() => {
    // B9 (T422): on the phone the one item of a list you picked is marked, not the whole list
    const root = ref.current
    if (!root) return
    for (const li of root.querySelectorAll('li[data-q]')) li.removeAttribute('data-q')
    const q = !desk() && U.docQuote
    if (!q) return
    const li = [...root.querySelectorAll<HTMLElement>(`section[data-key="${q.key}"] li`)].find(
      (l) => l.innerText.trim() === q.text,
    )
    li?.setAttribute('data-q', '')
  })
  const titled = !!d.blocks[0] && sameText(d.blocks[0].text.replace(/^#+\s*/, ''), d.title)
  const tks = tickKeys(d).map((x) => x.k)
  const [line0, ...rest0] = (d.blocks[0]?.text || '').split('\n'),
    titleLine =
      !titled && d.blocks[0]?.kind === 'para' && rest0.length > 0 && sameText(line0.replace(/^#+\s*/, ''), d.title) // T227 #4
  groups.delete('doc' + d.d) // its images, refilled as the blocks render
  const phoneBtn = `${HIT} ${BTN} text-sm lg:hidden`
  const side = desk() // B340: on the desktop the comments live in a column beside the text; the text never moves
  // B349: the column only when there are comments, and only when the pane is wide enough for it beside the text;
  // narrower, each commented paragraph shows a count beside it that opens its comments floating over the text.
  // B354: the text is always in the middle of the pane, as the box below it; the column goes in the room on its right
  // (it shows when that room holds it: the pane 90rem wide, the text 46rem and 22rem on each side, past the buttons)
  const [wide, setWide] = useState(true)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !side || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() =>
      setWide(el.clientWidth >= 90 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [side])
  const talked =
    !!d.whole?.length ||
    d.detached.length > 0 ||
    d.blocks.some((b) => b.comments.length) ||
    U.vcMarks.some((m) => m.d === d.d && markLive(m.label))
  const rail = side && wide && talked,
    float = side && !rail
  return (
    <div ref={ref} className="flex min-h-full flex-col">
      <div className="relative flex min-w-0 flex-col lg:mx-auto lg:w-full lg:max-w-[min(46rem,calc(100%-5rem))]">
        <div className="relative flex items-center gap-1 text-xs text-zinc-500">
          {float && d.whole?.length ? (
            <>
              <button
                data-act="doc-thread"
                data-key="doc"
                className="order-last flex h-7 items-center gap-1 rounded-md bg-amber-100 px-2 font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-100"
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
          <span className="min-w-0 flex-1 truncate">
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
            aria-pressed={!!U.docCircle}
            className={`${phoneBtn} aria-pressed:bg-amber-100 aria-pressed:text-amber-900 dark:aria-pressed:bg-amber-900/60 dark:aria-pressed:text-amber-100`}
          >
            {U.docCircle ? 'Draw around it…' : 'Mark an area'}
          </button>
          <button data-act="doc-edit" className={phoneBtn}>
            Edit
          </button>
        </div>
        {titled ? null : <div className="mt-3 text-2xl leading-tight font-bold tracking-tight">{d.title}</div>}
        <Outline d={d} />
        <div id="docBlocks" className={`relative mt-3 space-y-3 text-[15px] ${U.docCircle ? 'select-none' : ''}`}>
          {d.blocks.map((b0, i) => {
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
                {here ? (
                  R.rec ? (
                    // B300: recording, the same button stops and posts, where it was
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        data-act="doc-say"
                        data-key={b0.key}
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
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        data-act="doc-say"
                        data-key={b0.key}
                        {...(U.docQuote?.key === b0.key ? { 'data-quote': U.docQuote.text } : {})}
                        aria-label="Speak a comment on this paragraph"
                        className="grid size-12 shrink-0 place-items-center rounded-full bg-zinc-900 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        <Icon n="mic" c="size-5" />
                      </button>
                      <span className="text-[13px] text-zinc-500 dark:text-zinc-400">
                        Tap to speak, tap again to post
                      </span>
                      <button
                        data-act="doc-type"
                        className="ml-auto h-10 rounded-full px-3 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-300 dark:text-zinc-300 dark:ring-zinc-600"
                        aria-label="Type instead"
                      >
                        Aa
                      </button>
                    </div>
                  )
                ) : null}
                {!side && b0.comments.length && U.docThreads.has(b0.key) ? (
                  <Thread d={d} k={b0.key} comments={b0.comments} blockText={b0.text} />
                ) : null}
                {side ? <BlockActs d={d} k={b0.key} float={float} /> : null}
              </section>
            )
          })}
          {U.docCircle ? <Lasso /> : null}
        </div>
        {!side && d.whole?.length ? (
          <section className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-500">On the whole document</div>
            <Thread d={d} k="doc" comments={d.whole} />
          </section>
        ) : null}
        {!side && d.detached.length ? (
          <div className="mt-6 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-500">Original text changed</div>
            {d.detached.map((t) => (
              <section key={t.key}>
                <div className="text-sm text-zinc-400 line-through">{t.quote}</div>
                <Thread d={d} k={t.key} comments={t.comments} />
              </section>
            ))}
          </div>
        ) : null}
        {side ? null : (
          <>
            <p className="mt-6 text-center text-xs text-zinc-400">
              Tap a paragraph, select text or circle an area to comment on it
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
        {rail ? (
          <div className="absolute top-0 left-[calc(100%+5rem)] w-[17rem]">
            <DocRail d={d} />
          </div>
        ) : null}
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
        placeholder={'Title on the first line\n\nThen anything: a plan, a design, notes. Markdown works.'}
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
const PaneBtn = ({ act, title, children }: { act: string; title: string; children: ReactNode }) => (
  <button
    data-act={act}
    title={title}
    className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-100 aria-pressed:bg-amber-100 aria-pressed:text-amber-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:aria-pressed:bg-amber-900/60 dark:aria-pressed:text-amber-100"
  >
    {children}
  </button>
)
export const DocPaneHead = ({ d, editing }: { d: Doc; editing: boolean }) => (
  <span className="flex min-w-0 items-center gap-2 text-sm">
    <Icon n={editing ? 'pencil' : 'file'} c="size-[18px] text-zinc-500 dark:text-zinc-400" />
    {editing ? <span className="font-semibold">Editing</span> : null}
    <span className="font-mono font-bold text-zinc-700 dark:text-zinc-200">D{d.d}</span>
    <span className={`truncate ${editing ? '' : 'font-semibold'}`}>{d.title}</span>
  </span>
)
export const DocPaneActs = ({ d }: { d: Doc }) => (
  <>
    <PaneBtn act="doc-edit" title="Edit the text">
      <Icon n="pencil" c="size-4" />
      Edit
    </PaneBtn>
    <PaneBtn act="doc-move" title="Put it on another item">
      <Icon n="arrow" c="size-4" />
      Move
    </PaneBtn>
    <PaneBtn act="doc-delete" title="Delete the document (Deleted brings it back)">
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
    title={`Back to ${code(liveN(d.n))} · Esc`}
    className="flex h-9 items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
  >
    <Icon n="left" c="size-4" sw="2.25" />
    Back to {code(liveN(d.n))}
    <Kbd k="Esc" />
  </button>
)
