// Shared guide parts for prototypes: find a target by its role, name or words, mark where to tap, describe the step
// below the screen, and show a simulated microphone level. Each prototype owns its steps and transitions.
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

/** Where to tap next, as guided tours on the web mark it (F566, r970/r1004): a round, see-through yellow spot laid over
 * the part the step names, a colour and shape Taska itself never uses: no frame, no words, nothing dimmed. It is
 * there at once, follows the part wherever it goes, and takes no clicks (they reach the part under it). */
export function Mark({ root, step }: { root: RefObject<HTMLElement | null>; step: Step | null }) {
  const [at, setAt] = useState<{ x: number; y: number; d: number } | null>(null)
  useLayoutEffect(() => {
    let raf = 0
    const follow = () => {
      const r = root.current
      const el = r && step ? find(r, step.tap) : null
      if (!r || !el) setAt((a) => (a ? null : a))
      else {
        const a = r.getBoundingClientRect()
        const b = el.getBoundingClientRect()
        const n = { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2, d: Math.max(44, Math.min(b.width, b.height) + 20) }
        setAt((p) => (p && Math.abs(p.x - n.x) < 0.5 && Math.abs(p.y - n.y) < 0.5 && Math.abs(p.d - n.d) < 0.5 ? p : n))
      }
      raf = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(raf)
  }, [root, step])
  return at ? (
    <span
      data-guide-mark
      className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-yellow-300/60 mix-blend-multiply dark:mix-blend-screen"
      style={{ left: at.x, top: at.y, width: at.d, height: at.d }}
    />
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
