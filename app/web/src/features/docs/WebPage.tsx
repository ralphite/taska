// A document that is a web page an agent wrote: it runs as it is, in a frame of its own (pageHelper tells Taska what
// happens in it). Over it, as over a Markdown document: in Comment mode (the desktop) the part under the pointer is
// outlined with the speak and comment buttons at its corner; a tap picks a part (the phone); a picked part has the
// amber ring and the box says what you comment on; each thread's count sits in its part's corner, and opens its
// comments under it. Words selected are only selected, as on any page. Props, and the page's own state.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { plainQuote } from '../../model/markdown'
import { Icon } from '../../ui/Icon'
import { PAGE_HELPER } from './pageHelper'

type Box = { x: number; y: number; w: number; h: number }
export type Part = { key: string; text: string; rect: Box }
type XY = [number, number]
type Spot = { top: number; left: number }

export interface PageThread {
  tk: string
  /** the part it is on */
  key: string
  quote: string
  n: number
  done: boolean
  /** comments in the box not sent yet: a count of their own that opens their card */
  draft?: boolean
}

export interface WebPageEvents {
  pick(part: { key: string; text: string }): void
  say(part: { key: string; text: string }): void
  esc(): void
  toggle(tk: string): void
  /** a click away from the open comments */
  away(tk: string, key: string): void
}

/** a part the page shows now (not hidden, not gone) */
const shown = (r: Box | undefined): r is Box => !!r && r.w > 0 && r.h > 0

/** Where the speak and comment buttons go: just above the outline at its right end, hiding none of the part, and
 * left of a comment count there (never under it, where a click could not reach them). */
function btnsAt(r: Box, counts: Spot[] = []) {
  let x = Math.max(4, r.x + r.w - 64)
  const y = Math.max(0, r.y - 34)
  for (const c of [...counts].sort((a, b) => b.left - a.left)) if (c.top < y + 30 && c.top + 30 > y && c.left < x + 62 && c.left + 46 > x) x = Math.max(4, c.left - 64)
  return { x, y }
}

/** whether p is inside the triangle a b c */
function inside(p: XY, a: XY, b: XY, c: XY) {
  const side = (u: XY, v: XY) => (p[0] - v[0]) * (u[1] - v[1]) - (u[0] - v[0]) * (p[1] - v[1])
  const d1 = side(a, b)
  const d2 = side(b, c)
  const d3 = side(c, a)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}

export function WebPage({ title, html, threads, held, rec = false, open, desk, inspect, renderThread, sayRow, on }: {
  title: string
  html: string
  threads: PageThread[]
  /** the part picked to comment on */
  held: { key: string; text: string } | null
  /** a voice comment about the part held is being recorded: its mic is Stop */
  rec?: boolean
  /** the thread open */
  open: string | null
  desk: boolean
  /** the desktop's Comment mode */
  inspect: boolean
  /** a thread's comments (`rail`: a card over the page) */
  renderThread(tk: string, rail: boolean): ReactNode
  /** the phone's row to speak or type, under the part picked */
  sayRow?: ReactNode
  on: WebPageEvents
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(480)
  const tall = useRef({ h: 0, at: 0, step: 0, n: 0 })
  const [hover, setHover] = useState<Part | null>(null)
  const [rects, setRects] = useState<Record<string, Box>>({})
  const [measured, setMeasured] = useState(false)
  const [lit, setLit] = useState<string | null>(null)
  const onBtns = useRef(false)
  const drop = useRef(0)
  const swap = useRef(0)
  const cur = useRef<{ part: Part; from: XY } | null>(null)
  const spots = useRef<Spot[]>([])
  const live = useRef({ held, inspect, desk, on })
  /** closes the open comments (a click in the page) */
  const awayRef = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    live.current = { held, inspect, desk, on }
  })
  const mode = desk ? inspect : 'tap'
  // each thread's count in its part's top right corner (top of the page down); one that would cover another goes
  // just under it; a part the page does not show now has none
  const counts: (PageThread & Spot)[] = []
  for (const t of threads.filter((x) => shown(rects[x.key])).sort((a, b) => rects[a.key].y - rects[b.key].y || rects[a.key].x - rects[b.key].x)) {
    const r = rects[t.key]
    const left = Math.max(4, r.x + r.w - 52)
    let top = r.y + 4
    for (let moved = true; moved; ) {
      moved = false
      for (const c of counts)
        if (Math.abs(c.left - left) < 44 && top > c.top - 32 && top < c.top + 32) {
          top = c.top + 32
          moved = true
        }
    }
    counts.push({ ...t, top, left })
  }
  useLayoutEffect(() => {
    spots.current = counts
  })
  const elsewhere = measured ? threads.filter((t) => !t.draft && !shown(rects[t.key])) : []
  const opened = counts.find((c) => c.tk === open)
  const keys = [...new Set([...threads.map((t) => t.key), ...(held ? [held.key] : [])])]
  const want = JSON.stringify({ mode, keys, picked: held?.key || '', shut: !!opened })
  const wantNow = useRef(want)
  useLayoutEffect(() => {
    wantNow.current = want
    frame.current?.contentWindow?.postMessage({ taska: 1, ...(JSON.parse(want) as object) }, '*')
  }, [want])
  useLayoutEffect(() => {
    // before the page says how tall it is, it has what the pane shows below its top: a page as tall as its window
    // (an app) fills that
    const f = frame.current
    const pane = f?.closest('.overflow-y-auto')
    if (!f || !pane || tall.current.h) return
    const top = f.getBoundingClientRect()
    const h = Math.round(Math.min(pane.getBoundingClientRect().bottom, innerHeight) - top.top)
    if (h > 240) setHeight(h)
  }, [])
  useEffect(() => {
    const take = (part: Part, from: XY) => {
      cur.current = { part, from }
      setHover(part)
    }
    // the pointer leaves the page to reach the buttons over it: the part stays lit while it is on them; on the way
    // there another part under the pointer takes its place only if the pointer rests on it
    const hoverAt = (h: Part | null, at?: XY) => {
      clearTimeout(drop.current)
      clearTimeout(swap.current)
      if (h) {
        const was = cur.current
        if (was && at && h.key !== was.part.key) {
          const b = btnsAt(was.part.rect, spots.current)
          if (inside(at, was.from, [b.x - 24, b.y + 52], [b.x + 84, b.y - 24])) {
            swap.current = window.setTimeout(() => take(h, at), 300)
            return
          }
        }
        return take(h, at || was?.from || [0, 0])
      }
      drop.current = window.setTimeout(() => {
        if (onBtns.current) return
        cur.current = null
        setHover(null)
      }, 150)
    }
    // the frame takes the page's height; a page that grows by the same step each time its frame does (its height
    // follows its window's) stops growing it after three such steps in quick succession
    const fit = (h: number) => {
      const t = tall.current
      const now = performance.now()
      const step = h - t.h
      if (t.h && Math.abs(step) < 1) return
      t.n = t.h && step > 0 && Math.abs(step - t.step) <= 2 && now - t.at < 500 ? t.n + 1 : 0
      t.at = now
      t.step = step
      if (t.n >= 3) return
      t.h = h
      setHeight(h)
    }
    const got = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      const m = (e.data || {}) as { h?: number; hover?: Part | null; at?: XY; rects?: Record<string, Box>; pick?: Part; esc?: number; ready?: number; down?: number; maybe?: Part }
      const now = live.current
      if (m.ready) frame.current?.contentWindow?.postMessage({ taska: 1, ...(JSON.parse(wantNow.current) as object) }, '*')
      if (m.h) fit(m.h)
      if ('hover' in m) hoverAt(m.hover || null, m.at)
      if (m.rects) {
        setRects(m.rects)
        setMeasured(true)
      }
      if (m.down) awayRef.current?.()
      // on the desktop a part picked stays the one until Esc, whatever the page sends meanwhile
      const one = now.desk && !!now.held
      if (m.pick && !one) now.on.pick({ key: m.pick.key, text: m.pick.text })
      if (m.maybe && now.desk && now.inspect && !one) now.on.pick({ key: m.maybe.key, text: m.maybe.text })
      if (m.esc) now.on.esc()
    }
    addEventListener('message', got)
    return () => {
      removeEventListener('message', got)
      clearTimeout(drop.current)
      clearTimeout(swap.current)
    }
  }, [])
  // open comments close on a click anywhere else, in the page too (the page says so from inside)
  const openTk = opened?.tk
  const openKey = opened?.key
  useEffect(() => {
    if (!openTk || !openKey) return
    const close = () => {
      setLit(null)
      live.current.on.away(openTk, openKey)
    }
    const down = (e: MouseEvent) => {
      const t = e.target as Node
      if (pop.current?.contains(t) || root.current?.querySelector(`[data-count="${CSS.escape(openTk)}"]`)?.contains(t)) return
      // the box (a reply is written there), a sheet or a tip over the page keep it open
      if ((t as Element).closest?.('footer, [role=dialog], [role=tooltip]')) return
      close()
    }
    awayRef.current = close
    document.addEventListener('mousedown', down, true)
    requestAnimationFrame(() => pop.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
    return () => {
      awayRef.current = null
      document.removeEventListener('mousedown', down, true)
    }
  }, [openTk, openKey])
  const ring = (k: string, r: Box, cls: string) => (
    <div key={k} className={`pointer-events-none absolute rounded-lg ring-2 ${cls}`} style={{ left: r.x - 4, top: r.y - 4, width: r.w + 8, height: r.h + 8 }} />
  )
  // the part a comment is on is outlined while its count is under the pointer and while it is open
  const amber = [...new Set([lit, openKey])].filter((k): k is string => !!k && k !== held?.key && !!rects[k])
  const btn = 'grid size-7 place-items-center rounded-lg bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-900/10 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white'
  const buttons = (p: { key: string; text: string }, r: Box, hovering: boolean) => {
    const at = btnsAt(r, counts)
    const stop = rec && !hovering
    return (
      <div
        className="absolute z-20 flex flex-row gap-1"
        style={{ left: at.x, top: at.y }}
        {...(hovering
          ? {
              onMouseEnter: () => {
                onBtns.current = true
                clearTimeout(drop.current)
                clearTimeout(swap.current)
              },
              onMouseLeave: () => {
                onBtns.current = false
                drop.current = window.setTimeout(() => {
                  cur.current = null
                  setHover(null)
                }, 150)
              },
            }
          : {})}
      >
        {/* the part spoken about keeps its buttons right there; the mic pressed turns into Stop */}
        <button onClick={() => on.say(p)} title={stop ? 'Stop' : 'Speak a comment'} className={stop ? 'grid size-7 place-items-center rounded-lg bg-red-600 text-white shadow-sm ring-1 ring-red-700' : btn}>
          <Icon n={stop ? 'stop' : 'mic'} c="size-4" />
        </button>
        {stop ? null : (
          <button onClick={() => on.pick(p)} title="Comment" className={btn}>
            <Icon n="comment" c="size-4" />
          </button>
        )}
      </div>
    )
  }
  return (
    // edge to edge: on the phone across the sheet's side margins too
    <div ref={root} className="relative -mx-4 mt-3 lg:mx-0 lg:mt-0">
      {/* the page as it is: no frame around it, and no tooltip over all of it (a name for screen readers only) */}
      <iframe ref={frame} aria-label={title} sandbox="allow-scripts allow-popups allow-forms" srcDoc={html + PAGE_HELPER} style={{ height }} className="block w-full bg-white" />
      {elsewhere.length ? (
        <div className="mt-6 space-y-4 border-t border-zinc-200 px-4 pt-4 dark:border-zinc-800">
          <div className="text-xs font-medium text-zinc-500">Not on the page now</div>
          {elsewhere.map((t) => (
            <section key={t.tk}>
              <div className="line-clamp-2 text-sm text-zinc-400">“{plainQuote(t.quote)}”</div>
              {renderThread(t.tk, false)}
            </section>
          ))}
        </div>
      ) : null}
      {hover && mode === true && !held ? ring('hover', hover.rect, 'ring-blue-500') : null}
      {held && rects[held.key] ? ring(held.key, rects[held.key], 'ring-amber-300') : null}
      {amber.map((k) => ring(k, rects[k], 'ring-amber-400'))}
      {desk && held && rects[held.key] ? buttons(held, rects[held.key], false) : hover && mode === true && !held ? buttons(hover, hover.rect, true) : null}
      {counts.map((c) => (
        <button
          key={c.tk}
          data-count={c.tk}
          {...(c.draft ? { 'data-draft': '' } : {})}
          onClick={() => on.toggle(c.tk)}
          style={{ top: c.top, left: c.left }}
          onMouseEnter={() => setLit(c.key)}
          onMouseLeave={() => setLit(null)}
          className={`absolute z-10 flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-lg px-1.5 text-xs font-semibold shadow-sm ${
            c.done
              ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              : 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/80 dark:text-amber-100 dark:hover:bg-amber-800/80'
          }`}
        >
          <Icon n={c.done ? 'check' : 'comment'} c="size-3.5" />
          {c.n}
        </button>
      ))}
      {opened && rects[opened.key] ? (
        // the comments open right under their part (outlined), its right edges lined up
        <div
          ref={pop}
          className={`absolute z-20 flex flex-col gap-2 text-sm shadow-xl ${desk ? 'w-80 max-w-full' : 'inset-x-0 mx-1'}`}
          style={{ top: rects[opened.key].y + rects[opened.key].h + 8, ...(desk ? { left: Math.max(0, rects[opened.key].x + rects[opened.key].w - 320) } : {}) }}
        >
          {renderThread(opened.tk, true)}
        </div>
      ) : null}
      {!desk && held && rects[held.key] ? (
        // on the phone a tap picks the part; under it, the same speak and type buttons as under a paragraph
        <div className="absolute inset-x-0 z-10 mx-1 rounded-xl bg-white p-1.5 pr-3 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-900 dark:ring-white/10" style={{ top: rects[held.key].y + rects[held.key].h + 10 }}>
          {sayRow}
        </div>
      ) : null}
    </div>
  )
}
