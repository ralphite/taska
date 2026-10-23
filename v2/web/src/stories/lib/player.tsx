// T457, R488: a demo plays the real page by itself, as a person would: each tap shows a large, clear mark where the
// finger lands, and the steps take the time they take for a person (look, move, tap, wait for the page). What each
// step does is said in a bar under the page, with room between, never over it; the page keeps one size. Play again
// starts it over.
import { useEffect, useRef, useState } from 'react'
import { App, pageIn, wait } from '../pages/screens'

export interface Ctx {
  doc: Document
  /** say what this step does, in the bar above the page */
  say: (text: string) => void
  /** find something on the page (waits for it to show) */
  find: (sel: string, text?: string) => Promise<HTMLElement | null>
  /** tap it: the mark comes, the finger presses, the page answers */
  tap: (el: HTMLElement | null) => Promise<void>
  /** type words into the box, letter by letter */
  type: (text: string) => Promise<void>
  wait: (ms: number) => Promise<void>
}
export type Script = (c: Ctx) => Promise<void>

const MARK = 64 // px: the tap mark, big enough to see at a glance on the phone
function mark(doc: Document) {
  let m = doc.getElementById('demoTap')
  if (!m) {
    m = doc.createElement('div')
    m.id = 'demoTap'
    m.setAttribute('aria-hidden', 'true')
    Object.assign(m.style, {
      position: 'fixed',
      zIndex: '2147483647',
      width: MARK + 'px',
      height: MARK + 'px',
      margin: `-${MARK / 2}px 0 0 -${MARK / 2}px`,
      borderRadius: '50%',
      background: 'rgba(37, 99, 235, 0.28)',
      border: '3px solid rgba(37, 99, 235, 0.9)',
      boxShadow: '0 0 0 6px rgba(255, 255, 255, 0.7)',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'left 450ms ease, top 450ms ease, opacity 200ms ease, transform 160ms ease',
    })
    doc.body.append(m)
  }
  return m
}

export function Player({ path, script, scheme }: { path: string; script: Script; scheme: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [line, setLine] = useState('Starting…')
  const [run, setRun] = useState(0)
  const [done, setDone] = useState(false)
  useEffect(() => {
    let stop = false
    const go = async () => {
      setDone(false)
      const f = box.current && (await pageIn(box.current))
      const doc = f?.contentDocument
      if (!doc || stop) return
      const c: Ctx = {
        doc,
        wait: (ms) => (stop ? new Promise<void>(() => {}) : (wait(ms) as Promise<void>)),
        say: (t) => !stop && setLine(t),
        find: async (sel, text) => {
          for (let i = 0; i < 60; i++) {
            const el = [...doc.querySelectorAll<HTMLElement>(sel)].find(
              (e) => e.offsetParent && (!text || (e.textContent || '').includes(text)),
            )
            if (el) return el
            await wait(100)
          }
          return null
        },
        tap: async (el) => {
          if (!el || stop) return
          el.scrollIntoView({ block: 'nearest' })
          const r = el.getBoundingClientRect(),
            m = mark(doc)
          m.style.left = r.left + r.width / 2 + 'px'
          m.style.top = r.top + r.height / 2 + 'px'
          m.style.opacity = '1'
          await c.wait(700) // the eye finds the spot before the finger lands
          m.style.transform = 'scale(0.82)'
          const at = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
          el.dispatchEvent(new PointerEvent('pointerdown', { ...at, pointerType: 'touch' }))
          await c.wait(120)
          el.dispatchEvent(new PointerEvent('pointerup', { ...at, pointerType: 'touch' }))
          el.click()
          m.style.transform = 'scale(1)'
          await c.wait(500)
          m.style.opacity = '0'
          await c.wait(900) // the page answers, and you see what changed
        },
        type: async (text) => {
          const t = doc.querySelector<HTMLTextAreaElement>('#text')
          if (!t) return
          t.focus()
          for (const ch of text) {
            t.value += ch
            t.dispatchEvent(new Event('input', { bubbles: true }))
            await c.wait(90)
          }
        },
      }
      await script(c)
      if (!stop) setDone(true)
    }
    void go()
    return () => {
      stop = true
    }
  }, [run, script])
  // R488, r679: the page in a frame of a fixed size (a phone), the words under it with room between; nothing moves
  // or changes size while it plays
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-100 py-4 dark:bg-zinc-900">
      <div
        ref={box}
        key={run}
        className="h-[760px] w-[393px] shrink-0 overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950 [&_iframe]:h-full"
      >
        <App path={path} scheme={scheme} />
      </div>
      <div className="mt-4 flex h-16 w-[393px] shrink-0 items-center gap-3 rounded-2xl bg-zinc-900 px-4 text-white dark:bg-zinc-800">
        <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-medium">{line}</span>
        <button
          onClick={() => setRun((n) => n + 1)}
          className="h-9 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-zinc-900 disabled:opacity-40"
          disabled={!done}
        >
          Play again
        </button>
      </div>
    </div>
  )
}
