// T457, R488, #6481: a demo plays the real page by itself, as a person would. A demo is only data (demo/demo.tsx):
// where to start and its steps (a tap, words typed, a key, speaking, the agent writing back); this player does every
// demo the same way. The page runs on the real Taska server in the page (story-server.js), so each tap really
// changes what Taska keeps. The phone and the desktop play side by side, step by step together. Each tap shows a
// large mark that presses and ripples where the finger lands (finger.ts); the steps take the time a person takes. What each step does is said in a bar under the frames, never over them; the frames keep
// one size. Play again starts over. T456 (#5879): with Autoplay off, each tap waits for yours, in either frame.
import { useEffect, useMemo, useRef, useState } from 'react'
import { App, pageIn, wait } from '../pages/screens'
import { PACE, drag, flick, pasteIn, press, selectIn, swipe, touch, typeIn } from './finger'

export type On = 'phone' | 'desktop'
/** Where to tap: a CSS selector; or one with the words the element shows, or the n-th of them (1 = the first); per
 * device when they differ. */
export type Sel = string | [string, string | number]
export type Place = Sel | Partial<Record<On, Sel>>
export interface Step {
  /** what this step does, in a few words: the line under the frames */
  say: string
  /** tap here (the mark comes, the finger presses, the page answers) */
  tap?: Place
  /** with a key held while tapping (the desktop's Cmd-click, Shift-click) */
  hold?: 'Meta' | 'Shift'
  /** drag what `tap` names onto this (the desktop's mouse), dropping it before, into or after it */
  onto?: Place
  drop?: 'before' | 'into' | 'after'
  /** swipe across this, `by` px (right when more than 0) */
  swipe?: Place
  by?: number
  /** type these words, letter by letter, into the box, or into this field */
  type?: string
  into?: Place
  /** paste this picture into the box, as from the clipboard (one of Storybook's saved files) */
  paste?: string
  /** press this key, with Meta+ / Shift+ in front for a chord ("Meta+k", "Shift+Enter") */
  key?: string
  /** speak for this many seconds (the microphone, already on, hears Storybook's sentence) */
  speak?: number
  /** scroll this to its end, as a finger flicks up (to see what came in below) */
  scroll?: Place
  /** select these words in `into` (a sent input's words, a document's paragraph), as a finger drags over them */
  select?: string
  /** an agent writes to Taska in its own commands (the /agent language), as claude-code */
  agent?: string
  /** an agent reads this (a card, /next): Taska marks what it read */
  read?: string
  /** the connection to Taska goes away (false) or comes back (true) */
  online?: boolean
  /** the organizer files the newest input with these commands */
  organize?: string
  /** right after the step before, as a person confirms a tap (Delete, then Delete again) */
  soon?: boolean
  /** a step only one of the two does (a swipe on the phone, a shortcut on the desktop) */
  on?: On
}
export interface Demo {
  /** where the page opens; the Shop project's item list when left out */
  path?: string
  /** a demo of something only one of them has */
  on?: On
  /** what happened before the demo starts, in the agents' commands (lines "you: ..." are Yadong's own) */
  before?: string
  /** what the microphone says in this demo: one of Storybook's spoken sentences (fixtures/said-<clip>.webm, made by
   * story_fixtures.py --said) and its words, which the speech model hears; else Storybook's own sentence */
  said?: { clip: string; words: string }
  /** more of the speech model's answer (what may be misheard...) */
  heard?: Record<string, unknown>
  steps: Step[]
  /** the last line, once it is all done */
  done: string
}

const SIZE: Record<On, [number, number]> = { phone: [393, 852], desktop: [1440, 900] }

interface Frame {
  on: On
  doc: Document
  server: {
    agent: (project: string, text: string) => string
    organize: (project: string, plan: string) => void
    read: (project: string, path: string) => void
    online: (on: boolean) => void
  }
}
const FILES = '/storybook/fixtures/' // Storybook's saved files (pictures, voice notes)
const project = (path = '') => /^\/p\/([^/]+)/.exec(path)?.[1] || 'shop'

/** What the step taps, on this frame: waits for it to show; null when it never does. */
async function find(f: Frame, place: Place): Promise<HTMLElement | null> {
  const sel: Sel | undefined =
    typeof place === 'string' || Array.isArray(place) ? place : (place as Partial<Record<On, Sel>>)[f.on]
  if (!sel) return null
  const [css, which] = typeof sel === 'string' ? [sel, ''] : sel
  for (let t = 0; t < PACE.find; t += 100) {
    const shown = [...f.doc.querySelectorAll<HTMLElement>(css)].filter((e) => e.getClientRects().length)
    const el =
      typeof which === 'number'
        ? shown[which - 1]
        : shown.find((e) => !which || (e.textContent || e.getAttribute('aria-label') || '').includes(which))
    if (el) return el
    await wait(100)
  }
  return null
}

export function DemoPlayer({ demo, scheme }: { demo: Demo; scheme: string }) {
  const ons = useMemo<On[]>(() => (demo.on ? [demo.on] : ['phone', 'desktop']), [demo.on])
  const boxes = useRef<Partial<Record<On, HTMLDivElement | null>>>({})
  const [line, setLine] = useState('') // #5879: no "Starting" while the page loads: the first step says itself
  const [state, setState] = useState<{ step: number; how: 'playing' | 'waiting' | 'done' | 'failed' }>({
    step: 0,
    how: 'playing',
  })
  const start = useRef<() => void>(() => {})
  const [run, setRun] = useState(0)
  const [auto, setAuto] = useState(true)
  const autoNow = useRef(true)
  // the frames as big as the room holds with the bar under them, fixed once: they never move or change size. The
  // phone is the one Yadong holds: it gets the height there is, the desktop the width left beside it.
  const [scale] = useState(() => {
    const h = Math.max(320, innerHeight - 32 - 136),
      w = innerWidth - 32
    const phone = ons.includes('phone') ? Math.min(1, h / SIZE.phone[1], w / SIZE.phone[0]) : 0
    const left = w - (phone ? SIZE.phone[0] * phone + 24 : 0)
    return { phone, desktop: Math.min(1, h / SIZE.desktop[1], left / SIZE.desktop[0]) }
  })
  useEffect(() => {
    let stop = false
    const pause = (ms: number) => (stop ? new Promise<void>(() => {}) : (wait(ms) as Promise<void>))
    const go = async () => {
      setState({ step: 0, how: 'playing' })
      setLine('')
      const frames: Frame[] = []
      for (const on of ons) {
        const f = await pageIn(boxes.current[on]!)
        const win = f?.contentWindow as
          (Window & typeof globalThis & { __storyServer?: Promise<Frame['server']> }) | null
        if (!f?.contentDocument || !win?.__storyServer || stop) return
        frames.push({ on, doc: f.contentDocument, server: await win.__storyServer })
      }
      // a voice note needs sound, and a browser lets a page have it only after you clicked or tapped there
      const mute = frames.some((f) => {
        const a = new (f.doc.defaultView as Window & typeof globalThis).AudioContext(),
          ok = a.state === 'running'
        void a.close()
        return !ok
      })
      if (demo.steps.some((s) => s.speak) && mute) {
        setLine('Tap Play: this demo records a voice note, and the browser gives a page sound only after a tap')
        setState({ step: 0, how: 'waiting' })
        await new Promise<void>((ok) => (start.current = ok))
        if (stop) return
      }
      const fail = (i: number, why: string) => {
        setLine(`Step ${i + 1} could not be played: ${why}`)
        setState({ step: i, how: 'failed' })
      }
      const steps = demo.steps
      setLine(`1 / ${steps.length} · ${steps[0].say}`)
      await pause(PACE.start)
      for (const [i, s] of steps.entries()) {
        const here = frames.filter((f) => !s.on || s.on === f.on)
        setState({ step: i + 1, how: 'playing' })
        setLine(`${i + 1} / ${steps.length} · ${s.say}`)
        await pause(s.soon ? PACE.press : i ? PACE.read : PACE.read / 2)
        if (s.tap && s.onto) {
          const from = await Promise.all(here.map((f) => find(f, s.tap!))),
            to = await Promise.all(here.map((f) => find(f, s.onto!)))
          if (from.includes(null) || to.includes(null)) return fail(i, 'nothing to drag, or nowhere to drop it')
          await Promise.all(from.map((el, k) => drag(el!, to[k]!, pause, s.drop)))
        } else if (s.tap) {
          const els = await Promise.all(here.map((f) => find(f, s.tap!)))
          const missing = here.find((_, k) => !els[k])
          if (missing) return fail(i, `nothing to tap on the ${missing.on}`)
          // Autoplay off: the step waits for your tap in either frame, and the other frame follows
          const yours = autoNow.current
            ? undefined
            : Promise.race(
                here.map(
                  (f, k) =>
                    new Promise<Frame>((ok) =>
                      els[k]!.addEventListener('click', (e) => e.isTrusted && ok(f), { once: true, capture: true }),
                    ),
                ),
              )
          await Promise.all(
            here.map((f, k) =>
              touch(
                els[k]!,
                pause,
                yours?.then((who) => who === f),
                s.hold,
              ),
            ),
          )
        }
        if (s.swipe) {
          const els = await Promise.all(here.map((f) => find(f, s.swipe!)))
          const missing = here.find((_, k) => !els[k])
          if (missing) return fail(i, `nothing to swipe on the ${missing.on}`)
          await Promise.all(els.map((el) => swipe(el!, s.by || 0, pause)))
        }
        if (s.scroll) {
          const els = await Promise.all(here.map((f) => find(f, s.scroll!)))
          if (els.includes(null)) return fail(i, 'nothing to scroll')
          await Promise.all(els.map((el) => flick(el!, pause)))
        }
        if (s.select != null) {
          const els = await Promise.all(here.map((f) => find(f, s.into || '#text')))
          const done = await Promise.all(els.map((el) => el && selectIn(el, s.select!, pause)))
          if (done.includes(false) || done.includes(null)) return fail(i, `no "${s.select}" to select`)
        }
        if (s.type != null) {
          const fields = await Promise.all(here.map((f) => (s.into ? find(f, s.into) : f.doc.querySelector('#text'))))
          const typed = await Promise.all(here.map((f, k) => typeIn(f.doc, s.type!, pause, fields[k])))
          if (typed.includes(false)) return fail(i, 'nowhere to type')
        }
        if (s.paste && (await Promise.all(here.map((f) => pasteIn(f.doc, FILES + s.paste)))).includes(false))
          return fail(i, 'no box to paste in')
        if (s.key) await Promise.all(here.map((f) => press(f.doc, s.key!, pause)))
        if (s.speak) await pause(s.speak * 1000)
        try {
          if (s.agent) for (const f of here) f.server.agent(project(demo.path), s.agent)
          if (s.read) for (const f of here) f.server.read(project(demo.path), s.read)
          if (s.online != null)
            for (const f of here) {
              f.server.online(s.online)
              f.doc.defaultView?.dispatchEvent(new Event(s.online ? 'online' : 'offline')) // as the browser says it
            }
          if (s.organize) for (const f of here) f.server.organize(project(demo.path), s.organize)
          // you look at the page: a page you are not in asks Taska for news every few seconds; one you look at, now
          if (s.agent || s.organize || s.read)
            for (const f of here) f.doc.defaultView?.dispatchEvent(new Event('focus'))
        } catch (ex) {
          return fail(i, String(ex))
        }
        if (stop) return
        await pause(steps[i + 1]?.soon ? PACE.press : s.agent || s.organize ? PACE.agent : PACE.settle)
      }
      setLine(`Done · ${demo.done}`)
      setState({ step: steps.length, how: 'done' })
    }
    void go()
    return () => {
      stop = true
    }
  }, [run, demo, ons])
  // the demo's own beginning, carried to the page with its address (story-server.js does it before the page asks)
  const seed = JSON.stringify({
    project: project(demo.path),
    before: demo.before || '',
    heard: { ...(demo.said ? { tr: demo.said.words } : {}), ...demo.heard },
    mic: demo.said?.clip,
  })
  // R488, r679: the pages in frames of a fixed size, the words under them with room between; nothing moves or
  // changes size while it plays
  return (
    <div
      className="flex min-h-screen flex-col items-center bg-zinc-100 py-4 dark:bg-zinc-900"
      data-demo-step={state.step}
      data-demo-state={state.how}
    >
      <div className="flex items-start gap-6" key={run}>
        {ons.map((on) => {
          const [w, h] = SIZE[on],
            k = scale[on]
          return (
            <div
              key={on}
              className="shrink-0 overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
              style={{ width: w * k, height: h * k }}
            >
              <div
                ref={(el) => void (boxes.current[on] = el)}
                className="[&_iframe]:h-full"
                style={{ width: w, height: h, transform: `scale(${k})`, transformOrigin: '0 0' }}
              >
                <App path={demo.path || '/p/shop/'} scheme={scheme} server={seed} />
              </div>
            </div>
          )
        })}
      </div>
      <div
        className="mt-4 flex h-[104px] w-full max-w-xl shrink-0 flex-col gap-2 rounded-2xl bg-zinc-900 p-3 text-white dark:bg-zinc-800"
        role="status"
      >
        <span
          className={`line-clamp-2 h-10 text-sm leading-snug font-medium ${state.how === 'failed' ? 'text-red-300' : ''}`}
        >
          {line}
        </span>
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
            onClick={() => (state.how === 'waiting' ? start.current() : setRun((n) => n + 1))}
            className="h-9 shrink-0 rounded-full bg-white px-3 text-sm font-semibold text-zinc-900 disabled:opacity-40"
            disabled={state.how === 'playing'}
          >
            {state.how === 'waiting' ? 'Play' : 'Play again'}
          </button>
        </div>
      </div>
    </div>
  )
}
