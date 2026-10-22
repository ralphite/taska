// F432 (D50): a document that is a web page an agent wrote. The page runs as it is, in a sandbox of its own (its
// scripts cannot reach Taska); a small helper inside it tells Taska its height, the part you point at, tap or select
// words in, and where the parts with comments are. Taska draws the rest over it, the same way as on a Markdown
// document: Comment mode outlines the part under the pointer with the speak and comment buttons beside it, a picked
// part gets the amber ring and the box says what you comment on, each thread has its count beside its part.
import { useEffect, useRef, useState } from 'react'
import { U, desk, els, render, threadOpen, threadsOf, useArea } from '../lib/state'
import { renderDoc } from '../lib/docs'
import type { Doc } from '../lib/types'
import { Icon } from './ui'
import { Thread } from './Doc'

type Box = { x: number; y: number; w: number; h: number }
type Part = { key: string; text: string; rect: Box }

// Runs inside the page. A part is the nearest block around what you point at; its key is its place in the page.
const HELPER = `<script>(() => {
  const send = (m) => parent.postMessage(Object.assign({ taskaPage: 1 }, m), '*')
  let mode = false, keys = []
  const place = (el) => {
    const p = []
    for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      let i = 1, s = e
      while ((s = s.previousElementSibling)) i++
      p.unshift(e.tagName.toLowerCase() + ':nth-child(' + i + ')')
    }
    return 'h:body>' + p.join('>')
  }
  const part = (el) => {
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (el.nodeType !== 1) continue
      const r = el.getBoundingClientRect()
      if (r.width > 40 && r.height > 14 && getComputedStyle(el).display !== 'inline') return el
    }
    return null
  }
  const box = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height })
  const info = (el) => ({ key: place(el), text: (el.innerText || '').trim().slice(0, 500), rect: box(el.getBoundingClientRect()) })
  const size = () => send({ h: Math.ceil(document.documentElement.scrollHeight) })
  const measure = () => {
    const out = {}
    for (const k of keys) {
      try {
        const e = document.querySelector(k.slice(2))
        if (e) out[k] = box(e.getBoundingClientRect())
      } catch (_) {}
    }
    send({ rects: out })
  }
  addEventListener('message', (e) => {
    const m = e.data || {}
    if (!m.taska) return
    mode = m.mode
    keys = m.keys || []
    measure()
  })
  addEventListener('mousemove', (e) => { if (mode === true) { const el = part(e.target); send({ hover: el ? info(el) : null }) } })
  document.addEventListener('mouseleave', () => { if (mode === true) send({ hover: null }) })
  addEventListener('click', (e) => {
    if (mode !== true && mode !== 'tap') return
    if (String(getSelection()).trim()) return
    const el = part(e.target)
    if (!el) return
    e.preventDefault()
    e.stopPropagation()
    send({ pick: info(el) })
  }, true)
  let t = 0
  document.addEventListener('selectionchange', () => {
    clearTimeout(t)
    t = setTimeout(() => {
      const s = getSelection(), words = String(s).trim()
      if (!words || !s.anchorNode) return
      const el = part(s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement)
      if (el) send({ pick: { key: place(el), text: words.slice(0, 500), rect: box(s.getRangeAt(0).getBoundingClientRect()) } })
    }, 400)
  })
  addEventListener('keydown', (e) => { if (e.key === 'Escape') send({ esc: 1 }) })
  new ResizeObserver(() => { size(); measure() }).observe(document.documentElement)
  addEventListener('load', () => { size(); measure() })
  size()
  send({ ready: 1 }) // Taska answers with what it needs from the page
})()</script>`

const WANT = { now: '{}' } // what the page was last told, for a page that loads after it was said
/** Pick a part of the page (or words in it) to comment on: the box says it, as for a Markdown paragraph */
function pick(p: Part) {
  U.docSel = new Set()
  U.docReply = null
  U.docQuote = { key: p.key, text: p.text }
  renderDoc()
  render() // the box's line says what you comment on
  if (desk()) els.text?.focus({ preventScroll: true })
}

export function WebPage({ d }: { d: Doc }) {
  useArea('vc')
  useArea('composer')
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(480)
  const [hover, setHover] = useState<Part | null>(null)
  const [rects, setRects] = useState<Record<string, Box>>({})
  const side = desk(),
    mode = side ? !!U.docInspect : 'tap',
    picked = U.docQuote?.key.startsWith('h:') ? U.docQuote : null,
    threads = d.blocks.flatMap((b) => threadsOf(b.comments).map((t) => ({ ...t, key: b.key }))),
    keys = [...new Set([...d.blocks.map((b) => b.key), ...(picked ? [picked.key] : [])])]
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      const m = (e.data || {}) as {
        h?: number
        hover?: Part | null
        rects?: Record<string, Box>
        pick?: Part
        esc?: number
        ready?: number
      }
      if (m.ready) frame.current?.contentWindow?.postMessage({ taska: 1, ...(JSON.parse(WANT.now) as object) }, '*')
      if (m.h) setHeight(m.h + 2)
      if ('hover' in m) setHover(m.hover || null)
      if (m.rects) setRects(m.rects)
      if (m.pick) pick(m.pick)
      if (m.esc && U.docInspect) {
        U.docInspect = false
        renderDoc()
      }
    }
    addEventListener('message', on)
    return () => removeEventListener('message', on)
  }, [])
  // what the page needs from Taska: whether pointing outlines parts (or a tap picks one), and which parts to find
  const want = JSON.stringify({ mode, keys })
  WANT.now = want
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ taska: 1, ...(JSON.parse(want) as object) }, '*')
  }, [want])
  useEffect(() => {
    if (!U.docInspect) return
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      U.docInspect = false
      renderDoc()
    }
    addEventListener('keydown', esc, true)
    return () => removeEventListener('keydown', esc, true)
  }, [mode])
  const ring = (r: Box, cls: string) => (
    <div
      className={`pointer-events-none absolute rounded-lg ring-2 ${cls}`}
      style={{ left: r.x - 4, top: r.y - 4, width: r.w + 8, height: r.h + 8 }}
    />
  )
  // each thread's count sits level with its part, never on top of another one
  let last = -40
  const counts = threads.map((t) => {
    const top = Math.max((rects[t.key]?.y ?? 0) - (side ? 0 : 10), last + 32)
    last = top
    return { ...t, top }
  })
  const open = counts.find((c) => threadOpen(c.tk))
  return (
    <div className="relative mt-3">
      <iframe
        ref={frame}
        title={d.title}
        sandbox="allow-scripts allow-popups allow-forms"
        srcDoc={d.md + HELPER}
        style={{ height }}
        className="block w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-800"
      />
      {hover && mode === true ? ring(hover.rect, 'ring-blue-500') : null}
      {picked && rects[picked.key] ? ring(rects[picked.key], 'ring-amber-300') : null}
      {hover && mode === true ? (
        <div className="absolute left-full z-10 flex flex-row gap-1 pl-1" style={{ top: hover.rect.y - 2 }}>
          <button
            data-act="page-say"
            data-key={hover.key}
            data-quote={hover.text}
            title="Speak a comment"
            className="grid size-7 place-items-center rounded-lg bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-900/10 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white"
          >
            <Icon n="mic" c="size-4" />
          </button>
          <button
            data-act="page-pick"
            data-key={hover.key}
            data-quote={hover.text}
            title="Comment"
            className="grid size-7 place-items-center rounded-lg bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-900/10 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white"
          >
            <Icon n="comment" c="size-4" />
          </button>
        </div>
      ) : null}
      {counts.map((c) => (
        <button
          key={c.tk}
          data-act="doc-thread"
          data-key={c.tk}
          style={{ top: c.top + 2 }}
          className={`absolute z-10 flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-lg bg-amber-100 px-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-800/70 ${side ? 'left-[calc(100%+0.25rem)]' : 'right-1.5'}`}
        >
          {side ? null : <Icon n="comment" c="size-3.5" />}
          {c.comments.length}
        </button>
      ))}
      {side && open ? (
        <div
          className="absolute -right-10 z-20 flex w-80 max-w-full flex-col gap-2 text-sm shadow-xl"
          style={{ top: (rects[open.key]?.y ?? 0) + (rects[open.key]?.h ?? 0) + 8 }}
        >
          <Thread d={d} k={open.tk} comments={open.comments} rail />
        </div>
      ) : null}
      {!side && picked && rects[picked.key] ? (
        // on the phone a tap picks the part; under it, the same speak and type buttons as under a paragraph
        <div
          className="absolute inset-x-0 z-10 mx-1 flex items-center gap-2 rounded-xl bg-white p-1.5 pr-3 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-900 dark:ring-white/10"
          style={{ top: rects[picked.key].y + rects[picked.key].h + 10 }}
        >
          <button
            data-act="page-say"
            data-key={picked.key}
            data-quote={picked.text}
            aria-label="Dictate comment"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-zinc-900 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
          >
            <Icon n="mic" c="size-5" />
          </button>
          <span className="text-[13px] text-zinc-500 dark:text-zinc-400">Tap to speak, tap again to post</span>
          <button
            data-act="doc-type"
            aria-label="Type instead"
            className="ml-auto h-10 rounded-full px-3 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-300 dark:text-zinc-300 dark:ring-zinc-600"
          >
            Aa
          </button>
        </div>
      ) : null}
      {!side
        ? threads
            .filter((t) => threadOpen(t.tk))
            .map((t) => (
              <div key={t.tk} className="mt-3">
                <Thread d={d} k={t.tk} comments={t.comments} blockText={t.comments[0]?.quote} />
              </div>
            ))
        : null}
    </div>
  )
}
