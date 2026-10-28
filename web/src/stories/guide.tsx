// The guide through a prototype or a demo (F566, R488, B524): one list of steps, each saying what it does, what to tap
// (found on the screen by its role and name, or its words, as you would find it) and, when it says so, what the
// screen shows once it is done. A big blue mark is on that part at once and stays on it wherever it goes; a step is
// done when the screen shows what it should (however you got there), or when its part is tapped; steps already done
// are skipped; a part that cannot be found is said under the screen, never tapped blindly. Two ways through: you tap
// (guided, the default) or it taps for you at a person's pace (autoplay, only in demos: R577). What the step does is
// said under the screen, with Start again. And how loud you speak while it listens. Used by the prototypes and demos.
import { useLayoutEffect, useState, type RefObject } from 'react'

/** What to tap: a part by its role and name (as a screen reader finds it), by its words, by a CSS selector, or found
 * by a function of the screen. */
export type Target = string | { role?: string; name?: string | RegExp; text?: string } | ((root: HTMLElement) => Element | null)

/** A step of the way through: what it does, what to tap, and what the screen shows once it is done. */
export interface Step {
  say: string
  tap?: Target
  /** done when this is true of the screen (else: once its part is tapped) */
  until?(root: HTMLElement): boolean
}

const ROLE: Record<string, string> = { button: 'button, [role="button"]', link: 'a[href], [role="link"]', tab: '[role="tab"]', textbox: 'textarea, input, [role="textbox"]' }
const nameOf = (e: Element) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim()
const shown = (e: Element) => {
  const r = e.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'
}

/** The part a target names on the screen, if it is there and shown. */
export function find(root: HTMLElement, t: Target | undefined): Element | null {
  if (!t) return null
  if (typeof t === 'function') return t(root)
  if (typeof t === 'string') return [...root.querySelectorAll(t)].find(shown) ?? null
  const all = [...root.querySelectorAll(t.role ? ROLE[t.role] || `[role="${t.role}"]` : '*')].filter(shown)
  const match = (e: Element) => {
    const n = nameOf(e)
    if (t.name instanceof RegExp) return t.name.test(n)
    if (t.name != null) return n === t.name || n.startsWith(t.name)
    return !!t.text && n.includes(t.text)
  }
  // by its words: the smallest part that has them
  const hits = all.filter(match)
  return t.role ? (hits[0] ?? null) : (hits.find((e) => !hits.some((o) => o !== e && e.contains(o))) ?? null)
}
export const sel = (q: string): Target => q
export const withText = (q: string, text: string): Target => (root) => [...root.querySelectorAll(q)].find((e) => shown(e) && e.textContent?.includes(text)) || null

/** A big mark where to tap next, spreading out (R488): on the part the step names, at once, wherever it is now. */
export function Mark({ root, step }: { root: RefObject<HTMLElement | null>; step: Step | null }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    let raf = 0
    const follow = () => {
      const r = root.current
      const el = r && step ? find(r, step.tap) : null
      if (!r || !el) setAt((a) => (a ? null : a))
      else {
        const a = r.getBoundingClientRect()
        const b = el.getBoundingClientRect()
        const x = b.left - a.left + b.width / 2
        const y = b.top - a.top + b.height / 2
        setAt((p) => (p && Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5 ? p : { x, y }))
      }
      raf = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(raf)
  }, [root, step])
  return at ? (
    <span className="pointer-events-none absolute z-40 size-14 -translate-x-1/2 -translate-y-1/2" style={{ left: at.x, top: at.y }}>
      <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/30" />
      <span className="absolute inset-0 rounded-full border-4 border-blue-500" />
    </span>
  ) : null
}

/** What the step does, under the screen and apart from it (R488), whether its part is missing, and Start again. */
export function GuideLine({ n, total, say, missing = false, onAgain }: { n: number; total: number; say: string | undefined; missing?: boolean; onAgain(): void }) {
  return (
    <>
      <p className="flex min-h-10 items-center gap-3 text-sm text-zinc-700 dark:text-zinc-200">
        <span className="font-mono text-xs text-zinc-400">
          {Math.min(n + 1, total)} / {total}
        </span>
        <span className="flex-1">{say ?? 'That is all of it: tap anything, or start again.'}</span>
      </p>
      {say && missing ? <p className="text-xs text-red-600 dark:text-red-400">Step {n + 1}: what to tap is not on the screen now.</p> : null}
      <button onClick={onAgain} className="self-start rounded-full px-3 py-1.5 text-sm font-medium text-blue-600 ring-1 ring-blue-200 dark:text-blue-400 dark:ring-blue-400/30">
        Start again
      </button>
    </>
  )
}

/** How loud you speak, as the box's recording bar draws it. */
export const Level = () => (
  <span className="flex h-8 items-center gap-1">
    {[0.3, 0.6, 0.9, 0.5, 0.8, 0.4, 0.7, 0.3, 0.5].map((h, i) => (
      <span key={i} className="w-1 rounded-full bg-red-500 dark:bg-red-400" style={{ height: `${h * 100}%` }} />
    ))}
  </span>
)
