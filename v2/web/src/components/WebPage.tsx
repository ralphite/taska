// F432 (D50): a document that is a web page an agent wrote. The page runs as it is, in a sandbox of its own (its
// scripts cannot reach Taska); a small helper inside it tells Taska its height, the part you point at or tap, and
// where the parts with comments are. B502: words you select are only selected, as on any web page: never a comment. Taska draws the rest over it, the same way as on a Markdown
// document: Comment mode outlines the part under the pointer with the speak and comment buttons in its corner, a picked
// part gets the amber ring and the box says what you comment on, each thread has its count beside its part.
import { useEffect, useRef, useState } from 'react'
import { U, desk, els, render, threadOpen, threadsOf, useArea } from '../lib/state'
import { renderDoc } from '../lib/docs'
import { act } from '../lib/actions'
import { markUsed } from '../lib/data'
import type { Doc } from '../lib/types'
import { Icon } from './ui'
import { Thread } from './Doc'

type Box = { x: number; y: number; w: number; h: number }
type Part = { key: string; text: string; rect: Box }

// Runs inside the page. A part is the nearest block around what you point at; its key is its place in the page.
const HELPER = `<script>(() => {
  const send = (m) => parent.postMessage(Object.assign({ taskaPage: 1 }, m), '*')
  let mode = false, keys = [], picked = ''
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
    picked = m.picked || ''
    measure()
  })
  // B497: once a part is picked, no other one lights or can be picked until Esc lets it go
  addEventListener('mousemove', (e) => { if (mode === true && !picked) { const el = part(e.target); send({ hover: el ? info(el) : null, at: [e.clientX, e.clientY] }) } })
  document.addEventListener('mouseleave', () => { if (mode === true) send({ hover: null }) })
  addEventListener('click', (e) => {
    if (mode !== true && mode !== 'tap') return
    if (mode === true && picked) { e.preventDefault(); e.stopPropagation(); return }
    if (String(getSelection()).trim()) return
    const el = part(e.target)
    if (!el) return
    e.preventDefault()
    e.stopPropagation()
    send({ pick: info(el) })
  }, true)
  addEventListener('keydown', (e) => { if (e.key === 'Escape') send({ esc: 1 }) })
  let usedAt = 0 // F449: Taska does not reload under you while you use the page
  let pointer = ''
  const used = (e) => {
    if (e.type === 'pointermove') { if (e.screenX + ',' + e.screenY === pointer) return; pointer = e.screenX + ',' + e.screenY }
    const n = Date.now(); if (n - usedAt > 10000) { usedAt = n; send({ used: 1 }) }
  }
  for (const t of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'input']) addEventListener(t, used, true)
  new ResizeObserver(() => { size(); measure() }).observe(document.documentElement)
  addEventListener('load', () => { size(); measure() })
  size()
  send({ ready: 1 }) // Taska answers with what it needs from the page
})()</script>`

/** D56: where the speak and comment buttons go: just above the outline at its right end, hiding none of the part */
const btnsAt = (r: Box) => ({ x: Math.max(4, r.x + r.w - 64), y: Math.max(0, r.y - 34) })
type XY = [number, number]
/** whether p is inside the triangle a b c */
function inside(p: XY, a: XY, b: XY, c: XY) {
  const side = (u: XY, v: XY) => (p[0] - v[0]) * (u[1] - v[1]) - (u[0] - v[0]) * (p[1] - v[1])
  const d1 = side(a, b),
    d2 = side(b, c),
    d3 = side(c, a)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}
const WANT = { now: '{}' } // what the page was last told, for a page that loads after it was said
/** B484: Esc steps back one level: the picked part first (the words in the box stay), then Comment mode */
function escape() {
  if (U.docQuote?.key.startsWith('h:')) return act('doc-unpick')
  if (!U.docInspect) return
  U.docInspect = false
  renderDoc()
}
/** Pick a part of the page to comment on: the box says it, as for a Markdown paragraph */
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
  // D56: the pointer leaves the page to reach the buttons over it: the part stays lit while it is on them. On the way
  // there (heading for them from where the part was lit) another part under the pointer does not take its place,
  // unless the pointer rests on it.
  const onBtns = useRef(false),
    drop = useRef(0),
    swap = useRef(0),
    cur = useRef<{ part: Part; from: XY } | null>(null)
  const hoverAt = useRef((h: Part | null, at?: XY) => {
    clearTimeout(drop.current)
    clearTimeout(swap.current)
    const take = (part: Part, from: XY) => {
      cur.current = { part, from }
      setHover(part)
    }
    if (h) {
      const was = cur.current
      if (was && at && h.key !== was.part.key) {
        const b = btnsAt(was.part.rect)
        if (inside(at, was.from, [b.x - 24, b.y + 52], [b.x + 84, b.y - 24])) {
          swap.current = window.setTimeout(() => take(h, at), 300)
          return
        }
      }
      take(h, at || was?.from || [0, 0])
      return
    }
    drop.current = window.setTimeout(() => {
      if (onBtns.current) return
      cur.current = null
      setHover(null)
    }, 150)
  }).current
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
        at?: [number, number]
        rects?: Record<string, Box>
        pick?: Part
        esc?: number
        ready?: number
        used?: number
      }
      if (m.ready) frame.current?.contentWindow?.postMessage({ taska: 1, ...(JSON.parse(WANT.now) as object) }, '*')
      if (m.h) setHeight(m.h + 2)
      if ('hover' in m) hoverAt(m.hover || null, m.at)
      if (m.rects) setRects(m.rects)
      if (m.pick) pick(m.pick)
      if (m.esc) escape()
      if (m.used) markUsed()
    }
    addEventListener('message', on)
    return () => {
      removeEventListener('message', on)
      clearTimeout(drop.current)
      clearTimeout(swap.current)
    }
  }, [hoverAt])
  // what the page needs from Taska: whether pointing outlines parts (or a tap picks one), and which parts to find
  const want = JSON.stringify({ mode, keys, picked: picked?.key || '' })
  WANT.now = want
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ taska: 1, ...(JSON.parse(want) as object) }, '*')
  }, [want])
  useEffect(() => {
    if (!U.docInspect) return
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      escape()
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
  // B492: each thread's count sits in the page, in its part's top right corner, never on top of another one
  let last = -40
  const counts = threads.map((t) => {
    const r = rects[t.key],
      top = Math.max((r?.y ?? 0) + 4, last + 32)
    last = top
    return { ...t, top, left: Math.max(4, (r ? r.x + r.w : 0) - 52) }
  })
  const open = counts.find((c) => threadOpen(c.tk))
  return (
    // B492: edge to edge: on the phone across the sheet's side margins too
    <div className="relative -mx-4 mt-3 lg:mx-0 lg:mt-0">
      {/* B492: the page as it is: no frame around it, and no tooltip over all of it (a name for screen readers only) */}
      <iframe
        ref={frame}
        aria-label={d.title}
        sandbox="allow-scripts allow-popups allow-forms"
        srcDoc={d.md + HELPER}
        style={{ height }}
        className="block w-full bg-white"
      />
      {hover && mode === true && !picked ? ring(hover.rect, 'ring-blue-500') : null}
      {picked && rects[picked.key] ? ring(rects[picked.key], 'ring-amber-300') : null}
      {hover && mode === true && !picked ? (
        <div
          className="absolute z-10 flex flex-row gap-1"
          style={{ left: btnsAt(hover.rect).x, top: btnsAt(hover.rect).y }}
          onMouseEnter={() => {
            onBtns.current = true
            clearTimeout(drop.current)
            clearTimeout(swap.current)
          }}
          onMouseLeave={() => {
            onBtns.current = false
            hoverAt(null)
          }}
        >
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
          style={{ top: c.top, left: c.left }}
          className="absolute z-10 flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-lg bg-amber-100 px-1.5 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-200 dark:bg-amber-900/80 dark:text-amber-100 dark:hover:bg-amber-800/80"
        >
          <Icon n="comment" c="size-3.5" />
          {c.comments.length}
        </button>
      ))}
      {side && open ? (
        <div
          className="absolute right-2 z-20 flex w-80 max-w-full flex-col gap-2 text-sm shadow-xl"
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
