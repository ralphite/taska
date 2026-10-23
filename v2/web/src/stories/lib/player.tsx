// T457, R488: a demo plays the real page by itself, as a person would: each tap shows a large, clear mark where the
// finger lands, and the steps take the time they take for a person (look, move, tap, wait for the page). What each
// step does is said in a bar under the page, with room between, never over it; the page keeps one size. Play again
// starts it over. T456 (#5879): Autoplay can be switched off: then each step marks where to tap and waits for your
// own tap there.
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
  /** a prototype has drawn its parts on the page: show it (until then the frame is blank, with `veil`) */
  show: () => void
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
      // T456: it shows where the finger lands, never sliding there from the last tap
      transition: 'opacity 200ms ease, transform 160ms ease',
    })
    doc.body.append(m)
  }
  return m
}

/** The page inside, the moment its list is drawn (nothing more to wait for: it is not shown yet) */
async function listIn(canvas: HTMLElement) {
  const f = canvas.querySelector('iframe')
  for (let i = 0; i < 300 && !f?.contentDocument?.querySelector('#list [data-n]'); i++) await wait(30)
  await new Promise((r) => requestAnimationFrame(r))
  return f
}

// the phone, or (F479) the desktop, scaled down to the room there is; T456: the prototypes' phone is the whole
// iPhone screen (393x852)
const SIZE = { phone: [393, 760], iphone: [393, 852], desktop: [1440, 900] } as const
export function Player({
  path,
  script,
  scheme,
  on = 'phone',
  veil = false,
}: {
  path: string
  script: Script
  scheme: string
  on?: keyof typeof SIZE
  /** T456: a prototype changes the page before you see it: the page shows once its script calls show(), never
   * first as it was and then changed in front of you */
  veil?: boolean
}) {
  const [W, H] = SIZE[on]
  const box = useRef<HTMLDivElement>(null)
  const [line, setLine] = useState('') // #5879: no "Starting" while the page loads: the first step says itself
  const [run, setRun] = useState(0)
  const [done, setDone] = useState(false)
  const [hidden, setHidden] = useState(veil)
  const [auto, setAuto] = useState(true)
  const autoNow = useRef(true)
  // the frame as tall as the room holds with the bar under it, fixed once: it never moves or changes size
  const [scale] = useState(() =>
    Math.min(1, (window.innerWidth - 32) / W, Math.max(0.5, (window.innerHeight - 32 - 136) / H)),
  )
  useEffect(() => {
    let stop = false
    const go = async () => {
      setDone(false)
      setHidden(veil)
      const f = box.current && (await (veil ? listIn(box.current) : pageIn(box.current)))
      const doc = f?.contentDocument
      if (!doc || stop) return
      const c: Ctx = {
        doc,
        wait: (ms) => (stop ? new Promise<void>(() => {}) : (wait(ms) as Promise<void>)),
        show: () => !stop && setHidden(false),
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
          if (!autoNow.current) {
            // you tap it yourself: the mark breathes where to tap until you do
            const breathe = m.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], {
              duration: 1400,
              iterations: Infinity,
            })
            await new Promise<void>((done) => el.addEventListener('click', () => done(), { once: true, capture: true }))
            breathe.cancel()
            m.style.opacity = '0'
            await c.wait(900)
            return
          }
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
  }, [run, script, veil])
  // R488, r679: the page in a frame of a fixed size (a phone), the words under it with room between; nothing moves
  // or changes size while it plays
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-100 py-4 dark:bg-zinc-900">
      <div
        className="shrink-0 overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
        style={{ width: W * scale, height: H * scale }}
      >
        <div
          ref={box}
          key={run}
          className={`[&_iframe]:h-full ${hidden ? 'opacity-0' : ''}`}
          style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        >
          <App path={path} scheme={scheme} />
        </div>
      </div>
      <div
        className="mt-4 flex h-[104px] shrink-0 flex-col gap-2 rounded-2xl bg-zinc-900 p-3 text-white dark:bg-zinc-800"
        style={{ width: W * scale }}
      >
        <span className="line-clamp-2 h-10 text-sm leading-snug font-medium">{line}</span>
        <div className="flex items-center gap-2">
          <button
            role="switch"
            aria-checked={auto}
            onClick={() => {
              autoNow.current = !auto
              setAuto(!auto)
            }}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-xs font-semibold"
          >
            <span className={`flex h-4 w-7 items-center rounded-full p-0.5 ${auto ? 'bg-blue-500' : 'bg-zinc-500'}`}>
              <span className={`size-3 rounded-full bg-white transition-transform ${auto ? 'translate-x-3' : ''}`} />
            </span>
            Autoplay
          </button>
          <button
            onClick={() => setRun((n) => n + 1)}
            className="h-9 shrink-0 rounded-full bg-white px-3 text-sm font-semibold text-zinc-900 disabled:opacity-40"
            disabled={!done}
          >
            Play again
          </button>
        </div>
      </div>
    </div>
  )
}
