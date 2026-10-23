// F432 (D50): a document that is a web page an agent wrote. The page runs as it is, in a sandbox of its own (its
// scripts cannot reach Taska); a small helper inside it tells Taska its height, the part you point at or tap, and
// where the parts with comments are. B502: words you select are only selected, as on any web page: never a comment. Taska draws the rest over it, the same way as on a Markdown
// document: Comment mode outlines the part under the pointer with the speak and comment buttons in its corner, a picked
// part gets the amber ring and the box says what you comment on, each thread has its count beside its part.
import { useEffect, useRef, useState } from 'react'
import { R_STATE as R, U, desk, els, render, threadOpen, threadsOf, useArea } from '../lib/state'
import { renderDoc } from '../lib/docs'
import { act } from '../lib/actions'
import { markUsed } from '../lib/data'
import type { Doc } from '../lib/types'
import { Icon } from './ui'
import { SayRow, Thread } from './Doc'

type Box = { x: number; y: number; w: number; h: number }
type Part = { key: string; text: string; rect: Box }

// Runs inside the page. A part is the nearest block around what you point at; its key is its place in the page.
const HELPER = `<script>(() => {
  const send = (m) => parent.postMessage(Object.assign({ taskaPage: 1 }, m), '*')
  let mode = false, keys = [], picked = '', shut = false, shutting = false
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
    shut = !!m.shut
    measure()
  })
  // B497: once a part is picked, no other one lights or can be picked until Esc lets it go
  addEventListener('mousemove', (e) => { if (mode === true && !picked) { const el = part(e.target); send({ hover: el ? info(el) : null, at: [e.clientX, e.clientY] }) } })
  document.addEventListener('mouseleave', () => { if (mode === true) send({ hover: null }) })
  // B502: a drag selects words (and only that); a click where the pointer went down picks the part
  let down = [0, 0]
  addEventListener('mousedown', (e) => { down = [e.clientX, e.clientY] }, true)
  addEventListener('click', (e) => {
    if (mode !== true && mode !== 'tap') {
      // Comment mode may be on in Taska before the page has heard: Taska decides (the click itself goes on)
      if (!shutting && Math.abs(e.clientX - down[0]) + Math.abs(e.clientY - down[1]) <= 4) { const el = part(e.target); if (el) send({ maybe: info(el) }) }
      return
    }
    // B497: nothing else is picked while one part is; B503: a click that closes open comments only closes them
    if ((mode === true && picked) || shutting) { e.preventDefault(); e.stopPropagation(); return }
    if (Math.abs(e.clientX - down[0]) + Math.abs(e.clientY - down[1]) > 4) return
    getSelection().removeAllRanges()
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
  // B503: a click in the page closes open comments, and does nothing else (whatever Taska says meanwhile)
  addEventListener('pointerdown', () => { shutting = shut; send({ down: 1 }) }, true)
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
  if (R.rec) return act('doc-say-cancel') // B498: a recording stops first, as everywhere
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
  const pop = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(480)
  const [hover, setHover] = useState<Part | null>(null)
  const [rects, setRects] = useState<Record<string, Box>>({})
  const [lit, setLit] = useState<string | null>(null) // B503: the part whose comment count is under the pointer
  const away = useRef<(() => void) | null>(null) // B503: closes the open comments (a click anywhere else)
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
    // B498: the part you speak about: the mic you pressed turns into Stop right there, and no other part lights
    vc = R.vc,
    rec =
      R.rec && vc?.d === d.d && vc.key?.startsWith('h:') && !vc.range ? { key: vc.key, text: vc.quote || '' } : null,
    held = rec || picked,
    threads = d.blocks.flatMap((b) => threadsOf(b.comments).map((t) => ({ ...t, key: b.key }))),
    keys = [...new Set([...d.blocks.map((b) => b.key), ...(held ? [held.key] : [])])]
  // B492: each thread's count sits in the page, in its part's top right corner, never on top of another one
  let last = -40
  const counts = threads.map((t) => {
    const r = rects[t.key],
      top = Math.max((r?.y ?? 0) + 4, last + 32)
    last = top
    return { ...t, top, left: Math.max(4, (r ? r.x + r.w : 0) - 52) }
  })
  const open = counts.find((c) => threadOpen(c.tk))
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
        down?: number
        maybe?: Part
      }
      if (m.ready) frame.current?.contentWindow?.postMessage({ taska: 1, ...(JSON.parse(WANT.now) as object) }, '*')
      if (m.h) setHeight(m.h + 2)
      if ('hover' in m) hoverAt(m.hover || null, m.at)
      if (m.rects) setRects(m.rects)
      if (m.down) away.current?.()
      // B497: on the desktop a part picked stays the one until Esc, whatever the page sends meanwhile
      const one = desk() && !!U.docQuote?.key.startsWith('h:')
      if (m.pick && !one) pick(m.pick)
      if (m.maybe && desk() && U.docInspect && !one && !R.rec) pick(m.maybe)
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
  // what the page needs from Taska: whether pointing outlines parts (or a tap picks one), which parts to find, and
  // whether a click there only closes the open comments (B503)
  const want = JSON.stringify({ mode, keys, picked: held?.key || '', shut: !!open })
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
  // B503: open comments close on a click anywhere else, in the page too (the page says so from inside)
  const openTk = open?.tk,
    openKey = open?.key
  useEffect(() => {
    if (!openTk || !openKey) return
    const close = () => {
      U.docThreads.delete(openTk)
      U.docThreads.delete(openKey)
      setLit(null)
      renderDoc()
    }
    const down = (e: MouseEvent) => {
      const t = e.target as Element
      // the box (a reply is written there), a sheet or a tip over the page keep it open
      if (
        pop.current?.contains(t) ||
        t.closest?.(`[data-act="doc-thread"][data-key="${CSS.escape(openTk)}"], #docCmts, #foot, #dlg, #overlay, #tip`)
      )
        return
      close()
    }
    away.current = close
    document.addEventListener('mousedown', down, true)
    // under a part low on the screen, the comments come into view (the phone's page is long)
    requestAnimationFrame(() => pop.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
    return () => {
      away.current = null
      document.removeEventListener('mousedown', down, true)
    }
  }, [openTk, openKey])
  const ring = (k: string, r: Box, cls: string) => (
    <div
      key={k}
      data-ring={k}
      className={`pointer-events-none absolute rounded-lg ring-2 ${cls}`}
      style={{ left: r.x - 4, top: r.y - 4, width: r.w + 8, height: r.h + 8 }}
    />
  )
  // B503: the part a comment is on is outlined while its count is under the pointer and while it is open
  const amber = [...new Set([lit, openKey])].filter((k): k is string => !!k && k !== held?.key && !!rects[k])
  const btn =
    'grid size-7 place-items-center rounded-lg bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-900/10 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white'
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
      {hover && mode === true && !held ? ring('hover', hover.rect, 'ring-blue-500') : null}
      {held && rects[held.key] ? ring(held.key, rects[held.key], 'ring-amber-300') : null}
      {amber.map((k) => ring(k, rects[k], 'ring-amber-400'))}
      {side && held && rects[held.key] ? (
        // B497, B498: the part picked or spoken about keeps its buttons right there; the mic pressed turns into Stop
        <div
          className="absolute z-10 flex flex-row gap-1"
          style={{ left: btnsAt(rects[held.key]).x, top: btnsAt(rects[held.key]).y }}
        >
          <button
            data-act="page-say"
            data-key={held.key}
            data-quote={held.text}
            title={rec ? 'Stop' : 'Speak a comment'}
            className={
              rec
                ? 'grid size-7 place-items-center rounded-lg bg-red-600 text-white shadow-sm ring-1 ring-red-700'
                : btn
            }
          >
            <Icon n={rec ? 'stop' : 'mic'} c="size-4" />
          </button>
          {rec ? null : (
            // B497 (r739): picked, both buttons stay on the part, where they are needed
            <button data-act="page-pick" data-key={held.key} data-quote={held.text} title="Comment" className={btn}>
              <Icon n="comment" c="size-4" />
            </button>
          )}
        </div>
      ) : hover && mode === true && !held ? (
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
            className={btn}
          >
            <Icon n="mic" c="size-4" />
          </button>
          <button data-act="page-pick" data-key={hover.key} data-quote={hover.text} title="Comment" className={btn}>
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
          onMouseEnter={() => setLit(c.key)}
          onMouseLeave={() => setLit(null)}
          className="absolute z-10 flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-lg bg-amber-100 px-1.5 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-200 dark:bg-amber-900/80 dark:text-amber-100 dark:hover:bg-amber-800/80"
        >
          <Icon n="comment" c="size-3.5" />
          {c.comments.length}
        </button>
      ))}
      {open && rects[open.key] && !side ? (
        // B503: the comments open right under their part (outlined), its right edges lined up, not at the page's end;
        // B505: on the desktop they are in the comments' column beside the page, the part outlined while open
        <div
          ref={pop}
          data-thread-pop
          className={`absolute z-20 flex flex-col gap-2 text-sm shadow-xl ${side ? 'w-80 max-w-full' : 'inset-x-0 mx-1'}`}
          style={{
            top: rects[open.key].y + rects[open.key].h + 8,
            ...(side ? { left: Math.max(0, rects[open.key].x + rects[open.key].w - 320) } : {}),
          }}
        >
          <Thread d={d} k={open.tk} comments={open.comments} rail />
        </div>
      ) : null}
      {!side && held && rects[held.key] ? (
        // on the phone a tap picks the part; under it, the same speak and type buttons as under a paragraph
        <div
          className="absolute inset-x-0 z-10 mx-1 rounded-xl bg-white p-1.5 pr-3 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-900 dark:ring-white/10"
          style={{ top: rects[held.key].y + rects[held.key].h + 10 }}
        >
          <SayRow act="page-say" k={held.key} quote={held.text} rec={!!rec} at="" />
        </div>
      ) : null}
    </div>
  )
}
